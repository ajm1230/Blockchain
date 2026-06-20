/**
 * UTILS - Utility Functions
 */
const Utils = {
    generateId: () => Math.random().toString(36).substr(2, 9),
    formatHash: (h) => h ? h.substring(0, 12) + '...' : 'N/A',
    formatAddress: (a) => a ? a.substring(0, 8) + '...' : 'N/A',
    formatDate: (d) => new Date(d).toLocaleString(),
    formatTime: (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sc = s % 60;
        return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
    },
    copyToClipboard: (t) => navigator.clipboard.writeText(t),
    downloadFile: (c, f) => {
        const b = new Blob([c], { type: 'text/plain' });
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u;
        a.download = f;
        a.click();
        URL.revokeObjectURL(u);
    }
};

/**
 * CRYPTO - Web Crypto API Wrapper
 */
const Crypto = {
    async generateKeyPair() {
        const key = await window.crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );
        const priv = await window.crypto.subtle.exportKey('jwk', key.privateKey);
        const pub = await window.crypto.subtle.exportKey('jwk', key.publicKey);
        return { priv, pub };
    },

    async generateAddress(pubKey) {
        const hash = await this.sha256(JSON.stringify(pubKey));
        return 'BC' + hash.substring(0, 38);
    },

    async signData(data, privKey) {
        const key = await window.crypto.subtle.importKey('jwk', privKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const sig = await window.crypto.subtle.sign('ECDSA', key, encoded);
        return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async verifySignature(data, sig, pubKey) {
        try {
            const key = await window.crypto.subtle.importKey('jwk', pubKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
            const encoded = new TextEncoder().encode(JSON.stringify(data));
            const sigBuf = new Uint8Array(sig.match(/../g).map(b => parseInt(b, 16)));
            return await window.crypto.subtle.verify('ECDSA', key, sigBuf, encoded);
        } catch (e) {
            return false;
        }
    },

    async sha256(data) {
        const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

/**
 * STORAGE - localStorage Manager
 */
const Storage = {
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    get: (k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; },
    remove: (k) => localStorage.removeItem(k),
    clear: () => localStorage.clear()
};

/**
 * BLOCKCHAIN - Chain Management
 */
const Blockchain = {
    blocks: [],

    init() {
        const saved = Storage.get('blockchain');
        this.blocks = saved || [];
    },

    save() {
        Storage.set('blockchain', this.blocks);
    },

    addBlock(block) {
        if (this.validateBlock(block)) {
            this.blocks.push(block);
            this.save();
            return true;
        }
        return false;
    },

    validateBlock(block) {
        if (!block.hash || !block.hash.startsWith('000')) return false;
        if (this.blocks.length > 0 && block.previousHash !== this.blocks[this.blocks.length - 1].hash) return false;
        return true;
    },

    getBalance(addr) {
        let bal = 0;
        for (const block of this.blocks) {
            for (const tx of block.transactions || []) {
                if (tx.from === addr) bal -= (tx.amount + (tx.fee || 0));
                if (tx.to === addr) bal += tx.amount;
                if (tx.type === 'COINBASE' && tx.to === addr) bal += tx.amount;
            }
        }
        return bal;
    },

    getLength() {
        return this.blocks.length;
    },

    validate() {
        for (let i = 1; i < this.blocks.length; i++) {
            if (!this.validateBlock(this.blocks[i])) return false;
        }
        return true;
    }
};

/**
 * MEMPOOL - Transaction Pool
 */
const Mempool = {
    txs: [],

    add(tx) {
        if (!this.txs.find(t => t.id === tx.id)) {
            this.txs.push(tx);
            return true;
        }
        return false;
    },

    getAll() {
        return this.txs.sort((a, b) => (b.fee || 0) - (a.fee || 0));
    },

    select(count = 10) {
        return this.getAll().slice(0, count);
    },

    remove(txId) {
        this.txs = this.txs.filter(t => t.id !== txId);
    },

    clear() {
        this.txs = [];
    }
};
