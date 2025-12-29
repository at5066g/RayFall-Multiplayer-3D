const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve static files from the React app build directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from Vite dev server
        methods: ["GET", "POST"]
    }
});

// State
const rooms = {}; // roomId -> { players: {}, timeLeft: 300, status: 'WAITING' | 'PLAYING', timerInterval: null }

const GAME_DURATION = 300; // 5 minutes in seconds

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Initial Room List
    socket.emit('roomListUpdate', getRoomList());

    socket.on('requestRoomList', () => {
        socket.emit('roomListUpdate', getRoomList());
    });

    // --- LOBBY EVENTS ---

    socket.on('createRoom', (data) => {
        // data can be string (old) or object (new)
        let requestedId, duration = 5, username = 'Anonymous';
        if (typeof data === 'object') {
            requestedId = data.customId;
            duration = data.duration || 5;
            username = data.username || 'Anonymous';
        } else {
            requestedId = data;
        }

        let roomId = requestedId ? requestedId.toUpperCase().substring(0, 10) : uuidv4().substring(0, 6).toUpperCase();

        if (rooms[roomId]) {
            if (requestedId) {
                socket.emit('error', 'Room ID already exists');
                return;
            } else {
                roomId = uuidv4().substring(0, 6).toUpperCase();
            }
        }

        rooms[roomId] = {
            id: roomId,
            players: {},
            items: {},
            timeLeft: duration * 60, // Convert minutes to seconds
            status: 'WAITING',
            scores: {},
            timerInterval: null
        };

        socket.emit('roomCreated', roomId);

        // Auto-join the creator
        joinRoomInternal(socket, roomId, username);

        io.emit('roomListUpdate', getRoomList());
        console.log(`Room ${roomId} created by ${socket.id} (Duration: ${duration}m)`);
    });

    socket.on('joinRoom', (data) => {
        // data can be string or object
        let roomId, username = 'Anonymous';
        if (typeof data === 'object') {
            roomId = data.roomId;
            username = data.username || 'Anonymous';
        } else {
            roomId = data;
        }

        joinRoomInternal(socket, roomId, username);
    });

    function joinRoomInternal(socket, roomId, username) {
        const room = rooms[roomId];
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        socket.join(roomId);

        room.players[socket.id] = {
            x: 2.5, y: 2.5, angle: 0, health: 100, id: socket.id, isDead: false,
            name: username // Store Name
        };
        room.scores[socket.id] = 0;

        if (room.status === 'WAITING') {
            room.status = 'PLAYING';
            startGameLoop(roomId);
        }

        io.to(roomId).emit('playerJoined', {
            id: socket.id,
            name: username, // Send Name
            currentPlayers: room.players,
            timeLeft: room.timeLeft
        });
        io.emit('roomListUpdate', getRoomList());
        console.log(`${username} (${socket.id}) joined room ${roomId}`);
    }

    // --- GAME EVENTS ---

    socket.on('playerMove', (data) => {
        // data = { roomId, x, y, angle }
        const { roomId, x, y, angle } = data;
        const room = rooms[roomId];
        if (room && room.status === 'PLAYING') {
            if (room.players[socket.id]) {
                room.players[socket.id].x = x;
                room.players[socket.id].y = y;
                room.players[socket.id].angle = angle;

                // Broadcast to others immediately (or throttle in tick)
                socket.to(roomId).emit('playerMoved', { id: socket.id, x, y, angle });
            }
        }
    });

    socket.on('playerShoot', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('otherPlayerShot', { id: socket.id });
    });

    // Explicit request for list (for when client re-mounts lobby)
    socket.on('requestRoomList', () => {
        socket.emit('roomListUpdate', getRoomList());
    });

    // --- LOBBY EVENTS ---

    socket.on('createRoom', (requestedId) => {
        // ... (existing code, ensure it matches context if using replace)
        // ... actually, I should just insert the requestRoomList listener at the top and then jump to the death logic
    });

    // ... (skipping to death logic) ...

    socket.on('playerHit', (data) => {
        const { roomId, damage, shooterId, victimId } = data;
        const room = rooms[roomId];
        if (!room || room.status !== 'PLAYING') return;

        const victim = room.players[victimId];
        if (victim) {
            console.log(`DEBUG: playerHit on ${victimId} by ${shooterId}. Damage: ${damage}, NewHP: ${victim.health - damage}`);
            victim.health -= damage;
            io.to(roomId).emit('healthUpdate', { id: victimId, health: victim.health });

            if (victim.health <= 0) {
                console.log(`DEBUG: Player ${victimId} DIED. Emitting Death State.`);
                // Valid kill
                if (room.scores[shooterId] !== undefined) {
                    room.scores[shooterId] += 1;
                }

                // 1. Mark as Dead immediately (prevents ghosting)
                victim.isDead = true;
                io.to(roomId).emit('healthUpdate', { id: victimId, health: 0, isDead: true });
                io.to(roomId).emit('playerDied', { victimId: victimId, killerId: shooterId, scores: room.scores });

                // 2. Schedule Respawn (3 seconds delay)
                setTimeout(() => {
                    // Respawn immediately
                    const roomRef = rooms[roomId]; // Re-fetch to ensure room still exists
                    if (!roomRef || !roomRef.players[victimId]) return;

                    const victimRef = roomRef.players[victimId];

                    const SAFE_SPAWNS = [
                        { x: 2.5, y: 2.5 },
                        { x: 21.5, y: 2.5 },
                        { x: 2.5, y: 21.5 },
                        { x: 21.5, y: 21.5 },
                        { x: 12.0, y: 12.0 }
                    ];
                    const spawn = SAFE_SPAWNS[Math.floor(Math.random() * SAFE_SPAWNS.length)];

                    victimRef.health = 100;
                    victimRef.isDead = false;
                    victimRef.x = spawn.x;
                    victimRef.y = spawn.y;

                    // 3. Tell everyone they are alive again at the new spot
                    io.to(roomId).emit('healthUpdate', { id: victimId, health: 100, isDead: false });

                    // Force position sync
                    io.to(roomId).emit('playerMoved', {
                        id: victimId,
                        x: victimRef.x,
                        y: victimRef.y,
                        angle: 0
                    });

                    // Tell the player specifically to reset their local camera
                    io.to(victimId).emit('playerRespawn', { x: victimRef.x, y: victimRef.y });
                }, 3000); // Close setTimeout
            } // Close if (victim.health <= 0)

            // SPAWN ITEM (Restored)
            const roomRef = rooms[roomId]; // Re-fetch
            if (roomRef && roomRef.players[victimId] && roomRef.players[victimId].health <= 0) {
                const victim = roomRef.players[victimId];
                // Spawn Item
                const itemId = Date.now() + Math.random().toString(36).substr(2, 5);
                const itemType = Math.random() > 0.5 ? 50 : 51; // 50=Health, 51=Ammo

                console.log(`DEBUG: Spawning Item ${itemId} (Type ${itemType}) at ${victim.x}, ${victim.y}`);

                const itemData = {
                    id: itemId,
                    x: victim.x,
                    y: victim.y,
                    type: itemType
                };

                if (!roomRef.items) roomRef.items = {}; // Ensure init
                roomRef.items[itemId] = itemData;
                io.to(roomId).emit('itemSpawn', itemData);

                // Item Timeout (5 seconds)
                setTimeout(() => {
                    if (roomRef.items && roomRef.items[itemId]) {
                        delete roomRef.items[itemId];
                        io.to(roomId).emit('itemRemoved', itemId);
                    }
                }, 5000);
            }
        }
    });

    socket.on('pickupItem', (data) => {
        const { roomId, itemId } = data;
        const room = rooms[roomId];
        if (!room || !room.items) return;

        if (room.items[itemId]) {
            const item = room.items[itemId];
            // Valid Pickup
            socket.emit('itemCollected', { type: item.type }); // Give reward
            io.to(roomId).emit('itemRemoved', itemId); // Remove for everyone
            delete room.items[itemId];
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find room and remove
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                io.to(roomId).emit('playerLeft', socket.id);

                // Cleanup empty room
                if (Object.keys(room.players).length === 0) {
                    clearInterval(room.timerInterval);
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted`);
                }
                io.emit('roomListUpdate', getRoomList()); // Update list
                break;
            }
        }
    });
});

function getRoomList() {
    return Object.values(rooms).map(r => ({
        id: r.id,
        count: Object.keys(r.players).length,
        status: r.status,
        timeLeft: r.timeLeft
    }));
}

function startGameLoop(roomId) {
    const room = rooms[roomId];
    if (room.timerInterval) return;

    room.timerInterval = setInterval(() => {
        if (!rooms[roomId]) return; // Safety

        room.timeLeft -= 1;

        // Sync time every second
        io.to(roomId).emit('timeUpdate', room.timeLeft);

        if (room.timeLeft <= 0) {
            finishGame(roomId);
        }
    }, 1000);
}

function finishGame(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    room.status = 'FINISHED';
    clearInterval(room.timerInterval);

    // Calculate Winner
    let maxScore = -1;
    let winnerId = null;
    let winnerName = 'Unknown';

    for (const [pid, score] of Object.entries(room.scores)) {
        if (score > maxScore) {
            maxScore = score;
            winnerId = pid;
            if (room.players[pid]) winnerName = room.players[pid].name;
        }
    }

    io.to(roomId).emit('gameOver', { winnerId, winnerName, scores: room.scores });
}

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
