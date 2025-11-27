
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameAssets, GameState, Point, Enemy, PowerUp, PowerUpType } from '../types';
import { audioService } from '../services/audioService';

interface GameCanvasProps {
  assets: GameAssets;
  gameState: GameState;
  onGameOver: (win: boolean) => void;
  level: number;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
}

// Logic Constants
const GRID_WIDTH = 64;
const GRID_HEIGHT = 48;
const PLAYER_SPEED = 0.3; 
const ENEMY_SPEED = 0.2;
const BOSS_SPEED = 0.15;
const WIN_THRESHOLD = 0.80; // Updated per request for geometric bonus logic start
const LEVEL_TIME = 90; // Seconds

// Nord/Pastel Palette
const COLORS = {
  bg: '#2E3440',      // Polar Night Dark
  fog: 'rgba(46, 52, 64, 0.9)',
  trail: '#BF616A',   // Pastel Red (Nord Aurora)
  player: '#EBCB8B',  // Pastel Yellow
  playerInvincible: '#ECEFF4', // White-ish
  enemy: '#D08770',   // Pastel Orange
  boss: '#B48EAD',    // Pastel Purple
  safeBorder: 'rgba(136, 192, 208, 0.3)', // Faint blue
  powerups: {
    [PowerUpType.FREEZE]: '#88C0D0', // Cyan
    [PowerUpType.INVINCIBLE]: '#EBCB8B', // Gold
    [PowerUpType.EXTRA_LIFE]: '#BF616A', // Red
    [PowerUpType.TIME_BONUS]: '#A3BE8C'  // Green
  }
};

