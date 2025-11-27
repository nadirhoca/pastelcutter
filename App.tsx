
import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameAssets, GameState } from './types';
import { generateGameAsset } from './services/geminiService';
import { audioService } from './services/audioService';

const LEVEL_CONFIGS = [
  { name: "Pastel Plains", prompt: "pastel landscape nature" },
  { name: "Cotton Candy Core", prompt: "pink cute candy geometric" },
  { name: "Dream Station", prompt: "space neon stars colorful" },
  { name: "Cyber Garden", prompt: "flowers digital glitch" },
  { name: "Aurora Skies", prompt: "northern lights mountains" }
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [level, setLevel] = useState(0);
  const [score, setScore] = useState(0); // Score lifted to App
  const [highScores, setHighScores] = useState<number[]>([]);
  const [assets, setAssets] = useState<GameAssets>({
    background: null,
    player: null,
    enemy: null,
    boss: null
  });
  const [generationStatus, setGenerationStatus] = useState("Initializing...");

  useEffect(() => {
    const saved = localStorage.getItem('pastel_cutter_highscores');
    if (saved) {
      setHighScores(JSON.parse(saved));
    }
  }, []);

  const saveScore = (finalScore: number) => {
    const newScores = [...highScores, finalScore].sort((a, b) => b - a).slice(0, 5);
    setHighScores(newScores);
    localStorage.setItem('pastel_cutter_highscores', JSON.stringify(newScores));
  };

  // Generate assets for current level
  const loadLevelAssets = async (lvlIdx: number) => {
    setGameState(GameState.GENERATING_ASSETS);
    const config = LEVEL_CONFIGS[lvlIdx % LEVEL_CONFIGS.length];
    
    try {
      setGenerationStatus(`Fetching Asset: BG_LAYER_${lvlIdx}...`);
      const bg = await generateGameAsset(config.prompt, 'background');
      
      setGenerationStatus("Loading Sprite: HERO...");
      const player = await generateGameAsset("hero cute pixel", 'sprite');

      setGenerationStatus("Loading Sprite: MINION...");
      const enemy = await generateGameAsset("enemy robot bad", 'sprite');

      setGenerationStatus("Loading Sprite: BOSS...");
      const boss = await generateGameAsset("boss monster big", 'sprite');

      setAssets({ background: bg, player, enemy, boss });
      
      setGenerationStatus("READY.");
      setTimeout(() => {
         setGameState(GameState.PLAYING);
         audioService.playStart();
      }, 800);

    } catch (e) {
      console.error(e);
      setGenerationStatus("ERROR. RETRYING...");
      setTimeout(() => handleStart(), 1000);
    }
  };

  const handleStart = () => {
    setLevel(0);
    setScore(0);
    loadLevelAssets(0);
  };

  const handleGameOver = (win: boolean) => {
    if (win) {
      setGameState(GameState.VICTORY);
    } else {
      saveScore(score);
      setGameState(GameState.GAME_OVER);
    }
  };

  const handleNextLevel = () => {
    setLevel(l => l + 1);
    loadLevelAssets(level + 1);
  };

  return (
    <div className="min-h-screen bg-[#2E3440] flex flex-col items-center justify-center p-2 md:p-4 font-['Press_Start_2P']">
      
      {/* Header */}
      <h1 className="text-2xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-[#88C0D0] to-[#B48EAD] font-black mb-4 md:mb-8 tracking-tighter drop-shadow-md text-center">
        PASTEL CUTTER
      </h1>

      {/* Main Content */}
      <div className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center">
        
        {gameState === GameState.MENU && (
          <div className="bg-[#3B4252] border-4 border-[#88C0D0] p-8 text-center shadow-2xl rounded-xl max-w-lg w-full">
            <p className="text-[#D8DEE9] mb-8 text-sm md:text-lg leading-6 md:leading-8">
              RECLAIM THE DREAMSCAPE.<br/>
              CAPTURE POWERUPS.<br/>
              BEAT THE CLOCK.
            </p>
            
            {highScores.length > 0 && (
              <div className="mb-8 bg-[#2E3440] p-4 rounded border border-[#4C566A]">
                <h3 className="text-[#EBCB8B] mb-4 text-xs">HIGH SCORES</h3>
                <ul className="text-[#D8DEE9] text-sm space-y-2">
                  {highScores.map((s, i) => (
                    <li key={i} className="flex justify-between">
                      <span>RANK {i+1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[#81A1C1] text-xs mb-8 leading-5">
              DESKTOP: SPACE TO TOGGLE CUT<br/>
              MOBILE: USE ON-SCREEN BUTTONS<br/>
            </p>
            <button 
              onClick={handleStart}
              className="bg-[#88C0D0] hover:bg-[#81A1C1] text-[#2E3440] font-bold py-4 px-8 rounded text-xl animate-pulse transition-all shadow-lg w-full"
            >
              START GAME
            </button>
          </div>
        )}

        {gameState === GameState.GENERATING_ASSETS && (
          <div className="bg-[#3B4252] border-2 border-[#88C0D0] p-12 text-center h-[300px] md:h-[600px] w-full flex flex-col items-center justify-center rounded-xl">
             <div className="w-16 h-16 border-4 border-t-[#88C0D0] border-r-transparent border-b-[#B48EAD] border-l-transparent rounded-full animate-spin mb-8"></div>
             <p className="text-[#D8DEE9] text-sm md:text-xl font-mono blink">{generationStatus}</p>
          </div>
        )}

        {gameState === GameState.PLAYING && (
          <GameCanvas 
            assets={assets} 
            gameState={gameState} 
            onGameOver={handleGameOver}
            level={level}
            score={score}
            setScore={setScore}
          />
        )}

        {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
             <div className="bg-[#3B4252] p-8 md:p-12 border-4 border-[#BF616A] text-center transform scale-100 md:scale-110 rounded-xl shadow-2xl">
                <h2 className="text-2xl md:text-4xl text-[#BF616A] mb-4 drop-shadow-md">GAME OVER</h2>
                <p className="text-[#D8DEE9] mb-8 text-xl">FINAL SCORE: {score}</p>
                <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="bg-[#BF616A] hover:bg-[#D08770] text-[#2E3440] font-bold py-3 px-6 rounded text-lg md:text-xl"
                >
                  MENU
                </button>
             </div>
          </div>
        )}

        {gameState === GameState.VICTORY && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
             <div className="bg-[#3B4252] p-8 md:p-12 border-4 border-[#A3BE8C] text-center transform scale-100 md:scale-110 rounded-xl shadow-2xl">
                <h2 className="text-2xl md:text-4xl text-[#A3BE8C] mb-4 drop-shadow-md">AREA SECURED!</h2>
                <p className="text-[#EBCB8B] mb-2">SCORE: {score}</p>
                <p className="text-[#81A1C1] text-xs mb-8">GEOMETRIC BONUS APPLIED</p>
                <button 
                  onClick={handleNextLevel}
                  className="bg-[#A3BE8C] hover:bg-[#8FBCBB] text-[#2E3440] font-bold py-3 px-6 rounded text-lg md:text-xl"
                >
                  NEXT LEVEL
                </button>
             </div>
          </div>
        )}

      </div>
      
      <div className="mt-8 text-gray-500 text-[10px] md:text-xs text-center hidden md:block">
         ASSETS FROM DICEBEAR & PICSUM
      </div>
    </div>
  );
}