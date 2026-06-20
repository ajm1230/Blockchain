/**
 * APP - Main Application Entry Point
 */

class MinerApp {
    constructor() {
        this.initialized = false;
    }

    async init() {
        console.log('[App] Initializing NodeVault Miner...');

        // Initialize all systems
        Blockchain.init();
        Wallet.load();
        Server.connect();

        // Setup UI
        UI.init();

        // Update UI periodically
        setInterval(() => {
            if (UI.currentPage === 'blockchain') {
                UI.updateBlockchain();
            }
            if (UI.currentPage === 'mempool') {
                UI.refreshMempool();
            }
            if (Wallet.exists()) {
                document.getElementById('balanceValue').textContent = Wallet.getBalance().toFixed(2);
            }
            if (Mining.isMining) {
                document.getElementById('hashRate').textContent = Mining.hashRate + ' H/s';
                document.getElementById('attempts').textContent = Mining.attempts;
                document.getElementById('blocksMined').textContent = Mining.blocksMined;
            }
        }, 1000);

        // Auto-sync
        setInterval(async () => {
            if (Server.connected) {
                await UI.refreshMempool();
                await UI.refreshNodes();
            }
        }, 5000);

        this.initialized = true;
        UI.log('[App] Initialized successfully', 'success');
        console.log('[App] Ready!');
    }
}

// Start app on load
document.addEventListener('DOMContentLoaded', async () => {
    const app = new MinerApp();
    await app.init();
    window.app = app;
});
