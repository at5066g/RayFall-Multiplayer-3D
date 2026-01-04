# RAYFALL

**RAYFALL** is a high-performance, retro-style 3D First-Person Shooter (FPS) engine built from scratch using **React**, **TypeScript**, and **HTML5 Canvas**. It features a classic **Raycasting Engine** (Wolfenstein 3D style) and fully integrated **Multiplayer Mode**. 



 Might take a few seconds to start the instance -- 
 [RAYFALL Preview - for PC only](https://rayfall.onrender.com)
## 🚀 Features

### Multiplayer Mode (New)
*   **Real-time PVP**: Battle against friends with low-latency position and combat sync.
*   **Lobby System**: Create or Join rooms, set custom Usernames and Match Durations (2m, 5m, 10m).
*   **Hardcore Mechanics**: Limited ammo, loot drops on death, and ammo refill on respawn.
*   **Match Timer**: Server-authoritative countdown and Game Over screen with Winner display.

### Core Engine
*   **Custom Raycasting**: Pure TypeScript implementation of DDA algorithm.
*   **Performance**: Direct `Uint32Array` pixel manipulation for 60+ FPS.
*   **Verticality**: Jumping, looking up/down (Y-Shearing), and variable wall heights.

### Gameplay
*   **Weapons**: Primary assault rifle and secondary pistol with realistic recoil.
*   **Loot**: Health Orbs & Ammo Crates spawned dynamically (or dropped by players).
*   **Difficulty**: Single-player difficulty scaling (Recruit, Veteran, Nightmare).

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Movement** | `W` `A` `S` `D` |
| **Look** | `Mouse` |
| **Shoot** | `Left Click` |
| **Aim** | `Right Click` |
| **Jump** | `Space` |
| **Reload** | `R` |
| **Scores** | `TAB` (Multiplayer) |
| **Pause** | `ESC` |

## 🛠️ Technical Stack

*   **Frontend**: React 19, Vite, TypeScript, TailwindCSS
*   **Backend**: Node.js, Express, Socket.io
*   **Rendering**: HTML5 Canvas 2D (Raycasting)
*   **Audio**: Web Audio API (Procedural Synthesis)

## ⚡ Getting Started

### Prerequisites
*   Node.js (v18+)

### Installation
1.  **Install All Dependencies** (Frontend & Backend):
    ```bash
    npm install && cd server && npm install && cd ..
    ```

2.  **Run Development Server**:
    *   **Frontend**: `npm run dev` (http://localhost:3000)
    *   **Backend**: `node server/index.js` (http://localhost:3002)

3.  **Run Production Mode** (Local):
    ```bash
    npm run build
    npm run start
    ```

## 🌍 Deployment

This project is configured for deployment on **Render.com** (or any Node.js host).

**Build Command:**
```bash
npm install && cd server && npm install && cd .. && npm run build
```

**Start Command:**
```bash
npm run start
```

For a detailed walkthrough, verify `deployment_guide.md` in the repository.

## 📄 License
MIT License.
