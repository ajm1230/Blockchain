/**
 * WALLET - Wallet Management
 */

const Wallet = {
    privKey: null,
    pubKey: null,
    address: null,

    async create() {
        const { priv, pub } = await Crypto.generateKeyPair();
        this.privKey = priv;
        this.pubKey = pub;
        this.address = await Crypto.generateAddress(pub);

        Storage.set('wallet_priv', priv);
        Storage.set('wallet_pub', pub);
        Storage.set('wallet_addr', this.address);

        return {
            address: this.address,
            privKey: JSON.stringify(priv),
            pubKey: JSON.stringify(pub)
        };
    },

    async import(privKeyJson) {
        try {
            const priv = JSON.parse(privKeyJson);
            this.privKey = priv;
            this.pubKey = priv; // Simplified - in production use proper key derivation
            this.address = await Crypto.generateAddress(this.pubKey);

            Storage.set('wallet_priv', priv);
            Storage.set('wallet_pub', this.pubKey);
            Storage.set('wallet_addr', this.address);

            return true;
        } catch (e) {
            return false;
        }
    },

    load() {
        this.privKey = Storage.get('wallet_priv');
        this.pubKey = Storage.get('wallet_pub');
        this.address = Storage.get('wallet_addr');
        return this.address !== null;
    },

    exists() {
        return this.address !== null;
    },

    getBalance() {
        return this.address ? Blockchain.getBalance(this.address) : 0;
    },

    async createTransaction(to, amount, fee = 0.01) {
        if (!this.address) return null;
        if (this.getBalance() < amount + fee) return null;

        const tx = {
            id: Utils.generateId(),
            from: this.address,
            to: to,
            amount: parseFloat(amount),
            fee: parseFloat(fee),
            timestamp: new Date().toISOString(),
            publicKey: this.pubKey
        };

        tx.signature = await Crypto.signData(tx, this.privKey);
        return tx;
    },

    reset() {
        this.privKey = null;
        this.pubKey = null;
        this.address = null;
        Storage.remove('wallet_priv');
        Storage.remove('wallet_pub');
        Storage.remove('wallet_addr');
    }
};
