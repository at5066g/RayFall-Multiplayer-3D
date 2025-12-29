import React from 'react';
import { Difficulty, type DifficultyLevel } from '../types';

interface HomepageProps {
  onStart: (difficulty: DifficultyLevel) => void;
  onMultiplayer: () => void;
}

export const Homepage: React.FC<HomepageProps> = ({ onStart, onMultiplayer }) => {
  const [showDifficulty, setShowDifficulty] = React.useState(false);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-2xl p-12 space-y-8 bg-black/80 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 font-mono">
          RAYFALL
        </h1>
        <p className="text-gray-400 tracking-widest uppercase text-sm">Tactical shooter simulation</p>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent" />

      <div className="grid grid-cols-1 w-full gap-4">
        {!showDifficulty ? (
          <>
            {/* MAIN MENU */}
            <button
              onClick={() => setShowDifficulty(true)}
              className="group relative w-full px-8 py-6 bg-gray-900/50 hover:bg-white/10 border border-gray-600 hover:border-white transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-white group-hover:tracking-wider transition-all">SINGLE PLAYER</span>
                <span className="text-xs text-gray-500 font-mono uppercase">Campaign Mode</span>
              </div>
            </button>

            <button
              onClick={onMultiplayer}
              className="group relative w-full px-8 py-6 bg-gray-900/50 hover:bg-emerald-900/30 border border-gray-600 hover:border-emerald-500 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-white group-hover:text-emerald-400 group-hover:tracking-wider transition-all">MULTIPLAYER</span>
                <span className="text-xs text-emerald-500/70 font-mono uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
            </button>
          </>
        ) : (
          <>
            {/* DIFFICULTY SELECT */}
            <div className="w-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center text-gray-500 font-mono text-xs uppercase mb-2">- Select Difficulty -</div>
              <button
                onClick={() => onStart(Difficulty.EASY)}
                className="group relative w-full px-8 py-4 bg-gray-900/50 hover:bg-green-900/30 border border-gray-600 hover:border-green-500 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-green-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <div className="relative flex items-center justify-between">
                  <span className="text-xl font-mono font-bold text-white group-hover:text-green-400">EASY RECRUIT</span>
                  <span className="text-xs text-gray-500 group-hover:text-green-300 font-mono uppercase tracking-wider">Standard Damage</span>
                </div>
              </button>

              <button
                onClick={() => onStart(Difficulty.MEDIUM)}
                className="group relative w-full px-8 py-4 bg-gray-900/50 hover:bg-yellow-900/30 border border-gray-600 hover:border-yellow-500 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-yellow-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <div className="relative flex items-center justify-between">
                  <span className="text-xl font-mono font-bold text-white group-hover:text-yellow-400">HARDENED VETERAN</span>
                  <span className="text-xs text-gray-500 group-hover:text-yellow-300 font-mono uppercase tracking-wider">Increased Damage</span>
                </div>
              </button>

              <button
                onClick={() => onStart(Difficulty.HARD)}
                className="group relative w-full px-8 py-4 bg-gray-900/50 hover:bg-red-900/30 border border-gray-600 hover:border-red-500 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <div className="relative flex items-center justify-between">
                  <span className="text-xl font-mono font-bold text-white group-hover:text-red-400">NIGHTMARE</span>
                  <span className="text-xs text-gray-500 group-hover:text-red-300 font-mono uppercase tracking-wider">High Damage</span>
                </div>
              </button>

              <button
                onClick={() => setShowDifficulty(false)}
                className="w-full py-2 text-gray-500 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors mt-4"
              >
                &lt; Back to Main Menu
              </button>
            </div>
          </>
        )}
      </div>

      <div className="text-xs text-gray-600 font-mono pt-4">
        Controls: WASD to Move • Mouse to Look • Click to Shoot • ESC to Pause
      </div>
    </div>
  );
};