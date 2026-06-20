/**
 * MINING - Proof of Work Mining Engine
 */

const Mining = {
    isMining: false,
    startTime: 0,
    attempts: 0,
    hashRate: 0,
    blocksMined: 0,

    async mineBlock(transactions) {
        this.isMining = true;
        this.startTime = Date.now();
        this.attempts = 0;

        const block = {
            index: Blockchain.blocks.length,
            previousHash: Blockchain.blocks.length > 0 ? Blockchain.blocks[Blockchain.blocks.length - 1].hash : '0000000000000000000000000000000000000000',
            transactions: transactions,
            timestamp: new Date().toISOString(),
            nonce: 0,
            hash: ''
        };

        const target = '000'; // Difficulty level

        while (this.isMining) {
            block.nonce++;
            this.attempts++;

            // Calculate hash
            block.hash = await Crypto.sha256({
                index: block.index,
                previousHash: block.previousHash,
                transactions: block.transactions,
                timestamp: block.timestamp,
                nonce: block.nonce
            });

            // Check if hash matches difficulty
            if (block.hash.startsWith(target)) {
                this.blocksMined++;
                this.updateHashRate();
                return block;
            }

            // Yield to browser every 1000 attempts
            if (this.attempts % 1000 === 0) {
                this.updateHashRate();
                await new Promise(r => setTimeout(r, 0));
            }
        }
        return null;
    },

    updateHashRate() {
        const elapsed = (Date.now() - this.startTime) / 1000 || 1;
        this.hashRate = (this.attempts / elapsed).toFixed(2);
    },

    stop() {
        this.isMining = false;
    },

    getStats() {
        return {
            isMining: this.isMining,
            attempts: this.attempts,
            hashRate: this.hashRate + ' H/s',
            blocksMined: this.blocksMined,
            timeElapsed: Utils.formatTime(Math.floor((Date.now() - this.startTime) / 1000))
        };
    }
};
