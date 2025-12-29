
import { CellType, type Texture } from '../types';

const TEX_WIDTH = 64;
const TEX_HEIGHT = 64;

const createTexture = (drawFn: (ctx: CanvasRenderingContext2D) => void): Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_WIDTH;
  canvas.height = TEX_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    drawFn(ctx);
  }
  const imgData = ctx!.getImageData(0, 0, TEX_WIDTH, TEX_HEIGHT).data;
  const uint32Data = new Uint32Array(imgData.buffer);

  return { image: canvas, data: uint32Data, width: TEX_WIDTH, height: TEX_HEIGHT };
};

export const generateTextures = (): Record<number, Texture[]> => {
  const textures: Record<number, Texture[]> = {};

  const addTex = (id: number, drawFns: ((ctx: CanvasRenderingContext2D) => void)[]) => {
    textures[id] = drawFns.map(fn => createTexture(fn));
  };

  // --- WALL 1: BRIGHT BRICK ---
  addTex(CellType.WALL_1, [(ctx) => {
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    ctx.fillStyle = '#ff5555';
    for (let y = 0; y < 64; y += 16) {
      const offset = (y / 16) % 2 === 0 ? 0 : 16;
      for (let x = 0; x < 64; x += 32) {
        ctx.fillRect(x + offset + 2, y + 2, 28, 12);
        ctx.fillStyle = '#881111';
        ctx.fillRect(x + offset + 2, y + 14, 30, 2);
        ctx.fillStyle = '#ff5555';
      }
    }
  }]);

  // --- WALL 2: PULSING SLIME ---
  addTex(CellType.WALL_2, [0, 1, 2, 3].map(frame => (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = `rgb(50, ${150 + Math.sin(frame) * 50}, 50)`;
    for (let i = 0; i < 5; i++) {
      const x = (10 + i * 12 + Math.sin(frame + i) * 5);
      ctx.fillRect(x, 0, 6, 64);
    }
  }));

  // --- WALL 3: FLICKERING TECH ---
  addTex(CellType.WALL_3, [0, 1].map(frame => (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#222233';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#4444ff';
    ctx.strokeRect(4, 4, 56, 56);
    ctx.fillStyle = frame === 0 ? '#38bdf8' : '#0ea5e9';
    ctx.fillRect(16, 16, 32, 20); // Monitor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20, 20, 4, 4); // Cursor
  }));

  // --- WALL 4: INDUSTRIAL PIPES ---
  addTex(CellType.WALL_4, [(ctx) => {
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#666666';
    ctx.fillRect(10, 0, 14, 64);
    ctx.fillRect(40, 0, 14, 64);
    ctx.fillStyle = '#222222';
    ctx.fillRect(24, 0, 2, 64);
    ctx.fillRect(54, 0, 2, 64);
  }]);

  // --- WALL WINDOW ---
  addTex(CellType.WALL_WINDOW, [(ctx) => {
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, 64, 64);
    ctx.clearRect(12, 12, 40, 40); // Actual transparency for window
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 44, 44);
  }]);

  // --- FLOOR & CEILING (Bright) ---
  addTex(CellType.FLOOR, [(ctx) => {
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#666666';
    ctx.strokeRect(0, 0, 64, 64);
  }]);

  addTex(CellType.CEILING, [(ctx) => {
    ctx.fillStyle = '#333344';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#444466';
    ctx.fillRect(30, 0, 4, 64);
    ctx.fillRect(0, 30, 64, 4);
  }]);

  // --- HEALTH ORB: Clean and Borderless ---
  addTex(CellType.HEALTH_ORB, [(ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(28, 16, 8, 32);
    ctx.fillRect(16, 28, 32, 8);
  }]);

  // --- AMMO ORB: Restored and redesigned as an orb ---
  addTex(CellType.AMMO_BOX, [(ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#facc15'; // Bright Yellow
    ctx.beginPath();
    ctx.moveTo(32, 15);
    ctx.lineTo(40, 45);
    ctx.lineTo(24, 45);
    ctx.closePath();
    ctx.fill();
  }]);

  // --- ENEMY GUARD: Clean design without black outlines ---
  addTex(CellType.ENEMY_GUARD, [(ctx) => {
    ctx.fillStyle = '#1e3a8a'; // Blue suit
    ctx.fillRect(18, 18, 28, 32);
    ctx.fillStyle = '#475569'; // Grey details
    ctx.fillRect(20, 20, 24, 18);
    ctx.fillStyle = '#64748b'; // Lighter helmet
    ctx.fillRect(24, 6, 16, 12);
    ctx.fillStyle = '#ff3333'; // Bright Visor
    ctx.fillRect(24, 10, 16, 4);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(20, 50, 8, 10);
    ctx.fillRect(36, 50, 8, 10);
    ctx.fillStyle = '#334155'; // Dark Grey Gun (not pitch black)
    ctx.fillRect(42, 28, 14, 6);
  }]);

  // --- DEAD GUARD: Lying down ---
  addTex(CellType.ENEMY_GUARD_DEAD, [(ctx) => {
    ctx.fillStyle = '#1e3a8a'; // Blue suit
    // Flatter rect to simulate lying down
    ctx.fillRect(10, 48, 44, 12);
    ctx.fillStyle = '#475569';
    ctx.fillRect(14, 50, 30, 8);
    // Helmet on ground
    ctx.fillStyle = '#64748b';
    ctx.fillRect(4, 52, 12, 10);
    // Blood pool
    ctx.fillStyle = '#880000';
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(32, 58, 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
  }]);

  // --- BLOOD PARTICLE: Irregular Red Splatter ---
  addTex(CellType.PARTICLE_BLOOD, [(ctx) => {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(20, 20, 24, 24);
  }]);

  return textures;
};
