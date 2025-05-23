import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Socket as NetSocket } from 'net';
import { GameState, Player, Direction, Position, Room } from '../../types/game';

interface SocketServer extends HTTPServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const BOARD_WIDTH = 30;
const BOARD_HEIGHT = 20;
const GAME_SPEED = 150;
const PLAYER_COLORS = ['#4ade80', '#3b82f6', '#f59e0b', '#ef4444'];

// Game rooms storage
const rooms: { [key: string]: Room } = {};
const gameIntervals: { [key: string]: NodeJS.Timeout } = {};

function createInitialGameState(roomId: string): GameState {
  return {
    players: {},
    food: [],
    gameStarted: false,
    gameOver: false,
    roomId,
  };
}

function generateFood(gameState: GameState): Position {
  let food: Position;
  let attempts = 0;
  
  do {
    food = {
      x: Math.floor(Math.random() * BOARD_WIDTH),
      y: Math.floor(Math.random() * BOARD_HEIGHT),
    };
    attempts++;
  } while (attempts < 100 && isPositionOccupied(food, gameState));
  
  return food;
}

function isPositionOccupied(pos: Position, gameState: GameState): boolean {
  const players = Object.values(gameState.players);
  for (const player of players) {
    if (player.snake.some((segment: Position) => segment.x === pos.x && segment.y === pos.y)) {
      return true;
    }
  }
  return gameState.food.some((food: Position) => food.x === pos.x && food.y === pos.y);
}

function createPlayer(id: string, name: string, colorIndex: number): Player {
  const startPositions = [
    { x: 5, y: 10 },
    { x: 25, y: 10 },
    { x: 15, y: 5 },
    { x: 15, y: 15 },
  ];
  
  return {
    id,
    name,
    snake: [startPositions[colorIndex % startPositions.length]],
    direction: 'RIGHT',
    score: 0,
    color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
    alive: true,
  };
}

function moveSnake(player: Player): void {
  const head = { ...player.snake[0] };
  
  switch (player.direction) {
    case 'UP':
      head.y -= 1;
      break;
    case 'DOWN':
      head.y += 1;
      break;
    case 'LEFT':
      head.x -= 1;
      break;
    case 'RIGHT':
      head.x += 1;
      break;
  }
  
  player.snake.unshift(head);
}

function checkCollisions(gameState: GameState): void {
  const players = Object.values(gameState.players);
  const alivePlayers = players.filter((p: Player) => p.alive);
  
  for (const player of alivePlayers) {
    const head = player.snake[0];
    
    // Check wall collision
    if (head.x < 0 || head.x >= BOARD_WIDTH || head.y < 0 || head.y >= BOARD_HEIGHT) {
      player.alive = false;
      continue;
    }
    
    // Check self collision
    if (player.snake.slice(1).some((segment: Position) => segment.x === head.x && segment.y === head.y)) {
      player.alive = false;
      continue;
    }
    
    // Check collision with other snakes
    for (const otherPlayer of alivePlayers) {
      if (otherPlayer.id === player.id) continue;
      
      if (otherPlayer.snake.some((segment: Position) => segment.x === head.x && segment.y === head.y)) {
        player.alive = false;
        break;
      }
    }
  }
}

function checkFoodCollision(gameState: GameState): void {
  const players = Object.values(gameState.players);
  for (const player of players) {
    if (!player.alive) continue;
    
    const head = player.snake[0];
    const foodIndex = gameState.food.findIndex((food: Position) => food.x === head.x && food.y === head.y);
    
    if (foodIndex !== -1) {
      // Remove eaten food
      gameState.food.splice(foodIndex, 1);
      
      // Increase score
      player.score += 10;
      
      // Add new food
      gameState.food.push(generateFood(gameState));
    } else {
      // Remove tail if no food eaten
      player.snake.pop();
    }
  }
}

function updateGame(roomId: string, io: SocketIOServer): void {
  const room = rooms[roomId];
  if (!room || !room.gameState.gameStarted || room.gameState.gameOver) {
    return;
  }
  
  const gameState = room.gameState;
  
  // Move all alive players
  const players = Object.values(gameState.players);
  for (const player of players) {
    if (player.alive) {
      moveSnake(player);
    }
  }
  
  // Check collisions
  checkCollisions(gameState);
  checkFoodCollision(gameState);
  
  // Check win condition
  const alivePlayers = Object.values(gameState.players).filter((p: Player) => p.alive);
  if (alivePlayers.length <= 1) {
    gameState.gameOver = true;
    gameState.gameStarted = false;
    
    if (alivePlayers.length === 1) {
      gameState.winner = alivePlayers[0].id;
    }
    
    // Clear game interval
    if (gameIntervals[roomId]) {
      clearInterval(gameIntervals[roomId]);
      delete gameIntervals[roomId];
    }
  }
  
  // Broadcast game state
  io.to(roomId).emit('game-state', gameState);
}

