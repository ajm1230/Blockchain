/* ============================================================
   WALLET — identity, keys, balance, transaction creation
   ============================================================ */

const Wallet = {
    privateKey: null,
    publicKey: null,
    address: null,

    load() {
        this.privateKey = Storage.get(CONFIG.KEYS.PRIVATE_KEY);
        this.publicKey  = Storage.get(CONFIG.KEYS.PUBLIC_KEY);
        this.address    = Storage.get(CONFIG.KEYS.ADDRESS);
        return this.exists();
    },

    exists() {
        return !!this.address;
    },

    // ---- Create a brand-new wallet + genesis coinbase (10 BTC demo) ----
    async createNew() {
        const { privateJwk, publicJwk } = await CryptoModule.generateKeyPair();
        const address = await CryptoModule.deriveAddress(publicJwk);

        this.privateKey = privateJwk;
        this.publicKey  = publicJwk;
        this.address    = address;

        Storage.set(CONFIG.KEYS.PRIVATE_KEY, privateJwk);
        Storage.set(CONFIG.KEYS.PUBLIC_KEY, publicJwk);
        Storage.set(CONFIG.KEYS.ADDRESS, address);

        await Blockchain.createGenesisBlock(address);

        return { address, privateKey: JSON.stringify(privateJwk) };
    },

    // ---- Recover from a pasted private key JWK JSON ----
    async recoverFromPrivateKey(privateKeyJsonString) {
        let privateJwk;
        try {
            privateJwk = JSON.parse(privateKeyJsonString);
        } catch (e) {
            return { ok: false, error: 'Invalid key format — must be JSON' };
        }

        try {
            // Derive the matching public key by re-signing a test payload
            // is not possible from a private JWK alone for ECDSA, so we
            // require the public key to be embedded alongside on export.
            // Our recovery files store both; if only private key pasted,
            // we still import it for signing — public key recovery needs
            // the original public JWK (stored in the same backup file).
            const key = await CryptoModule.importPrivateKey(privateJwk);
            if (!key) throw new Error('bad key');
        } catch (e) {
            return { ok: false, error: 'Could not import this private key' };
        }

        // If the JSON pasted is actually a full recovery file { address, privateKey, publicKey }
        let publicJwk = privateJwk.publicKey || null;
        let address = privateJwk.address || null;

        if (privateJwk.privateKey) {
            // Full recovery file was pasted
            const recoveryPriv = privateJwk.privateKey;
            publicJwk = privateJwk.publicKey;
            address = privateJwk.address;
            this.privateKey = recoveryPriv;
        } else {
            this.privateKey = privateJwk;
        }

        if (!publicJwk || !address) {
            return { ok: false, error: 'Recovery file missing public key/address. Paste the full recovery file.' };
        }

        this.publicKey = publicJwk;
        this.address = address;

        Storage.set(CONFIG.KEYS.PRIVATE_KEY, this.privateKey);
        Storage.set(CONFIG.KEYS.PUBLIC_KEY, this.publicKey);
        Storage.set(CONFIG.KEYS.ADDRESS, this.address);

        return { ok: true, address: this.address };
    },

    getBackupObject() {
        return {
            address: this.address,
            privateKey: this.privateKey,
            publicKey: this.publicKey,
            createdNote: 'NodeVault Wallet Recovery File — keep this safe',
            exportedAt: new Date().toISOString()
        };
    },

    getBalance() {
        return this.address ? Blockchain.getBalance(this.address) : 0;
    },

    // ---- Build, sign, and return a transaction ready for broadcast ----
    async createTransaction(toAddress, amount, fee) {
        if (!this.exists()) return { ok: false, error: 'No wallet loaded' };
        if (!Utils.isValidAddress(toAddress)) return { ok: false, error: 'Invalid recipient address' };
        amount = Number(amount);
        fee = Number(fee) || 0;
        if (amount <= 0) return { ok: false, error: 'Amount must be greater than zero' };

        const balance = this.getBalance();
        if (balance < amount + fee) return { ok: false, error: 'Insufficient balance' };

        const unsigned = {
            id: Utils.randomId(),
            from: this.address,
            to: toAddress,
            amount,
            fee,
            timestamp: new Date().toISOString(),
            publicKey: this.publicKey
        };

        const signature = await CryptoModule.sign(unsigned, this.privateKey);
        const tx = { ...unsigned, signature };

        return { ok: true, tx };
    },

    deleteWallet() {
        Storage.remove(CONFIG.KEYS.PRIVATE_KEY);
        Storage.remove(CONFIG.KEYS.PUBLIC_KEY);
        Storage.remove(CONFIG.KEYS.ADDRESS);
        this.privateKey = null;
        this.publicKey = null;
        this.address = null;
    }
};
