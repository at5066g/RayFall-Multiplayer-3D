# RAYFALL

**RAYFALL** is a high-performance, retro-style 3D First-Person Shooter (FPS) engine built from scratch using **React**, **TypeScript**, and **HTML5 Canvas**. It utilizes the classic **Digital Differential Analysis (DDA)** raycasting technique, reminiscent of 90s classics like *Wolfenstein 3D* and *Doom*.

![RAYFALL Preview][https://rayfall.vercel.app]

## 🚀 Features

### Core Engine
- **Custom Raycasting Engine**: A pure TypeScript implementation of the DDA algorithm for wall intersections.
- **Direct Pixel Manipulation**: High-performance rendering using `Uint32Array` buffers to bypass slow Canvas API calls.
- **Z-Buffering**: Accurate sprite-to-wall depth testing for proper occlusion of enemies and items.
- **Verticality**: Support for jumping, gravity, and camera pitch (looking up/down).
- **Floor & Ceiling Casting**: Performance-optimized horizontal plane rendering with distance-based fog.

### Gameplay
- **Tactical Combat**: Semi-auto and automatic weapons with recoil, fire rates, and headshot multipliers.
- **Enemy AI**: Finite State Machine (FSM) driven enemies that idle, chase, and engage in melee or ranged combat.
- **Loot System**: Health and ammo pickups with limited lifetimes spawned from defeated enemies.
- **Difficulty Levels**: Recruit, Veteran, and Nightmare modes affecting damage scales and enemy aggression.

### Visuals & Audio
- **Procedural Textures**: 64x64 textures generated programmatically (bricks, tech panels, animated slime).
- **Dynamic HUD**: Smoothly interpolated (LERP) vitals, ammo counts, and a tactical minimap.
- **Synthesized Audio**: Procedural sound effects (gunshots, reloads, heals) generated via the **Web Audio API**.
- **Visual Effects**: Screen-space muzzle flashes, hit markers, and wall decals (bullet holes).

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Movement** | `W` `A` `S` `D` |
| **Look** | `Mouse` |
| **Shoot** | `Left Click` |
| **Aim / Scope** | `Right Click` |
| **Jump** | `Space` |
| **Reload** | `R` |
| **Switch Weapon** | `Scroll Wheel` |
| **Pause / Menu** | `ESC` |

## 🛠️ Technical Stack

- **Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Rendering**: HTML5 Canvas 2D Context (ImageData buffer)
- **Audio**: Web Audio API

## 🏗️ Project Structure

```text
├── engine/
│   ├── Raycaster.ts     # Core DDA rendering logic
│   ├── textures.ts      # Procedural texture generation
│   └── SoundManager.ts  # Web Audio synthesis logic
├── components/
│   ├── Game.tsx         # Main game loop & React state bridge
│   ├── Minimap.tsx      # 2D tactical overlay
│   └── Homepage.tsx     # Menu system
├── types.ts             # Global TS interfaces & enums
├── constants.ts         # Game balance and map data
└── index.tsx            # Application entry point
```

## ⚡ Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

## 📜 Logic Documentation
For a deep dive into the mathematical implementation of the physics, AI, and rendering systems, please refer to the `logic_documentation.txt` file included in the root directory.

## 📄 License
MIT License - feel free to use this engine as a base for your own raycasting projects!


[def]: https://rayfall.vercel.app