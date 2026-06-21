/* ============================================================
   APP — bootstraps every module in the correct order
   ============================================================ */

(async function startApp() {
    console.log('[App] Booting NodeVault Miner…');

    // 1. Load persisted state first (no network needed)
    Blockchain.init();
    Wallet.load();

    // 2. Build the UI shell and wire all event listeners
    //    (UI.init sets window.UIBridge, which Network/Mining call into)
    UI.init();

    // 3. Connect to the network (if online mode is on)
    Network.init();

    // 4. Background loops
    setInterval(async () => {
        if (!Network.online) return;
        const remoteTxs = await Network.fetchMempool();
        for (const tx of remoteTxs) {
            const bal = Blockchain.getBalance(tx.from);
            const r = await Mempool.validateTransaction(tx, bal);
            if (r.valid && Mempool.add(tx)) UI.refreshMempoolTable();
        }
    }, CONFIG.MEMPOOL_REFRESH_MS);

    setInterval(() => {
        if (Network.online) UI.refreshPeersTable();
    }, CONFIG.PEERS_REFRESH_MS);

    setInterval(() => {
        if (Network.online) Network.checkForLongerChain();
    }, CONFIG.SYNC_CHECK_MS);

    setInterval(() => {
        if (Wallet.exists()) UI.refreshWalletPanel();
    }, 4000);

    UI.log('NodeVault Miner ready', 'ok');
    console.log('[App] Ready.');

    window.NodeVault = { Blockchain, Wallet, Mempool, Mining, Network, Storage, CryptoModule, UI };
})();
