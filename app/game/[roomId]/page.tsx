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
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null);

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

  // Heartbeat mechanism to detect disconnections early
  const startHeartbeat = useCallback((socket: Socket) => {
    // Clear existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send ping every 30 seconds (well before 5-minute timeout)
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket && socket.connected) {
        console.log('💓 Sending heartbeat ping');
        socket.emit('ping', { timestamp: Date.now() });
      }
    }, 30000);

    // Check connection health every 10 seconds
    if (connectionCheckRef.current) {
      clearInterval(connectionCheckRef.current);
    }
    
    connectionCheckRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeat;
      
      // If no heartbeat response for 2 minutes, force reconnection
      if (timeSinceLastHeartbeat > 120000 && socket.connected) {
        console.log('⚠️ No heartbeat response for 2 minutes, forcing reconnection');
        socket.disconnect();
        setTimeout(() => connectSocket(), 1000);
      }
    }, 10000);
  }, [lastHeartbeat]);

  // Initialize socket connection
  const connectSocket = useCallback(() => {
    console.log('🔌 Attempting to connect to Socket.IO server...');
    
    // Get the current origin for the connection
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
    console.log('🌐 Connecting to:', socketUrl);
    
    const newSocket = io(socketUrl, {
      path: '/api/socket',
      // Enhanced configuration for Render platform
      transports: ['polling', 'websocket'],
      forceNew: true,
      autoConnect: true,
      // More aggressive reconnection settings for Render
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10, // Increased attempts
      reconnectionDelayMax: 3000, // Shorter max delay
      // Polling settings optimized for Render
      upgrade: true,
      rememberUpgrade: false,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server with ID:', newSocket?.id);
      console.log('🚀 Transport:', newSocket?.io.engine.transport.name);
      setConnected(true);
      setError('');
      setConnectionAttempts(0);
      setLastHeartbeat(Date.now());
      
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Start heartbeat mechanism
      startHeartbeat(newSocket);
      
      // Join room after successful connection
      console.log('🎮 Sending join-room event with:', { roomId, playerName });
      newSocket?.emit('join-room', { roomId, playerName });
    });

    newSocket.on('connected', (data) => {
      console.log('🎉 Server confirmed connection:', data);
    });

    // Handle heartbeat responses
    newSocket.on('pong', (data) => {
      console.log('💓 Received heartbeat pong');
      setLastHeartbeat(Date.now());
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server. Reason:', reason);
      setConnected(false);
      
      // Clear heartbeat when disconnected
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current);
      }
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setError('Connection lost. Reconnecting...');
        // Force immediate reconnection for server-initiated disconnects
        setTimeout(() => connectSocket(), 1000);
      } else if (reason === 'ping timeout') {
        setError('Connection timeout. Reconnecting...');
        setTimeout(() => connectSocket(), 500);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnected(false);
      setConnectionAttempts(prev => prev + 1);
      
      // Show user-friendly error messages
      if (connectionAttempts < 5) {
        setError(`Connection attempt ${connectionAttempts + 1}/5. Retrying...`);
      } else {
        setError('Failed to connect to server. Please check your internet connection and try again.');
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      setError('');
      setConnectionAttempts(0);
      setLastHeartbeat(Date.now());
      // Re-join room after reconnection
      newSocket?.emit('join-room', { roomId, playerName });
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('🔄 Reconnection error:', error);
      setConnectionAttempts(prev => prev + 1);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('💥 Failed to reconnect');
      setError('Failed to reconnect to server. Please refresh the page.');
    });

    newSocket.on('player-joined', (data) => {
      console.log('🎮 Player joined successfully:', data);
      setPlayerId(data.playerId);
    });

    newSocket.on('game-state', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('error', (errorMsg: string) => {
      console.error('🔥 Server error:', errorMsg);
      setError(errorMsg);
    });

    setSocket(newSocket);
    return newSocket;
  }, [roomId, playerName, connectionAttempts, startHeartbeat]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = connectSocket();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current);
      }
      if (newSocket) {
        newSocket.removeAllListeners();
        newSocket.close();
      }
    };
  }, [connectSocket]);

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
    if (socket && connected) {
      socket.emit('start-game');
    } else {
      setError('Not connected to server. Please wait or refresh the page.');
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leave-room');
    }
    router.push('/');
  };

  const retryConnection = () => {
    setError('');
    setConnectionAttempts(0);
    window.location.reload();
  };

  if (error && connectionAttempts >= 5) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="game-card text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Connection Error</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <div className="space-y-2">
            <button onClick={retryConnection} className="game-button">
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
          <p className="text-gray-300">
            {error || 'Connecting to game server...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {connectionAttempts > 0 ? `Attempt ${connectionAttempts}/5` : 'This may take a moment on Render'}
          </p>
          {connectionAttempts > 1 && (
            <button onClick={retryConnection} className="game-button mt-4">
              Force Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players[playerId];
  const playerList = Object.values(gameState.players);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Game Board */}
          <div className="flex-1">
            <div className="game-card">
        <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Room: {roomId}</h1>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-400">
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
          </div>
        </div>

              <div className="flex justify-center mb-4">
                <canvas
                  ref={canvasRef}
                  width={BOARD_WIDTH * CELL_SIZE}
                  height={BOARD_HEIGHT * CELL_SIZE}
                  className="border border-game-secondary rounded"
                />
              </div>

              {/* Game Status */}
              <div className="text-center">
              {!gameState.gameStarted && !gameState.gameOver && (
                  <div className="space-y-2">
                    <p className="text-gray-300">
                      {playerList.length < 2 
                        ? `Waiting for players... (${playerList.length}/2 minimum)`
                        : 'Ready to start!'
                      }
                    </p>
                    <button
                      onClick={startGame}
                      disabled={playerList.length < 2 || !connected}
                      className="game-button disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Start Game
                    </button>
                </div>
              )}
                
                {gameState.gameStarted && !gameState.gameOver && (
                  <p className="text-green-400 font-bold">Game in Progress!</p>
                )}

              {gameState.gameOver && (
                  <div className="space-y-2">
                    <p className="text-red-400 font-bold">Game Over!</p>
                  {gameState.winner && (
                      <p className="text-yellow-400">
                      Winner: {gameState.players[gameState.winner]?.name}
                    </p>
                  )}
                  <button onClick={startGame} className="game-button">
                    Play Again
                  </button>
                </div>
              )}
                </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-80">
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
                <p>Platform: Render</p>
                <p>Transport: {socket?.io.engine.transport.name || 'Polling'}</p>
                <p>Connection: {connected ? 'Stable' : 'Reconnecting...'}</p>
                <p className="text-yellow-400 text-xs mt-2">
                  ⚠️ Render may disconnect every 5min
                </p>
                <p className="text-green-400 text-xs">
                  ✅ Auto-reconnect enabled
                </p>
              </div>
            </div>

              {/* Leave Room */}
              <button
                onClick={leaveRoom}
                className="w-full game-button bg-red-600 hover:bg-red-700"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 