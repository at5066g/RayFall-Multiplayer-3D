
import React, { useEffect, useRef } from 'react';
import type { GameState } from '../types';

interface MinimapProps {
  gameState: GameState;
}

export const Minimap: React.FC<MinimapProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CELL_SIZE = 6;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { map, player } = gameState;
    const mapW = map.length;
    const mapH = map[0].length;
    canvas.width = mapW * CELL_SIZE;
    canvas.height = mapH * CELL_SIZE;

    // Tactical Background
    ctx.fillStyle = 'rgba(20, 20, 20, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Light Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Walls
    for (let x = 0; x < mapW; x++) {
      for (let y = 0; y < mapH; y++) {
        if (map[x][y] > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE - 0.5, CELL_SIZE - 0.5);
        }
      }
    }

    // Player
    const px = player.pos.x * CELL_SIZE;
    const py = player.pos.y * CELL_SIZE;
    
    // View Cone
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    const coneAngle = Math.atan2(player.dir.y, player.dir.x);
    ctx.arc(px, py, 40, coneAngle - 0.5, coneAngle + 0.5);
    ctx.fill();

    // Player Dot
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Dir Indicator
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + player.dir.x * 8, py + player.dir.y * 8);
    ctx.stroke();

  }, [gameState]);

  return (
    <div className="absolute top-8 left-8 border border-white/10 p-1 bg-black/40 backdrop-blur-sm z-20">
      <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
    </div>
  );
};
