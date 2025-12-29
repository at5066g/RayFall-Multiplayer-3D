
import React, { useEffect, useRef, useState } from 'react';
import { NetworkManager } from '../engine/NetworkManager';
import { Raycaster } from '../engine/Raycaster';
import { generateTextures } from '../engine/textures';
import { SoundManager } from '../engine/SoundManager';
import {
  type GameState,
  type Player,
  type Vector2,
  type Enemy,
  EnemyState,
  CellType,
  Difficulty,
  type DifficultyLevel,
  type Decal
} from '../types';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  WORLD_MAP,
  MOVE_SPEED,
  SPAWN_POINTS,
  MAX_ENEMIES,
  SPAWN_INTERVAL,
  FOV,
  CLIP_SIZE,
  MAX_RESERVE,
  START_AMMO,
  START_RESERVE,
  RELOAD_TIME,
  WEAPONS
} from '../constants';
import { Minimap } from './Minimap';

const GRAVITY = 25.0;
const JUMP_FORCE = 8.5;

const safeRequestPointerLock = (element: HTMLCanvasElement) => {
  try {
    const promise = (element as any).requestPointerLock({ unadjustedMovement: true }) || (element as any).requestPointerLock();
    if (promise && typeof promise.catch === 'function') promise.catch(() => { });
  } catch (e) { }
};

const createInitialPlayer = (): Player => ({
  pos: { x: 22, y: 12 },
  dir: { x: -1, y: 0 },
  plane: { x: 0, y: 0.66 },
  health: 100,
  ammo: START_AMMO,
  ammoReserve: START_RESERVE,
  z: 0,
  vz: 0,
  pitch: 0,
  weaponIndex: 0
});

interface GameProps {
  difficulty: DifficultyLevel;
  onExit: () => void;
  isMultiplayer?: boolean;
}

