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
  // Enhanced logging for debugging
  console.log('=== Socket API Request ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'origin': req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50),
  });

  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    res.status(200).end();
    return;
  }

  try {
    // Check if Socket.IO server already exists
    if (res.socket.server.io) {
      console.log('Socket.IO server already running, delegating to existing instance');
      // Let Socket.IO handle the request
      return;
    }

    console.log('Initializing new Socket.IO server...');

    // Create Socket.IO server with minimal, Vercel-optimized configuration
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      // Minimal configuration for Vercel
      transports: ['polling'],
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
      },
      // Vercel-specific optimizations
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6,
      serveClient: false,
      cookie: false,
      // Additional stability settings
      connectTimeout: 45000,
      allowUpgrades: false, // Force polling only
    });

    // Store the io instance
    res.socket.server.io = io;

    // Enhanced connection handling
    io.on('connection', (socket) => {
      console.log('✅ Client connected successfully:', socket.id);

      // Send immediate confirmation
      socket.emit('connected', { 
        id: socket.id, 
        timestamp: new Date().toISOString(),
        transport: socket.conn.transport.name
      });

      // Room joining logic
      socket.on('join-room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
        try {
          console.log(`🎮 Player ${playerName} (${socket.id}) joining room ${roomId}`);
          
          if (!roomId || !playerName) {
            console.error('❌ Invalid room ID or player name');
            socket.emit('error', 'Room ID and player name are required');
            return;
          }

          // Create room if needed
          if (!rooms[roomId]) {
            rooms[roomId] = {
              id: roomId,
              players: [],
              maxPlayers: 4,
              gameState: createInitialGameState(roomId),
              createdAt: new Date(),
            };
            console.log(`🏠 Created new room: ${roomId}`);
          }

          const room = rooms[roomId];
          
          // Check if already in room
          if (room.players.includes(socket.id)) {
            console.log(`🔄 Player ${socket.id} already in room ${roomId}`);
            socket.emit('player-joined', { playerId: socket.id });
            io.to(roomId).emit('game-state', room.gameState);
            return;
          }
          
          // Check room capacity
          if (room.players.length >= room.maxPlayers) {
            console.error(`🚫 Room ${roomId} is full`);
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
          
          console.log(`✅ Player ${playerName} joined room ${roomId}. Players: ${room.players.length}`);
        } catch (error) {
          console.error('❌ Error joining room:', error);
          socket.emit('error', 'Failed to join room: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      });

      // Game start logic
      socket.on('start-game', () => {
        try {
          const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
          if (!roomId || !rooms[roomId]) {
            socket.emit('error', 'Room not found');
            return;
          }

          const room = rooms[roomId];
          
          if (Object.keys(room.gameState.players).length < 2) {
            socket.emit('error', 'Need at least 2 players to start');
            return;
          }

          // Reset game state
          room.gameState.gameStarted = true;
          room.gameState.gameOver = false;
          room.gameState.winner = undefined;
          
          // Reset players
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
          
          console.log(`🎮 Game started in room ${roomId}`);
        } catch (error) {
          console.error('❌ Error starting game:', error);
          socket.emit('error', 'Failed to start game');
        }
      });

      // Direction change
      socket.on('change-direction', (direction: Direction) => {
        try {
          const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
          if (!roomId || !rooms[roomId]) return;

          const player = rooms[roomId].gameState.players[socket.id];
          if (!player || !player.alive) return;

          const opposites: { [key in Direction]: Direction } = {
            UP: 'DOWN',
            DOWN: 'UP',
            LEFT: 'RIGHT',
            RIGHT: 'LEFT',
          };

          if (opposites[direction] !== player.direction) {
            player.direction = direction;
          }
        } catch (error) {
          console.error('❌ Error changing direction:', error);
        }
      });

      // Leave room
      socket.on('leave-room', () => {
        try {
          const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
          if (!roomId || !rooms[roomId]) return;

          const room = rooms[roomId];
          room.players = room.players.filter(id => id !== socket.id);
          delete room.gameState.players[socket.id];
          socket.leave(roomId);
          
          if (room.players.length === 0) {
            if (gameIntervals[roomId]) {
              clearInterval(gameIntervals[roomId]);
              delete gameIntervals[roomId];
            }
            delete rooms[roomId];
            console.log(`🧹 Cleaned up empty room: ${roomId}`);
          } else {
            io.to(roomId).emit('game-state', room.gameState);
          }
        } catch (error) {
          console.error('❌ Error leaving room:', error);
        }
      });

      // Disconnect handling
      socket.on('disconnect', (reason) => {
        try {
          console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);
          
          const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
          if (!roomId || !rooms[roomId]) return;

          const room = rooms[roomId];
          room.players = room.players.filter(id => id !== socket.id);
          delete room.gameState.players[socket.id];
          
          if (room.players.length === 0) {
            if (gameIntervals[roomId]) {
              clearInterval(gameIntervals[roomId]);
              delete gameIntervals[roomId];
            }
            delete rooms[roomId];
            console.log(`🧹 Cleaned up empty room: ${roomId}`);
          } else {
            io.to(roomId).emit('game-state', room.gameState);
          }
        } catch (error) {
          console.error('❌ Error handling disconnect:', error);
        }
      });

      socket.on('error', (error) => {
        console.error('🔥 Socket error:', error);
      });
    });

    // Server error handling
    io.on('error', (error) => {
      console.error('🔥 Socket.IO server error:', error);
    });

    console.log('✅ Socket.IO server initialized successfully');
    
    // Return success response
    res.status(200).json({ 
      success: true,
      message: 'Socket.IO server initialized',
      timestamp: new Date().toISOString(),
      transport: 'polling'
    });

  } catch (error) {
    console.error('💥 Failed to initialize Socket.IO server:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to initialize Socket.IO server',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
} 