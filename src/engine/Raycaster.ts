
import { CellType, type GameState, type Player, type Texture, type Enemy, type Item, type Vector2, type Decal } from '../types';

export class Raycaster {
  private zBuffer: number[];
  private width: number;
  private height: number;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private buffer: Uint32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.zBuffer = new Array(width).fill(0);
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false })!;
    this.imageData = this.offscreenCtx.createImageData(width, height);
    this.buffer = new Uint32Array(this.imageData.data.buffer);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    gameState: GameState,
    textures: Record<number, Texture[]>,
    isShooting: boolean = false,
    zoom: number = 1.0
  ) {
    const { player, map, enemies, items, particles, decals } = gameState;
    const w = this.width;
    const h = this.height;
    const time = performance.now();

    // 1. Floor and Ceiling Casting (Raw Buffer manipulation for performance)
    this.castFloorAndCeiling(player, textures, w, h, zoom);

    // Apply pixel buffer to offscreen canvas
    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    // 2. Wall Casting
    this.castWalls(this.offscreenCtx, player, map, textures, decals, w, h, time, zoom);

    // 3. Sprite Casting
    const allSprites = [...enemies, ...items, ...particles];
    this.castSprites(this.offscreenCtx, player, allSprites, textures, w, h, zoom);

    // 4. Muzzle Flash Lighting
    if (isShooting) {
      this.offscreenCtx.fillStyle = 'rgba(255, 255, 200, 0.15)';
      this.offscreenCtx.fillRect(0, 0, w, h);
    }

    // Draw final output to main canvas
    ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  private castFloorAndCeiling(player: Player, textures: Record<number, Texture[]>, w: number, h: number, zoom: number) {
    const floorTexture = textures[CellType.FLOOR][0];
    const ceilingTexture = textures[CellType.CEILING][0];
    if (!floorTexture || !ceilingTexture) return;

    const wallHeight = 1.0;
    const camHeight = 0.5 + player.z;
    const pitch = player.pitch;
    const playerZ = 0.5 + player.z;

    for (let y = 0; y < h; y++) {
      const isFloor = y > h / 2 + pitch;
      const p = isFloor ? (y - h / 2 - pitch) : (h / 2 - y + pitch);

      if (p === 0) continue;

      // Correct perspective: 
      const zDiff = isFloor ? camHeight : (wallHeight - camHeight);
      // Apply Zoom to vertical distance calculation
      const rowDistance = (h * zDiff * zoom) / p;

      const floorStepX = rowDistance * (player.plane.x * 2) / w;
      const floorStepY = rowDistance * (player.plane.y * 2) / w;

      let floorX = player.pos.x + rowDistance * (player.dir.x - player.plane.x);
      let floorY = player.pos.y + rowDistance * (player.dir.y - player.plane.y);

      const fogDistance = 20.0;
      const fogAmount = Math.min(1, rowDistance / fogDistance);

      for (let x = 0; x < w; x++) {
        const tx = Math.floor(floorTexture.width * (floorX - Math.floor(floorX))) & (floorTexture.width - 1);
        const ty = Math.floor(floorTexture.height * (floorY - Math.floor(floorY))) & (floorTexture.height - 1);

        const texIndex = ty * floorTexture.width + tx;
        let color = isFloor ? floorTexture.data[texIndex] : ceilingTexture.data[texIndex];

        if (fogAmount > 0) {
          const fogFactor = 1 - fogAmount * 0.7;
          const r = (color & 0xFF) * fogFactor;
          const g = ((color >> 8) & 0xFF) * fogFactor;
          const b = ((color >> 16) & 0xFF) * fogFactor;
          color = (color & 0xFF000000) | (b << 16) | (g << 8) | r;
        }

        this.buffer[y * w + x] = color;

        floorX += floorStepX;
        floorY += floorStepY;
      }
    }
  }

  private castWalls(
    ctx: CanvasRenderingContext2D,
    player: Player,
    map: number[][],
    textures: Record<number, Texture[]>,
    decals: Decal[],
    w: number,
    h: number,
    time: number,
    zoom: number
  ) {
    const camHeight = 0.5 + player.z;

    for (let x = 0; x < w; x++) {
      const cameraX = 2 * x / w - 1;
      const rayDirX = player.dir.x + player.plane.x * cameraX;
      const rayDirY = player.dir.y + player.plane.y * cameraX;

      let mapX = Math.floor(player.pos.x);
      let mapY = Math.floor(player.pos.y);

      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);

      let stepX, stepY, sideDistX, sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (player.pos.x - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - player.pos.x) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (player.pos.y - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - player.pos.y) * deltaDistY;
      }

      let hit = 0, side = 0, wallType = 0;
      while (hit === 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (map[mapX] && map[mapX][mapY] > 0) {
          hit = 1;
          wallType = map[mapX][mapY];
        }
      }

      const perpWallDist = side === 0 ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
      this.zBuffer[x] = perpWallDist;

      // Apply Zoom to Wall Scale
      const scale = (h / perpWallDist) * zoom;

      // Fixed Wall Height (Standard)
      const wallHeight = 1.0;

      // Perspective Projection:
      const drawStart = (h / 2) + player.pitch - (wallHeight - camHeight) * scale;
      const drawEnd = (h / 2) + player.pitch + (camHeight) * scale;

      const lineHeight = drawEnd - drawStart;

      const texFrames = textures[wallType] || textures[1];
      const frameIdx = texFrames.length > 1 ? Math.floor(time / 200) % texFrames.length : 0;
      const texture = texFrames[frameIdx];

      let wallX = side === 0 ? player.pos.y + perpWallDist * rayDirY : player.pos.x + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * texture.width);
      if (side === 0 && rayDirX > 0) texX = texture.width - texX - 1;
      if (side === 1 && rayDirY < 0) texX = texture.width - texX - 1;

      const clippedStart = Math.max(0, drawStart);
      const clippedEnd = Math.min(h - 1, drawEnd);

      if (clippedEnd > clippedStart) {
        ctx.drawImage(
          texture.image,
          texX, 0, 1, texture.height,
          x, clippedStart, 1, clippedEnd - clippedStart
        );

        if (side === 1) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(x, clippedStart, 1, clippedEnd - clippedStart);
        }

        const sliceDecals = decals.filter(d => d.mapX === mapX && d.mapY === mapY && d.side === side && Math.abs(d.wallX - wallX) < 0.01);
        sliceDecals.forEach(d => {
          const decalY = drawStart + d.wallY * lineHeight;
          ctx.fillStyle = `rgba(30, 30, 30, ${d.life})`;
          ctx.fillRect(x, decalY - 2, 1, 4);
        });

        const fogDistance = 18.0;
        const fogAmount = Math.min(1, perpWallDist / fogDistance);
        if (fogAmount > 0) {
          ctx.fillStyle = `rgba(30, 30, 40, ${fogAmount * 0.6})`;
          ctx.fillRect(x, clippedStart, 1, clippedEnd - clippedStart);
        }
      }
    }
  }

  private castSprites(
    ctx: CanvasRenderingContext2D,
    player: Player,
    sprites: any[],
    textures: Record<number, Texture[]>,
    w: number,
    h: number,
    zoom: number
  ) {
    const spriteOrder = sprites
      .map((sprite) => {
        const dist = (player.pos.x - sprite.pos.x) ** 2 + (player.pos.y - sprite.pos.y) ** 2;
        return { sprite, dist };
      })
      .sort((a, b) => b.dist - a.dist);

    for (const item of spriteOrder) {
      const { sprite, dist } = item;
      const spriteX = sprite.pos.x - player.pos.x;
      const spriteY = sprite.pos.y - player.pos.y;
      const invDet = 1.0 / (player.plane.x * player.dir.y - player.dir.x * player.plane.y);

      const transformX = invDet * (player.dir.y * spriteX - player.dir.x * spriteY);
      const transformY = invDet * (-player.plane.y * spriteX + player.plane.x * spriteY);

      if (transformY <= 0) continue;

      const spriteScreenX = Math.floor((w / 2) * (1 + transformX / transformY));

      // Apply Zoom to Sprites
      const spriteHeight = Math.abs(Math.floor(h / transformY)) * zoom;
      const spriteWidth = Math.abs(Math.floor(h / transformY)) * zoom;

      const vOffset = player.pitch + (player.z * h * zoom) / transformY;

      const drawStartY = -spriteHeight / 2 + h / 2 + vOffset;
      const drawEndY = spriteHeight / 2 + h / 2 + vOffset;

      const drawStartX = Math.max(0, -spriteWidth / 2 + spriteScreenX);
      const drawEndX = Math.min(w - 1, spriteWidth / 2 + spriteScreenX);

      const texture = textures[sprite.textureId]?.[0];
      if (!texture) continue;

      for (let stripe = Math.floor(drawStartX); stripe < Math.floor(drawEndX); stripe++) {
        const texX = Math.floor((stripe - (-spriteWidth / 2 + spriteScreenX)) * texture.width / spriteWidth);
        if (transformY > 0 && stripe > 0 && stripe < w && transformY < this.zBuffer[stripe]) {
          const clippedYStart = Math.max(0, drawStartY);
          const clippedYEnd = Math.min(h - 1, drawEndY);

          if (clippedYEnd > clippedYStart) {
            ctx.drawImage(
              texture.image,
              texX, 0, 1, texture.height,
              stripe, clippedYStart, 1, clippedYEnd - clippedYStart
            );

            // Fog was removed from here to eliminate the black border artifact around transparent sprite regions.
          }
        }
      }
    }
  }
}