export const Game: React.FC<GameProps> = ({ difficulty, onExit, isMultiplayer = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weaponRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const raycaster = useRef(new Raycaster(SCREEN_WIDTH, SCREEN_HEIGHT));
  const soundManager = useRef(new SoundManager());

  const keys = useRef<Record<string, boolean>>({});
  const isMouseDown = useRef(false);
  const isZooming = useRef(false);
  const currentFovScale = useRef(FOV);

  const walkCycle = useRef(0);
  const recoilImpulse = useRef(0);
  const swayPos = useRef({ x: 0, y: 0 });
  const swayTarget = useRef({ x: 0, y: 0 });
  const lastShotTime = useRef(0);
  const lastDryFireTime = useRef(0);

  const [isShooting, setIsShooting] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hitMarkerOpacity, setHitMarkerOpacity] = useState(0);
  const hitMarkerOpacityRef = useRef(0); // Ref for game loop access

  const [isHeadshot, setIsHeadshot] = useState(false);

  const [damageFlash, setDamageFlash] = useState(0);
  const damageFlashRef = useRef(0); // Ref for game loop access

  const [sensitivity, setSensitivity] = useState(1.0);
  const [isInfiniteAmmo, setIsInfiniteAmmo] = useState(!isMultiplayer);
  const [timeLeft, setTimeLeft] = useState(300); // Default 5 mins
  const [gameOverData, setGameOverData] = useState<{ winnerId: string, winnerName: string, scores: any } | null>(null);
  const [isScoped, setIsScoped] = useState(false);

  const shootTimer = useRef<number | null>(null);
  const lastSpawnTime = useRef(0);
  const enemyIdCounter = useRef(0);
  const itemIdCounter = useRef(0);

  const stateRef = useRef<GameState>({
    player: createInitialPlayer(),
    enemies: [],
    items: [],
    particles: [],
    decals: [],
    map: WORLD_MAP,
    lastTime: performance.now(),
    score: 0,
  });

  const [uiState, setUiState] = useState<GameState>(stateRef.current);
  const texturesRef = useRef(generateTextures());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setIsPaused(prev => !prev);
      }
      if (e.code === 'KeyR') reload();
      if (e.code === 'Space') jump();
      keys.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const handleLockChange = () => {
      if (!document.pointerLockElement && !isGameOver) setIsPaused(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('pointerlockchange', handleLockChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, [isGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (stateRef.current.player.health <= 0 || isPaused) return;
      if (document.pointerLockElement !== canvas) {
        safeRequestPointerLock(canvas);
        soundManager.current.init();
      } else {
        if (e.button === 0) {
          isMouseDown.current = true;
          shoot();
        } else if (e.button === 2) {
          isZooming.current = true;
          setIsScoped(true);
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = false;
      if (e.button === 2) {
        isZooming.current = false;
        setIsScoped(false);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (stateRef.current.player.health <= 0 || isPaused) return;
      if (document.pointerLockElement === canvas) {
        const { player } = stateRef.current;
        const baseSensitivityX = isZooming.current ? 0.0005 : 0.0022;
        const sensitivityX = baseSensitivityX * sensitivity;
        const sensitivityY = 1.0;
        const rotX = -e.movementX * sensitivityX;
        const oldDirX = player.dir.x;
        player.dir.x = player.dir.x * Math.cos(rotX) - player.dir.y * Math.sin(rotX);
        player.dir.y = oldDirX * Math.sin(rotX) + player.dir.y * Math.cos(rotX);
        player.pitch -= e.movementY * sensitivityY;
        const maxPitch = SCREEN_HEIGHT / 1.5;
        player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch));

        // Weapon Sway Input (Only when moving)
        const isMoving = keys.current['KeyW'] || keys.current['KeyS'] || keys.current['KeyA'] || keys.current['KeyD'];
        if (isMoving) {
          swayTarget.current.x += e.movementX * 0.5;
          swayTarget.current.y += e.movementY * 0.5;
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (isPaused || isReloading || stateRef.current.player.health <= 0) return;
      const { player } = stateRef.current;
      if (e.deltaY > 0) {
        player.weaponIndex = (player.weaponIndex + 1) % WEAPONS.length;
      } else {
        player.weaponIndex = (player.weaponIndex - 1 + WEAPONS.length) % WEAPONS.length;
      }
      soundManager.current.playAmmoPickup();
    };

    document.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [isPaused, isReloading, sensitivity, isInfiniteAmmo]);

  const jump = () => {
    const { player } = stateRef.current;
    if (player.z === 0) player.vz = JUMP_FORCE;
  };

  const restartGame = () => {
    stateRef.current = {
      player: createInitialPlayer(),
      enemies: [],
      items: [],
      particles: [],
      decals: [],
      map: WORLD_MAP,
      lastTime: performance.now(),
      score: 0,
    };
    lastSpawnTime.current = performance.now();
    recoilImpulse.current = 0;
    setIsGameOver(false);
    setIsPaused(false);
    setIsReloading(false);
    setUiState(stateRef.current);
    if (canvasRef.current) safeRequestPointerLock(canvasRef.current);
  };

  const reload = () => {
    const { player } = stateRef.current;
    if (isInfiniteAmmo || isReloading || player.ammo === CLIP_SIZE || player.ammoReserve === 0) return;
    if (player.health <= 0) return;
    setIsReloading(true);

    if (player.weaponIndex !== 1) {
      soundManager.current.playReload();
    }

    setTimeout(() => {
      const needed = CLIP_SIZE - player.ammo;
      const available = Math.min(needed, player.ammoReserve);
      player.ammo += available;
      player.ammoReserve -= available;
      setIsReloading(false);
    }, RELOAD_TIME);
  };

  const spawnEnemy = (now: number) => {
    if (stateRef.current.enemies.length >= MAX_ENEMIES) return;
    if (now - lastSpawnTime.current < SPAWN_INTERVAL) return;
    const point = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    const dx = point.x - stateRef.current.player.pos.x;
    const dy = point.y - stateRef.current.player.pos.y;
    if (Math.sqrt(dx * dx + dy * dy) < 5.0) return;
    stateRef.current.enemies.push({
      id: ++enemyIdCounter.current,
      pos: { x: point.x, y: point.y },
      dir: { x: 0, y: 1 },
      state: EnemyState.IDLE,
      health: 100,
      textureId: CellType.ENEMY_GUARD,
      lastAttackTime: now,
      animationTimer: 0
    });
    lastSpawnTime.current = now;
  };

  const shoot = () => {
    const { player, enemies, map, decals } = stateRef.current;
    const weapon = WEAPONS[player.weaponIndex];
    const now = performance.now();

    if (player.health <= 0 || isReloading) return;
    if (now - lastShotTime.current < weapon.fireRate) return;

    if (!isInfiniteAmmo) {
      if (player.ammo <= 0) {
        if (player.ammoReserve > 0) reload();
        else if (now - lastDryFireTime.current > 400) {
          soundManager.current.playDryFire();
          lastDryFireTime.current = now;
        }
        return;
      }
      player.ammo--;
    }

    lastShotTime.current = now;
    soundManager.current.playShoot(weapon.isAuto);
    recoilImpulse.current = weapon.recoil;
    setIsShooting(true);
    if (shootTimer.current) clearTimeout(shootTimer.current);
    shootTimer.current = window.setTimeout(() => setIsShooting(false), Math.min(weapon.fireRate, 50));

    // Find closest wall hit for Decal spawning
    let mapX = Math.floor(player.pos.x);
    let mapY = Math.floor(player.pos.y);
    const deltaDistX = Math.abs(1 / player.dir.x);
    const deltaDistY = Math.abs(1 / player.dir.y);
    let stepX = player.dir.x < 0 ? -1 : 1;
    let stepY = player.dir.y < 0 ? -1 : 1;
    let sideDistX = player.dir.x < 0 ? (player.pos.x - mapX) * deltaDistX : (mapX + 1.0 - player.pos.x) * deltaDistX;
    let sideDistY = player.dir.y < 0 ? (player.pos.y - mapY) * deltaDistY : (mapY + 1.0 - player.pos.y) * deltaDistY;
    let side = 0;
    while (map[mapX] && map[mapX][mapY] === 0) {
      if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
      else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
    }
    const wallDist = side === 0 ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
    let wallX = side === 0 ? player.pos.y + wallDist * player.dir.y : player.pos.x + wallDist * player.dir.x;
    wallX -= Math.floor(wallX);

    // Create persistent wall decal
    decals.push({ mapX, mapY, side, wallX, wallY: 0.5 + (Math.random() - 0.5) * 0.1, life: 1.0 });

    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;
    let hitRelativeY = 0;

    enemies.forEach((enemy: Enemy) => {
      if (enemy.health <= 0) return;
      const dx = enemy.pos.x - player.pos.x, dy = enemy.pos.y - player.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dot = dx * player.dir.x + dy * player.dir.y;
      if (dot > 0 && dist < wallDist) {
        const perpDist = Math.abs(dx * player.dir.y - dy * player.dir.x);
        if (perpDist < 0.5 && hasLineOfSight(player.pos, enemy.pos, map)) {
          const transformY = dist;
          // Apply Zoom to Hit Detection (Match Raycaster Logic)
          const zoom = FOV / currentFovScale.current;
          const vOffset = player.pitch + (player.z * SCREEN_HEIGHT * zoom) / transformY;
          const spriteHeight = (SCREEN_HEIGHT / transformY) * zoom;

          const drawStartY = -spriteHeight / 2 + SCREEN_HEIGHT / 2 + vOffset;
          const drawEndY = spriteHeight / 2 + SCREEN_HEIGHT / 2 + vOffset;
          const crosshairY = SCREEN_HEIGHT / 2;
          if (crosshairY >= drawStartY && crosshairY <= drawEndY) {
            if (dist < closestDist) { closestDist = dist; closestEnemy = enemy; hitRelativeY = (crosshairY - drawStartY) / (drawEndY - drawStartY); }
          }
        }
      }
    });

    if (closestEnemy) {
      const target = closestEnemy as Enemy;
      const isHead = hitRelativeY < 0.25;
      const dmg = isHead ? (weapon.damage * weapon.headshotMultiplier) : weapon.damage;

      if (isMultiplayer && target.networkId) {
        // Multiplayer Hit
        NetworkManager.getInstance().sendHit(target.networkId, dmg);
        // Visual feedback only (Server will send health update)
        soundManager.current.playEnemyHit(target.pos);
        setHitMarkerOpacity(1.0);
        hitMarkerOpacityRef.current = 1.0;
        if (isHead) {
          setIsHeadshot(true);
          setTimeout(() => setIsHeadshot(false), 200);
        }
      } else {
        // Singleplayer Logic
        target.health -= dmg;
        setHitMarkerOpacity(1.0);
        hitMarkerOpacityRef.current = 1.0; // Sync Ref
        if (isHead) {
          setIsHeadshot(true);
          setTimeout(() => setIsHeadshot(false), 200);
        }
        if (target.health <= 0) {
          soundManager.current.playEnemyDeath(target.pos);
          stateRef.current.score += 100;
          stateRef.current.items.push({
            id: ++itemIdCounter.current,
            pos: { x: target.pos.x, y: target.pos.y },
            // Restored: Randomized drop between Health and Ammo
            textureId: Math.random() > 0.5 ? CellType.HEALTH_ORB : CellType.AMMO_BOX,
            spawnTime: performance.now()
          });
        } else {
          soundManager.current.playEnemyHit(target.pos);
          target.state = EnemyState.CHASE;
        }
      }
    }
  };

  const hasLineOfSight = (p1: Vector2, p2: Vector2, map: number[][]): boolean => {
    const steps = 25;
    const dx = (p2.x - p1.x) / steps, dy = (p2.y - p1.y) / steps;
    let cx = p1.x, cy = p1.y;
    for (let i = 0; i < steps; i++) {
      cx += dx; cy += dy;
      if (map[Math.floor(cx)]?.[Math.floor(cy)] > 0) return false;
    }
    return true;
  };

  const updateAI = (dt: number, now: number) => {
    const { player, enemies, map } = stateRef.current;
    const ENEMY_SPEED = 2.5, AGGRO_RANGE = 12.0, ATTACK_RANGE = 1.0;

    let damageMelee = 10, damageRanged = 5, shootCooldown = 2500;
    if (difficulty === Difficulty.MEDIUM) {
      damageMelee = 20; damageRanged = 10; shootCooldown = 1800;
    } else if (difficulty === Difficulty.HARD) {
      damageMelee = 35; damageRanged = 20; shootCooldown = 1200;
    }

    stateRef.current.enemies = enemies.filter(e => e.health > 0);
    stateRef.current.enemies.forEach((enemy: Enemy) => {
      const dx = player.pos.x - enemy.pos.x, dy = player.pos.y - enemy.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const canSee = hasLineOfSight(enemy.pos, player.pos, map);

      if (enemy.state === EnemyState.IDLE && dist < AGGRO_RANGE && canSee) {
        enemy.state = EnemyState.CHASE;
      }

      if (enemy.state === EnemyState.CHASE) {
        if (dist > ATTACK_RANGE) {
          const dirX = dx / dist, dirY = dy / dist;
          const moveStep = ENEMY_SPEED * dt;
          if (map[Math.floor(enemy.pos.x + dirX * moveStep)]?.[Math.floor(enemy.pos.y)] === 0) enemy.pos.x += dirX * moveStep;
          if (map[Math.floor(enemy.pos.x)]?.[Math.floor(enemy.pos.y + dirY * moveStep)] === 0) enemy.pos.y += dirY * moveStep;
        }

        // Enemy Shoot Logic & Audio
        if (now - enemy.lastAttackTime > 1000 && Math.random() < 0.02) {
          soundManager.current.playEnemyShoot(enemy.pos);
          enemy.lastAttackTime = now;
          // Simple hitscan vs player
          if (Math.random() < 0.4) {
            soundManager.current.playPlayerDamage();
            player.health -= 10;
            damageFlashRef.current = 0.8; // Trigger Flash via Ref
            setDamageFlash(0.8); // Trigger Flash
          }
        } else if (dist < 9.0 && canSee) {
          if (now - enemy.lastAttackTime > shootCooldown) {
            enemy.lastAttackTime = now;
            player.health -= damageRanged;
            damageFlashRef.current = 0.8; // Trigger Flash via Ref
            setDamageFlash(0.8); // Trigger Flash
            soundManager.current.playEnemyShoot();
            soundManager.current.playPlayerDamage();
          }
        }
      }
    });
  };

  const lastUiUpdate = useRef(0);

  const tick = (time: number) => {
    // if (isPaused) { stateRef.current.lastTime = time; requestRef.current = requestAnimationFrame(tick); return; } // OLD PAUSE

    // NEW PAUSE: If Multiplayer, keep rendering. If Singleplayer, hard pause.
    if (isPaused && !isMultiplayer) { stateRef.current.lastTime = time; requestRef.current = requestAnimationFrame(tick); return; }

    const dt = Math.min(0.1, (time - stateRef.current.lastTime) / 1000);
    stateRef.current.lastTime = time;

    // Skip Input/Physics if paused (but allow rendering)
    if (!isPaused) {
      if (isMouseDown.current && WEAPONS[stateRef.current.player.weaponIndex].isAuto) shoot();
    }

    if (hitMarkerOpacityRef.current > 0) {
      hitMarkerOpacityRef.current = Math.max(0, hitMarkerOpacityRef.current - dt * 2.0);
      setHitMarkerOpacity(hitMarkerOpacityRef.current);
    }
    if (damageFlashRef.current > 0) {
      damageFlashRef.current = Math.max(0, damageFlashRef.current - dt * 1.3);
      setDamageFlash(damageFlashRef.current);
    }
    if (stateRef.current.player.health > 0) {
      if (!isPaused) {
        updatePhysics(dt);
      } else {
        // Even if paused, we might want simple gravity or nothing? For now, freeze local player.
      }

      if (!isMultiplayer) {
        updateAI(dt, time);
        spawnEnemy(time);
      } else {
        // MULTIPLAYER SYNC
        const net = NetworkManager.getInstance();

        // 1. Send my position
        const p = stateRef.current.player;
        // Calculate angle from dir vector
        const angle = Math.atan2(p.dir.y, p.dir.x);
        net.sendMove(p.pos.x, p.pos.y, angle);

        // 2. Update network entities (Treat as pseudo-enemies for rendering)
        const allPlayers = net.players;
        const myId = net.playerId;
        const renderList: Enemy[] = [];

        Object.values(allPlayers).forEach((np: any) => {
          if (np.id === myId) return; // Don't render self

          // If dead, use dead texture or simple logic
          if (np.isDead) {
            // console.log(`DEBUG: Rendering Dead Player ${np.id}`);
          }
          const texture = np.isDead ? CellType.ENEMY_GUARD_DEAD : CellType.ENEMY_GUARD;
          const state = np.isDead ? EnemyState.DEAD : EnemyState.CHASE;

          renderList.push({
            id: 999, // dummy id
            pos: { x: np.x, y: np.y },
            dir: { x: Math.cos(np.angle), y: Math.sin(np.angle) },
            health: np.health,
            state: state,
            type: 'SOLDIER',
            textureId: texture,
            lastAttackTime: 0,
            path: [],
            currentFrame: 0,
            animationTimer: 0,
            networkId: np.id // Store socket ID for hit detection
          } as Enemy);
        });

        stateRef.current.enemies = renderList;
      }

      stateRef.current.particles.forEach(p => p.life -= dt * 2);
      stateRef.current.particles = stateRef.current.particles.filter(p => p.life > 0);
      stateRef.current.decals.forEach(d => d.life -= dt * 0.1);
      stateRef.current.decals = stateRef.current.decals.filter(d => d.life > 0);
    } else if (!isGameOver) setIsGameOver(true);

    // Render the game (Canvsa) - Always run at full speed
    render();

    // Update UI (React) - Throttled to ~10-15 FPS to prevent React overhead lag
    if (time - lastUiUpdate.current > 100) { // 100ms = 10 updates per second
      lastUiUpdate.current = time;
      setUiState({ ...stateRef.current });
    }

    requestRef.current = requestAnimationFrame(tick);
  };

  const updatePhysics = (dt: number) => {
    const { player, map, items } = stateRef.current;
    if (player.z > 0 || player.vz !== 0) {
      player.vz -= GRAVITY * dt;
      player.z += player.vz * dt;
      if (player.z < 0) { player.z = 0; player.vz = 0; }
    }
    // Movement Logic (Moved UP to be available for Sway)
    let dx = 0, dy = 0;
    if (keys.current['KeyW']) { dx += player.dir.x; dy += player.dir.y; }
    if (keys.current['KeyS']) { dx -= player.dir.x; dy -= player.dir.y; }
    if (keys.current['KeyA']) { dx -= player.dir.y; dy += player.dir.x; }
    if (keys.current['KeyD']) { dx += player.dir.y; dy -= player.dir.x; }
    const len = Math.sqrt(dx * dx + dy * dy);

    // Weapon Sway Physics
    const isMoving = len > 0;

    if (!isMoving) {
      // Hard stop logic: Force target to 0 immediately when stopped
      swayTarget.current.x = 0;
      swayTarget.current.y = 0;

      // Fast decay for position to eliminate "vibration"
      swayPos.current.x += (0 - swayPos.current.x) * 20 * dt;
      swayPos.current.y += (0 - swayPos.current.y) * 20 * dt;

      // Snap to zero if very small to prevent micro-jitter
      if (Math.abs(swayPos.current.x) < 0.1) swayPos.current.x = 0;
      if (Math.abs(swayPos.current.y) < 0.1) swayPos.current.y = 0;
    } else {
      // Normal decay when moving (allows build up)
      swayTarget.current.x -= swayTarget.current.x * 10 * dt;
      swayTarget.current.y -= swayTarget.current.y * 10 * dt;

      // Smooth interpolation
      swayPos.current.x += (swayTarget.current.x - swayPos.current.x) * 10 * dt;
      swayPos.current.y += (swayTarget.current.y - swayPos.current.y) * 10 * dt;
    }

    // Clamp sway
    const maxSway = 40;
    swayPos.current.x = Math.max(-maxSway, Math.min(maxSway, swayPos.current.x));
    swayPos.current.y = Math.max(-maxSway, Math.min(maxSway, swayPos.current.y));

    // Audio Listener Update relative to player
    // Calculate player angle from dir vector
    const playerAngle = Math.atan2(player.dir.y, player.dir.x);
    soundManager.current.updateListener(player.pos.x, player.pos.y, playerAngle);

    // Zoom Logic
    const targetFov = isZooming.current ? 0.33 : FOV; // 0.33 = 2x Zoom (0.66 / 2)
    currentFovScale.current += (targetFov - currentFovScale.current) * 8.0 * dt;
    player.plane.x = player.dir.y * currentFovScale.current;
    player.plane.y = -player.dir.x * currentFovScale.current;

    const now = performance.now();
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (now - item.spawnTime > 5000) { items.splice(i, 1); continue; }
      if (Math.sqrt((player.pos.x - item.pos.x) ** 2 + (player.pos.y - item.pos.y) ** 2) < 0.8) {
        if (isMultiplayer) {
          // Server Authoritative Pickup
          NetworkManager.getInstance().sendPickup(item.id);
        } else {
          // Client Authoritative (Singleplayer)
          if (item.textureId === CellType.HEALTH_ORB) { soundManager.current.playHeal(); player.health = Math.min(100, player.health + 30); }
          else { soundManager.current.playAmmoPickup(); player.ammoReserve = Math.min(MAX_RESERVE, player.ammoReserve + CLIP_SIZE * 2); }
          items.splice(i, 1);
        }
      }
    }

    if (len > 0) {
      const move = (MOVE_SPEED * dt) / len;
      if (map[Math.floor(player.pos.x + dx * move)]?.[Math.floor(player.pos.y)] === 0) player.pos.x += dx * move;
      if (map[Math.floor(player.pos.x)]?.[Math.floor(player.pos.y + dy * move)] === 0) player.pos.y += dy * move;
      walkCycle.current += dt * 15;
    }
    if (recoilImpulse.current > 0) recoilImpulse.current = Math.max(0, recoilImpulse.current - dt * 8);
    if (weaponRef.current) {
      const bobY = len > 0 && player.z === 0 ? Math.sin(walkCycle.current * 1.5) * 8 : 0;
      const bobX = len > 0 && player.z === 0 ? Math.cos(walkCycle.current * 0.75) * 6 : 0;

      // Combine Sway + Bobbing + Recoil
      weaponRef.current.style.transform = `
        translateX(calc(-50% + ${-swayPos.current.x + bobX}px)) 
        translateY(${25 + Math.abs(bobY) + swayPos.current.y + (Math.abs(swayPos.current.x) * 0.3) + recoilImpulse.current * 45}px) 
        rotate(${-swayPos.current.x * 0.5 + bobX * 0.5}deg) 
        scale(${isZooming.current ? 1.15 : 1})
      `;
    }
  };

  const render = () => {
    const ctx = canvasRef.current?.getContext('2d', { alpha: false });
    const zoom = FOV / currentFovScale.current;
    if (ctx) raycaster.current.render(ctx, stateRef.current, texturesRef.current, isShooting, zoom);
  };

  useEffect(() => {
    const net = NetworkManager.getInstance();
    if (isMultiplayer) {
      net.onPlayerRespawn = (pos) => {
        stateRef.current.player.pos.x = pos.x;
        stateRef.current.player.pos.y = pos.y;
        stateRef.current.player.health = 100;
        // Refill Ammo on Respawn (Hardcore Loop)
        stateRef.current.player.ammo = START_AMMO;
        stateRef.current.player.ammoReserve = START_RESERVE;
      };
      net.onPlayerDied = (data) => {
        // data.scores is a map of { playerId: score }
        if (data.scores && net.playerId && data.scores[net.playerId]) {
          stateRef.current.score = data.scores[net.playerId] * 100; // Assuming 1 kill = 100 points
        }
      };

      net.onHealthUpdate = (data) => {
        if (data.id === net.playerId) {
          const oldHealth = stateRef.current.player.health;
          stateRef.current.player.health = data.health;

          // Visual feedback if damaged
          if (data.health < oldHealth) {
            setDamageFlash(0.6);
            damageFlashRef.current = 0.6;
            soundManager.current.playPlayerDamage();
          }
        }
      };

      net.onItemSpawn = (item) => {
        console.log(`DEBUG: Adding Item ${item.id} to World at ${item.x},${item.y}`);
        stateRef.current.items.push({
          id: item.id,
          pos: { x: item.x, y: item.y },
          textureId: item.type,
          spawnTime: performance.now()
        });
      };

      net.onItemRemoved = (itemId) => {
        stateRef.current.items = stateRef.current.items.filter(i => i.id !== itemId);
      };

      net.onItemCollected = (data) => {
        if (data.type === CellType.HEALTH_ORB) {
          soundManager.current.playHeal();
          stateRef.current.player.health = Math.min(100, stateRef.current.player.health + 30);
        } else {
          soundManager.current.playAmmoPickup();
          stateRef.current.player.ammoReserve = Math.min(MAX_RESERVE, stateRef.current.player.ammoReserve + CLIP_SIZE * 2);
        }
      };
    }
    return () => {
      net.onPlayerRespawn = null;
      net.onPlayerDied = null;
      net.onItemCollected = (data) => {
        if (data.type === CellType.HEALTH_ORB) {
          soundManager.current.playHeal();
          stateRef.current.player.health = Math.min(100, stateRef.current.player.health + 30);
        } else {
          soundManager.current.playAmmoPickup();
          stateRef.current.player.ammoReserve = Math.min(MAX_RESERVE, stateRef.current.player.ammoReserve + CLIP_SIZE * 2);
        }
      };

      net.onTimeUpdate = (time) => {
        setTimeLeft(time);
      };

      net.onGameOver = (data) => {
        setGameOverData(data);
        setIsPaused(true); // Pause local input
        if (document.pointerLockElement) document.exitPointerLock();
      };
    }
    return () => {
      net.onPlayerRespawn = null;
      net.onPlayerDied = null;
      net.onHealthUpdate = null;
      net.onItemSpawn = null;
      net.onItemRemoved = null;
      net.onItemCollected = null;
      net.onTimeUpdate = null;
      net.onGameOver = null;
    };
  }, [isMultiplayer]);

  useEffect(() => { requestRef.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(requestRef.current); }, [isPaused]);

  const currentWeapon = WEAPONS[uiState.player.weaponIndex];

  return (
    <div className="relative group select-none overflow-hidden bg-black border-[12px] border-neutral-900 shadow-2xl">
      <canvas ref={canvasRef} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} className="block cursor-none" style={{ width: '1280px', height: '720px' }} />

      <Minimap gameState={uiState} />

      {/* TACTICAL HUD */}
      <div className="absolute top-0 right-0 p-10 flex flex-col items-end z-20 pointer-events-none">
        <div className="font-mono text-[10px] text-white/40 tracking-[0.3em] uppercase mb-1">Combat Rating</div>
        <div className="font-mono text-4xl font-black text-white">{uiState.score.toString().padStart(4, '0')}</div>
        <div className="mt-4 flex flex-col items-end">
          <div className="font-mono text-[10px] text-green-500/60 tracking-[0.3em] uppercase mb-1">Arsenal</div>
          <div className="font-mono text-xl font-bold text-green-500 bg-green-500/10 px-3 py-1 border-r-2 border-green-500">
            {currentWeapon.name}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-10 flex justify-between items-end z-20 pointer-events-none">
        <div className="flex flex-col gap-1 pl-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" /></svg>
            <div className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-mono">Vitality Scan</div>
          </div>
          <div className={`font-mono text-5xl font-black leading-none ${uiState.player.health > 30 ? 'text-white' : 'text-red-500 animate-pulse'}`}>
            {Math.ceil(uiState.player.health)}%
          </div>
        </div>
        <div className="text-right pr-4 border-r-4 border-white">
          <div className="flex items-center justify-end gap-2 mb-1">
            <div className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-mono">Munitions</div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M14.5 2h-5L7 7v15h10V7l-2.5-5zm-3.5 13h2v2h-2v-2zm0-4h2v2h-2v-2z" /></svg>
          </div>
          <div className="text-white font-mono text-5xl font-black leading-none">
            {isInfiniteAmmo ? '∞' : uiState.player.ammo}<span className="text-xl text-white/20 ml-2">[{isInfiniteAmmo ? '∞' : uiState.player.ammoReserve}]</span>
          </div>
        </div>
      </div>

      {/* CROSSHAIR */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none z-30">
        {!isScoped && (
          <>
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-green-400 -translate-y-1/2 shadow-[0_0_2px_black]" />
            <div className="absolute left-1/2 top-0 w-[2px] h-full bg-green-400 -translate-x-1/2 shadow-[0_0_4px_black]" />
          </>
        )}
        <div className="absolute inset-0 transition-opacity duration-75" style={{ opacity: hitMarkerOpacity }}>
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white -translate-y-1/2 shadow-[0_0_4px_white]" />
          <div className="absolute left-1/2 top-0 w-[2px] h-full bg-white -translate-x-1/2 shadow-[0_0_4px_white]" />
        </div>
      </div>

      {/* DAMAGE FLASH VIGNETTE */}
      <div
        className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-75"
        style={{
          opacity: damageFlash,
          boxShadow: 'inset 0 0 150px 50px rgba(220, 20, 60, 0.9)'
        }}
      />

      {/* SCOPE OVERLAY */}
      {isScoped && (
        <div className="absolute inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-black" style={{ maskImage: 'radial-gradient(circle at 50% 50%, transparent 25%, black 45%)', WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 25%, black 45%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-white/30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-full bg-white/30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/20 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_5px_red]" />
          <div className="absolute top-[55%] left-1/2 -translate-x-1/2 text-[8px] font-mono text-white/40 uppercase tracking-widest">Target Lock: Active</div>
        </div>
      )}

      {/* Weapon Rendering */}
      {!isScoped && (
        <div ref={weaponRef}
          className="absolute bottom-0 left-1/2 w-80 h-80 pointer-events-none z-20 origin-bottom flex items-end justify-center transition-transform duration-75"
          style={{
            transform: `
                  translateX(calc(-50% + ${-swayPos.current.x}px)) 
                  translateY(${Math.abs(swayPos.current.x * 0.3) + swayPos.current.y}px)
                  rotate(${-swayPos.current.x * 0.5}deg)
                `
          }}
        >
          {uiState.player.weaponIndex === 0 ? (
            <div className="relative w-20 h-52 bg-neutral-900 border-x-4 border-neutral-800 shadow-2xl rounded-t-lg">
              <div className="absolute top-0 w-full h-12 bg-neutral-800 rounded-t-md" />
              <div className="absolute top-14 left-1/2 -translate-x-1/2 w-8 h-14 bg-black/40 rounded-full" />
              {isShooting && <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-yellow-500/30 rounded-full blur-2xl animate-ping" />}
            </div>
          ) : (
            <div className="relative w-28 h-60 flex flex-col items-center">
              <div className="w-6 h-32 bg-neutral-800 border-x-2 border-neutral-700 -mb-4 z-0" />
              <div className="relative w-24 h-44 bg-neutral-900 border-x-4 border-neutral-800 shadow-2xl rounded-t-xl z-10 overflow-hidden">
                <div className="absolute top-0 w-full h-16 bg-neutral-800 border-b-2 border-neutral-700" />
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-12 h-20 bg-black/60 rounded-md" />
                <div className="absolute top-4 right-2 w-4 h-8 bg-green-500/20 rounded" />
              </div>
              {isShooting && <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/30 rounded-full blur-3xl animate-pulse" />}
            </div>
          )}
        </div>
      )}

      {/* MULTIPLAYER HUD */}
      {isMultiplayer && (
        <div className="absolute top-4 left-60 z-40 bg-black/60 px-4 py-2 border border-emerald-500 rounded text-emerald-400 font-mono text-sm animate-in fade-in slide-in-from-left-4 duration-500">
          <span className="text-gray-400 text-xs uppercase block tracking-widest">Room ID</span>
          <span className="text-xl font-bold">{NetworkManager.getInstance().roomId}</span>
        </div>
      )}

      {/* MATCH TIMER (Multiplayer Only) */}
      {isMultiplayer && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
          <div className={`px-6 py-2 bg-black/60 border ${timeLeft < 60 ? 'border-red-500 animate-pulse' : 'border-green-500'} rounded text-white font-mono text-xl font-bold tracking-widest`}>
            {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>
      )}

      {/* GAMEOVER SCREEN (Multiplayer) */}
      {gameOverData && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-8 tracking-tighter">
            MISSION COMPLETE
          </h1>
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-lg text-center w-96">
            <div className="text-gray-400 text-sm font-mono uppercase tracking-widest mb-2">Top Operator</div>
            <div className="text-4xl text-white font-bold font-mono mb-6">{gameOverData.winnerName}</div>

            <div className="text-gray-400 text-sm font-mono uppercase tracking-widest mb-2">Combat Score</div>
            <div className="text-6xl text-green-500 font-black font-mono">{gameOverData.scores[gameOverData.winnerId] || 0}</div>
          </div>
          <button
            onClick={onExit}
            className="mt-12 px-8 py-4 bg-white text-black font-bold font-mono uppercase tracking-widest hover:bg-gray-200 transition-colors"
          >
            Return to Lobby
          </button>
        </div>
      )}

      {/* PAUSE */}
      {isPaused && !gameOverData && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-50">
          <h2 className="text-white font-mono text-5xl font-black mb-10 tracking-[0.2em]">TERMINAL PAUSE</h2>
          <div className="flex flex-col gap-6 w-72 mb-10 text-white">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-[10px] text-white/40 uppercase tracking-widest">
                <span>Aim Sensitivity</span>
                <span>{sensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-full accent-green-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Restored: Infinite Ammo Toggle Button */}
            {/* Infinite Ammo Toggle Button (Singleplayer Only) */}
            {!isMultiplayer && (
              <button
                onClick={() => setIsInfiniteAmmo(!isInfiniteAmmo)}
                className={`w-full py-4 font-mono font-black uppercase tracking-widest border transition-all ${isInfiniteAmmo ? 'bg-green-600 border-green-400 text-white' : 'border-white/20 text-white/60 hover:border-white/40'}`}
              >
                Ammo: {isInfiniteAmmo ? 'Infinite' : 'Limited'}
              </button>
            )}

            <button onClick={() => setIsPaused(false)} className="py-4 bg-white text-black font-mono font-black uppercase tracking-widest hover:bg-neutral-200 transition-colors">Resume</button>
            <button onClick={onExit} className="py-4 border-2 border-white text-white font-mono font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">Abort Mission</button>
          </div>
        </div>
      )}

      {isGameOver && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50">
          <h1 className="text-7xl font-black text-red-600 font-mono mb-12">MISSION FAILED</h1>
          <button onClick={restartGame} className="px-12 py-5 bg-red-600 text-white font-mono font-black uppercase tracking-widest">Redeploy</button>
        </div>
      )}
    </div>
  );
};
