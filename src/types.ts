
export interface Vector2 {
  x: number;
  y: number;
}

export interface Player {
  pos: Vector2;
  dir: Vector2;
  plane: Vector2;
  health: number;
  ammo: number;
  ammoReserve: number;
  z: number;
  vz: number;
  pitch: number;
  weaponIndex: number;
}

export const EnemyState = {
  IDLE: 0,
  CHASE: 1,
  ATTACK: 2,
  DYING: 3,
  DEAD: 4
} as const;

export type EnemyStateValue = typeof EnemyState[keyof typeof EnemyState];

export interface Enemy {
  id: number;
  pos: Vector2;
  dir: Vector2;
  state: EnemyStateValue;
  health: number;
  textureId: number;
  lastAttackTime: number;
  animationTimer: number;
  networkId?: string; // For Multiplayer mapping
}

export interface Item {
  id: number | string;
  pos: Vector2;
  textureId: number;
  spawnTime: number;
}

export interface Particle {
  id: number;
  pos: Vector2;
  textureId: number;
  life: number;
  velocity: Vector2;
}

export interface Decal {
  mapX: number;
  mapY: number;
  side: number;
  wallX: number;
  wallY: number; // Normalized Y on wall [0, 1]
  life: number;
}

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD'
} as const;

export type DifficultyLevel = typeof Difficulty[keyof typeof Difficulty];

export interface GameState {
  player: Player;
  enemies: Enemy[];
  items: Item[];
  particles: Particle[];
  decals: Decal[];
  map: number[][];
  lastTime: number;
  score: number;
}

export interface Texture {
  image: HTMLCanvasElement;
  data: Uint32Array; // Raw pixel data for floor casting
  width: number;
  height: number;
}

export const CellType = {
  EMPTY: 0,
  WALL_1: 1,      // Red Brick
  WALL_2: 2,      // Green Slime (Animated)
  WALL_3: 3,      // Blue Tech (Animated)
  WALL_4: 4,      // Wood/Pipes
  WALL_WINDOW: 5, // Window
  FLOOR: 100,
  CEILING: 101,
  HEALTH_ORB: 50,
  AMMO_BOX: 51,
  ENEMY_GUARD: 99,
  ENEMY_GUARD_WALK: 98,
  ENEMY_GUARD_DEAD: 97,
  PARTICLE_BLOOD: 200,
  PARTICLE_IMPACT: 201
} as const;

export type CellTypeValue = typeof CellType[keyof typeof CellType];
