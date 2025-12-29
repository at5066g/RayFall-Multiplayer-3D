import React, { useState } from 'react';
import { Game } from './components/Game';
import { Homepage } from './components/Homepage';
import { type DifficultyLevel, Difficulty } from './types';
import { Lobby } from './components/Lobby';

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(null);
  const [view, setView] = useState<'HOME' | 'LOBBY'>('HOME');
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  const handleStartGame = (diff: DifficultyLevel) => {
    setDifficulty(diff);
    setIsMultiplayer(false);
  };

  const handleMultiplayerJoin = (roomId: string) => {
    setDifficulty(Difficulty.MEDIUM); // Default difficulty for MP
    setIsMultiplayer(true);
    // Note: We don't need to store roomId here, NetworkManager handles it.
  };

  const handleExit = () => {
    setDifficulty(null);
    setIsMultiplayer(false);
    setView('HOME');
  };

  return (
    <div className="w-screen h-screen bg-neutral-900 flex items-center justify-center font-sans text-white overflow-hidden relative">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {!difficulty && view === 'HOME' && (
        <Homepage
          onStart={handleStartGame}
          onMultiplayer={() => setView('LOBBY')}
        />
      )}

      {!difficulty && view === 'LOBBY' && (
        <Lobby
          onJoin={handleMultiplayerJoin}
          onBack={() => setView('HOME')}
        />
      )}

      {difficulty && (
        <Game
          difficulty={difficulty}
          onExit={handleExit}
          isMultiplayer={isMultiplayer}
        />
      )}
    </div>
  );
};

export default App;