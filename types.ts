export enum GameState {
  MENU,
  GENERATING_ASSETS,
  PLAYING,
  GAME_OVER,
  VICTORY
}

export interface SpriteAsset {
  name: string;
  dataUrl: string; // Base64 image
}

export interface GameAssets {
  background: string | null;
  player: string | null;
  enemy: string | null;
  boss: string | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'minion' | 'boss';
  radius: number;
}

export enum PowerUpType {
  FREEZE,       // Stops enemies
  INVINCIBLE,   // Player cannot die
  EXTRA_LIFE,   // +1 Life
  TIME_BONUS    // +30 Seconds
}

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  type: PowerUpType;
}