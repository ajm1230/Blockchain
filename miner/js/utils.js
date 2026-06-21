/* ============================================================
   UTILS — small reusable helpers
   ============================================================ */

const Utils = {

    // Short random id (used for node id, tx local refs, etc.)
    randomId(len = 10) {
        return Array.from(crypto.getRandomValues(new Uint8Array(len)))
            .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, len);
    },

    // Truncate long strings for display: "abcd1234...wxyz"
    short(str, head = 8, tail = 6) {
        if (!str) return '—';
        if (str.length <= head + tail + 3) return str;
        return `${str.slice(0, head)}…${str.slice(-tail)}`;
    },

    // Format BTC amount to 8 decimals
    fmtBTC(n) {
        return (Number(n) || 0).toFixed(8);
    },

    // Format unix/ISO timestamp to readable local time
    fmtTime(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        return d.toLocaleString();
    },

    // Format seconds -> HH:MM:SS
    fmtDuration(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    },

    // Format large hash-rate numbers: 1234 -> "1.23 kH/s"
    fmtHashRate(hps) {
        if (hps >= 1_000_000) return (hps / 1_000_000).toFixed(2) + ' MH/s';
        if (hps >= 1_000) return (hps / 1_000).toFixed(2) + ' kH/s';
        return Math.round(hps) + ' H/s';
    },

    copyToClipboard(text) {
        navigator.clipboard?.writeText(text);
    },

    downloadJSON(obj, filename) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },

    downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },

    // Deep clone helper (for safely editing JSON in File Explorer)
    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Validate a NodeVault address loosely (starts with BC, reasonable length)
    isValidAddress(addr) {
        return typeof addr === 'string' && addr.startsWith('BC') && addr.length >= 20;
    },

    // Yield control back to the browser (used inside mining loop so UI doesn't freeze)
    nextTick() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }
};
