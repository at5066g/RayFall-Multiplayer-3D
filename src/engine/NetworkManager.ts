import { io, Socket } from 'socket.io-client';

export class NetworkManager {
    private socket: Socket | null = null;
    private static instance: NetworkManager;

    public playerId: string | null = null;
    public roomId: string | null = null;
    public players: Record<string, any> = {};
    public timeLeft: number = 300;

    // Callbacks
    public onStateUpdate: ((players: any) => void) | null = null;
    public onRoomJoined: ((roomId: string) => void) | null = null;
    public onRoomListUpdate: ((rooms: any[]) => void) | null = null;
    public onTimeUpdate: ((time: number) => void) | null = null;
    public onGameOver: ((data: any) => void) | null = null;
    public onPlayerDied: ((data: any) => void) | null = null;
    public onPlayerRespawn: ((pos: { x: number, y: number }) => void) | null = null;
    public onHealthUpdate: ((data: { id: string, health: number, isDead?: boolean }) => void) | null = null;

    public onItemSpawn: ((item: any) => void) | null = null;
    public onItemRemoved: ((itemId: any) => void) | null = null;
    public onItemCollected: ((data: { type: number }) => void) | null = null;

    // Auto-Win & Count Events
    public onPlayerLeft: ((id: string) => void) | null = null;
    public onWaitingForPlayers: ((timeout: number) => void) | null = null;
    public onGameResumed: (() => void) | null = null;

    private constructor() { }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    public connect() {
        if (this.socket) return;

        const isProduction = import.meta.env.PROD;
        const serverUrl = isProduction ? window.location.origin : 'http://localhost:3002';

        this.socket = io(serverUrl);

        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket?.id);
            this.playerId = this.socket?.id || null;
            // Explicitly request room list on fresh connection
            this.requestRoomList();
        });

        // this.socket.on('roomCreated', ...) - Server auto-joins creator now

        this.socket.on('roomListUpdate', (rooms: any[]) => {
            if (this.onRoomListUpdate) this.onRoomListUpdate(rooms);
        });

        // Room Events
        this.socket.on('playerJoined', (data: any) => {
            console.log('Player Joined:', data);
            this.players = data.currentPlayers;

            // If it's me joining
            if (data.id === this.playerId) {
                this.roomId = data.roomId; // Capture RoomID
                if (data.timeLeft) {
                    if (this.onTimeUpdate) this.onTimeUpdate(data.timeLeft);
                }
                if (this.onRoomJoined) {
                    this.onRoomJoined(this.roomId!);
                }
            }

            if (this.onStateUpdate) this.onStateUpdate(this.players);
        });

        this.socket.on('playerLeft', (data: any) => {
            // data can be ID (old) or Object {id, count} (new)
            const id = (typeof data === 'object') ? data.id : data;

            delete this.players[id];
            if (this.onStateUpdate) this.onStateUpdate(this.players);

            // Pass the ID to update logic (Game.tsx calculates keys.length)
            if (this.onPlayerLeft) this.onPlayerLeft(id);
        });

        this.socket.on('waitingForPlayers', (data: { timeout: number }) => {
            // Server warning: "You are the last one. Auto-win in X seconds"
            if (this.onWaitingForPlayers) this.onWaitingForPlayers(data.timeout);
        });

        this.socket.on('gameResumed', () => {
            // Auto-win cancelled
            if (this.onGameResumed) this.onGameResumed();
        });

        // Game Events
        this.socket.on('playerMoved', (data: any) => {
            if (this.players[data.id]) {
                this.players[data.id].x = data.x;
                this.players[data.id].y = data.y;
                this.players[data.id].angle = data.angle;
            }
        });

        this.socket.on('otherPlayerShot', (data: any) => {
            // Visual effect for other players shooting could be handled here
        });

        this.socket.on('healthUpdate', (data: any) => {
            if (this.players[data.id]) {
                // console.log('DEBUG: healthUpdate', data);
                this.players[data.id].health = data.health;
                if (data.isDead !== undefined) {
                    console.log(`DEBUG: Player ${data.id} isDead set to ${data.isDead}`);
                    this.players[data.id].isDead = data.isDead;
                }
            }
            if (this.onHealthUpdate) this.onHealthUpdate(data);
        });

        this.socket.on('timeUpdate', (time: number) => {
            if (this.onTimeUpdate) this.onTimeUpdate(time);
        });

        this.socket.on('gameOver', (data: any) => {
            if (this.onGameOver) this.onGameOver(data);
        });

        this.socket.on('playerDied', (data: any) => {
            if (this.onPlayerDied) this.onPlayerDied(data);
        });

        this.socket.on('playerRespawn', (data: any) => {
            if (this.onPlayerRespawn) this.onPlayerRespawn(data);
        });

        this.socket.on('itemSpawn', (data: any) => {
            console.log('DEBUG: NetManager received itemSpawn', data);
            if (this.onItemSpawn) this.onItemSpawn(data);
        });

        this.socket.on('itemRemoved', (itemId: any) => {
            if (this.onItemRemoved) this.onItemRemoved(itemId);
        });

        this.socket.on('itemCollected', (data: any) => {
            if (this.onItemCollected) this.onItemCollected(data);
        });
        this.socket.on('playerHit', (data: any) => {
            // handled by client logic or just logging? usually game listens directly
        });

        this.socket.on('timeUpdate', (time: number) => {
            // console.log('DEBUG: Net Time Update', time);
            this.timeLeft = time; // Update local state
            if (this.onTimeUpdate) this.onTimeUpdate(time);
        });

        this.socket.on('gameOver', (data: any) => {
            if (this.onGameOver) this.onGameOver(data);
        });
    }

    public requestRoomList() {
        this.socket?.emit('requestRoomList');
    }

    public createRoom(customId?: string, duration: number = 5, username: string = 'Anonymous') {
        this.socket?.emit('createRoom', { customId, duration, username });
    }

    public joinRoom(roomId: string, username: string = 'Anonymous') {
        this.roomId = roomId;
        this.socket?.emit('joinRoom', { roomId, username });
    }

    public sendMove(x: number, y: number, angle: number) {
        if (!this.roomId) return;
        this.socket?.emit('playerMove', { roomId: this.roomId, x, y, angle });
    }

    public sendShoot() {
        if (!this.roomId) return;
        this.socket?.emit('playerShoot', { roomId: this.roomId });
    }

    public sendHit(victimId: string, damage: number) {
        if (!this.roomId) return;
        // In a trusted client model (lazy), shooter claims the hit
        this.socket?.emit('playerHit', { roomId: this.roomId, shooterId: this.playerId, victimId, damage });
    }

    public sendPickup(itemId: string | number) {
        if (!this.roomId) return;
        this.socket?.emit('pickupItem', { roomId: this.roomId, itemId });
    }
}
