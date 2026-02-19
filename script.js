const sendBtn       = document.getElementById('send-btn');
const urlInput      = document.getElementById('url');
const methodSelect  = document.getElementById('method');
const responseBody  = document.getElementById('response-body');
const historyList   = document.getElementById('history-list');
const statusBadge   = document.getElementById('status-badge');
const timingBadge   = document.getElementById('timing-badge');
const lineNumbers   = document.getElementById('line-numbers');
const statusDot     = document.querySelector('.status-dot');
const headerStatus  = document.querySelector('.header-status span');
const statTotal     = document.getElementById('stat-total');
const statOk        = document.getElementById('stat-ok');
const statErr       = document.getElementById('stat-err');
const statAvg       = document.getElementById('stat-avg');

let history = [];
let stats   = { total: 0, ok: 0, err: 0, times: [] };

try {
    const stored = JSON.parse(localStorage.getItem('foxHistory') || '{}');
    history = stored.history || [];
    stats   = stored.stats   || stats;
} catch {}

function setDot(state) {
    statusDot.className = 'status-dot ' + state;
    const map = { active: 'READY', loading: 'SENDING…', error: 'ERROR' };
    headerStatus.textContent = map[state] || 'READY';
}

function updateLineNumbers(text) {
    const lines = (text || '').split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
}

function syntaxHighlight(json) {
    return JSON.stringify(json, null, 4)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'json-num';
            if (/^"/.test(match)) {
                cls = /:$/.test(match) ? 'json-key' : 'json-str';
            } else if (/true|false/.test(match)) {
                cls = 'json-bool';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return `<span class="${cls}">${match}</span>`;
        });
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<div class="hi-empty">AUCUNE REQUÊTE</div>';
        return;
    }
    historyList.innerHTML = history.map((h, i) => `
        <div class="history-item" data-index="${i}" title="${h.url}">
            <span class="hi-method ${h.ok ? 'ok' : 'err'}">${h.method}</span>
            <span class="hi-url">${h.url}</span>
        </div>
    `).join('');

    historyList.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            const h = history[+el.dataset.index];
            urlInput.value = h.url;
            methodSelect.value = h.method;
            urlInput.focus();
        });
    });
}

function renderStats() {
    statTotal.textContent = stats.total;
    statOk.textContent    = stats.ok;
    statErr.textContent   = stats.err;
    statAvg.textContent   = stats.times.length
        ? Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length) + ''
        : '—';
}

function saveState() {
    localStorage.setItem('foxHistory', JSON.stringify({ history, stats }));
}

async function handleRequest() {
    const url    = urlInput.value.trim();
    const method = methodSelect.value;

    if (!url) {
        urlInput.focus();
        urlInput.style.borderColor = 'var(--red)';
        setTimeout(() => urlInput.style.borderColor = '', 800);
        return;
    }

    sendBtn.disabled = true;
    document.querySelector('.btn-text').textContent = 'SENDING';
    document.querySelector('.btn-arrow').textContent = '⟳';
    responseBody.className = 'loading';
    responseBody.innerHTML = '// Appel en cours...';
    lineNumbers.innerHTML  = '1';
    statusBadge.className  = 'status-badge';
    statusBadge.textContent = '';
    timingBadge.className   = 'timing-badge';
    setDot('loading');

    try {
        const start = Date.now();
        const res   = await fetch(url, { method });
        const ms    = Date.now() - start;

        let text = await res.text();
        let parsed;
        let isJson = false;

        try {
            parsed = JSON.parse(text);
            isJson = true;
        } catch {}

        const displayed = isJson ? syntaxHighlight(parsed) : text;

        responseBody.className = '';
        responseBody.innerHTML = displayed;

        injectHighlightStyles();

        updateLineNumbers(isJson ? JSON.stringify(parsed, null, 4) : text);

        statusBadge.textContent  = `${res.status} ${res.statusText || 'OK'}`;
        statusBadge.className    = `status-badge ${res.ok ? 'ok' : 'err'}`;
        timingBadge.textContent  = `${ms}ms`;
        timingBadge.className    = 'timing-badge visible';

        setDot(res.ok ? 'active' : 'error');

        history.unshift({ method, url, ok: res.ok, status: res.status });
        history = history.slice(0, 10);

        stats.total++;
        if (res.ok) stats.ok++; else stats.err++;
        stats.times.push(ms);
        if (stats.times.length > 50) stats.times.shift();

    } catch (err) {
        responseBody.className = 'error';
        responseBody.innerHTML = `// ERREUR DE CONNEXION\n// ${err.message}\n\n// Note: Vérifiez les CORS si vous testez une API publique.`;
        updateLineNumbers(responseBody.textContent);

        statusBadge.textContent = 'ERREUR';
        statusBadge.className   = 'status-badge err';
        timingBadge.className   = 'timing-badge';
        setDot('error');

        history.unshift({ method, url, ok: false, status: 0 });
        history = history.slice(0, 10);
        stats.total++;
        stats.err++;
    } finally {
        sendBtn.disabled = false;
        document.querySelector('.btn-text').textContent = 'SEND';
        document.querySelector('.btn-arrow').textContent = '→';
        saveState();
        renderHistory();
        renderStats();
    }
}

let highlightInjected = false;
function injectHighlightStyles() {
    if (highlightInjected) return;
    highlightInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        .json-key  { color: #79c0ff; }
        .json-str  { color: #3dffa0; }
        .json-num  { color: #eaff4f; }
        .json-bool { color: #ff9e64; }
        .json-null { color: #f472b6; }
    `;
    document.head.appendChild(style);
}

sendBtn.addEventListener('click', handleRequest);

urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleRequest();
});

document.getElementById('clear-history').addEventListener('click', () => {
    history = [];
    stats   = { total: 0, ok: 0, err: 0, times: [] };
    saveState();
    renderHistory();
    renderStats();
});

renderHistory();
renderStats();
updateLineNumbers(responseBody.textContent);