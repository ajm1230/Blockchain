/* ============================================================
   MINING — proof-of-work engine
   Real SHA-256 nonce search. Fee-only reward for now (per our plan).
   ============================================================ */

const Mining = {
    isMining: false,
    startedAt: 0,
    attempts: 0,
    lastNonce: 0,
    blocksMinedCount: 0,
    totalFeesEarned: 0,
    _stopRequested: false,

    // ---- Build a draft block from mempool, then search for valid nonce ----
    async mineNext(rewardAddress) {
        if (this.isMining) return null;
        this.isMining = true;
        this._stopRequested = false;
        this.startedAt = Date.now();
        this.attempts = 0;

        const selected = Mempool.selectForMining();
        const totalFees = selected.reduce((sum, tx) => sum + (tx.fee || 0), 0);

        // Fee collection transaction — miner's payout (real Bitcoin style,
        // but no block subsidy yet, only fees, as decided)
        const feeTx = {
            id: Utils.randomId(),
            type: 'FEE_COLLECTION',
            from: 'NETWORK_FEES',
            to: rewardAddress,
            amount: totalFees,
            timestamp: new Date().toISOString()
        };

        const transactions = totalFees > 0 ? [feeTx, ...selected] : [...selected];

        const block = {
            index: Blockchain.height(),
            previousHash: Blockchain.latestHash(),
            transactions,
            timestamp: new Date().toISOString(),
            nonce: 0,
            hash: ''
        };

        UIBridge?.onMiningDraftUpdate?.(block, totalFees);

        const target = CONFIG.DIFFICULTY_PREFIX;
        let found = false;

        while (!this._stopRequested) {
            block.nonce++;
            this.attempts++;
            this.lastNonce = block.nonce;

            const hash = await CryptoModule.sha256({
                index: block.index,
                previousHash: block.previousHash,
                transactions: block.transactions,
                timestamp: block.timestamp,
                nonce: block.nonce
            });

            if (hash.startsWith(target)) {
                block.hash = hash;
                found = true;
                break;
            }

            // Yield every batch so the UI thread stays responsive
            if (this.attempts % 400 === 0) {
                UIBridge?.onMiningProgress?.(this.getStats());
                await Utils.nextTick();

                // Someone else may have broadcast a winning block while we mined —
                // if our previousHash is now stale, abandon this draft.
                if (block.previousHash !== Blockchain.latestHash()) {
                    this.isMining = false;
                    UIBridge?.onMiningAbandoned?.();
                    return null;
                }
            }
        }

        this.isMining = false;

        if (!found) return null; // stopped manually

        this.blocksMinedCount++;
        this.totalFeesEarned += totalFees;
        return block;
    },

    stop() {
        this._stopRequested = true;
    },

    getStats() {
        const elapsedSec = Math.floor((Date.now() - this.startedAt) / 1000) || 1;
        const hashRate = this.attempts / elapsedSec;
        return {
            isMining: this.isMining,
            attempts: this.attempts,
            nonce: this.lastNonce,
            hashRate,
            hashRateFormatted: Utils.fmtHashRate(hashRate),
            elapsedSec,
            elapsedFormatted: Utils.fmtDuration(elapsedSec),
            blocksMinedCount: this.blocksMinedCount,
            totalFeesEarned: this.totalFeesEarned
        };
    }
};

// UIBridge is defined in ui.js; declared here so mining.js can load
// independently without throwing if ui.js hasn't attached yet.
window.UIBridge = window.UIBridge || {};
