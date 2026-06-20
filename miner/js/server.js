/**
 * SERVER - WebSocket & API Communication
 */

const CONFIG = {
    SERVER_URL: 'https://crypto3670.pythonanywhere.com',
    WS_URL: 'wss://crypto3670.pythonanywhere.com'
};

const Server = {
    socket: null,
    connected: false,
    nodeId: Utils.generateId(),

    connect() {
        try {
            this.socket = io(CONFIG.SERVER_URL, {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 5
            });

            this.socket.on('connect', () => {
                this.connected = true;
                this.registerNode();
                console.log('[Server] Connected');
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
                console.log('[Server] Disconnected');
            });

            this.socket.on('transaction_broadcast', (data) => {
                Mempool.add(data.transaction);
                console.log('[Server] New transaction');
            });

            this.socket.on('block_broadcast', (data) => {
                Blockchain.addBlock(data.block);
                console.log('[Server] New block');
            });

            this.socket.on('node_online', (data) => {
                console.log('[Server] Node online:', data.nodeId);
            });

            this.socket.on('error', (err) => {
                console.error('[Server] Error:', err);
            });
        } catch (e) {
            console.error('[Server] Connection failed:', e);
        }
    },

    registerNode() {
        if (!this.socket) return;
        this.socket.emit('register_node', {
            nodeId: this.nodeId,
            walletAddress: Wallet.address,
            chainLength: Blockchain.getLength(),
            latestHash: Blockchain.blocks.length > 0 ? Blockchain.blocks[Blockchain.blocks.length - 1].hash : '0000',
            status: 'online'
        });
    },

    async broadcastTransaction(tx) {
        if (!this.socket) return false;
        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/transactions/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tx)
            });
            return await response.json();
        } catch (e) {
            console.error('[Server] Broadcast TX failed:', e);
            return null;
        }
    },

    async broadcastBlock(block) {
        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/blocks/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(block)
            });
            return await response.json();
        } catch (e) {
            console.error('[Server] Broadcast block failed:', e);
            return null;
        }
    },

    async getMempool() {
        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/transactions/pending`);
            const data = await response.json();
            return data.transactions || [];
        } catch (e) {
            console.error('[Server] Get mempool failed:', e);
            return [];
        }
    },

    async getNodes() {
        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/nodes/list`);
            const data = await response.json();
            return data.nodes || [];
        } catch (e) {
            console.error('[Server] Get nodes failed:', e);
            return [];
        }
    },

    async getHealth() {
        try {
            const response = await fetch(`${CONFIG.SERVER_URL}/api/health`);
            return await response.json();
        } catch (e) {
            return null;
        }
    }
};
