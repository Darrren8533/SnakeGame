'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const createRoom = () => {
    if (!playerName.trim()) {
      alert('Please enter your name!');
      return;
    }
    setIsCreating(true);
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/game/${newRoomId}?name=${encodeURIComponent(playerName)}`);
  };

  const joinRoom = () => {
    if (!playerName.trim()) {
      alert('Please enter your name!');
      return;
    }
    if (!roomId.trim()) {
      alert('Please enter room ID!');
      return;
    }
    router.push(`/game/${roomId.toUpperCase()}?name=${encodeURIComponent(playerName)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="game-card max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-game-accent mb-2">🐍 Snake Battle</h1>
          <p className="text-gray-300">Play with friends online!</p>
        </div>

        <div className="space-y-4 mb-8">
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="game-input w-full"
            maxLength={20}
          />
        </div>

        <div className="space-y-4">
          <button
            onClick={createRoom}
            disabled={isCreating}
            className="game-button w-full"
          >
            {isCreating ? 'Creating...' : 'Create New Room'}
          </button>

          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-game-secondary"></div>
            <span className="px-4 text-gray-400">OR</span>
            <div className="flex-1 border-t border-game-secondary"></div>
          </div>

          <input
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            className="game-input w-full"
            maxLength={6}
          />

          <button
            onClick={joinRoom}
            className="game-button w-full bg-blue-600 hover:bg-blue-700"
          >
            Join Room
          </button>
        </div>

        <div className="mt-8 text-sm text-gray-400">
          <h3 className="font-semibold mb-2">How to Play:</h3>
          <ul className="text-left space-y-1">
            <li>• Use arrow keys or WASD to move</li>
            <li>• Eat food to grow and score points</li>
            <li>• Avoid hitting walls or other snakes</li>
            <li>• Last snake standing wins!</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 