chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
const DEFAULT_SERVER = 'http://localhost:3377';
let _woServer = DEFAULT_SERVER;
chrome.storage.local.get('wo_server_url', (r) => {
    if (r?.wo_server_url)
        _woServer = r.wo_server_url;
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.wo_server_url?.newValue)
        _woServer = changes.wo_server_url.newValue;
});
const _approvedSites = new Map();
let _sitesReady = false;
function _persistSites() {
    const obj = Object.fromEntries(_approvedSites);
    chrome.storage.local.set({ wo_approved_sites: obj }).catch(() => { });
}
const _sitesReadyP = new Promise(resolve => {
    chrome.storage.local.get('wo_approved_sites', (r) => {
        if (r?.wo_approved_sites) {
            for (const [k, v] of Object.entries(r.wo_approved_sites))
                _approvedSites.set(k, v);
        }
        chrome.storage.session.get('wo_approved_sites', (r2) => {
            if (r2?.wo_approved_sites) {
                for (const [k, v] of Object.entries(r2.wo_approved_sites)) {
                    if (!_approvedSites.has(k))
                        _approvedSites.set(k, v);
                }
                _persistSites();
                chrome.storage.session.remove('wo_approved_sites').catch(() => { });
            }
            _sitesReady = true;
            resolve();
        });
    });
});
const _pendingWallet = new Map();
let _walletReqId = 0;
let _burnMode = false;
let _burnAddress = '';
const _pendingSidepanelMsgs = [];
function _sendToTab(tabId, pageId, payload) {
    if (!tabId)
        return;
    chrome.tabs.sendMessage(tabId, { type: 'wo-provider-res', id: pageId, ...payload }).catch(() => { });
}
function _sendToSidepanel(msg, errorCb) {
    _pendingSidepanelMsgs.push(msg);
    let attempts = 0;
    const maxAttempts = 30;
    function tryDeliver() {
        attempts++;
        chrome.runtime.sendMessage(msg, (resp) => {
            if (chrome.runtime.lastError || !resp?.ack) {
                if (attempts < maxAttempts) {
                    setTimeout(tryDeliver, 500);
                }
                else {
                    const idx = _pendingSidepanelMsgs.indexOf(msg);
                    if (idx >= 0)
                        _pendingSidepanelMsgs.splice(idx, 1);
                    if (errorCb)
                        errorCb();
                }
                return;
            }
            const idx = _pendingSidepanelMsgs.indexOf(msg);
            if (idx >= 0)
                _pendingSidepanelMsgs.splice(idx, 1);
        });
    }
    tryDeliver();
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'wo-force-sync') {
        if (!_dataCollectionStarted) {
            sendResponse({ ok: false, error: 'no consent' });
            return true;
        }
        syncAxiomCookies().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e.message }));
        return true;
    }
    if (msg.type === 'wo-gmgn-ws-relay' && msg.wsUrl) {
        fetch(`${_woServer}/api/twitter/gmgn-ws`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wsUrl: msg.wsUrl })
        })
            .then(r => r.json())
            .then(data => { sendResponse({ ok: true }); })
            .catch(err => { sendResponse({ ok: false }); });
        return true;
    }
    if (msg.type === 'wo-gmgn-ws-data' && Array.isArray(msg.items) && msg.items.length) {
        fetch(`${_woServer}/api/twitter/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg.items)
        }).catch(() => { });
        return false;
    }
    if (msg.type === 'wo-fetch') {
        fetch(msg.url, {
            method: msg.method || 'GET',
            headers: msg.headers || {},
            body: msg.body || undefined,
        })
            .then(async (r) => {
            const text = await r.text();
            sendResponse({ ok: r.ok, status: r.status, body: text });
        })
            .catch((err) => {
            sendResponse({ ok: false, status: 0, body: err.message });
        });
        return true;
    }
    if (msg.type === 'wo-mint-detected' || msg.type === 'wo-mint-cleared') {
        chrome.runtime.sendMessage(msg).catch(() => { });
    }
    if (msg.type === 'wo-scan-page-drainer-result') {
        chrome.runtime.sendMessage(msg).catch(() => { });
    }
    if (msg.type === 'wo-token-info') {
        const api = msg.api || _woServer;
        const mint = msg.mint || '';
        Promise.all([
            fetch(api + '/api/token/info/' + encodeURIComponent(mint)).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(api + '/api/token/holders/' + encodeURIComponent(mint)).then(r => r.ok ? r.json() : null).catch(() => null),
        ]).then(([info, holders]) => {
            sendResponse({ ok: true, info, holders });
        }).catch(err => {
            sendResponse({ ok: false, error: err.message || 'Failed to fetch token info' });
        });
        return true;
    }
    if (msg.type === 'wo-image-scan') {
        const api = msg.api || _woServer;
        const SOL_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
        const SKIP = new Set([
            'So11111111111111111111111111111111111111112',
            '11111111111111111111111111111111',
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
        ]);
        (async () => {
            try {
                const imgResp = await fetch(msg.imageUrl, { signal: AbortSignal.timeout(8000) });
                if (!imgResp.ok)
                    throw new Error('Image fetch HTTP ' + imgResp.status);
                const blob = await imgResp.blob();
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                });
                const r = await fetch(api + '/api/image-scan', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ imageBase64: dataUrl }),
                });
                const data = r.ok ? await r.json() : { mints: [] };
                sendResponse({ ok: true, mints: data.mints || [] });
            }
            catch (err) {
                sendResponse({ ok: false, mints: [], error: err.message });
            }
        })();
        return true;
    }
    if (msg.type === 'wo-x-pumpfun-buy') {
        const api = msg.api || _woServer;
        fetch(api + '/api/pumpfun/buy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tokenAddress: msg.tokenAddress, solAmount: msg.solAmount }),
        })
            .then(async (r) => {
            const body = await r.text();
            let json;
            try {
                json = JSON.parse(body);
            }
            catch {
                json = { message: body };
            }
            sendResponse({ ok: r.ok, ...json });
        })
            .catch((err) => { sendResponse({ ok: false, error: err.message || 'network error' }); });
        return true;
    }
    if (msg.type === 'wo-x-pumpfun-sell') {
        const api = msg.api || _woServer;
        fetch(api + '/api/pumpfun/sell', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tokenAddress: msg.tokenAddress, percent: msg.percent }),
        })
            .then(async (r) => {
            const body = await r.text();
            let json;
            try {
                json = JSON.parse(body);
            }
            catch {
                json = { message: body };
            }
            sendResponse({ ok: r.ok, ...json });
        })
            .catch((err) => { sendResponse({ ok: false, error: err.message || 'network error' }); });
        return true;
    }
    if (msg.type === 'wo-x-pumpfun-chart') {
        const api = msg.api || _woServer;
        const mint = msg.mint || '';
        fetch(api + '/api/pumpfun/chart/' + encodeURIComponent(mint))
            .then(async (r) => {
            const body = await r.text();
            let json;
            try {
                json = JSON.parse(body);
            }
            catch {
                json = { ok: false, error: body };
            }
            sendResponse(json);
        })
            .catch((err) => { sendResponse({ ok: false, error: err.message || 'network error' }); });
        return true;
    }
    if (msg.type === 'wo-x-pumpfun-build') {
        const post = msg.post || {};
        const api = post.api || _woServer;
        fetch(api + '/api/pumpfun/autobuild', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(post),
        })
            .then(async (r) => {
            const body = await r.text();
            let json;
            try {
                json = JSON.parse(body);
            }
            catch {
                json = { message: body };
            }
            sendResponse({ ok: r.ok, status: r.status, ...json });
        })
            .catch((err) => {
            sendResponse({ ok: false, error: err.message || 'network error' });
        });
        return true;
    }
    if (msg.type === 'wo-x-pumpfun-preview') {
        const post = msg.post || {};
        const api = post.api || _woServer;
        fetch(api + '/api/pumpfun/preview', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(post),
        })
            .then(async (r) => {
            const body = await r.text();
            let json;
            try {
                json = JSON.parse(body);
            }
            catch {
                json = { message: body };
            }
            sendResponse({ ok: r.ok, status: r.status, ...json });
        })
            .catch((err) => {
            sendResponse({ ok: false, error: err.message || 'network error' });
        });
        return true;
    }
    if (msg.type === 'wo-collect-page-data-result') {
        chrome.runtime.sendMessage(msg).catch(() => { });
    }
    if (msg.type === 'wo-inspector-capture' || msg.type === 'wo-inspector-stopped') {
        chrome.runtime.sendMessage(msg).catch(() => { });
    }
    if (msg.type === 'wo-capture-tab') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                sendResponse({ ok: false, error: 'No active tab' });
                return;
            }
            chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'jpeg', quality: 75 }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                }
                else {
                    sendResponse({ ok: true, dataUrl });
                }
            });
        });
        return true;
    }
    if (msg.type === 'wo-use-original-wallet' && msg.tabId && msg.walletName) {
        chrome.tabs.sendMessage(msg.tabId, { type: 'wo-use-original-wallet', walletName: msg.walletName }).catch(() => { });
    }
    if (msg.type === 'wo-get-connected-sites') {
        _sitesReadyP.then(() => {
            const sites = [];
            for (const [origin, address] of _approvedSites) {
                sites.push({ origin, address });
            }
            sendResponse({ sites });
        });
        return true;
    }
    if (msg.type === 'wo-disconnect-site') {
        const disconnOrigin = msg.origin;
        const affectedOrigins = new Set();
        if (disconnOrigin === '*') {
            for (const o of _approvedSites.keys())
                affectedOrigins.add(o);
            _approvedSites.clear();
        }
        else if (disconnOrigin) {
            if (_approvedSites.has(disconnOrigin))
                affectedOrigins.add(disconnOrigin);
            _approvedSites.delete(disconnOrigin);
        }
        _persistSites();
        chrome.tabs.query({}, (tabs) => {
            const reloadIds = [];
            for (const tab of tabs) {
                if (!tab.id)
                    continue;
                chrome.tabs.sendMessage(tab.id, { type: 'wo-wallet-disconnected', origin: disconnOrigin }).catch(() => { });
                if (!tab.url)
                    continue;
                let matched = false;
                if (disconnOrigin === '*') {
                    let tabOrigin;
                    try {
                        tabOrigin = new URL(tab.url).origin;
                    }
                    catch {
                        continue;
                    }
                    matched = affectedOrigins.has(tabOrigin);
                    if (!matched) {
                        const tabHost = new URL(tab.url).hostname.replace(/^www\./, '');
                        for (const ao of affectedOrigins) {
                            try {
                                if (new URL(ao).hostname.replace(/^www\./, '') === tabHost) {
                                    matched = true;
                                    break;
                                }
                            }
                            catch { }
                        }
                    }
                }
                else {
                    let tabOrigin;
                    try {
                        tabOrigin = new URL(tab.url).origin;
                    }
                    catch {
                        continue;
                    }
                    matched = affectedOrigins.has(tabOrigin);
                    if (!matched) {
                        const tabHost = new URL(tab.url).hostname.replace(/^www\./, '');
                        for (const ao of affectedOrigins) {
                            try {
                                if (new URL(ao).hostname.replace(/^www\./, '') === tabHost) {
                                    matched = true;
                                    break;
                                }
                            }
                            catch { }
                        }
                    }
                }
                if (matched)
                    reloadIds.push(tab.id);
            }
            setTimeout(() => {
                for (const id of reloadIds) {
                    try {
                        chrome.tabs.reload(id);
                    }
                    catch { }
                }
            }, 400);
        });
        sendResponse({ ok: true });
        return true;
    }
    if (msg.type === 'wo-get-pending-wallet-msgs') {
        const msgs = _pendingSidepanelMsgs.splice(0);
        sendResponse({ msgs });
        return true;
    }
    if (msg.type === 'wo-set-burn-mode') {
        _burnMode = !!msg.enabled;
        _burnAddress = msg.address || '';
        sendResponse({ ok: true });
        return true;
    }
    if (msg.type === 'wo-provider-req') {
        const { id, action, data, origin, favicon } = msg;
        const tabId = sender.tab?.id;
        if (action === 'connect') {
            const handleConnect = () => {
                if (_approvedSites.has(origin)) {
                    sendResponse({ result: { publicKey: _approvedSites.get(origin) } });
                    return;
                }
                if (data?.onlyIfTrusted) {
                    let pendingForTab = false;
                    for (const [, p] of _pendingWallet) {
                        if (p.tabId === tabId && !p.action) {
                            pendingForTab = true;
                            break;
                        }
                    }
                    if (pendingForTab) {
                        const reqId = ++_walletReqId;
                        _pendingWallet.set(reqId, { tabId, pageId: id, origin });
                        sendResponse({ result: { pending: true } });
                        return;
                    }
                    sendResponse({ error: 'User rejected the request' });
                    return;
                }
                if (_burnMode && _burnAddress) {
                    _approvedSites.set(origin, _burnAddress);
                    _persistSites();
                    sendResponse({ result: { publicKey: _burnAddress } });
                    return;
                }
                let alreadyPendingForTab = false;
                for (const [, p] of _pendingWallet) {
                    if (p.tabId === tabId && !p.action) {
                        alreadyPendingForTab = true;
                        break;
                    }
                }
                const reqId = ++_walletReqId;
                _pendingWallet.set(reqId, { tabId, pageId: id, origin });
                sendResponse({ result: { pending: true } });
                if (alreadyPendingForTab)
                    return;
                if (tabId) {
                    chrome.tabs.sendMessage(tabId, { type: 'wo-scan-page-drainer' }).catch(() => { });
                }
                const connectMsg = {
                    type: 'wo-wallet-connect',
                    origin, favicon, tabId, reqId,
                    detectedWallets: msg.detectedWallets || [],
                };
                (async () => {
                    try {
                        if (tabId)
                            await chrome.sidePanel.open({ tabId });
                    }
                    catch { }
                    _sendToSidepanel(connectMsg, () => {
                        _sendToTab(tabId, id, { error: 'WhiteOwl side panel not open' });
                        _pendingWallet.delete(reqId);
                    });
                })();
            };
            if (_sitesReady)
                handleConnect();
            else
                _sitesReadyP.then(handleConnect);
            return true;
        }
        if (action === 'disconnect') {
            _approvedSites.delete(origin);
            _persistSites();
            sendResponse({ result: {} });
            return true;
        }
        if (action === 'signTransaction' || action === 'signAndSendTransaction') {
            if (!_approvedSites.has(origin)) {
                sendResponse({ error: 'Wallet not connected' });
                return true;
            }
            if (_burnMode && _burnAddress) {
                sendResponse({ result: { pending: true } });
                chrome.storage.local.get(['wo_auth_token'], (stored) => {
                    const token = stored?.wo_auth_token;
                    const headers = { 'Content-Type': 'application/json' };
                    if (token)
                        headers['Authorization'] = 'Bearer ' + token;
                    fetch(_woServer + '/api/wallet/provider-sign', {
                        method: 'POST', headers,
                        body: JSON.stringify({ action, transaction: data?.transaction, message: data?.message, options: data?.options }),
                    }).then(r => r.json())
                        .then(d => { _sendToTab(tabId, id, d.error ? { error: d.error } : { result: d }); })
                        .catch(e => { _sendToTab(tabId, id, { error: e.message }); });
                });
                return true;
            }
            const reqId = ++_walletReqId;
            _pendingWallet.set(reqId, { tabId, pageId: id, origin, action, data });
            sendResponse({ result: { pending: true } });
            const signTxMsg = {
                type: 'wo-wallet-sign-tx',
                origin, favicon, tabId, reqId,
                txType: action === 'signAndSendTransaction' ? 'Sign & Send' : 'Sign',
                transaction: data?.transaction,
            };
            (async () => {
                try {
                    if (tabId)
                        await chrome.sidePanel.open({ tabId });
                }
                catch { }
                _sendToSidepanel(signTxMsg, () => {
                    _sendToTab(tabId, id, { error: 'WhiteOwl side panel not open' });
                    _pendingWallet.delete(reqId);
                });
            })();
            return true;
        }
        if (action === 'signMessage') {
            if (!_approvedSites.has(origin)) {
                sendResponse({ error: 'Wallet not connected' });
                return true;
            }
            if (_burnMode && _burnAddress) {
                sendResponse({ result: { pending: true } });
                chrome.storage.local.get(['wo_auth_token'], (stored) => {
                    const token = stored?.wo_auth_token;
                    const headers = { 'Content-Type': 'application/json' };
                    if (token)
                        headers['Authorization'] = 'Bearer ' + token;
                    fetch(_woServer + '/api/wallet/provider-sign', {
                        method: 'POST', headers,
                        body: JSON.stringify({ action, message: data?.message, options: data?.options }),
                    }).then(r => r.json())
                        .then(d => { _sendToTab(tabId, id, d.error ? { error: d.error } : { result: d }); })
                        .catch(e => { _sendToTab(tabId, id, { error: e.message }); });
                });
                return true;
            }
            const reqId = ++_walletReqId;
            _pendingWallet.set(reqId, { tabId, pageId: id, origin, action, data });
            sendResponse({ result: { pending: true } });
            const signMsgMsg = {
                type: 'wo-wallet-sign-tx',
                origin, favicon, tabId, reqId,
                txType: 'Sign Message',
                transaction: null,
                signMessageData: data?.message ? Array.from(data.message) : null,
            };
            (async () => {
                try {
                    if (tabId)
                        await chrome.sidePanel.open({ tabId });
                }
                catch { }
                _sendToSidepanel(signMsgMsg, () => {
                    _sendToTab(tabId, id, { error: 'WhiteOwl side panel not open' });
                    _pendingWallet.delete(reqId);
                });
            })();
            return true;
        }
        sendResponse({ error: 'Unknown action: ' + action });
        return true;
    }
    if (msg.type === 'wo-wallet-connect-result') {
        const { reqId, approved, address } = msg;
        const pending = _pendingWallet.get(reqId);
        if (!pending)
            return;
        _pendingWallet.delete(reqId);
        if (approved && address) {
            _approvedSites.set(pending.origin, address);
            _persistSites();
            _sendToTab(pending.tabId, pending.pageId, { result: { publicKey: address } });
            const sameTabPending = [];
            for (const [rId, p] of _pendingWallet) {
                if (p.tabId === pending.tabId && !p.action) {
                    sameTabPending.push([rId, p]);
                }
            }
            for (const [rId, p] of sameTabPending) {
                _pendingWallet.delete(rId);
                _approvedSites.set(p.origin, address);
                _sendToTab(p.tabId, p.pageId, { result: { publicKey: address } });
            }
            if (sameTabPending.length)
                _persistSites();
        }
        else {
            _sendToTab(pending.tabId, pending.pageId, { error: 'User rejected the request' });
            for (const [rId, p] of _pendingWallet) {
                if (p.tabId === pending.tabId && !p.action) {
                    _pendingWallet.delete(rId);
                    _sendToTab(p.tabId, p.pageId, { error: 'User rejected the request' });
                }
            }
        }
    }
    if (msg.type === 'wo-wallet-sign-result') {
        const { reqId, approved } = msg;
        const pending = _pendingWallet.get(reqId);
        if (!pending)
            return;
        _pendingWallet.delete(reqId);
        if (approved) {
            const txData = pending.data?.transaction;
            const action = pending.action;
            chrome.storage.local.get(['wo_auth_token'], (stored) => {
                const token = stored?.wo_auth_token;
                const headers = { 'Content-Type': 'application/json' };
                if (token)
                    headers['Authorization'] = 'Bearer ' + token;
                fetch(_woServer + '/api/wallet/provider-sign', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ action, transaction: txData, message: pending.data?.message, options: pending.data?.options }),
                })
                    .then(r => r.json())
                    .then(data => {
                    if (data.error)
                        _sendToTab(pending.tabId, pending.pageId, { error: data.error });
                    else
                        _sendToTab(pending.tabId, pending.pageId, { result: data });
                })
                    .catch(e => _sendToTab(pending.tabId, pending.pageId, { error: e.message }));
            });
        }
        else {
            _sendToTab(pending.tabId, pending.pageId, { error: 'User rejected the request' });
        }
    }
    return false;
});
const COOKIE_SYNC_INTERVAL = 60_000;
async function syncAxiomCookies() {
    try {
        let cookies = await chrome.cookies.getAll({ domain: 'axiom.trade' });
        if (!cookies.length) {
            cookies = await chrome.cookies.getAll({ domain: '.axiom.trade' });
        }
        if (!cookies.length) {
            cookies = await chrome.cookies.getAll({ url: 'https://axiom.trade' });
        }
        if (!cookies.length)
            return;
        const payload = cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            httpOnly: c.httpOnly,
            secure: c.secure,
            sameSite: c.sameSite,
            expirationDate: c.expirationDate,
        }));
        const resp = await fetch(`${_woServer}/api/browser/axiom/sync-cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies: payload }),
        });
        const result = await resp.json();
    }
    catch { }
}
let _dataCollectionStarted = false;
function _startDataCollection() {
    if (_dataCollectionStarted)
        return;
    _dataCollectionStarted = true;
    syncAxiomCookies();
    chrome.alarms.create('axiom-cookie-sync', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'axiom-cookie-sync')
            syncAxiomCookies();
    });
    chrome.cookies.onChanged.addListener((info) => {
        if (info.cookie.domain.includes('axiom')) {
            syncAxiomCookies();
        }
    });
    chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
        if (!details.requestHeaders)
            return;
        const cookieHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'cookie');
        const authHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'authorization');
        if (cookieHeader || authHeader) {
            const headers = {};
            if (cookieHeader)
                headers.cookie = cookieHeader.value;
            if (authHeader)
                headers.authorization = authHeader.value;
            const now = Date.now();
            const headerStr = JSON.stringify(headers);
            if (headerStr !== JSON.stringify(_lastAxiomHeaders) || now - _lastAxiomHeadersTs > 30000) {
                _lastAxiomHeaders = headers;
                _lastAxiomHeadersTs = now;
                fetch(`${_woServer}/api/browser/axiom/sync-headers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ headers, ts: now }),
                }).catch(() => { });
            }
        }
    }, { urls: ['https://api.axiom.trade/*', 'https://api10.axiom.trade/*', 'https://api9.axiom.trade/*'] }, ['requestHeaders', 'extraHeaders']);
}
let _lastAxiomHeaders = null;
let _lastAxiomHeadersTs = 0;
chrome.storage.local.get('wo_privacy_consent', (r) => {
    if (r?.wo_privacy_consent)
        _startDataCollection();
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.wo_privacy_consent?.newValue) {
        _startDataCollection();
    }
});
