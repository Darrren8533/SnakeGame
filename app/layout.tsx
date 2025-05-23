import './globals.css'
import React from 'react'

export const metadata = {
  title: 'Multiplayer Snake Game',
  description: 'Play snake with friends online!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-game-bg via-game-primary to-game-secondary">
          {children}
        </div>
      </body>
    </html>
  )
} 