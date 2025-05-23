'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { GameState, Player, Direction, Position } from '../../../types/game';

const BOARD_WIDTH = 30;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 20;

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Add null checks for params and searchParams
  const roomId = params?.roomId as string || '';
  const playerName = searchParams?.get('name') || 'Anonymous';
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Early return if roomId is not available
  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="game-card text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Invalid Room</h2>
          <p className="text-gray-300 mb-4">Room ID is required</p>
          <button onClick={() => router.push('/')} className="game-button">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io({
      path: '/api/socket',
      // Vercel-specific configuration
      transports: ['polling'], // Force polling transport for Vercel
      forceNew: true,
      reconnection: true,
      timeout: 60000,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      newSocket.emit('join-room', { roomId, playerName });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Failed to connect to server. Please try again.');
    });

    newSocket.on('player-joined', (data) => {
      setPlayerId(data.playerId);
    });

    newSocket.on('game-state', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('error', (errorMsg: string) => {
      setError(errorMsg);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [roomId, playerName]);

  // Handle keyboard input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!socket || !gameState?.gameStarted) return;

    let direction: Direction | null = null;
    
    switch (event.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        direction = 'UP';
        break;
      case 'arrowdown':
      case 's':
        direction = 'DOWN';
        break;
      case 'arrowleft':
      case 'a':
        direction = 'LEFT';
        break;
      case 'arrowright':
      case 'd':
        direction = 'RIGHT';
        break;
    }

    if (direction) {
      socket.emit('change-direction', direction);
    }
  }, [socket, gameState]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Draw game on canvas
  useEffect(() => {
    if (!gameState || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#16213e';
    ctx.lineWidth = 1;
    for (let x = 0; x <= BOARD_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(BOARD_WIDTH * CELL_SIZE, y * CELL_SIZE);
      ctx.stroke();
    }

    // Draw food
    gameState.food.forEach(food => {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(
        food.x * CELL_SIZE + CELL_SIZE / 2,
        food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });

    // Draw snakes
    Object.values(gameState.players).forEach(player => {
      if (!player.alive) return;
      
      player.snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? player.color : player.color + '80';
        ctx.fillRect(
          segment.x * CELL_SIZE + 1,
          segment.y * CELL_SIZE + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2
        );
      });
    });
  }, [gameState]);

  const startGame = () => {
    if (socket) {
      socket.emit('start-game');
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leave-room');
    }
    router.push('/');
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="game-card text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Connection Error</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <div className="space-y-2">
            <button onClick={() => window.location.reload()} className="game-button">
              Retry Connection
            </button>
            <button onClick={() => router.push('/')} className="game-button bg-gray-600 hover:bg-gray-700">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!connected || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="game-card text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-game-accent mx-auto mb-4"></div>
          <p className="text-gray-300">Connecting to game server...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a moment on Vercel</p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players[playerId];
  const playerList = Object.values(gameState.players);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-game-accent">Room: {roomId}</h1>
            <p className="text-gray-300">Players: {playerList.length}/4</p>
            <p className="text-sm text-gray-500">
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </p>
          </div>
          <button onClick={leaveRoom} className="game-button bg-gray-600 hover:bg-gray-700">
            Leave Room
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Game Canvas */}
          <div className="lg:col-span-3">
            <div className="game-card">
              {!gameState.gameStarted && !gameState.gameOver && (
                <div className="text-center mb-4">
                  <p className="text-gray-300 mb-4">
                    Waiting for players... ({playerList.length}/2 minimum)
                  </p>
                  {playerList.length >= 2 && (
                    <button onClick={startGame} className="game-button">
                      Start Game
                    </button>
                  )}
                </div>
              )}

              {gameState.gameOver && (
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-game-accent mb-2">Game Over!</h2>
                  {gameState.winner && (
                    <p className="text-gray-300 mb-4">
                      Winner: {gameState.players[gameState.winner]?.name}
                    </p>
                  )}
                  <button onClick={startGame} className="game-button">
                    Play Again
                  </button>
                </div>
              )}

              <canvas
                ref={canvasRef}
                width={BOARD_WIDTH * CELL_SIZE}
                height={BOARD_HEIGHT * CELL_SIZE}
                className="border border-game-secondary rounded-lg mx-auto block"
              />

              {gameState.gameStarted && (
                <div className="text-center mt-4 text-sm text-gray-400">
                  Use arrow keys or WASD to move
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Players */}
            <div className="game-card">
              <h3 className="text-lg font-bold mb-4">Players</h3>
              <div className="space-y-2">
                {playerList.map(player => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      player.id === playerId ? 'bg-game-secondary' : 'bg-game-bg'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: player.color }}
                      ></div>
                      <span className={`${!player.alive ? 'line-through text-gray-500' : ''}`}>
                        {player.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-400">{player.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="game-card">
              <h3 className="text-lg font-bold mb-4">Controls</h3>
              <div className="text-sm text-gray-400 space-y-1">
                <p>↑ or W: Move Up</p>
                <p>↓ or S: Move Down</p>
                <p>← or A: Move Left</p>
                <p>→ or D: Move Right</p>
              </div>
            </div>

            {/* Connection Status */}
            <div className="game-card">
              <h3 className="text-lg font-bold mb-4">Status</h3>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Transport: Polling</p>
                <p>Optimized for Vercel</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 