const GameCanvas: React.FC<GameCanvasProps> = ({ assets, gameState, onGameOver, level, score, setScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const gridRef = useRef<number[][]>([]); // 0: unowned, 1: owned/safe, 2: trail
  const playerRef = useRef<{ x: number; y: number; dir: Point }>({ x: 0, y: 0, dir: {x:0, y:0} });
  const enemiesRef = useRef<Enemy[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  
  // Game State Refs
  const livesRef = useRef(3);
  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>(0);
  
  // Timers and Status Effects
  const timeLeftRef = useRef(LEVEL_TIME);
  const frozenRef = useRef(0); // Timestamp until frozen
  const invincibleRef = useRef(0); // Timestamp until invincibility ends
  
  // React State for UI
  const [percent, setPercent] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeDisplay, setTimeDisplay] = useState(LEVEL_TIME);
  const [isCuttingMode, setIsCuttingMode] = useState(false);

  const initLevel = useCallback(() => {
    // 1. Setup Grid
    const newGrid = Array(GRID_HEIGHT).fill(0).map(() => Array(GRID_WIDTH).fill(0));
    for(let y=0; y<GRID_HEIGHT; y++) {
      for(let x=0; x<GRID_WIDTH; x++) {
        if (x===0 || x===GRID_WIDTH-1 || y===0 || y===GRID_HEIGHT-1) {
          newGrid[y][x] = 1;
        }
      }
    }
    gridRef.current = newGrid;

    // 2. Setup Player
    playerRef.current = { x: GRID_WIDTH/2, y: 0, dir: {x:0, y:0} };
    setIsCuttingMode(false);
    invincibleRef.current = 0;
    frozenRef.current = 0;

    // 3. Setup Enemies
    const enemies: Enemy[] = [];
    // Boss
    enemies.push({
      x: GRID_WIDTH/2,
      y: GRID_HEIGHT/2,
      vx: Math.random() > 0.5 ? BOSS_SPEED : -BOSS_SPEED,
      vy: Math.random() > 0.5 ? BOSS_SPEED : -BOSS_SPEED,
      type: 'boss',
      radius: 3.5 
    });
    // Minions
    const minionCount = 3 + level;
    for(let i=0; i<minionCount; i++) {
      enemies.push({
        x: Math.random() * (GRID_WIDTH-4) + 2,
        y: Math.random() * (GRID_HEIGHT-4) + 2,
        vx: Math.random() > 0.5 ? ENEMY_SPEED : -ENEMY_SPEED,
        vy: Math.random() > 0.5 ? ENEMY_SPEED : -ENEMY_SPEED,
        type: 'minion',
        radius: 1.2
      });
    }
    enemiesRef.current = enemies;
    powerUpsRef.current = [];

    // 4. Timer
    timeLeftRef.current = LEVEL_TIME;
    
    setPercent(0);
  }, [level]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initLevel();
      setLives(3);
      livesRef.current = 3;
    }
  }, [gameState, initLevel]);

  // --- Logic Helpers ---

  const spawnPowerUp = () => {
     // Try to spawn a powerup in void
     if (Math.random() > 0.005) return; // Low chance per frame
     if (powerUpsRef.current.length > 2) return; // Max 3 at a time

     const typeProb = Math.random();
     let type = PowerUpType.TIME_BONUS;
     if (typeProb < 0.25) type = PowerUpType.FREEZE;
     else if (typeProb < 0.5) type = PowerUpType.INVINCIBLE;
     else if (typeProb < 0.75) type = PowerUpType.EXTRA_LIFE;

     // Find valid spot
     let px = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
     let py = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;
     
     if (gridRef.current[py][px] === 0) {
        powerUpsRef.current.push({
            id: Date.now() + Math.random(),
            x: px,
            y: py,
            type
        });
     }
  };

  const applyPowerUp = (type: PowerUpType) => {
      const now = Date.now();
      audioService.playClaim(); // Use claim sound for powerup
      switch(type) {
          case PowerUpType.FREEZE:
              frozenRef.current = now + 5000; // 5s
              break;
          case PowerUpType.INVINCIBLE:
              invincibleRef.current = now + 7000; // 7s
              break;
          case PowerUpType.EXTRA_LIFE:
              livesRef.current++;
              setLives(livesRef.current);
              break;
          case PowerUpType.TIME_BONUS:
              timeLeftRef.current += 30;
              setTimeDisplay(Math.ceil(timeLeftRef.current));
              break;
      }
  };

  const floodFill = (grid: number[][], startX: number, startY: number, targetVal: number, replaceVal: number): number => {
    if (startX < 0 || startX >= GRID_WIDTH || startY < 0 || startY >= GRID_HEIGHT) return 0;
    if (grid[startY][startX] !== targetVal) return 0;

    const queue: Point[] = [{x: startX, y: startY}];
    grid[startY][startX] = replaceVal;
    let count = 0;

    while(queue.length > 0) {
      const p = queue.pop()!;
      count++;
      const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
      for(const d of dirs) {
        const nx = p.x + d[0];
        const ny = p.y + d[1];
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && grid[ny][nx] === targetVal) {
           grid[ny][nx] = replaceVal;
           queue.push({x: nx, y: ny});
        }
      }
    }
    return count;
  };

  const resolveFill = (currentPercent: number) => {
    const boss = enemiesRef.current.find(e => e.type === 'boss');
    if (!boss) return;

    const tempGrid = gridRef.current.map(row => [...row]);
    let startX = Math.floor(boss.x);
    let startY = Math.floor(boss.y);
    
    // Safety check if boss is on a line (rare but possible)
    if (tempGrid[startY][startX] !== 0) {
        const neighbors = [[0,1],[0,-1],[1,0], [-1,0]];
        for(const n of neighbors) {
            if (tempGrid[startY+n[1]]?.[startX+n[0]] === 0) {
                startX += n[0];
                startY += n[1];
                break;
            }
        }
    }

    // Mark the "Enemy Zone" as 3
    floodFill(tempGrid, startX, startY, 0, 3);

    let capturedCount = 0;
    const claimedPoints: Point[] = [];

    // Convert everything that is still 0 (isolated from boss) to 1
    for(let y=0; y<GRID_HEIGHT; y++) {
        for(let x=0; x<GRID_WIDTH; x++) {
            if (tempGrid[y][x] === 0) {
                gridRef.current[y][x] = 1; // Claimed
                capturedCount++;
                claimedPoints.push({x, y});
            }
        }
    }

    // Check for powerups in claimed area
    powerUpsRef.current = powerUpsRef.current.filter(p => {
        // If powerup pos is now 1, it's captured
        if (gridRef.current[p.y][p.x] === 1) {
            applyPowerUp(p.type);
            return false; // Remove from array
        }
        return true;
    });

    if (capturedCount > 0) {
        audioService.playClaim();
        
        // Geometric Scoring Logic
        // If percent is already high, points are worth way more
        // e.g. Base 10 per block.
        // Multiplier: 1 + (currentPercent * 2) -> Linear
        // Geometric Request: "geometric after 80%"
        let multiplier = 1;
        if (currentPercent > 0.8) {
            // Very high reward for cutting small pieces when map is nearly full
            multiplier = Math.pow(4, (currentPercent - 0.8) * 10); 
        }
        
        const addedScore = Math.floor(capturedCount * 10 * multiplier);
        setScore(s => s + addedScore);
    }
  };

  // --- Game Loop ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    
    let lastTime = Date.now();

    const update = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Update Timer
      timeLeftRef.current -= dt;
      if (timeLeftRef.current <= 0) {
          onGameOver(false);
          return;
      }
      setTimeDisplay(Math.ceil(timeLeftRef.current));

      const player = playerRef.current;
      const grid = gridRef.current;
      const isFrozen = now < frozenRef.current;

      spawnPowerUp();

      // 1. Handle Input
      let dx = 0;
      let dy = 0;

      if (keysPressed.current.has('ArrowUp')) dy = -1;
      else if (keysPressed.current.has('ArrowDown')) dy = 1;
      else if (keysPressed.current.has('ArrowLeft')) dx = -1;
      else if (keysPressed.current.has('ArrowRight')) dx = 1;

      if (dx !== 0 || dy !== 0) {
         player.dir = { x: dx, y: dy };
      }

      const currentGx = Math.round(player.x);
      const currentGy = Math.round(player.y);
      const isCurrentlyDrawing = grid[currentGy]?.[currentGx] === 2;

      if (dx !== 0 || dy !== 0) {
        const nextX = player.x + dx * PLAYER_SPEED;
        const nextY = player.y + dy * PLAYER_SPEED;

        if (nextX >= 0 && nextX <= GRID_WIDTH - 1 && nextY >= 0 && nextY <= GRID_HEIGHT - 1) {
            const gx = Math.round(nextX);
            const gy = Math.round(nextY);
            const isNextSafe = grid[gy][gx] === 1;

            if (isNextSafe) {
                player.x = nextX;
                player.y = nextY;
                if (isCurrentlyDrawing) {
                    // Finished Cut
                    let trailExists = false;
                    for(let y=0; y<GRID_HEIGHT;y++) {
                        for(let x=0; x<GRID_WIDTH;x++) {
                            if (grid[y][x] === 2) {
                              grid[y][x] = 1;
                              trailExists = true;
                            }
                        }
                    }
                    if (trailExists) {
                        // Calculate percent BEFORE resolve to use in scoring
                        let owned = 0;
                        for(let y=0; y<GRID_HEIGHT;y++) {
                            for(let x=0; x<GRID_WIDTH;x++) {
                                if (grid[y][x] === 1) owned++;
                            }
                        }
                        const p = owned / (GRID_WIDTH * GRID_HEIGHT);
                        resolveFill(p);
                    }
                }
            } else {
                if (isCuttingMode || isCurrentlyDrawing) {
                    player.x = nextX;
                    player.y = nextY;
                    grid[gy][gx] = 2; // Leave trail
                    audioService.playDraw();
                }
            }
        }
      }

      // 2. Update Enemies
      if (!isFrozen) {
          enemiesRef.current.forEach(enemy => {
            enemy.x += enemy.vx;
            enemy.y += enemy.vy;

            // Bounce off Claimed Area
            const checkCollision = (x: number, y: number) => {
                 const gx = Math.floor(x);
                 const gy = Math.floor(y);
                 if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) return true;
                 return grid[gy][gx] === 1;
            };

            if (checkCollision(enemy.x + enemy.vx, enemy.y)) enemy.vx *= -1;
            if (checkCollision(enemy.x, enemy.y + enemy.vy)) enemy.vy *= -1;

            // Collision with Trail or Player
            const gx = Math.floor(enemy.x);
            const gy = Math.floor(enemy.y);
            const hitTrace = (gx >=0 && gx < GRID_WIDTH && gy >= 0 && gy < GRID_HEIGHT && grid[gy][gx] === 2);
            const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            
            const playerGx = Math.round(player.x);
            const playerGy = Math.round(player.y);
            const isPlayerSafe = grid[playerGy][playerGx] === 1;
            const isPlayerInvincible = now < invincibleRef.current;

            if (hitTrace && !isPlayerInvincible) {
               handleDeath();
            } else if (distToPlayer < (enemy.radius + 0.5) && !isPlayerInvincible) {
               if (!isPlayerSafe) {
                  handleDeath();
               }
            }
          });
      }

      // 3. Calculate Percent
      let owned = 0;
      const total = GRID_WIDTH * GRID_HEIGHT;
      for(let y=0; y<GRID_HEIGHT;y++) {
        for(let x=0; x<GRID_WIDTH;x++) {
            if (grid[y][x] === 1) owned++;
        }
      }
      const p = owned / total;
      setPercent(p);

      if (p >= WIN_THRESHOLD) {
          audioService.playWin();
          onGameOver(true);
      }
    };

    const handleDeath = () => {
        audioService.playDie();
        livesRef.current -= 1;
        setLives(livesRef.current);
        
        // Clear trail
        const grid = gridRef.current;
        for(let y=0; y<GRID_HEIGHT;y++) {
            for(let x=0; x<GRID_WIDTH;x++) {
                if (grid[y][x] === 2) grid[y][x] = 0;
            }
        }
        
        playerRef.current.x = GRID_WIDTH / 2;
        playerRef.current.y = 0;
        playerRef.current.dir = {x:0, y:0};
        setIsCuttingMode(false);

        if (livesRef.current <= 0) {
            onGameOver(false);
        }
    };

    const loop = () => {
      update();
      draw();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    
    // Draw Function
    const draw = () => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        
        const CW = cvs.width;
        const CH = cvs.height;
        const cellW = CW / GRID_WIDTH;
        const cellH = CH / GRID_HEIGHT;

        // 1. Background
        if (assets.background) {
            const img = new Image();
            img.src = assets.background;
            ctx.drawImage(img, 0, 0, CW, CH);
        } else {
            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(0,0,CW,CH);
        }

        // 2. Fog
        ctx.fillStyle = COLORS.fog;
        ctx.beginPath();
        for(let y=0; y<GRID_HEIGHT; y++) {
            for(let x=0; x<GRID_WIDTH; x++) {
                if (gridRef.current[y][x] === 0 || gridRef.current[y][x] === 2) {
                    ctx.rect(x * cellW, y * cellH, cellW, cellH);
                }
            }
        }
        ctx.fill();

        // 3. Trail
        ctx.fillStyle = COLORS.trail;
        for(let y=0; y<GRID_HEIGHT; y++) {
            for(let x=0; x<GRID_WIDTH; x++) {
                if (gridRef.current[y][x] === 2) {
                    ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
                }
            }
        }

        // 4. Powerups
        powerUpsRef.current.forEach(p => {
             const px = p.x * cellW;
             const py = p.y * cellH;
             ctx.fillStyle = COLORS.powerups[p.type];
             // Simple shape for powerup
             ctx.beginPath();
             ctx.arc(px + cellW/2, py + cellH/2, cellW, 0, Math.PI*2);
             ctx.fill();
             ctx.strokeStyle = '#FFF';
             ctx.lineWidth = 2;
             ctx.stroke();
             
             // Icon char
             ctx.fillStyle = '#FFF';
             ctx.font = '10px monospace';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             let char = '?';
             if (p.type === PowerUpType.FREEZE) char = '❄';
             else if (p.type === PowerUpType.INVINCIBLE) char = '★';
             else if (p.type === PowerUpType.EXTRA_LIFE) char = '♥';
             else if (p.type === PowerUpType.TIME_BONUS) char = 'T';
             ctx.fillText(char, px + cellW/2, py + cellH/2);
        });
        
        // 5. Player
        const px = playerRef.current.x * cellW;
        const py = playerRef.current.y * cellH;
        const isInvincible = Date.now() < invincibleRef.current;

        if (assets.player) {
            const pImg = new Image();
            pImg.src = assets.player;
            ctx.save();
            if (isInvincible) {
                ctx.globalAlpha = 0.6 + Math.sin(Date.now()/50)*0.4;
            }
            ctx.drawImage(pImg, px - 12, py - 12, 24 + cellW, 24 + cellH);
            ctx.restore();
        } else {
            ctx.fillStyle = isInvincible ? COLORS.playerInvincible : COLORS.player;
            ctx.fillRect(px, py, cellW, cellH);
        }

        // 6. Enemies
        const isFrozen = Date.now() < frozenRef.current;
        enemiesRef.current.forEach(e => {
            const ex = e.x * cellW;
            const ey = e.y * cellH;
            const size = e.radius * Math.min(cellW, cellH) * 2;
            
            ctx.save();
            if (isFrozen) {
                ctx.strokeStyle = '#88C0D0';
                ctx.lineWidth = 3;
                ctx.strokeRect(ex - size/2, ey-size/2, size, size);
            }

            if (e.type === 'boss' && assets.boss) {
                 const bImg = new Image();
                 bImg.src = assets.boss;
                 ctx.drawImage(bImg, ex - size/2, ey - size/2, size, size);
            } else if (e.type === 'minion' && assets.enemy) {
                 const eImg = new Image();
                 eImg.src = assets.enemy;
                 ctx.drawImage(eImg, ex - size/2, ey - size/2, size, size);
            } else {
                ctx.fillStyle = e.type === 'boss' ? COLORS.boss : COLORS.enemy;
                ctx.beginPath();
                ctx.arc(ex, ey, size/2, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.restore();
        });
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    const handleKeyDown = (e: KeyboardEvent) => {
        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", " "].indexOf(e.key) > -1) {
            e.preventDefault();
        }
        if (e.key === ' ') {
            setIsCuttingMode(prev => !prev);
        } else {
            keysPressed.current.add(e.key);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key !== ' ') {
            keysPressed.current.delete(e.key);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animationFrameRef.current!);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, assets, onGameOver, isCuttingMode, setScore, level]);

  // --- Touch Controls Handlers ---
  const handleTouchStart = (key: string) => {
      keysPressed.current.add(key);
  };
  const handleTouchEnd = (key: string) => {
      keysPressed.current.delete(key);
  };
  const toggleCut = () => {
      setIsCuttingMode(prev => !prev);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      <div className="relative w-full max-w-4xl aspect-[4/3] border-4 border-[#88C0D0] rounded-xl shadow-2xl bg-[#2E3440] overflow-hidden">
        <canvas 
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-full object-contain pixel-art block"
        />
        
        {/* UI Overlay */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between text-[#88C0D0] font-bold text-xs md:text-xl tracking-widest uppercase pointer-events-none drop-shadow-md bg-black/30">
          <div>SCORE: {score}</div>
          <div className={percent > WIN_THRESHOLD ? "text-[#EBCB8B] animate-pulse" : "text-[#D8DEE9]"}>
              {(percent * 100).toFixed(1)}% / {(WIN_THRESHOLD * 100).toFixed(0)}%
          </div>
          <div className="flex gap-4">
             <div className={`${timeDisplay < 10 ? 'text-[#BF616A] animate-pulse' : 'text-[#A3BE8C]'}`}>TIME: {timeDisplay}</div>
             <div className="text-[#BF616A]">{lives} ♥</div>
          </div>
        </div>

        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded font-bold text-sm pointer-events-none transition-all ${isCuttingMode ? "bg-[#BF616A] text-white scale-110 shadow-lg" : "bg-black/50 text-gray-400"}`}>
            {isCuttingMode ? "CUTTING ACTIVE" : "SAFE MODE"}
        </div>
      </div>

      <div className="w-full max-w-4xl mt-4 flex justify-between items-center px-4 md:hidden pb-8">
          <div className="relative w-32 h-32">
              <button className="absolute top-0 left-10 w-12 h-12 bg-[#3B4252] rounded shadow active:bg-[#88C0D0]"
                onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowUp'); }}
                onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowUp'); }}
              >↑</button>
              <button className="absolute bottom-0 left-10 w-12 h-12 bg-[#3B4252] rounded shadow active:bg-[#88C0D0]"
                onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowDown'); }}
                onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowDown'); }}
              >↓</button>
              <button className="absolute top-10 left-0 w-12 h-12 bg-[#3B4252] rounded shadow active:bg-[#88C0D0]"
                onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowLeft'); }}
                onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowLeft'); }}
              >←</button>
              <button className="absolute top-10 right-0 w-12 h-12 bg-[#3B4252] rounded shadow active:bg-[#88C0D0]"
                onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowRight'); }}
                onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowRight'); }}
              >→</button>
          </div>

          <button 
             className={`w-24 h-24 rounded-full border-4 font-black text-xs shadow-lg active:scale-95 transition-colors ${isCuttingMode ? 'bg-[#BF616A] border-[#BF616A] text-white' : 'bg-[#3B4252] border-[#88C0D0] text-[#88C0D0]'}`}
             onClick={toggleCut}
          >
            {isCuttingMode ? "CUTTING!" : "CUT"}
          </button>
      </div>
    </div>
  );
};

export default GameCanvas;