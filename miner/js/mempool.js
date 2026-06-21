/* ============================================================
   MEMPOOL — pending transaction pool (real-style, no fixed cap)
   ============================================================ */

const Mempool = {
    pool: new Map(), // txId -> transaction

    add(tx) {
        if (!tx || !tx.id) return false;
        if (this.pool.has(tx.id)) return false; // duplicate
        this.pool.set(tx.id, tx);
        return true;
    },

    remove(txId) {
        this.pool.delete(txId);
    },

    removeMany(txIds) {
        txIds.forEach(id => this.pool.delete(id));
    },

    has(txId) {
        return this.pool.has(txId);
    },

    all() {
        return Array.from(this.pool.values());
    },

    // ---- Sorted by fee, highest first (real Bitcoin priority) ----
    byFeePriority() {
        return this.all().sort((a, b) => (b.fee || 0) - (a.fee || 0));
    },

    // ---- Miner picks top N by fee (miner's own choice, not a network rule) ----
    selectForMining(limit = CONFIG.MAX_TX_PER_BLOCK) {
        return this.byFeePriority().slice(0, limit);
    },

    count() {
        return this.pool.size;
    },

    clear() {
        this.pool.clear();
    },

    // ---- Independent validation before accepting into mempool ----
    // (No voting — every node checks the same rules on its own)
    async validateTransaction(tx, balanceOfSender) {
        if (!tx || !tx.from || !tx.to || !tx.amount || !tx.signature || !tx.publicKey) {
            return { valid: false, reason: 'Missing required fields' };
        }
        if (tx.amount <= 0) return { valid: false, reason: 'Invalid amount' };
        if ((tx.fee || 0) < 0) return { valid: false, reason: 'Invalid fee' };

        const derivedAddr = await CryptoModule.deriveAddress(tx.publicKey);
        if (derivedAddr !== tx.from) return { valid: false, reason: 'Public key does not match sender address' };

        const { signature, ...unsigned } = tx;
        const sigOk = await CryptoModule.verify(unsigned, signature, tx.publicKey);
        if (!sigOk) return { valid: false, reason: 'Invalid signature' };

        if (balanceOfSender < tx.amount + (tx.fee || 0)) {
            return { valid: false, reason: 'Insufficient balance' };
        }

        return { valid: true };
    }
};
