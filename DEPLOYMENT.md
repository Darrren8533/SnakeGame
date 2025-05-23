# 🚀 Deployment Guide

## Quick Deploy to Vercel

### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Multiplayer Snake Game"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your repository
   - Click "Deploy"
   - Your game will be live in minutes!

### Method 2: Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Set up and deploy
   - Choose default settings
   - Your game is now live!

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open browser**:
   - Go to `http://localhost:3000`
   - Create a room and test the game

## Environment Variables

No environment variables are required for basic functionality. The game works out of the box!

## Troubleshooting

### Common Issues:

1. **Socket.io connection issues**:
   - Make sure the Vercel deployment includes the `vercel.json` configuration
   - Check that the Socket.io path is correctly configured

2. **Build errors**:
   - Ensure all dependencies are installed
   - Check TypeScript errors and fix them

3. **Game not starting**:
   - Make sure at least 2 players join the room
   - Check browser console for errors

### Performance Tips:

1. **For better performance**:
   - Use Vercel Pro for faster cold starts
   - Consider using a dedicated WebSocket service for production

2. **Scaling**:
   - Current implementation stores game state in memory
   - For production, consider using Redis or a database

## Features Included

✅ Real-time multiplayer gameplay  
✅ Room-based system  
✅ Responsive design  
✅ Modern UI with animations  
✅ Touch controls for mobile  
✅ Automatic room cleanup  
✅ Player reconnection handling  

## Share Your Game

Once deployed, share your game URL with friends:
- `https://your-app-name.vercel.app`
- Players can create rooms and invite others
- Up to 4 players per room
- Instant multiplayer fun!

## Next Steps

Want to enhance the game? Consider adding:
- User accounts and profiles
- Game statistics and leaderboards
- Different game modes
- Power-ups and special abilities
- Tournament system
- Mobile app version

Happy gaming! 🎮🐍 