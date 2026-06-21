/* ============================================================
   CONFIG — central constants for the whole app
   ============================================================ */

const CONFIG = {

    // ---- Server ----
    SERVER_URL: 'https://crypto3670.pythonanywhere.com',

    // ---- Mining ----
    DIFFICULTY_PREFIX: '000',        // hash must start with this
    BLOCK_REWARD_INITIAL: 50,        // BTC, halves over time (not active yet — fees only for now)
    HALVING_INTERVAL: 210000,        // blocks
    DIFFICULTY_ADJUST_INTERVAL: 2016,// blocks
    TARGET_BLOCK_TIME_MIN: 10,       // minutes

    // ---- Mempool / mining selection ----
    MAX_TX_PER_BLOCK: 25,            // miner's own self-imposed cap (not a network rule)

    // ---- Network ----
    PING_INTERVAL_MS: 15000,
    MEMPOOL_REFRESH_MS: 6000,
    PEERS_REFRESH_MS: 8000,
    SYNC_CHECK_MS: 10000,

    // ---- UI ----
    TOAST_DURATION_MS: 3000,
    TERMINAL_MAX_LINES: 200,

    // ---- LocalStorage Keys ----
    KEYS: {
        PRIVATE_KEY:   'nv_wallet_private',
        PUBLIC_KEY:    'nv_wallet_public',
        ADDRESS:       'nv_wallet_address',
        BLOCKCHAIN:    'nv_blockchain',
        NODE_ID:       'nv_node_id',
        SETTINGS:      'nv_settings',
        TX_HISTORY:    'nv_tx_history',
        MY_BLOCKS:     'nv_my_blocks',
        ONLINE_STATE:  'nv_online_state'
    }
};
