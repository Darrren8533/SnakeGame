export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  snake: Position[];
  direction: Direction;
  score: number;
  color: string;
  alive: boolean;
}

export interface GameState {
  players: { [key: string]: Player };
  food: Position[];
  gameStarted: boolean;
  gameOver: boolean;
  winner?: string;
  roomId: string;
}

export interface Room {
  id: string;
  players: string[];
  maxPlayers: number;
  gameState: GameState;
  createdAt: Date;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface GameConfig {
  boardWidth: number;
  boardHeight: number;
  cellSize: number;
  gameSpeed: number;
  maxPlayers: number;
} 