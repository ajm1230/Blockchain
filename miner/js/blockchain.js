/* ============================================================
   BLOCKCHAIN — local ledger, validation, balance calc, fork rule
   ============================================================ */

const Blockchain = {
    chain: [],

    init() {
        this.chain = Storage.getBlockchain();
    },

    persist() {
        Storage.saveBlockchain(this.chain);
    },

    height() {
        return this.chain.length;
    },

    latestBlock() {
        return this.chain[this.chain.length - 1] || null;
    },

    latestHash() {
        const b = this.latestBlock();
        return b ? b.hash : '0'.repeat(40);
    },

    // ---- Validate a single block's structural & consensus rules ----
    async validateBlock(block, previous) {
        if (!block || !block.hash || !block.previousHash) return false;
        if (!block.hash.startsWith(CONFIG.DIFFICULTY_PREFIX)) return false;

        // Hash must actually match recomputed hash (no forged hash field)
        const recomputed = await CryptoModule.sha256({
            index: block.index,
            previousHash: block.previousHash,
            transactions: block.transactions,
            timestamp: block.timestamp,
            nonce: block.nonce
        });
        if (recomputed !== block.hash) return false;

        // Must link to the given previous block (if one is supplied)
        if (previous && block.previousHash !== previous.hash) return false;
        if (previous && block.index !== previous.index + 1) return false;

        return true;
    },

    // ---- Validate entire chain end to end ----
    async validateChain(chain = this.chain) {
        for (let i = 0; i < chain.length; i++) {
            const prev = i > 0 ? chain[i - 1] : null;
            const ok = await this.validateBlock(chain[i], prev);
            if (!ok) return { valid: false, brokenAt: i };
        }
        return { valid: true, brokenAt: -1 };
    },

    // ---- Add a new block (after validating against current tip) ----
    async addBlock(block) {
        const prev = this.latestBlock();
        const ok = await this.validateBlock(block, prev);
        if (!ok) return false;
        this.chain.push(block);
        this.persist();
        return true;
    },

    // ---- Balance: live recalculation from full ledger scan ----
    getBalance(address) {
        let balance = 0;
        for (const block of this.chain) {
            for (const tx of block.transactions || []) {
                if (tx.type === 'FEE_COLLECTION' && tx.to === address) balance += tx.amount;
                if (tx.type !== 'FEE_COLLECTION') {
                    if (tx.from === address) balance -= (tx.amount + (tx.fee || 0));
                    if (tx.to === address) balance += tx.amount;
                }
            }
        }
        return balance;
    },

    // ---- All transactions touching an address (for history view) ----
    getTransactionsFor(address) {
        const list = [];
        for (const block of this.chain) {
            for (const tx of block.transactions || []) {
                if (tx.from === address || tx.to === address) {
                    list.push({ ...tx, blockIndex: block.index, blockHash: block.hash });
                }
            }
        }
        return list;
    },

    // ---- Longest valid chain wins (used during sync with peers) ----
    async chooseBetterChain(candidateChain) {
        if (candidateChain.length <= this.chain.length) return false;
        const result = await this.validateChain(candidateChain);
        if (!result.valid) return false;
        this.chain = candidateChain;
        this.persist();
        return true;
    },

    // ---- Genesis / coinbase block for a brand-new wallet ----
    async createGenesisBlock(address) {
        const tx = {
            id: Utils.randomId(),
            type: 'COINBASE',
            from: 'GENESIS',
            to: address,
            amount: 10,
            fee: 0,
            timestamp: new Date().toISOString(),
            note: 'Initial demo BTC'
        };
        const block = {
            index: this.chain.length,
            previousHash: this.latestHash(),
            transactions: [tx],
            timestamp: new Date().toISOString(),
            nonce: 0
        };
        block.hash = await CryptoModule.sha256({
            index: block.index,
            previousHash: block.previousHash,
            transactions: block.transactions,
            timestamp: block.timestamp,
            nonce: block.nonce
        });
        // Genesis/coinbase blocks are accepted locally without PoW —
        // they're a personal starting balance, not network-validated.
        this.chain.push(block);
        this.persist();
        return block;
    },

    // ---- Wipe the chain entirely (used by Repair Center) ----
    wipe() {
        this.chain = [];
        this.persist();
    }
};