function startGameLoop(roomId: string, io: SocketIOServer): void {
  if (gameIntervals[roomId]) {
    clearInterval(gameIntervals[roomId]);
  }
  
  gameIntervals[roomId] = setInterval(() => {
    updateGame(roomId, io);
  }, GAME_SPEED);
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    res.status(200).json({ message: 'Socket is already running' });
    return;
  }

  const io = new SocketIOServer(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
  });

  res.socket.server.io = io;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
      // Create room if it doesn't exist
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: [],
          maxPlayers: 4,
          gameState: createInitialGameState(roomId),
          createdAt: new Date(),
        };
      }

      const room = rooms[roomId];
      
      // Check if room is full
      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', 'Room is full');
        return;
      }

      // Add player to room
      socket.join(roomId);
      room.players.push(socket.id);
      
      // Create player
      const player = createPlayer(socket.id, playerName, room.players.length - 1);
      room.gameState.players[socket.id] = player;
      
      // Generate initial food
      if (room.gameState.food.length === 0) {
        for (let i = 0; i < 3; i++) {
          room.gameState.food.push(generateFood(room.gameState));
        }
      }

      socket.emit('player-joined', { playerId: socket.id });
      io.to(roomId).emit('game-state', room.gameState);
      
      console.log(`Player ${playerName} joined room ${roomId}`);
    });

    socket.on('start-game', () => {
      const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
      if (!roomId || !rooms[roomId]) return;

      const room = rooms[roomId];
      
      if (Object.keys(room.gameState.players).length < 2) {
        socket.emit('error', 'Need at least 2 players to start');
        return;
      }

      // Reset game state
      room.gameState.gameStarted = true;
      room.gameState.gameOver = false;
      room.gameState.winner = undefined;
      
      // Reset all players
      const players = Object.values(room.gameState.players);
      players.forEach((player: Player, index: number) => {
        const startPositions = [
          { x: 5, y: 10 },
          { x: 25, y: 10 },
          { x: 15, y: 5 },
          { x: 15, y: 15 },
        ];
        
        player.snake = [startPositions[index % startPositions.length]];
        player.direction = 'RIGHT';
        player.score = 0;
        player.alive = true;
      });
      
      // Generate new food
      room.gameState.food = [];
      for (let i = 0; i < 3; i++) {
        room.gameState.food.push(generateFood(room.gameState));
      }

      io.to(roomId).emit('game-state', room.gameState);
      startGameLoop(roomId, io);
      
      console.log(`Game started in room ${roomId}`);
    });

    socket.on('change-direction', (direction: Direction) => {
      const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
      if (!roomId || !rooms[roomId]) return;

      const player = rooms[roomId].gameState.players[socket.id];
      if (!player || !player.alive) return;

      // Prevent reverse direction
      const opposites: { [key in Direction]: Direction } = {
        UP: 'DOWN',
        DOWN: 'UP',
        LEFT: 'RIGHT',
        RIGHT: 'LEFT',
      };

      if (opposites[direction] !== player.direction) {
        player.direction = direction;
      }
    });

    socket.on('leave-room', () => {
      const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
      if (!roomId || !rooms[roomId]) return;

      const room = rooms[roomId];
      
      // Remove player from room
      room.players = room.players.filter(id => id !== socket.id);
      delete room.gameState.players[socket.id];
      
      socket.leave(roomId);
      
      // If room is empty, clean up
      if (room.players.length === 0) {
        if (gameIntervals[roomId]) {
          clearInterval(gameIntervals[roomId]);
          delete gameIntervals[roomId];
        }
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('game-state', room.gameState);
      }
      
      console.log(`Player left room ${roomId}`);
    });

    socket.on('disconnect', () => {
      const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
      if (!roomId || !rooms[roomId]) return;

      const room = rooms[roomId];
      
      // Remove player from room
      room.players = room.players.filter(id => id !== socket.id);
      delete room.gameState.players[socket.id];
      
      // If room is empty, clean up
      if (room.players.length === 0) {
        if (gameIntervals[roomId]) {
          clearInterval(gameIntervals[roomId]);
          delete gameIntervals[roomId];
        }
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('game-state', room.gameState);
      }
      
      console.log('Client disconnected:', socket.id);
    });
  });

  res.status(200).json({ message: 'Socket server started' });
} 