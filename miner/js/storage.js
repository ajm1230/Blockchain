/* ============================================================
   STORAGE — wraps localStorage with JSON safety
   ============================================================ */

const Storage = {

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('[Storage] set failed:', e);
            return false;
        }
    },

    get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) {
            console.error('[Storage] get failed:', e);
            return fallback;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clearAll() {
        localStorage.clear();
    },

    // ---- Convenience wrappers for common app data ----
    getBlockchain()       { return this.get(CONFIG.KEYS.BLOCKCHAIN, []); },
    saveBlockchain(chain) { return this.set(CONFIG.KEYS.BLOCKCHAIN, chain); },

    getTxHistory()        { return this.get(CONFIG.KEYS.TX_HISTORY, []); },
    saveTxHistory(list)   { return this.set(CONFIG.KEYS.TX_HISTORY, list); },

    getMyBlocks()         { return this.get(CONFIG.KEYS.MY_BLOCKS, []); },
    saveMyBlocks(list)    { return this.set(CONFIG.KEYS.MY_BLOCKS, list); },

    getSettings()         { return this.get(CONFIG.KEYS.SETTINGS, {}); },
    saveSettings(obj)     { return this.set(CONFIG.KEYS.SETTINGS, obj); },

    getNodeId() {
        let id = this.get(CONFIG.KEYS.NODE_ID);
        if (!id) {
            id = 'node_' + Utils.randomId(12);
            this.set(CONFIG.KEYS.NODE_ID, id);
        }
        return id;
    },

    getOnlineState()       { return this.get(CONFIG.KEYS.ONLINE_STATE, true); },
    saveOnlineState(bool)  { return this.set(CONFIG.KEYS.ONLINE_STATE, bool); }
};
