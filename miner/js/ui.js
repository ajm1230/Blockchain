/* ============================================================
   UI — DOM controller. Wires every page/button/table to the data layer.
   Exposes window.UIBridge so other modules can push live updates here.
   ============================================================ */

const UI = {

    init() {
        this._wireNav();
        this._wireWallet();
        this._wireMining();
        this._wireMempool();
        this._wireExplorer();
        this._wireSend();
        this._wirePeers();
        this._wireFiles();
        this._wireRepair();
        this._wireSettings();
        this._wireConsole();
        this._wireModals();

        window.UIBridge = {
            onNetworkStatus: (isOn) => this._setNetStatus(isOn),
            onMempoolChanged: () => this.refreshMempoolTable(),
            onBlockAccepted: (block) => { this.refreshExplorer(); this.refreshWalletPanel(); },
            onMiningProgress: (stats) => this._renderMiningStats(stats),
            onMiningDraftUpdate: (block, fees) => this._renderDraft(block, fees),
            onMiningAbandoned: () => this.log('Draft abandoned — network found a block first', 'warn'),
            log: (msg, type) => this.log(msg, type)
        };

        this.refreshAll();
    },

    refreshAll() {
        this.refreshWalletPanel();
        this.refreshExplorer();
        this.refreshMempoolTable();
        this.refreshPeersTable();
        this.refreshMyBlocks();
        this.refreshTxHistory();
        this.refreshFileTree();
        this._loadSettingsForm();
        this._runTamperCheck();
    },

    /* ===================== NAVIGATION ===================== */
    _wireNav() {
        document.querySelectorAll('.nav-item, .bn-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'more') { this.switchPage('settings'); return; }
                this.switchPage(page);
            });
        });
    },

    switchPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item, .bn-item').forEach(b => b.classList.remove('active'));
        document.getElementById('page-' + page)?.classList.add('active');
        document.querySelectorAll(`[data-page="${page}"]`).forEach(b => b.classList.add('active'));
    },

    _setNetStatus(isOn) {
        document.getElementById('netDot').classList.toggle('on', isOn);
        document.getElementById('netText').textContent = isOn ? 'Online' : 'Offline';
    },

    /* ===================== WALLET PAGE ===================== */
    _wireWallet() {
        document.getElementById('btnNewWallet').addEventListener('click', async () => {
            const result = await Wallet.createNew();
            document.getElementById('newPrivShow').value = JSON.stringify(Wallet.getBackupObject(), null, 2);
            document.getElementById('newAddrShow').value = result.address;
            this._openModal('createModal');
            this.refreshWalletPanel();
            this.refreshExplorer();
            this.toast('Wallet created', 'success');
        });

        document.getElementById('btnRecoverWallet').addEventListener('click', () => this._openModal('recoverModal'));

        document.getElementById('confirmRecover').addEventListener('click', async () => {
            const input = document.getElementById('recoverInput').value.trim();
            const result = await Wallet.recoverFromPrivateKey(input);
            if (result.ok) {
                this._closeModal('recoverModal');
                this.refreshWalletPanel();
                this.toast('Wallet recovered', 'success');
            } else {
                this.toast(result.error, 'error');
            }
        });

        document.getElementById('copyAddr').addEventListener('click', () => {
            Utils.copyToClipboard(Wallet.address);
            this.toast('Address copied', 'success');
        });

        document.getElementById('copyPub').addEventListener('click', () => {
            Utils.copyToClipboard(JSON.stringify(Wallet.publicKey));
            this.toast('Public key copied', 'success');
        });

        document.getElementById('copyPriv').addEventListener('click', () => {
            Utils.copyToClipboard(JSON.stringify(Wallet.privateKey));
            this.toast('Private key copied', 'success');
        });

        document.getElementById('togglePriv').addEventListener('click', () => {
            const field = document.getElementById('privKeyField');
            field.type = field.type === 'password' ? 'text' : 'password';
        });

        document.getElementById('downloadBackup').addEventListener('click', () => {
            Utils.downloadJSON(Wallet.getBackupObject(), `nodevault-recovery-${Wallet.address}.json`);
            this.toast('Recovery file downloaded', 'success');
        });

        document.getElementById('deleteWallet').addEventListener('click', () => {
            if (!confirm('Delete this wallet? Make sure you downloaded the recovery file first.')) return;
            Wallet.deleteWallet();
            this.refreshWalletPanel();
            this.toast('Wallet deleted', 'success');
        });

        document.getElementById('showQr').addEventListener('click', () => {
            this._openModal('qrModal');
            const canvas = document.getElementById('qrCanvas');
            QRCode.render(canvas, Wallet.address);
            document.getElementById('qrAddrText').textContent = Wallet.address;
        });
    },

    refreshWalletPanel() {
        const has = Wallet.exists();
        document.getElementById('noWalletPanel').style.display = has ? 'none' : 'block';
        document.getElementById('walletPanel').style.display = has ? 'grid' : 'none';
        if (!has) return;

        document.getElementById('addrField').value = Wallet.address;
        document.getElementById('pubKeyField').value = JSON.stringify(Wallet.publicKey);
        document.getElementById('privKeyField').value = JSON.stringify(Wallet.privateKey);

        const balance = Wallet.getBalance();
        document.getElementById('balVal').textContent = Utils.fmtBTC(balance);
        const pendingOut = Mempool.all().filter(t => t.from === Wallet.address)
            .reduce((s, t) => s + t.amount + (t.fee || 0), 0);
        document.getElementById('balConfirmed').textContent = `${Utils.fmtBTC(balance)} confirmed`;
        document.getElementById('balPending').textContent = `${Utils.fmtBTC(pendingOut)} pending out`;
    },

    /* ===================== MINING PAGE ===================== */
    _wireMining() {
        document.getElementById('btnStartMine').addEventListener('click', async () => {
            if (!Wallet.exists()) { this.toast('Create a wallet first', 'error'); return; }
            document.getElementById('btnStartMine').style.display = 'none';
            document.getElementById('btnStopMine').style.display = 'inline-flex';
            document.getElementById('miningStateLabel').textContent = 'Mining…';
            document.getElementById('miningStateLabel').classList.add('active');

            const settings = Storage.getSettings();
            const rewardAddr = settings.rewardDest === 'custom' && settings.customRewardAddr
                ? settings.customRewardAddr : Wallet.address;

            this._mineLoop(rewardAddr);
        });

        document.getElementById('btnStopMine').addEventListener('click', () => {
            Mining.stop();
            document.getElementById('btnStartMine').style.display = 'inline-flex';
            document.getElementById('btnStopMine').style.display = 'none';
            document.getElementById('miningStateLabel').textContent = 'Idle';
            document.getElementById('miningStateLabel').classList.remove('active');
            this.log('Mining stopped by user', 'warn');
        });

        document.getElementById('autoMineSwitch').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.autoMine = e.target.checked;
            Storage.saveSettings(settings);
            if (e.target.checked && !Mining.isMining) document.getElementById('btnStartMine').click();
        });
    },

    async _mineLoop(rewardAddr) {
        while (!Mining._stopRequested) {
            const block = await Mining.mineNext(rewardAddr);
            if (!block) break; // stopped or abandoned

            const added = await Blockchain.addBlock(block);
            if (added) {
                const minedIds = block.transactions.filter(t => t.type !== 'FEE_COLLECTION').map(t => t.id);
                Mempool.removeMany(minedIds);
                await Network.broadcastBlock(block);

                const myBlocks = Storage.getMyBlocks();
                const feeEarned = block.transactions.find(t => t.type === 'FEE_COLLECTION')?.amount || 0;
                myBlocks.unshift({ ...block, feeEarned, minedAt: new Date().toISOString() });
                Storage.saveMyBlocks(myBlocks);

                this.log(`⛏ Block #${block.index} mined! Hash: ${Utils.short(block.hash)} | Fees: ${Utils.fmtBTC(feeEarned)}`, 'ok');
                this.toast(`Block #${block.index} mined!`, 'success');

                this.refreshExplorer();
                this.refreshWalletPanel();
                this.refreshMyBlocks();
            }

            const settings = Storage.getSettings();
            if (!settings.autoMine) break;
            await Utils.nextTick();
        }

        document.getElementById('btnStartMine').style.display = 'inline-flex';
        document.getElementById('btnStopMine').style.display = 'none';
        document.getElementById('miningStateLabel').textContent = 'Idle';
        document.getElementById('miningStateLabel').classList.remove('active');
    },

    _renderMiningStats(stats) {
        document.getElementById('statHashRate').textContent = stats.hashRateFormatted;
        document.getElementById('statAttempts').textContent = stats.attempts.toLocaleString();
        document.getElementById('statNonce').textContent = stats.nonce.toLocaleString();
        document.getElementById('statElapsed').textContent = stats.elapsedFormatted;
        document.getElementById('statBlocksMined').textContent = stats.blocksMinedCount;
        document.getElementById('statFeesEarned').textContent = Utils.fmtBTC(stats.totalFeesEarned);
    },

    _renderDraft(block, fees) {
        document.getElementById('draftHeight').textContent = block.index;
        document.getElementById('draftPrevHash').textContent = Utils.short(block.previousHash);
        document.getElementById('draftTxCount').textContent = block.transactions.length;
        document.getElementById('draftFees').textContent = Utils.fmtBTC(fees);
    },

    /* ===================== MEMPOOL PAGE ===================== */
    _wireMempool() {
        document.getElementById('refreshMempool').addEventListener('click', async () => {
            const remote = await Network.fetchMempool();
            for (const tx of remote) {
                const bal = Blockchain.getBalance(tx.from);
                const r = await Mempool.validateTransaction(tx, bal);
                if (r.valid) Mempool.add(tx);
            }
            this.refreshMempoolTable();
        });
    },

    refreshMempoolTable() {
        const txs = Mempool.byFeePriority();
        document.getElementById('mempoolCount').textContent = txs.length;
        const body = document.getElementById('mempoolBody');
        if (txs.length === 0) {
            body.innerHTML = `<tr><td colspan="6" class="empty-row">Mempool is empty</td></tr>`;
            return;
        }
        const maxFee = Math.max(...txs.map(t => t.fee || 0), 0.0001);
        body.innerHTML = txs.map(tx => `
            <tr>
                <td class="mono">${Utils.short(tx.id)}</td>
                <td class="mono">${Utils.short(tx.from)}</td>
                <td class="mono">${Utils.short(tx.to)}</td>
                <td>${Utils.fmtBTC(tx.amount)}</td>
                <td>${Utils.fmtBTC(tx.fee || 0)}</td>
                <td>${this._priorityBar((tx.fee || 0) / maxFee)}</td>
            </tr>
        `).join('');
    },

    _priorityBar(ratio) {
        const pct = Math.round(Math.min(ratio, 1) * 100);
        const color = pct > 60 ? 'var(--green)' : pct > 25 ? 'var(--amber)' : 'var(--text-faint)';
        return `<div style="background:var(--bg);border-radius:4px;height:6px;width:80px;overflow:hidden">
                    <div style="background:${color};height:100%;width:${pct}%"></div>
                </div>`;
    },

    /* ===================== EXPLORER PAGE ===================== */
    _wireExplorer() {
        document.getElementById('validateChainBtn').addEventListener('click', async () => {
            const result = await Blockchain.validateChain();
            this._renderChainStatus(result);
            this.toast(result.valid ? 'Chain is valid' : `Invalid at block ${result.brokenAt}`, result.valid ? 'success' : 'error');
        });
    },

    async refreshExplorer() {
        const chain = Blockchain.chain;
        document.getElementById('expHeight').textContent = chain.length;
        const totalTx = chain.reduce((s, b) => s + (b.transactions?.length || 0), 0);
        document.getElementById('expTxTotal').textContent = totalTx;
        document.getElementById('expLastTime').textContent = chain.length ? Utils.fmtTime(chain[chain.length - 1].timestamp) : '—';

        const body = document.getElementById('explorerBody');
        if (chain.length === 0) {
            body.innerHTML = `<tr><td colspan="6" class="empty-row">No blocks yet</td></tr>`;
        } else {
            body.innerHTML = [...chain].reverse().map(b => `
                <tr class="clickable" data-height="${b.index}">
                    <td>#${b.index}</td>
                    <td class="mono">${Utils.short(b.hash)}</td>
                    <td class="mono">${Utils.short(b.previousHash)}</td>
                    <td>${b.transactions?.length || 0}</td>
                    <td>${Utils.fmtTime(b.timestamp)}</td>
                    <td><button class="btn btn-sm btn-outline view-block">View</button></td>
                </tr>
            `).join('');

            body.querySelectorAll('.view-block').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const height = Number(e.target.closest('tr').dataset.height);
                    const block = chain.find(b => b.index === height);
                    document.getElementById('blockJsonView').textContent = JSON.stringify(block, null, 2);
                    this._openModal('blockModal');
                });
            });
        }

        const result = await Blockchain.validateChain();
        this._renderChainStatus(result);
    },

    _renderChainStatus(result) {
        const el = document.getElementById('expValid');
        el.textContent = result.valid ? 'Valid ✓' : `Broken at #${result.brokenAt}`;
        el.classList.toggle('ok', result.valid);
        el.classList.toggle('bad', !result.valid);
    },

    refreshMyBlocks() {
        const blocks = Storage.getMyBlocks();
        const body = document.getElementById('myBlocksBody');
        if (blocks.length === 0) {
            body.innerHTML = `<tr><td colspan="6" class="empty-row">You haven't mined any blocks yet</td></tr>`;
            return;
        }
        body.innerHTML = blocks.map(b => `
            <tr>
                <td>#${b.index}</td>
                <td class="mono">${Utils.short(b.hash)}</td>
                <td>${b.nonce.toLocaleString()}</td>
                <td>${b.transactions.length}</td>
                <td>${Utils.fmtBTC(b.feeEarned)}</td>
                <td>${Utils.fmtTime(b.minedAt)}</td>
            </tr>
        `).join('');
    },

    /* ===================== SEND PAGE ===================== */
    _wireSend() {
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                document.getElementById('sendFee').value = chip.dataset.fee;
            });
        });

        document.getElementById('sendForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const to = document.getElementById('sendTo').value.trim();
            const amount = document.getElementById('sendAmount').value;
            const fee = document.getElementById('sendFee').value;

            const result = await Wallet.createTransaction(to, amount, fee);
            if (!result.ok) { this.toast(result.error, 'error'); return; }

            document.getElementById('sigPreview').style.display = 'block';
            document.getElementById('sigPreviewText').textContent = Utils.short(result.tx.signature, 16, 16);

            Mempool.add(result.tx);
            await Network.broadcastTransaction(result.tx);

            const history = Storage.getTxHistory();
            history.unshift({ ...result.tx, status: 'pending' });
            Storage.saveTxHistory(history);

            this.refreshTxHistory();
            this.refreshWalletPanel();
            this.toast('Transaction broadcast', 'success');
            this.log(`TX sent: ${Utils.short(result.tx.id)} → ${Utils.short(to)}`, 'ok');
            e.target.reset();
            document.getElementById('sendFee').value = '0.0001';
        });
    },

    refreshTxHistory() {
        const history = Storage.getTxHistory();
        const body = document.getElementById('historyBody');
        if (history.length === 0) {
            body.innerHTML = `<tr><td colspan="4" class="empty-row">No transactions sent yet</td></tr>`;
            return;
        }
        body.innerHTML = history.map(tx => {
            const confirmed = Blockchain.chain.some(b => b.transactions?.some(t => t.id === tx.id));
            return `<tr>
                <td class="mono">${Utils.short(tx.to)}</td>
                <td>${Utils.fmtBTC(tx.amount)}</td>
                <td>${Utils.fmtBTC(tx.fee)}</td>
                <td>${confirmed ? '<span style="color:var(--green)">Confirmed</span>' : '<span style="color:var(--amber)">Pending</span>'}</td>
            </tr>`;
        }).join('');
    },

    /* ===================== PEERS PAGE ===================== */
    _wirePeers() {
        document.getElementById('refreshPeers').addEventListener('click', () => this.refreshPeersTable());
    },

    async refreshPeersTable() {
        const peers = await Network.fetchPeers();
        document.getElementById('peerCount').textContent = peers.length;
        document.getElementById('peerListCount').textContent = peers.length;
        const body = document.getElementById('peersBody');
        if (peers.length === 0) {
            body.innerHTML = `<tr><td colspan="5" class="empty-row">No peers connected</td></tr>`;
            return;
        }
        body.innerHTML = peers.map(p => `
            <tr>
                <td class="mono">${Utils.short(p.nodeId)}</td>
                <td class="mono">${Utils.short(p.walletAddress)}</td>
                <td>${p.chainLength}</td>
                <td class="mono">${Utils.short(p.latestBlockHash || p.latestHash)}</td>
                <td><span style="color:var(--green)">●</span> ${p.status}</td>
            </tr>
        `).join('');
    },

    /* ===================== FILE EXPLORER PAGE ===================== */
    _wireFiles() {
        document.getElementById('editFileBtn').addEventListener('click', () => {
            const el = document.getElementById('fileContent');
            el.contentEditable = 'true';
            el.focus();
            document.getElementById('saveFileBtn').style.display = 'inline-flex';
        });

        document.getElementById('saveFileBtn').addEventListener('click', async () => {
            const el = document.getElementById('fileContent');
            const path = el.dataset.path;
            try {
                const edited = JSON.parse(el.textContent);
                if (path && path.startsWith('Blocks/')) {
                    const height = Number(path.split('/')[1]);
                    Blockchain.chain[height] = edited;
                    Blockchain.persist();
                    this.toast('Saved — tamper check will now flag this block', 'success');
                    this._runTamperCheck();
                    this.refreshExplorer();
                }
            } catch (err) {
                this.toast('Invalid JSON — not saved', 'error');
            }
            el.contentEditable = 'false';
            document.getElementById('saveFileBtn').style.display = 'none';
        });
    },

    refreshFileTree() {
        const tree = document.getElementById('fileTree');
        let html = `<li class="folder">Wallet/</li>
            <li data-path="Wallet/address.txt">address.txt</li>
            <li data-path="Wallet/public-key.json">public-key.json</li>
            <li class="folder">Blocks/</li>`;
        Blockchain.chain.forEach(b => {
            html += `<li data-path="Blocks/${b.index}">block_${b.index}.json</li>`;
        });
        html += `<li class="folder">PendingTransactions/</li>`;
        Mempool.all().forEach(tx => {
            html += `<li data-path="Pending/${tx.id}">${Utils.short(tx.id)}.json</li>`;
        });
        tree.innerHTML = html;

        tree.querySelectorAll('li[data-path]').forEach(li => {
            li.addEventListener('click', () => {
                tree.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                li.classList.add('active');
                const path = li.dataset.path;
                const content = document.getElementById('fileContent');
                content.dataset.path = path;
                content.contentEditable = 'false';
                document.getElementById('fileEditActions').style.display = 'flex';
                document.getElementById('saveFileBtn').style.display = 'none';

                if (path === 'Wallet/address.txt') content.textContent = Wallet.address || '';
                else if (path === 'Wallet/public-key.json') content.textContent = JSON.stringify(Wallet.publicKey, null, 2);
                else if (path.startsWith('Blocks/')) {
                    const h = Number(path.split('/')[1]);
                    content.textContent = JSON.stringify(Blockchain.chain[h], null, 2);
                } else if (path.startsWith('Pending/')) {
                    const id = path.split('/')[1];
                    content.textContent = JSON.stringify(Mempool.all().find(t => t.id.startsWith(id)), null, 2);
                }
            });
        });
    },

    /* ===================== REPAIR CENTER PAGE ===================== */
    _wireRepair() {
        document.getElementById('repairOfflineBtn').addEventListener('click', () => {
            Network.setOnline(false);
            document.getElementById('onlineSwitch').checked = false;
            document.getElementById('repairDeleteBtn').disabled = false;
            this.toast('Now offline', 'success');
        });

        document.getElementById('repairDeleteBtn').addEventListener('click', () => {
            if (!confirm('This will erase your entire local blockchain. Continue?')) return;
            Blockchain.wipe();
            document.getElementById('repairDownloadBtn').disabled = false;
            this.refreshExplorer();
            this.toast('Ledger deleted', 'success');
        });

        document.getElementById('repairDownloadBtn').addEventListener('click', async () => {
            await Network.checkForLongerChain();
            document.getElementById('repairOnlineBtn').disabled = false;
            this.toast('Requested ledger from peers', 'success');
        });

        document.getElementById('repairOnlineBtn').addEventListener('click', () => {
            Network.setOnline(true);
            document.getElementById('onlineSwitch').checked = true;
            this.toast('Back online', 'success');
            this._runTamperCheck();
        });
    },

    async _runTamperCheck() {
        const result = await Blockchain.validateChain();
        const panel = document.getElementById('tamperStatus');
        const text = document.getElementById('tamperStatusText');
        panel.classList.toggle('ok', result.valid);
        panel.classList.toggle('bad', !result.valid);
        text.textContent = result.valid
            ? 'Ledger integrity verified — no tampering detected'
            : `Tampering detected at block #${result.brokenAt} — use Repair Center below`;
    },

    /* ===================== SETTINGS PAGE ===================== */
    _wireSettings() {
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            const settings = Storage.getSettings();
            settings.serverUrl = document.getElementById('settingServerUrl').value;
            Storage.saveSettings(settings);
            this.toast('Settings saved', 'success');
        });

        document.getElementById('regenNodeId').addEventListener('click', () => {
            const newId = 'node_' + Utils.randomId(12);
            Storage.set(CONFIG.KEYS.NODE_ID, newId);
            Network.nodeId = newId;
            document.getElementById('settingNodeId').value = newId;
            this.toast('Node ID regenerated', 'success');
        });

        document.querySelectorAll('input[name="rewardDest"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('customRewardAddr').style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        });

        document.getElementById('saveRewardBtn').addEventListener('click', () => {
            const settings = Storage.getSettings();
            settings.rewardDest = document.querySelector('input[name="rewardDest"]:checked').value;
            settings.customRewardAddr = document.getElementById('customRewardAddr').value;
            Storage.saveSettings(settings);
            this.toast('Reward address saved', 'success');
        });

        document.getElementById('onlineSwitch').addEventListener('change', (e) => {
            Network.setOnline(e.target.checked);
        });
    },

    _loadSettingsForm() {
        document.getElementById('settingServerUrl').value = CONFIG.SERVER_URL;
        document.getElementById('settingNodeId').value = Network.nodeId;
        document.getElementById('onlineSwitch').checked = Network.online;

        const settings = Storage.getSettings();
        if (settings.rewardDest === 'custom') {
            document.querySelector('input[name="rewardDest"][value="custom"]').checked = true;
            document.getElementById('customRewardAddr').style.display = 'block';
            document.getElementById('customRewardAddr').value = settings.customRewardAddr || '';
        }
        if (settings.autoMine) document.getElementById('autoMineSwitch').checked = true;
    },

    /* ===================== CONSOLE PAGE ===================== */
    _wireConsole() {
        document.getElementById('clearConsole').addEventListener('click', () => {
            document.getElementById('consoleTerminal').innerHTML = '';
        });
        document.getElementById('downloadConsole').addEventListener('click', () => {
            const lines = Array.from(document.getElementById('consoleTerminal').children).map(l => l.textContent);
            Utils.downloadText(lines.join('\n'), 'nodevault-console.log');
        });
    },

    log(message, type = '') {
        const consoleEl = document.getElementById('consoleTerminal');
        const miningEl = document.getElementById('miningTerminal');
        const line = `<div class="t-line ${type}">[${new Date().toLocaleTimeString()}] ${message}</div>`;
        [consoleEl, miningEl].forEach(el => {
            if (!el) return;
            el.insertAdjacentHTML('beforeend', line);
            el.scrollTop = el.scrollHeight;
            while (el.children.length > CONFIG.TERMINAL_MAX_LINES) el.removeChild(el.firstChild);
        });
    },

    /* ===================== MODALS & TOAST ===================== */
    _wireModals() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal-backdrop').classList.remove('show');
            });
        });
    },

    _openModal(id) { document.getElementById(id).classList.add('show'); },
    _closeModal(id) { document.getElementById(id).classList.remove('show'); },

    toast(message, type = 'success') {
        const t = document.getElementById('toast');
        t.textContent = message;
        t.className = `toast show ${type}`;
        setTimeout(() => t.classList.remove('show'), CONFIG.TOAST_DURATION_MS);
    }
};
