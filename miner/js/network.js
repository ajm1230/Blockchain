/* ============================================================
   NETWORK — server connection, broadcasting, peer discovery, sync
   ============================================================ */

const Network = {
    socket: null,
    connected: false,
    online: true,
    nodeId: null,
    peers: [],

    init() {
        this.nodeId = Storage.getNodeId();
        this.online = Storage.getOnlineState();
        if (this.online) this.connect();
    },

    connect() {
        if (this.socket) return;
        try {
            this.socket = io(CONFIG.SERVER_URL, {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 6000
            });

            this.socket.on('connect', () => {
                this.connected = true;
                this._announce();
                UIBridge?.onNetworkStatus?.(true);
                UIBridge?.log?.('Connected to network', 'ok');
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
                UIBridge?.onNetworkStatus?.(false);
                UIBridge?.log?.('Disconnected from network', 'warn');
            });

            // ---- Real-time: new transaction broadcast by any node ----
            this.socket.on('transaction_broadcast', async (data) => {
                const tx = data.transaction;
                const senderBalance = Blockchain.getBalance(tx.from);
                const result = await Mempool.validateTransaction(tx, senderBalance);
                if (result.valid) {
                    Mempool.add(tx);
                    UIBridge?.onMempoolChanged?.();
                    UIBridge?.log?.(`New tx accepted: ${Utils.short(tx.id)}`, 'ok');
                } else {
                    UIBridge?.log?.(`Rejected incoming tx: ${result.reason}`, 'err');
                }
            });

            // ---- Real-time: new block broadcast by some miner ----
            this.socket.on('block_broadcast', async (data) => {
                const block = data.block;
                const prevHash = Blockchain.latestHash();

                if (block.previousHash === prevHash) {
                    const added = await Blockchain.addBlock(block);
                    if (added) {
                        const minedTxIds = (block.transactions || [])
                            .filter(t => t.type !== 'FEE_COLLECTION')
                            .map(t => t.id);
                        Mempool.removeMany(minedTxIds);
                        UIBridge?.onBlockAccepted?.(block);
                        UIBridge?.log?.(`Block #${block.index} accepted (${Utils.short(block.hash)})`, 'ok');

                        // If we were mining this same slot, abandon — handled in mining.js too
                        if (Mining.isMining) Mining.stop();
                    }
                } else if (block.index >= Blockchain.height()) {
                    // Possible fork — trigger a sync check
                    this.checkForLongerChain();
                }
            });

            this.socket.on('node_online', (data) => UIBridge?.log?.(`Peer online: ${Utils.short(data.nodeId)}`, 'ok'));
            this.socket.on('node_offline', (data) => UIBridge?.log?.(`Peer offline: ${Utils.short(data.nodeId)}`, 'warn'));

        } catch (e) {
            UIBridge?.log?.('Connection failed: ' + e.message, 'err');
        }
    },

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        UIBridge?.onNetworkStatus?.(false);
    },

    setOnline(isOnline) {
        this.online = isOnline;
        Storage.saveOnlineState(isOnline);
        if (isOnline) this.connect(); else this.disconnect();
    },

    _announce() {
        if (!this.socket) return;
        this.socket.emit('register_node', {
            nodeId: this.nodeId,
            walletAddress: Wallet.address,
            chainLength: Blockchain.height(),
            latestHash: Blockchain.latestHash(),
            status: 'online'
        });
    },

    // ---- REST: broadcast a signed transaction ----
    async broadcastTransaction(tx) {
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/transactions/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tx)
            });
            return await res.json();
        } catch (e) {
            UIBridge?.log?.('Broadcast tx failed: ' + e.message, 'err');
            return { success: false, error: e.message };
        }
    },

    // ---- REST: broadcast a freshly mined block ----
    async broadcastBlock(block) {
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/blocks/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(block)
            });
            return await res.json();
        } catch (e) {
            UIBridge?.log?.('Broadcast block failed: ' + e.message, 'err');
            return { success: false, error: e.message };
        }
    },

    // ---- REST: pull current mempool snapshot ----
    async fetchMempool() {
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/transactions/pending`);
            const data = await res.json();
            return data.transactions || [];
        } catch (e) {
            return [];
        }
    },

    // ---- REST: pull online peer list ----
    async fetchPeers() {
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/nodes/list`);
            const data = await res.json();
            this.peers = data.nodes || [];
            return this.peers;
        } catch (e) {
            return [];
        }
    },

    async fetchHealth() {
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/health`);
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    // ---- Sync: ask all peers for their chain, accept longest valid ----
    async checkForLongerChain() {
        const peers = await this.fetchPeers();
        for (const peer of peers) {
            if (peer.chainLength > Blockchain.height()) {
                UIBridge?.log?.(`Peer ${Utils.short(peer.nodeId)} has a longer chain — requesting…`, 'warn');
                // Full ledger pull uses the request/upload/get endpoints (Repair Center flow)
                await this.requestLedgerFrom(peer.nodeId);
            }
        }
    },

    async requestLedgerFrom(peerNodeId) {
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/ledger/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromNode: this.nodeId, toNode: peerNodeId })
            });
            const data = await res.json();
            if (data.requestId) this._pollForLedger(data.requestId);
        } catch (e) {
            UIBridge?.log?.('Ledger request failed: ' + e.message, 'err');
        }
    },

    async _pollForLedger(requestId, attempts = 0) {
        if (attempts > 10) return;
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/ledger/${requestId}`);
            if (res.status === 200) {
                const data = await res.json();
                const accepted = await Blockchain.chooseBetterChain(data.ledger_data.blocks);
                if (accepted) {
                    UIBridge?.onBlockAccepted?.(Blockchain.latestBlock());
                    UIBridge?.log?.('Ledger synced from peer — chain updated', 'ok');
                }
            } else {
                setTimeout(() => this._pollForLedger(requestId, attempts + 1), 1500);
            }
        } catch (e) {
            // silent retry
        }
    }
};
