# 🐍 Multiplayer Snake Game

A real-time multiplayer snake game built with Next.js, Socket.io, and TypeScript. Play with friends online!

## Features

- 🎮 Real-time multiplayer gameplay (up to 4 players)
- 🏠 Room-based system with unique room IDs
- 🎨 Beautiful modern UI with animations
- 📱 Responsive design
- 🚀 Easy deployment to Vercel
- ⚡ Fast and smooth gameplay

## How to Play

1. Enter your name on the home page
2. Create a new room or join an existing one with a room ID
3. Share the room ID with friends
4. Wait for at least 2 players to join
5. Click "Start Game" to begin
6. Use arrow keys or WASD to control your snake
7. Eat food to grow and score points
8. Avoid hitting walls or other snakes
9. Last snake standing wins!

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Real-time Communication**: Socket.io
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
\`\`\`bash
git clone <your-repo-url>
cd multiplayer-snake-game
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Deploy with default settings
4. Your multiplayer snake game is now live!

## Game Controls

- **Arrow Keys** or **WASD**: Move your snake
- **Start Game**: Begin the game (requires 2+ players)
- **Leave Room**: Exit the current game room

## Game Rules

- Minimum 2 players required to start
- Maximum 4 players per room
- Eat food (red circles) to grow and score points
- Avoid hitting walls or other snakes
- Game ends when only one snake remains alive
- Winner is determined by being the last snake standing

## Project Structure

\`\`\`
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── game/[roomId]/     # Game page
├── pages/api/             # API routes
│   └── socket.ts          # Socket.io server
├── types/                 # TypeScript type definitions
│   └── game.ts           # Game-related types
├── package.json          # Dependencies and scripts
└── README.md             # This file
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for learning or building your own games!

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Have fun playing! 🎮🐍 