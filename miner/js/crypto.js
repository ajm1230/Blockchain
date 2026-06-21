/* ============================================================
   CRYPTO — wraps native Web Crypto API
   No external libraries. ECDSA P-256 for signing, SHA-256 for hashing.
   ============================================================ */

const CryptoModule = {

    // ---- Generate a brand new keypair ----
    async generateKeyPair() {
        const pair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );
        const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
        const publicJwk  = await crypto.subtle.exportKey('jwk', pair.publicKey);
        return { privateJwk, publicJwk };
    },

    // ---- Re-import a stored JWK back into a usable CryptoKey ----
    async importPrivateKey(jwk) {
        return crypto.subtle.importKey(
            'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
        );
    },

    async importPublicKey(jwk) {
        return crypto.subtle.importKey(
            'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
        );
    },

    // ---- Wallet address = SHA-256(public key) prefixed with BC ----
    async deriveAddress(publicJwk) {
        const hash = await this.sha256(publicJwk);
        return 'BC' + hash.slice(0, 38);
    },

    // ---- Sign arbitrary JSON-serializable data ----
    async sign(data, privateJwk) {
        const key = await this.importPrivateKey(privateJwk);
        const bytes = new TextEncoder().encode(JSON.stringify(data));
        const sigBuffer = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes);
        return this.bufferToHex(sigBuffer);
    },

    // ---- Verify a signature against data + public key ----
    async verify(data, signatureHex, publicJwk) {
        try {
            const key = await this.importPublicKey(publicJwk);
            const bytes = new TextEncoder().encode(JSON.stringify(data));
            const sigBuffer = this.hexToBuffer(signatureHex);
            return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sigBuffer, bytes);
        } catch (e) {
            return false;
        }
    },

    // ---- SHA-256 hash of any JSON-serializable value ----
    async sha256(data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        const bytes = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
        return this.bufferToHex(hashBuffer);
    },

    // ---- Buffer <-> hex helpers ----
    bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    },

    hexToBuffer(hex) {
        const bytes = hex.match(/../g).map(b => parseInt(b, 16));
        return new Uint8Array(bytes);
    }
};
