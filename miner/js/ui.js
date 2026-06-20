/**
 * UI - User Interface Management
 */

const UI = {
    currentPage: 'wallet',

    init() {
        // Page navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => this.switchPage(link.dataset.page));
        });

        // Wallet buttons
        document.getElementById('createWalletBtn')?.addEventListener('click', () => this.showCreateWallet());
        document.getElementById('importWalletBtn')?.addEventListener('click', () => this.showImportWallet());
        document.getElementById('resetWalletBtn')?.addEventListener('click', () => this.resetWallet());
        document.getElementById('copyAddressBtn')?.addEventListener('click', () => {
            Utils.copyToClipboard(Wallet.address);
            this.toast('Copied to clipboard', 'success');
        });
        document.getElementById('togglePrivateBtn')?.addEventListener('click', (e) => {
            const field = document.getElementById('privateKeyDisplay');
            field.type = field.type === 'password' ? 'text' : 'password';
            e.target.textContent = field.type === 'password' ? '👁️' : '🙈';
        });
        document.getElementById('copyPrivateBtn')?.addEventListener('click', () => {
            Utils.copyToClipboard(document.getElementById('privateKeyDisplay').value);
            this.toast('Private key copied', 'success');
        });
        document.getElementById('downloadRecoveryBtn')?.addEventListener('click', () => {
            const recovery = {
                address: Wallet.address,
                privateKey: JSON.stringify(Wallet.privKey),
                created: new Date().toISOString()
            };
            Utils.downloadFile(JSON.stringify(recovery, null, 2), 'wallet-recovery.json');
            this.toast('Recovery file downloaded', 'success');
        });

        // Mining buttons
        document.getElementById('startMineBtn')?.addEventListener('click', () => this.startMining());
        document.getElementById('stopMineBtn')?.addEventListener('click', () => this.stopMining());

        // Transaction form
        document.getElementById('txForm')?.addEventListener('submit', (e) => this.sendTransaction(e));

        // Mempool button
        document.getElementById('refreshMempoolBtn')?.addEventListener('click', () => this.refreshMempool());

        // Nodes button
        document.getElementById('refreshNodesBtn')?.addEventListener('click', () => this.refreshNodes());

        // Settings
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());

        // Logs
        document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
            document.getElementById('systemLogs').innerHTML = '<div class="log-line">[Cleared]</div>';
        });

        // Modal close
        document.getElementById('closeModal')?.addEventListener('click', () => {
            document.getElementById('modal').classList.remove('show');
        });

        this.updateUI();
    },

    switchPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.getElementById(page + 'Page')?.classList.add('active');
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
        this.currentPage = page;
    },

    updateUI() {
        if (Wallet.exists()) {
            document.getElementById('walletSetup').style.display = 'none';
            document.getElementById('walletInfo').style.display = 'block';
            this.updateWalletInfo();
        } else {
            document.getElementById('walletSetup').style.display = 'block';
            document.getElementById('walletInfo').style.display = 'none';
        }
        this.updateStatus();
        this.updateBlockchain();
    },

    updateWalletInfo() {
        document.getElementById('walletAddress').value = Wallet.address;
        document.getElementById('publicKeyDisplay').value = JSON.stringify(Wallet.pubKey, null, 2);
        document.getElementById('privateKeyDisplay').value = JSON.stringify(Wallet.privKey, null, 2);
        document.getElementById('balanceValue').textContent = Wallet.getBalance().toFixed(2);
    },

    updateStatus() {
        const indicator = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        if (Server.connected) {
            indicator?.classList.add('online');
            text.textContent = 'Online';
        } else {
            indicator?.classList.remove('online');
            text.textContent = 'Offline';
        }
    },

    updateBlockchain() {
        const blocks = Blockchain.blocks;
        document.getElementById('totalBlocks').textContent = blocks.length;
        document.getElementById('chainLength').textContent = blocks.length;

        const tbody = document.getElementById('blockTableBody');
        if (tbody) {
            tbody.innerHTML = blocks.map((b, i) => `
                <tr>
                    <td>#${b.index}</td>
                    <td>${Utils.formatHash(b.hash)}</td>
                    <td>${b.transactions.length}</td>
                    <td>${new Date(b.timestamp).toLocaleTimeString()}</td>
                </tr>
            `).join('');
        }
    },

    async refreshMempool() {
        const txs = await Server.getMempool();
        txs.forEach(tx => Mempool.add(tx));
        const tbody = document.getElementById('mempoolBody');
        if (tbody) {
            if (Mempool.txs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No pending transactions</td></tr>';
            } else {
                tbody.innerHTML = Mempool.getAll().map(tx => `
                    <tr>
                        <td>${Utils.formatAddress(tx.from)}</td>
                        <td>${Utils.formatAddress(tx.to)}</td>
                        <td>${tx.amount}</td>
                        <td>${tx.fee || 0}</td>
                    </tr>
                `).join('');
            }
        }
    },

    async refreshNodes() {
        const nodes = await Server.getNodes();
        const tbody = document.getElementById('nodesBody');
        if (tbody) {
            if (nodes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No nodes connected</td></tr>';
            } else {
                tbody.innerHTML = nodes.map(n => `
                    <tr>
                        <td>${Utils.formatHash(n.nodeId)}</td>
                        <td>${Utils.formatAddress(n.walletAddress)}</td>
                        <td>${n.chainLength}</td>
                        <td><span style="color: #10b981;">●</span> ${n.status}</td>
                    </tr>
                `).join('');
            }
        }
    },

    showCreateWallet() {
        this.showModal('Create New Wallet', `
            <p>A new wallet will be created with a random keypair.</p>
            <button class="btn btn-primary" id="confirmCreateWallet" style="width: 100%; margin-top: 1rem;">
                Create Wallet
            </button>
        `);
        document.getElementById('confirmCreateWallet').addEventListener('click', async () => {
            await Wallet.create();
            this.updateUI();
            this.closeModal();
            this.toast('Wallet created successfully', 'success');
        });
    },

    showImportWallet() {
        this.showModal('Import Wallet', `
            <input type="text" id="importPrivateKey" placeholder="Paste private key (JSON)" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; background: #0f172a; border: 1px solid #475569; color: #f1f5f9; border-radius: 8px;">
            <button class="btn btn-primary" id="confirmImportWallet" style="width: 100%;">
                Import
            </button>
        `);
        document.getElementById('confirmImportWallet').addEventListener('click', async () => {
            const key = document.getElementById('importPrivateKey').value;
            if (await Wallet.import(key)) {
                this.updateUI();
                this.closeModal();
                this.toast('Wallet imported successfully', 'success');
            } else {
                this.toast('Failed to import wallet', 'error');
            }
        });
    },

    resetWallet() {
        if (confirm('Delete wallet? Download recovery file first!')) {
            Wallet.reset();
            this.updateUI();
            this.toast('Wallet reset', 'success');
        }
    },

    async startMining() {
        if (!Wallet.exists()) {
            this.toast('Create wallet first', 'error');
            return;
        }
        this.log('[Mining] Starting...', 'success');
        document.getElementById('startMineBtn').style.display = 'none';
        document.getElementById('stopMineBtn').style.display = 'inline-flex';

        const txs = Mempool.select(10);
        const block = await Mining.mineBlock(txs);

        if (block) {
            Blockchain.addBlock(block);
            await Server.broadcastBlock(block);
            this.updateBlockchain();
            this.log('[Mining] Block mined! Hash: ' + Utils.formatHash(block.hash), 'success');
            this.toast('Block mined!', 'success');
            this.updateWalletInfo();
        }

        document.getElementById('startMineBtn').style.display = 'inline-flex';
        document.getElementById('stopMineBtn').style.display = 'none';
    },

    stopMining() {
        Mining.stop();
        document.getElementById('startMineBtn').style.display = 'inline-flex';
        document.getElementById('stopMineBtn').style.display = 'none';
        this.log('[Mining] Stopped', 'warning');
    },

    async sendTransaction(e) {
        e.preventDefault();
        const to = document.getElementById('recipientAddr').value;
        const amount = parseFloat(document.getElementById('txAmount').value);
        const fee = parseFloat(document.getElementById('txFee').value || 0.01);

        if (!to || !amount) {
            this.toast('Fill all fields', 'error');
            return;
        }

        if (Wallet.getBalance() < amount + fee) {
            this.toast('Insufficient balance', 'error');
            return;
        }

        const tx = await Wallet.createTransaction(to, amount, fee);
        if (tx) {
            await Server.broadcastTransaction(tx);
            Mempool.add(tx);
            this.toast('Transaction sent', 'success');
            this.log('[TX] Sent to ' + Utils.formatAddress(to), 'success');
            e.target.reset();
        }
    },

    saveSettings() {
        const url = document.getElementById('serverUrl').value;
        if (url) {
            Storage.set('serverUrl', url);
            this.toast('Settings saved', 'success');
        }
    },

    showModal(title, content) {
        const modal = document.getElementById('modal');
        const body = document.getElementById('modalBody');
        body.innerHTML = `<h3>${title}</h3><div>${content}</div>`;
        modal.classList.add('show');
    },

    closeModal() {
        document.getElementById('modal').classList.remove('show');
    },

    log(message, type = 'info') {
        const logs = document.getElementById('miningLog') || document.getElementById('systemLogs');
        if (!logs) return;
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logs.appendChild(line);
        logs.scrollTop = logs.scrollHeight;
    },

    toast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};
