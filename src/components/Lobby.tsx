import React, { useState, useEffect } from 'react';
import { NetworkManager } from '../engine/NetworkManager';

interface LobbyProps {
    onJoin: (roomId: string) => void;
    onBack: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoin, onBack }) => {
    const [roomIdInput, setRoomIdInput] = useState('');
    const [username, setUsername] = useState('');
    const [duration, setDuration] = useState(5); // Default 5 minutes
    const [status, setStatus] = useState('Connecting to server...');
    const [connected, setConnected] = useState(false);
    const [rooms, setRooms] = useState<any[]>([]);

    useEffect(() => {
        const net = NetworkManager.getInstance();
        net.connect();
        net.requestRoomList(); // Ensure we get the latest list even if already connected

        // Check connection after a short delay or listen to events
        // Ideally NetworkManager would expose connection state
        setTimeout(() => {
            if (net.playerId) {
                setConnected(true);
                setStatus('Connected to Region: Local');
            } else {
                setStatus('Connection failed. Is server running?');
            }
        }, 1000);

        net.onRoomJoined = (id) => {
            onJoin(id);
        };

        net.onRoomListUpdate = (list) => {
            setRooms(list);
        };

        return () => {
            net.onRoomJoined = null;
            net.onRoomListUpdate = null;
        };
    }, [onJoin]);

    const handleCreate = () => {
        if (!username.trim()) {
            setStatus('Please enter your Codename');
            return;
        }
        NetworkManager.getInstance().createRoom(roomIdInput || undefined, duration, username);
        setStatus('Creating room...');
    };

    const handleJoin = (id?: string) => {
        const targetId = id || roomIdInput;
        if (!targetId) {
            setStatus('Please enter a Room ID');
            return;
        }
        if (!username.trim()) {
            setStatus('Please enter your Codename');
            return;
        }
        NetworkManager.getInstance().joinRoom(targetId, username);
        setStatus(`Joining room ${targetId}...`);
    };

    return (
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl p-8 space-y-6 bg-black/90 border border-green-900/50 rounded-lg shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
            <div className="text-center space-y-2">
                <h2 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-600 font-mono">
                    MULTIPLAYER LOBBY
                </h2>
                <p className={`text-xs font-mono tracking-widest uppercase ${connected ? 'text-green-500' : 'text-red-500'}`}>
                    {status}
                </p>
            </div>

            <div className="w-full h-px bg-gray-800" />

            <div className="flex w-full gap-8">
                {/* LEFT: CONTROLS */}
                <div className="w-1/2 space-y-4">
                    {/* INPUT SECTION */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-400 font-mono uppercase block mb-1">Codename</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="ENTER NAME"
                                className="w-full bg-gray-900 border border-gray-700 text-white font-mono px-4 py-3 focus:outline-none focus:border-green-500 text-center tracking-widest uppercase"
                                maxLength={12}
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-400 font-mono uppercase block mb-1">Mission Indentifier (Optional)</label>
                            <input
                                type="text"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                                placeholder="AUTO-GENERATE"
                                className="w-full bg-gray-900 border border-gray-700 text-white font-mono px-4 py-3 focus:outline-none focus:border-green-500 text-center tracking-widest mb-2"
                                maxLength={10}
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-400 font-mono uppercase block mb-1">Mission Duration</label>
                            <div className="flex gap-2">
                                {[2, 5, 10].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setDuration(mins)}
                                        className={`flex-1 py-2 font-mono text-sm border ${duration === mins ? 'bg-green-600 border-green-500 text-black font-bold' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                    >
                                        {mins}M
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                onClick={() => handleJoin()}
                                className={`px-4 py-3 font-bold font-mono uppercase transition-all border ${!roomIdInput || !username ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' : 'bg-emerald-900/40 text-emerald-400 border-emerald-600 hover:bg-emerald-500 hover:text-black'}`}
                                disabled={!roomIdInput || !username}
                            >
                                JOIN ROOM
                            </button>
                            <button
                                onClick={handleCreate}
                                className={`px-4 py-3 font-bold font-mono uppercase transition-colors ${!username ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-black border border-green-500'}`}
                                disabled={!username}
                            >
                                CREATE ROOM
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: ROOM LIST */}
                <div className="w-1/2 bg-gray-900/50 border border-gray-800 p-4 h-[340px] overflow-y-auto">
                    <h3 className="text-xs text-gray-400 font-mono uppercase mb-4 sticky top-0 bg-gray-900/90 pb-2 border-b border-gray-800">
                        Active Rooms ({rooms.length})
                    </h3>

                    <div className="space-y-2">
                        {rooms.length === 0 ? (
                            <div className="text-gray-600 text-xs font-mono text-center py-8">No active rooms found. Create one!</div>
                        ) : (
                            rooms.map((room) => (
                                <div key={room.id} className="flex items-center justify-between bg-black/40 border border-gray-800 p-3 hover:border-gray-600 transition-colors">
                                    <div>
                                        <div className="text-emerald-400 font-mono font-bold text-sm">{room.id}</div>
                                        <div className="text-gray-500 text-xs font-mono">{room.status} • {room.count} Player(s)</div>
                                    </div>
                                    <button
                                        onClick={() => handleJoin(room.id)}
                                        className="px-3 py-1 bg-gray-800 hover:bg-emerald-600 text-xs text-white font-mono uppercase border border-gray-700 hover:border-emerald-500 transition-all"
                                    >
                                        Join
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full pt-4 text-center">
                <button
                    onClick={onBack}
                    className="text-gray-500 hover:text-white text-xs font-mono uppercase tracking-widest underline decoration-gray-700 hover:decoration-white transition-all"
                >
                    Return to Base
                </button>
            </div>
        </div>
    );
};
