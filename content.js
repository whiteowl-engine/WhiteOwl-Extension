(function () {
    'use strict';
    if (window.__whiteOwlContent)
        return;
    window.__whiteOwlContent = true;
    let API = 'http://localhost:3377';
    try {
        chrome.storage.local.get('wo_server_url', (r) => { if (r?.wo_server_url)
            API = r.wo_server_url; });
    }
    catch { }
    const WO_CONTENT_HOSTS = [
        'axiom.trade',
        'pump.fun',
        'gmgn.ai',
        'x.com',
        'twitter.com',
        'dexscreener.com',
        'birdeye.so',
        'solscan.io',
        'solana.fm',
        'jup.ag',
        'jupiter.exchange',
        'raydium.io',
        'magiceden.io',
        'magiceden.com',
        'tensor.trade',
        'backpack.app',
        'backpack.exchange',
        'orca.so',
        'drift.trade',
        'marginfi.com',
        'kamino.finance',
        'bullx.io',
        'photon-sol.tinyastro.io',
        'defined.fi'
    ];
    const WO_PROVIDER_HOSTS = [
        'axiom.trade',
        'pump.fun',
        'gmgn.ai',
        'jup.ag',
        'jupiter.exchange',
        'raydium.io',
        'magiceden.io',
        'magiceden.com',
        'tensor.trade',
        'backpack.app',
        'backpack.exchange',
        'orca.so',
        'drift.trade',
        'marginfi.com',
        'kamino.finance',
        'bullx.io',
        'photon-sol.tinyastro.io',
        'defined.fi'
    ];
    function _woHostMatches(hostname, domains) {
        const normalized = String(hostname || '').toLowerCase();
        return domains.some((domain) => normalized === domain || normalized.endsWith('.' + domain));
    }
    const _woContentHostAllowed = _woHostMatches(location.hostname, WO_CONTENT_HOSTS);
    const _woProviderHostAllowed = _woHostMatches(location.hostname, WO_PROVIDER_HOSTS);
    function _alive() {
        try {
            return !!chrome.runtime?.id;
        }
        catch {
            return false;
        }
    }
    function _safeSend(msg, cb) {
        if (!_alive()) {
            if (cb)
                cb(undefined);
            return;
        }
        try {
            chrome.runtime.sendMessage(msg, function (resp) {
                void chrome.runtime.lastError;
                if (cb)
                    cb(resp);
            });
        }
        catch (e) {
            if (cb)
                cb(undefined);
        }
    }
    let _contentActivated = false;
    function _activateContent() {
        if (_contentActivated)
            return;
        _contentActivated = true;
        try {
            if (_woProviderHostAllowed && !window.__whiteOwlProvider) {
                if (!_alive())
                    throw new Error('context dead');
                const s = document.createElement('script');
                s.src = chrome.runtime.getURL('provider.js');
                s.onload = () => s.remove();
                (document.head || document.documentElement).prepend(s);
            }
        }
        catch (e) { }
        const _providerPending = new Set();
        window.addEventListener('message', (e) => {
            if (e.source !== window)
                return;
            if (e.data?.type === 'wo-provider-req') {
                const { id, action, data, detectedWallets } = e.data;
                if (!_alive()) {
                    window.postMessage({ type: 'wo-provider-res', id, error: 'Extension context invalidated — reload the page' }, '*');
                    return;
                }
                _providerPending.add(id);
                try {
                    chrome.runtime.sendMessage({ type: 'wo-provider-req', id, action, data, detectedWallets, origin: location.origin, favicon: getFavicon() }, (response) => {
                        if (chrome.runtime.lastError) {
                            if (_providerPending.has(id)) {
                                _providerPending.delete(id);
                                window.postMessage({ type: 'wo-provider-res', id, error: chrome.runtime.lastError.message }, '*');
                            }
                            return;
                        }
                        if (response?.result?.pending) {
                            return;
                        }
                        if (_providerPending.has(id)) {
                            _providerPending.delete(id);
                            window.postMessage({ type: 'wo-provider-res', id, result: response?.result, error: response?.error }, '*');
                        }
                    });
                }
                catch (err) {
                    _providerPending.delete(id);
                    window.postMessage({ type: 'wo-provider-res', id, error: err.message || 'Extension error' }, '*');
                }
            }
            if (e.data?.type === 'wo-fetch-req') {
                const { id, url, method, headers, body } = e.data;
                bgFetch(url, { method, headers, body })
                    .then((resp) => window.postMessage({ type: 'wo-fetch-res', id, ok: true, status: resp.status, body: resp.body }, '*'))
                    .catch((err) => window.postMessage({ type: 'wo-fetch-res', id, ok: false, body: err.message }, '*'));
            }
            if (e.data?.type === 'wo-gmgn-ws-captured') {
                const wsUrl = e.data.url;
                if (wsUrl && typeof wsUrl === 'string' && wsUrl.includes('gmgn.ai') && wsUrl.includes('/ws')) {
                    _safeSend({ type: 'wo-gmgn-ws-relay', wsUrl, isTwitter: !!e.data.isTwitter });
                }
            }
            if (e.data?.type === 'wo-gmgn-ws-data' && Array.isArray(e.data.items)) {
                _safeSend({ type: 'wo-gmgn-ws-data', items: e.data.items });
            }
        });
    }
    try {
        chrome.storage.local.get('wo_privacy_consent', (r) => {
            void chrome.runtime.lastError;
            if (r?.wo_privacy_consent)
                _activateContent();
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.wo_privacy_consent?.newValue) {
                _activateContent();
            }
        });
    }
    catch { }
    function bgFetch(url, opts) {
        return new Promise((resolve, reject) => {
            if (!_alive())
                return reject(new Error('Extension context invalidated'));
            try {
                chrome.runtime.sendMessage({ type: 'wo-fetch', url, method: opts.method, headers: opts.headers, body: opts.body }, (resp) => {
                    void chrome.runtime.lastError;
                    if (!resp || !resp.ok)
                        return reject(new Error((resp && resp.body) || 'Request failed'));
                    resolve(resp);
                });
            }
            catch (e) {
                reject(new Error('Extension context invalidated'));
            }
        });
    }
    function getFavicon() {
        const link = document.querySelector('link[rel*="icon"]');
        return link?.href || (location.origin + '/favicon.ico');
    }
    function _ensurePumpUiStyles() {
        if (document.getElementById('wo-pump-ui-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'wo-pump-ui-styles';
        style.textContent = `
      .wo-pump-overlay,
      .wo-pump-overlay * {
        box-sizing: border-box;
      }
      @keyframes woPumpFadeUp {
        from { opacity: 0; transform: translateY(18px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes woPumpCardIn {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes woPumpFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes woPumpPulse {
        0%, 100% { box-shadow: 0 0 0 rgba(139,92,246,0); }
        50% { box-shadow: 0 0 28px rgba(139,92,246,0.26); }
      }
      @keyframes woPumpSweep {
        from { transform: translateX(-120%); }
        to { transform: translateX(120%); }
      }
      @keyframes woPumpAmbient {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .9; }
        50% { transform: translate3d(0, -6px, 0) scale(1.02); opacity: 1; }
      }
      @keyframes woPumpPulseSoft {
        0%, 100% { box-shadow: 0 8px 18px rgba(22,22,22,0.07); }
        50% { box-shadow: 0 14px 26px rgba(22,22,22,0.10); }
      }
      .wo-pump-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        color: #0f1011;
      }
      .wo-pump-shell {
        position: relative;
        animation: woPumpFadeUp .32s cubic-bezier(.2,.8,.2,1);
        width: 520px;
        max-width: 96vw;
        max-height: 92vh;
        overflow-y: auto;
        overflow-x: hidden;
        color: #101010;
        border-radius: 22px;
        border: 1px solid rgba(18,18,18,0.08);
        background:
          radial-gradient(circle at 18% 8%, rgba(255,255,255,0.78) 0%, transparent 24%),
          radial-gradient(circle at 88% 4%, rgba(187,192,198,0.22) 0%, transparent 18%),
          linear-gradient(180deg, #f7f4ee 0%, #f2eee6 46%, #ece6dc 100%);
        box-shadow: 0 22px 54px rgba(20,20,20,0.14), inset 0 1px 0 rgba(255,255,255,0.82);
        scrollbar-width: thin;
      }
      .wo-pump-shell::before {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(255,255,255,0.7), transparent 28%, transparent 70%, rgba(135,140,148,0.12));
        opacity: .75;
      }
      .wo-pump-shell::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.28), transparent 28%),
          linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.022) 50%, transparent 100%);
      }
      .wo-pump-hero {
        position: relative;
        overflow: hidden;
      }
      .wo-pump-hero::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 42%;
        height: 1px;
        background: linear-gradient(90deg, rgba(192,170,255,.95), rgba(191,231,255,.05));
        box-shadow: 0 0 12px rgba(230,240,255,0.36);
      }
      .wo-pump-orb {
        animation: none;
      }
      .wo-pump-shine {
        position: relative;
        overflow: hidden;
      }
      .wo-pump-shine::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.08) 42%, transparent 58%);
        transform: translateX(-120%);
        animation: woPumpSweep 3.2s ease-in-out infinite;
        pointer-events: none;
      }
      .wo-pump-body {
        position: relative;
        z-index: 1;
        padding: 0 22px 22px;
      }
      .wo-pump-header,
      .wo-pump-context,
      .wo-pump-body > * {
        animation: woPumpCardIn .42s cubic-bezier(.16,1,.3,1) both;
      }
      .wo-pump-context { animation-delay: .05s; }
      .wo-pump-body > *:nth-child(1) { animation-delay: .08s; }
      .wo-pump-body > *:nth-child(2) { animation-delay: .12s; }
      .wo-pump-body > *:nth-child(3) { animation-delay: .16s; }
      .wo-pump-body > *:nth-child(4) { animation-delay: .20s; }
      .wo-pump-body > *:nth-child(5) { animation-delay: .24s; }
      .wo-pump-body > *:nth-child(6) { animation-delay: .28s; }
      .wo-pump-body > *:nth-child(7) { animation-delay: .32s; }
      .wo-pump-header {
        position: relative;
        z-index: 1;
        padding: 18px 22px 0;
      }
      .wo-pump-header-bg {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 18% 0%, rgba(255,255,255,0.75), transparent 28%), radial-gradient(circle at 88% 0%, rgba(160,166,173,0.12), transparent 24%);
        pointer-events: none;
      }
      .wo-pump-header-row {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 16px 18px;
        border-radius: 22px;
        background: rgba(255, 252, 247, 0.74);
        border: 1px solid rgba(18,18,18,0.08);
        box-shadow: 0 12px 24px rgba(20,20,20,0.08);
        backdrop-filter: blur(18px);
      }
      .wo-pump-header-row::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(255,255,255,0.65), transparent 34%);
      }
      .wo-pump-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .wo-pump-brand-badge {
        width: 40px;
        height: 40px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, #ffffff, #e5dfd5);
        color: #111;
        border: 1px solid rgba(18,18,18,0.08);
        box-shadow: 0 2px 5px rgba(22,22,22,0.05);
        flex-shrink: 0;
        animation: woPumpAmbient 4.8s ease-in-out infinite;
      }
      .wo-pump-brand-badge img {
        width: 30px;
        height: 30px;
        display: block;
        object-fit: contain;
      }
      .wo-pump-brand-copy {
        min-width: 0;
      }
      .wo-pump-title {
        font-size: 16px;
        line-height: 1.1;
        font-weight: 800;
        color: #0a0a0a;
        letter-spacing: -0.35px;
      }
      .wo-pump-subtitle {
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.4;
        color: #545a61;
      }
      .wo-pump-close {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        border: 1px solid rgba(18,18,18,0.1);
        background: rgba(255,255,255,0.72);
        color: #61676d;
        cursor: pointer;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(18px);
        box-shadow: 0 8px 18px rgba(22,22,22,0.07);
        transition: all .18s ease;
      }
      .wo-pump-close:hover {
        color: #111;
        border-color: rgba(18,18,18,0.16);
        transform: translateY(-1px);
      }
      .wo-pump-section-card {
        position: relative;
        background: rgba(255, 252, 247, 0.82);
        backdrop-filter: blur(18px);
        border: 1px solid rgba(18,18,18,0.1);
        border-radius: 20px;
        box-shadow: 0 8px 18px rgba(22,22,22,0.07);
        transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease, background .22s ease;
      }
      .wo-pump-section-card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255,255,255,0.56), transparent 32%);
        opacity: .85;
      }
      .wo-pump-context {
        margin: 12px 22px 14px;
        padding: 14px 16px;
      }
      .wo-pump-context:hover,
      .wo-pump-media:hover,
      .wo-pump-preview:hover,
      .wo-pump-collapsible:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 26px rgba(22,22,22,0.09);
      }
      .wo-pump-context-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .5px;
        text-transform: uppercase;
        color: #6e757c;
      }
      .wo-pump-context-text {
        font-size: 11px;
        line-height: 1.55;
        color: #34383d;
        white-space: pre-wrap;
      }
      .wo-pump-media {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 184px;
        margin-bottom: 18px;
        overflow: hidden;
        border-radius: 24px;
      }
      .wo-pump-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transform: scale(1.01);
        transition: transform .35s ease;
      }
      .wo-pump-media:hover img {
        transform: scale(1.04);
      }
      .wo-pump-media-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #7f858b;
        text-align: center;
        padding: 20px;
      }
      .wo-pump-media-empty-icon {
        width: 40px;
        height: 40px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(18,18,18,0.08);
        background: linear-gradient(180deg, #ffffff, #e5dfd5);
        color: #4d5359;
      }
      .wo-pump-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 130px;
        gap: 10px;
        margin-bottom: 14px;
      }
      .wo-pump-field {
        margin-bottom: 12px;
      }
      .wo-pump-label {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        color: #4d5359;
        font-weight: 600;
        letter-spacing: .15px;
      }
      .wo-pump-input,
      .wo-pump-textarea,
      .wo-pump-range {
        width: 100%;
        border: 1px solid rgba(18,18,18,0.12);
        border-radius: 16px;
        background: rgba(255,255,255,0.72);
        color: #101010;
        outline: none;
        transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease, background .18s ease;
      }
      .wo-pump-input,
      .wo-pump-textarea {
        padding: 11px 14px;
        font-size: 13px;
      }
      .wo-pump-input::placeholder,
      .wo-pump-textarea::placeholder {
        color: #8c9297;
      }
      .wo-pump-input:focus,
      .wo-pump-textarea:focus,
      .wo-pump-range:focus {
        background: rgba(255,255,255,0.9);
        box-shadow: 0 0 0 3px rgba(12,12,12,0.05);
        border-color: rgba(18,18,18,0.34);
      }
      .wo-pump-textarea {
        min-height: 72px;
        resize: vertical;
      }
      .wo-pump-helper {
        margin-top: 5px;
        font-size: 10px;
        color: #83898f;
      }
      .wo-pump-collapsible {
        margin-bottom: 14px;
      }
      .wo-pump-collapsible summary {
        list-style: none;
        cursor: pointer;
      }
      .wo-pump-collapsible summary::-webkit-details-marker {
        display: none;
      }
      .wo-pump-collapse-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
      }
      .wo-pump-collapse-copy {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .wo-pump-collapse-icon,
      .wo-pump-feature-icon,
      .wo-pump-context-label svg,
      .wo-pump-media-empty-icon svg,
      .wo-pump-preview-state svg,
      .wo-pump-btn svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .wo-pump-collapse-icon {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        color: #4d5359;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,0.72);
        border: 1px solid rgba(18,18,18,0.1);
      }
      .wo-pump-collapse-title {
        font-size: 12px;
        font-weight: 700;
        color: #101010;
      }
      .wo-pump-collapse-subtitle {
        margin-top: 2px;
        font-size: 10px;
        color: #83898f;
      }
      .wo-pump-collapse-chevron {
        color: #7a8086;
        transition: transform .18s ease;
      }
      .wo-pump-collapsible[open] .wo-pump-collapse-chevron {
        transform: rotate(180deg);
      }
      .wo-pump-collapse-body {
        padding: 10px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wo-pump-feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 14px;
      }
      .wo-pump-feature-card {
        position: relative;
        min-height: 120px;
        padding: 12px 10px;
        cursor: pointer;
        transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease, background .18s ease;
      }
      .wo-pump-feature-card:hover {
        transform: translateY(-1px);
        border-color: rgba(18,18,18,0.14);
        background: rgba(255,255,255,0.9);
      }
      .wo-pump-feature-card.is-active {
        border-color: rgba(18,18,18,0.18);
        background: rgba(255,255,255,0.92);
        box-shadow: 0 12px 22px rgba(20,20,20,0.1);
      }
      .wo-pump-feature-head {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        margin-bottom: 6px;
      }
      .wo-pump-feature-icon {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #111;
        background: linear-gradient(180deg, #ffffff, #e5dfd5);
        border: 1px solid rgba(18,18,18,0.1);
        flex-shrink: 0;
      }
      .wo-pump-feature-title {
        font-size: 13px;
        font-weight: 700;
        color: #101010;
      }
      .wo-pump-feature-copy {
        font-size: 11px;
        line-height: 1.4;
        color: #545a61;
      }
      .wo-pump-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(18,117,72,0.08);
        color: #127548;
        border: 1px solid rgba(18,117,72,0.16);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .4px;
        text-transform: uppercase;
        margin-top: 4px;
      }
      .wo-pump-switch {
        position: relative;
        display: block;
        margin-top: 8px;
        width: 36px;
        height: 20px;
        appearance: none;
        border: none;
        border-radius: 999px;
        background: #cfd5db;
        cursor: pointer;
        transition: background .2s ease;
        flex-shrink: 0;
      }
      .wo-pump-switch::before {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ffffff;
        transition: transform .2s ease;
      }
      .wo-pump-switch:checked {
        background: #111111;
      }
      .wo-pump-switch:checked::before {
        transform: translateX(16px);
      }
      .wo-pump-advanced {
        display: none;
        margin-bottom: 14px;
        padding: 14px;
        border-color: rgba(18,18,18,0.12);
      }
      .wo-pump-advanced.is-visible {
        display: block;
      }
      .wo-pump-advanced-copy {
        font-size: 11px;
        color: #545a61;
        margin-bottom: 10px;
      }
      .wo-pump-advanced-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .wo-pump-range {
        appearance: none;
        height: 6px;
        padding: 0;
        background: linear-gradient(90deg, rgba(17,17,17,0.10), rgba(17,17,17,0.18));
      }
      .wo-pump-range::-webkit-slider-thumb {
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #f3f7fd;
        border: 2px solid #111111;
        box-shadow: 0 4px 10px rgba(20,20,20,0.12);
        cursor: pointer;
      }
      .wo-pump-range-label {
        min-width: 42px;
        text-align: right;
        font-size: 14px;
        font-weight: 700;
        color: #127548;
      }
      .wo-pump-preview {
        margin-bottom: 16px;
        padding: 16px;
        min-height: 76px;
      }
      .wo-pump-preview-state {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .wo-pump-preview-state-icon {
        width: 28px;
        height: 28px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: rgba(255,255,255,0.72);
        color: #111111;
        border: 1px solid rgba(18,18,18,0.1);
      }
      .wo-pump-preview-state.error .wo-pump-preview-state-icon {
        background: rgba(175,62,53,0.08);
        color: #af3e35;
        border-color: rgba(175,62,53,0.16);
      }
      .wo-pump-preview-state.success .wo-pump-preview-state-icon {
        background: rgba(18,117,72,0.08);
        color: #127548;
        border-color: rgba(18,117,72,0.16);
      }
      .wo-pump-preview-title {
        font-size: 12px;
        font-weight: 700;
        color: #101010;
      }
      .wo-pump-preview-copy {
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.5;
        color: #545a61;
      }
      .wo-pump-preview-copy code {
        font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
        color: #4d5359;
        word-break: break-all;
      }
      .wo-pump-actions {
        display: flex;
        gap: 8px;
      }
      .wo-pump-btn {
        border: none;
        border-radius: 14px;
        padding: 12px 14px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease, border-color .18s ease;
        position: relative;
        overflow: hidden;
      }
      .wo-pump-btn::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.18) 45%, transparent 60%);
        transform: translateX(-130%);
        transition: transform .45s ease;
        pointer-events: none;
      }
      .wo-pump-btn:hover {
        transform: translateY(-1px);
      }
      .wo-pump-btn:hover::after {
        transform: translateX(130%);
      }
      .wo-pump-btn:disabled {
        opacity: .65;
        cursor: default;
        transform: none;
      }
      .wo-pump-btn-ghost {
        flex: 1;
        color: #4f555b;
        background: rgba(255,255,255,0.72);
        border: 1px solid rgba(18,18,18,0.1);
        box-shadow: 0 8px 18px rgba(22,22,22,0.07);
      }
      .wo-pump-btn-ghost:hover {
        color: #111;
        border-color: rgba(18,18,18,0.16);
      }
      .wo-pump-btn-ai {
        flex: 1;
        color: #fff;
        background: linear-gradient(180deg, #202328 0%, #0b0c0d 100%);
        box-shadow: 0 16px 24px rgba(20,20,20,0.12);
      }
      .wo-pump-btn-launch {
        flex: 1.5;
        color: #fff;
        background: linear-gradient(180deg, #127548 0%, #0d5c39 100%);
        box-shadow: 0 16px 24px rgba(20,20,20,0.12);
      }
      .wo-pump-address {
        margin-top: 8px;
        font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
        font-size: 10px;
        color: #4d5359;
        word-break: break-all;
      }
      .wo-pump-preview-meta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .wo-pump-preview-meta-symbol {
        color: #6b7280;
      }
      @media (max-width: 640px) {
        .wo-pump-shell {
          width: min(96vw, 520px);
          max-height: 94vh;
        }
        .wo-pump-grid,
        .wo-pump-actions {
          grid-template-columns: 1fr;
          flex-direction: column;
        }
        .wo-pump-feature-grid {
          grid-template-columns: 1fr;
        }
        .wo-pump-grid > *:last-child {
          width: auto;
        }
      }
    `;
        document.head.appendChild(style);
    }
    (function initXButton() {
        const host = location.hostname;
        if (!/^(x|twitter)\.com$/.test(host))
            return;
        const BTN_CLASS = 'wo-pumpfun-btn';
        const BTN_LABEL = 'Launch on pump.fun';
        const BTN_ICON_SRC = _alive() ? chrome.runtime.getURL('icon48.png') : '';
        function setLaunchButtonText(btn, label) {
            const textEl = btn.querySelector('.wo-pumpfun-btn-label');
            if (textEl)
                textEl.textContent = label;
            else
                btn.textContent = label;
        }
        function makeButton() {
            const btn = document.createElement('button');
            btn.className = BTN_CLASS;
            btn.innerHTML = `
        <span class="wo-pumpfun-btn-icon-wrap">
          ${BTN_ICON_SRC ? `<img class="wo-pumpfun-btn-icon" src="${BTN_ICON_SRC}" alt="Axiom" />` : '<span class="wo-pumpfun-btn-icon-fallback">A</span>'}
        </span>
        <span class="wo-pumpfun-btn-label">${BTN_LABEL}</span>`;
            btn.style.cssText = [
                'border:1px solid rgba(15,23,31,0.12)',
                'color:#111111',
                'background:linear-gradient(180deg, rgba(255,255,255,0.96), rgba(240,236,228,0.94))',
                'border-radius:9999px',
                'padding:4px 14px 4px 6px',
                'font-weight:700',
                'font-size:13px',
                'cursor:pointer',
                'display:inline-flex',
                'align-items:center',
                'gap:8px',
                'box-shadow:0 8px 18px rgba(20,20,20,0.08), inset 0 1px 0 rgba(255,255,255,0.85)',
                'transition:transform 160ms ease,box-shadow 160ms ease,opacity 120ms ease,border-color 160ms ease,background 160ms ease',
            ].join(';');
            const iconWrap = btn.querySelector('.wo-pumpfun-btn-icon-wrap');
            const iconImg = btn.querySelector('.wo-pumpfun-btn-icon');
            if (iconWrap) {
                iconWrap.style.cssText = [
                    'width:28px',
                    'height:28px',
                    'border-radius:50%',
                    'display:inline-flex',
                    'align-items:center',
                    'justify-content:center',
                    'background:linear-gradient(180deg,#5f88aa,#4f789b)',
                    'box-shadow:inset 0 1px 0 rgba(255,255,255,0.24)',
                    'flex-shrink:0',
                    'overflow:hidden'
                ].join(';');
            }
            if (iconImg) {
                iconImg.style.cssText = 'width:18px;height:18px;display:block;object-fit:contain;';
            }
            btn.onmouseenter = () => {
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 12px 22px rgba(20,20,20,0.12), inset 0 1px 0 rgba(255,255,255,0.9)';
                btn.style.borderColor = 'rgba(15,23,31,0.18)';
                btn.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(236,231,221,0.96))';
            };
            btn.onmouseleave = () => {
                btn.style.transform = 'none';
                btn.style.boxShadow = '0 8px 18px rgba(20,20,20,0.08), inset 0 1px 0 rgba(255,255,255,0.85)';
                btn.style.borderColor = 'rgba(15,23,31,0.12)';
                btn.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(240,236,228,0.94))';
            };
            return btn;
        }
        function showModal(postData, onLaunch) {
            _ensurePumpUiStyles();
            const overlay = document.createElement('div');
            overlay.className = 'wo-pump-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 18% 10%, rgba(255,255,255,0.24) 0%, transparent 20%),radial-gradient(circle at 78% 0%, rgba(187,192,198,0.12) 0%, transparent 18%),rgba(236,230,220,0.58);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)';
            const card = document.createElement('div');
            card.className = 'wo-pump-shell';
            const avatarSrc = postData.imageUrl || '';
            const textSnippet = (postData.text || '').slice(0, 200) + (postData.text.length > 200 ? '…' : '');
            const owlSrc = _alive() ? chrome.runtime.getURL('icon48.png') : BTN_ICON_SRC;
            function generateTokenAvatar(seed) {
                let _h = 0;
                const s = String(seed || 'TOKEN');
                for (let i = 0; i < s.length; i++)
                    _h = ((_h << 5) - _h + s.charCodeAt(i)) | 0;
                _h = Math.abs(_h) || 1;
                const rng = () => { _h = (_h * 16807) % 2147483647; return (_h & 0x7fffffff) / 2147483647; };
                const u = 'ta' + (Math.abs(_h) % 99999);
                const P = Math.PI, T = P * 2;
                const palettes = [
                    ['#0f0c29', '#302b63', '#24243e', '#8e2de2', '#4a00e0', '#e040fb'],
                    ['#0d1b2a', '#1b263b', '#415a77', '#00b4d8', '#90e0ef', '#48cae4'],
                    ['#1a1a2e', '#16213e', '#e94560', '#ff6b6b', '#ffc93c', '#ff8c42'],
                    ['#0b0b0b', '#1a1a2e', '#e2e2e2', '#00f5d4', '#00bbf9', '#ffd166'],
                    ['#2d1b69', '#11998e', '#38ef7d', '#a8ff78', '#78ffd6', '#eaffd0'],
                    ['#1f1c2c', '#928dab', '#e8cbc0', '#ff6a88', '#ff99ac', '#ffd6e0'],
                    ['#0c0c0c', '#f7971e', '#ffd200', '#ff5e62', '#ff9966', '#ffecd2'],
                    ['#141e30', '#243b55', '#4ecdc4', '#2bc0e4', '#eaecc6', '#a8e6cf'],
                ];
                const pal = palettes[~~(rng() * palettes.length)];
                const theme = ~~(rng() * 8);
                const letter = (s.match(/[A-Za-z0-9]/)?.[0] || s[0] || '?').toUpperCase();
                let defs = '', bg = '', layers = '';
                const gAng = ~~(rng() * 360);
                const gx1 = (50 + 50 * Math.cos(gAng * P / 180)).toFixed(0);
                const gy1 = (50 + 50 * Math.sin(gAng * P / 180)).toFixed(0);
                const gx2 = (50 - 50 * Math.cos(gAng * P / 180)).toFixed(0);
                const gy2 = (50 - 50 * Math.sin(gAng * P / 180)).toFixed(0);
                defs += `<linearGradient id="${u}bg" x1="${gx1}%" y1="${gy1}%" x2="${gx2}%" y2="${gy2}%">`;
                defs += `<stop offset="0%" stop-color="${pal[0]}"/><stop offset="50%" stop-color="${pal[1]}"/><stop offset="100%" stop-color="${pal[2]}"/></linearGradient>`;
                defs += `<radialGradient id="${u}rg" cx="${(30 + rng() * 40).toFixed(0)}%" cy="${(30 + rng() * 40).toFixed(0)}%" r="60%"><stop offset="0%" stop-color="${pal[3]}" stop-opacity=".6"/><stop offset="100%" stop-color="${pal[3]}" stop-opacity="0"/></radialGradient>`;
                defs += `<radialGradient id="${u}rg2" cx="${(40 + rng() * 30).toFixed(0)}%" cy="${(50 + rng() * 30).toFixed(0)}%" r="50%"><stop offset="0%" stop-color="${pal[4]}" stop-opacity=".4"/><stop offset="100%" stop-color="${pal[4]}" stop-opacity="0"/></radialGradient>`;
                defs += `<filter id="${u}gl"><feGaussianBlur stdDeviation="6"/></filter>`;
                defs += `<filter id="${u}gl2"><feGaussianBlur stdDeviation="12"/></filter>`;
                defs += `<filter id="${u}sh"><feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="${pal[0]}" flood-opacity=".7"/></filter>`;
                defs += `<clipPath id="${u}clip"><rect width="100" height="100" rx="16"/></clipPath>`;
                bg = `<rect width="100" height="100" rx="16" fill="url(#${u}bg)"/><rect width="100" height="100" rx="16" fill="url(#${u}rg)"/><rect width="100" height="100" rx="16" fill="url(#${u}rg2)"/>`;
                if (theme === 0) {
                    for (let i = 0; i < 5; i++) {
                        const cx = 10 + rng() * 80, cy = 10 + rng() * 80, r = 12 + rng() * 25;
                        layers += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${pal[3 + (i % 3)]}" opacity="${(.15 + rng() * .25).toFixed(2)}" filter="url(#${u}gl2)"/>`;
                    }
                    for (let i = 0; i < 20; i++) {
                        const cx = 5 + rng() * 90, cy = 5 + rng() * 90, r = .4 + rng() * 1.8;
                        layers += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="white" opacity="${(.3 + rng() * .7).toFixed(2)}"/>`;
                    }
                    layers += `<circle cx="${(35 + rng() * 30).toFixed(0)}" cy="${(35 + rng() * 30).toFixed(0)}" r="18" fill="${pal[5]}" opacity=".12" filter="url(#${u}gl2)"/>`;
                }
                else if (theme === 1) {
                    for (let i = 0; i < 6; i++) {
                        const cx = 20 + rng() * 60, cy = 20 + rng() * 60;
                        const sides = 3 + ~~(rng() * 4), sz = 8 + rng() * 20, rot = rng() * T;
                        let pts = '';
                        for (let si = 0; si < sides; si++) {
                            const a = rot + si / sides * T;
                            pts += `${(cx + sz * Math.cos(a)).toFixed(1)},${(cy + sz * Math.sin(a)).toFixed(1)} `;
                        }
                        const inner = sz * (.3 + rng() * .3);
                        layers += `<polygon points="${pts.trim()}" fill="${pal[3 + (i % 3)]}" opacity="${(.1 + rng() * .2).toFixed(2)}" filter="url(#${u}gl)"/>`;
                        layers += `<polygon points="${pts.trim()}" fill="none" stroke="${pal[4]}" stroke-width=".5" opacity="${(.3 + rng() * .4).toFixed(2)}"/>`;
                        let pts2 = '';
                        for (let si = 0; si < sides; si++) {
                            const a = rot + si / sides * T;
                            pts2 += `${(cx + inner * Math.cos(a)).toFixed(1)},${(cy + inner * Math.sin(a)).toFixed(1)} `;
                        }
                        layers += `<polygon points="${pts2.trim()}" fill="white" opacity="${(.04 + rng() * .08).toFixed(2)}"/>`;
                    }
                    for (let i = 0; i < 3; i++) {
                        const a = rng() * T, len = 30 + rng() * 50;
                        layers += `<line x1="50" y1="50" x2="${(50 + len * Math.cos(a)).toFixed(1)}" y2="${(50 + len * Math.sin(a)).toFixed(1)}" stroke="${pal[5]}" stroke-width=".6" opacity="${(.15 + rng() * .2).toFixed(2)}"/>`;
                    }
                }
                else if (theme === 2) {
                    for (let i = 0; i < 7; i++) {
                        const bx = 15 + rng() * 70, by = 80 - rng() * 20;
                        const h = 25 + rng() * 45, w = 8 + rng() * 16;
                        const cp1x = bx - w * (.5 + rng()), cp1y = by - h * .4;
                        const cp2x = bx + w * (.5 + rng()), cp2y = by - h * .6;
                        layers += `<path d="M${bx.toFixed(1)},${by.toFixed(1)} C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${(bx + (rng() - .5) * 10).toFixed(1)},${(by - h).toFixed(1)}" fill="none" stroke="${pal[3 + (i % 3)]}" stroke-width="${(2 + rng() * 6).toFixed(1)}" opacity="${(.2 + rng() * .3).toFixed(2)}" stroke-linecap="round" filter="url(#${u}gl)"/>`;
                    }
                    for (let i = 0; i < 12; i++) {
                        const ex = 15 + rng() * 70, ey = 10 + rng() * 70, er = .5 + rng() * 2;
                        layers += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${er.toFixed(1)}" fill="${pal[4 + (i % 2)]}" opacity="${(.4 + rng() * .6).toFixed(2)}"/>`;
                    }
                    layers += `<circle cx="50" cy="75" r="28" fill="${pal[3]}" opacity=".08" filter="url(#${u}gl2)"/>`;
                }
                else if (theme === 3) {
                    const cols = 5, rows = 5, sp = 20;
                    for (let r = 0; r < rows; r++)
                        for (let c = 0; c < cols; c++) {
                            const nx = 10 + c * sp + (rng() - .5) * 6, ny = 10 + r * sp + (rng() - .5) * 6;
                            if (rng() > .3) {
                                const dir = ~~(rng() * 4), len = sp * (.5 + rng() * .8);
                                const dx = [len, 0, -len, 0][dir], dy = [0, len, 0, -len][dir];
                                layers += `<line x1="${nx.toFixed(1)}" y1="${ny.toFixed(1)}" x2="${(nx + dx).toFixed(1)}" y2="${(ny + dy).toFixed(1)}" stroke="${pal[3 + (c % 3)]}" stroke-width="${(.4 + rng() * .8).toFixed(1)}" opacity="${(.2 + rng() * .4).toFixed(2)}"/>`;
                            }
                            layers += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${(.8 + rng() * 2).toFixed(1)}" fill="${pal[4]}" opacity="${(.3 + rng() * .5).toFixed(2)}"/>`;
                        }
                    for (let i = 0; i < 3; i++) {
                        const x1 = rng() * 100, y1 = rng() * 100;
                        layers += `<circle cx="${x1.toFixed(0)}" cy="${y1.toFixed(0)}" r="12" fill="${pal[5]}" opacity=".08" filter="url(#${u}gl2)"/>`;
                    }
                }
                else if (theme === 4) {
                    for (let i = 0; i < 6; i++) {
                        const y = 5 + i * 16 + rng() * 8;
                        const amp = 4 + rng() * 12, freq = .5 + rng() * 1.5;
                        let d = `M-5,${y.toFixed(1)}`;
                        for (let x = 0; x <= 110; x += 5)
                            d += ` L${x},${(y + amp * Math.sin(x * freq * P / 50)).toFixed(1)}`;
                        layers += `<path d="${d}" fill="none" stroke="${pal[3 + (i % 3)]}" stroke-width="${(3 + rng() * 8).toFixed(1)}" opacity="${(.12 + rng() * .2).toFixed(2)}" stroke-linecap="round" filter="url(#${u}gl)"/>`;
                    }
                    for (let i = 0; i < 8; i++)
                        layers += `<circle cx="${(rng() * 100).toFixed(0)}" cy="${(rng() * 100).toFixed(0)}" r="${(3 + rng() * 10).toFixed(1)}" fill="${pal[5]}" opacity="${(.05 + rng() * .1).toFixed(2)}" filter="url(#${u}gl2)"/>`;
                }
                else if (theme === 5) {
                    const cx0 = 35 + rng() * 30, cy0 = 35 + rng() * 30;
                    for (let i = 0; i < 7; i++) {
                        const r = 6 + i * 7 + rng() * 4;
                        const dx = (rng() - .5) * 8, dy = (rng() - .5) * 8;
                        layers += `<ellipse cx="${(cx0 + dx).toFixed(1)}" cy="${(cy0 + dy).toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * (.7 + rng() * .6)).toFixed(1)}" fill="none" stroke="${pal[3 + (i % 3)]}" stroke-width="${(.5 + rng() * 1).toFixed(1)}" opacity="${(.2 + rng() * .35).toFixed(2)}" transform="rotate(${(rng() * 40 - 20).toFixed(0)} ${cx0.toFixed(0)} ${cy0.toFixed(0)})"/>`;
                    }
                    for (let i = 0; i < 15; i++)
                        layers += `<circle cx="${(rng() * 100).toFixed(0)}" cy="${(rng() * 100).toFixed(0)}" r="${(.5 + rng() * 1.5).toFixed(1)}" fill="${pal[4]}" opacity="${(.2 + rng() * .5).toFixed(2)}"/>`;
                }
                else if (theme === 6) {
                    for (let i = 0; i < 5; i++) {
                        const cx = 15 + rng() * 70, cy = 15 + rng() * 70;
                        const rx = 10 + rng() * 22, ry = 10 + rng() * 22;
                        layers += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${pal[3 + (i % 3)]}" opacity="${(.18 + rng() * .22).toFixed(2)}" filter="url(#${u}gl2)" transform="rotate(${(rng() * 360).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
                    }
                    for (let i = 0; i < 4; i++) {
                        const cx = 20 + rng() * 60, cy = 20 + rng() * 60;
                        layers += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(5 + rng() * 10).toFixed(1)}" ry="${(3 + rng() * 6).toFixed(1)}" fill="white" opacity="${(.03 + rng() * .06).toFixed(2)}" filter="url(#${u}gl)"/>`;
                    }
                }
                else {
                    for (let i = 0; i < 12; i++) {
                        const x = rng() * 90, y = rng() * 90;
                        const w = 8 + rng() * 20, h = 8 + rng() * 20;
                        const rot = ~~(rng() * 45) - 22;
                        layers += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(1 + rng() * 4).toFixed(1)}" fill="${pal[3 + (i % 3)]}" opacity="${(.08 + rng() * .18).toFixed(2)}" transform="rotate(${rot} ${(x + w / 2).toFixed(0)} ${(y + h / 2).toFixed(0)})"/>`;
                    }
                    layers += `<circle cx="50" cy="50" r="30" fill="${pal[5]}" opacity=".06" filter="url(#${u}gl2)"/>`;
                }
                const textLayer = `<circle cx="50" cy="50" r="22" fill="${pal[0]}" opacity=".45" filter="url(#${u}gl)"/><text x="50" y="53" text-anchor="middle" dominant-baseline="central" font-size="36" font-weight="800" fill="white" fill-opacity=".95" font-family="'Inter','SF Pro Display',system-ui,sans-serif" filter="url(#${u}sh)" letter-spacing="1">${letter}</text>`;
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs><g clip-path="url(#${u}clip)">${bg}${layers}${textLayer}</g></svg>`;
                return 'data:image/svg+xml,' + encodeURIComponent(svg);
            }
            const icons = {
                signal: '<svg viewBox="0 0 24 24"><path d="M12 3v18"></path><path d="M5 12h14"></path><path d="M7 7l10 10"></path><path d="M17 7L7 17"></path></svg>',
                image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="9.5" r="1.5"></circle><path d="M21 15l-5-5L5 20"></path></svg>',
                link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L10 4"></path><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L14 20"></path></svg>',
                chevron: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>',
                zap: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z"></path></svg>',
                bot: '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="10" rx="4"></rect><path d="M9 8V5"></path><path d="M15 8V5"></path><circle cx="9" cy="13" r="1"></circle><circle cx="15" cy="13" r="1"></circle></svg>',
                wallet: '<svg viewBox="0 0 24 24"><path d="M3 7h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path><path d="M3 9V6a2 2 0 0 1 2-2h11"></path><path d="M17 13h4"></path></svg>',
                spark: '<svg viewBox="0 0 24 24"><path d="M12 2l1.7 4.3L18 8l-4.3 1.7L12 14l-1.7-4.3L6 8l4.3-1.7L12 2z"></path><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"></path></svg>',
                alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>',
                check: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>',
                send: '<svg viewBox="0 0 24 24"><path d="M22 2L11 13"></path><path d="M22 2L15 22l-4-9-9-4 20-7z"></path></svg>',
            };
            function renderMedia(imageUrl, seed) {
                if (imageUrl)
                    return `<img src="${imageUrl}" alt="Token preview" />`;
                if (seed)
                    return `<img src="${generateTokenAvatar(seed)}" alt="Token preview" style="border-radius:14px;width:100%;aspect-ratio:1;object-fit:cover" />`;
                return `<div class="wo-pump-media-empty"><div class="wo-pump-media-empty-icon">${icons.image}</div><div>Visual preview appears here after AI generates artwork metadata.</div></div>`;
            }
            function renderPreviewState(kind, title, copy, extra) {
                const icon = kind === 'error' ? icons.alert : kind === 'success' ? icons.check : icons.spark;
                return `
          <div class="wo-pump-preview-state ${kind}">
            <div class="wo-pump-preview-state-icon">${icon}</div>
            <div>
              <div class="wo-pump-preview-title">${title}</div>
              <div class="wo-pump-preview-copy">${copy}</div>
              ${extra || ''}
            </div>
          </div>`;
            }
            card.innerHTML = `
      <div class="wo-pump-hero wo-pump-header">
        <div class="wo-pump-header-bg"></div>
        <div class="wo-pump-header-row">
          <div class="wo-pump-brand">
            <div class="wo-pump-brand-badge wo-pump-orb wo-pump-shine">${owlSrc ? `<img src="${owlSrc}" alt="WhiteOwl" />` : 'WO'}</div>
            <div class="wo-pump-brand-copy">
              <div class="wo-pump-title">WhiteOwl Launch Console</div>
              <div class="wo-pump-subtitle">Deploy token from post with the same command-layer controls used in app and wallet.</div>
            </div>
          </div>
          <button data-close class="wo-pump-close" aria-label="Close launch console">✕</button>
        </div>
      </div>

      <div class="wo-pump-context wo-pump-section-card wo-pump-shine">
        <div class="wo-pump-context-label">${icons.signal}<span>Source Context</span></div>
        <div class="wo-pump-context-text">${textSnippet}</div>
      </div>

      <div class="wo-pump-body">
        <div data-img-box class="wo-pump-media wo-pump-section-card">${renderMedia(avatarSrc, postData.text)}</div>

        <div class="wo-pump-grid">
          <div class="wo-pump-field">
            <label class="wo-pump-label">Coin name</label>
            <input data-name type="text" class="wo-pump-input" placeholder="Name your coin" />
          </div>
          <div class="wo-pump-field">
            <label class="wo-pump-label">Ticker</label>
            <input data-symbol type="text" class="wo-pump-input" placeholder="DOGE" maxlength="10" style="text-transform:uppercase" />
          </div>
        </div>

        <div class="wo-pump-field">
          <label class="wo-pump-label">Description</label>
          <textarea data-description rows="3" class="wo-pump-textarea" placeholder="Write a short description"></textarea>
        </div>

        <details class="wo-pump-collapsible wo-pump-section-card">
          <summary>
            <div class="wo-pump-collapse-trigger">
              <div class="wo-pump-collapse-copy">
                <div class="wo-pump-collapse-icon">${icons.link}</div>
                <div>
                  <div class="wo-pump-collapse-title">Social links</div>
                  <div class="wo-pump-collapse-subtitle">Optional routing for X, Telegram and website</div>
                </div>
              </div>
              <div class="wo-pump-collapse-chevron">${icons.chevron}</div>
            </div>
          </summary>
          <div class="wo-pump-collapse-body">
            <input data-twitter type="url" class="wo-pump-input" placeholder="https://x.com/yourtoken" />
            <input data-telegram type="url" class="wo-pump-input" placeholder="https://t.me/yourtoken" />
            <input data-website type="url" class="wo-pump-input" placeholder="https://yoursite.com" />
          </div>
        </details>

        <div class="wo-pump-feature-grid">
          <div data-card-mayhem class="wo-pump-feature-card wo-pump-section-card">
            <div class="wo-pump-feature-head">
              <div class="wo-pump-feature-icon">${icons.zap}</div>
              <div class="wo-pump-feature-title">Mayhem mode</div>
            </div>
            <div class="wo-pump-feature-copy">Route fees to reserved recipients for higher price-action velocity.</div>
            <input data-mayhem type="checkbox" class="wo-pump-switch" />
          </div>
          <div data-card-agent class="wo-pump-feature-card wo-pump-section-card">
            <div class="wo-pump-feature-head">
              <div class="wo-pump-feature-icon">${icons.bot}</div>
              <div>
                <div class="wo-pump-feature-title">Tokenized agent</div>
                <div class="wo-pump-badge">New</div>
              </div>
            </div>
            <div class="wo-pump-feature-copy">Attach fee-sharing config for automated buyback routing.</div>
            <input data-agent type="checkbox" class="wo-pump-switch" />
          </div>
          <div data-card-cashback class="wo-pump-feature-card wo-pump-section-card">
            <div class="wo-pump-feature-head">
              <div class="wo-pump-feature-icon">${icons.wallet}</div>
              <div class="wo-pump-feature-title">Cash back</div>
            </div>
            <div class="wo-pump-feature-copy">Enable on-chain cashback flag for creator reward redistribution.</div>
            <input data-cashback type="checkbox" class="wo-pump-switch" />
          </div>
        </div>

        <div data-agent-opts class="wo-pump-advanced wo-pump-section-card">
          <div class="wo-pump-advanced-copy">Buyback percentage controls how much revenue the agent routes back into the token.</div>
          <div class="wo-pump-advanced-row">
            <input data-agent-pct type="range" class="wo-pump-range" min="10" max="100" step="10" value="50" />
            <span data-agent-pct-label class="wo-pump-range-label">50%</span>
          </div>
        </div>

        <div class="wo-pump-field">
          <label class="wo-pump-label">Buy-in (SOL)</label>
          <input data-price type="number" min="0" step="0.01" value="0.1" class="wo-pump-input" />
          <div class="wo-pump-helper">Tip: 0 SOL creates without buying.</div>
        </div>

        <div data-preview class="wo-pump-preview wo-pump-section-card">${renderPreviewState('loading', 'Generating AI metadata', 'WhiteOwl is preparing name, ticker, artwork and contract details from the post signal.')}</div>

        <div class="wo-pump-actions">
          <button data-cancel class="wo-pump-btn wo-pump-btn-ghost">Cancel</button>
          <button data-preview-btn class="wo-pump-btn wo-pump-btn-ai">${icons.spark}<span>Preview AI</span></button>
          <button data-launch class="wo-pump-btn wo-pump-btn-launch">${icons.send}<span>Launch Token</span></button>
        </div>
      </div>`;
            overlay.appendChild(card);
            document.body.appendChild(overlay);
            ['[data-card-mayhem]', '[data-card-agent]', '[data-card-cashback]'].forEach(sel => {
                const cardEl = card.querySelector(sel);
                cardEl.onclick = (e) => {
                    if (e.target.tagName === 'INPUT')
                        return;
                    const chk = cardEl.querySelector('input[type=checkbox]');
                    chk.checked = !chk.checked;
                    chk.dispatchEvent(new Event('change'));
                };
                const chk = cardEl.querySelector('input[type=checkbox]');
                chk.addEventListener('change', () => {
                    cardEl.classList.toggle('is-active', chk.checked);
                });
                chk.dispatchEvent(new Event('change'));
            });
            const agentChk = card.querySelector('[data-agent]');
            const agentOpts = card.querySelector('[data-agent-opts]');
            const agentPctSlider = card.querySelector('[data-agent-pct]');
            const agentPctLabel = card.querySelector('[data-agent-pct-label]');
            agentChk.addEventListener('change', () => {
                agentOpts.classList.toggle('is-visible', agentChk.checked);
            });
            agentPctSlider.addEventListener('input', () => {
                agentPctLabel.textContent = agentPctSlider.value + '%';
            });
            function close() { overlay.remove(); }
            card.querySelector('[data-close]').onclick = close;
            card.querySelector('[data-cancel]').onclick = close;
            const nameInput = card.querySelector('[data-name]');
            const symInput = card.querySelector('[data-symbol]');
            const descInput = card.querySelector('[data-description]');
            const priceInput = card.querySelector('[data-price]');
            const previewBox = card.querySelector('[data-preview]');
            const previewBtn = card.querySelector('[data-preview-btn]');
            const launchBtn = card.querySelector('[data-launch]');
            const imgBox = card.querySelector('[data-img-box]');
            const twitterInput = card.querySelector('[data-twitter]');
            const websiteInput = card.querySelector('[data-website]');
            if (postData.postUrl)
                twitterInput.value = postData.postUrl;
            if (postData.websiteUrl)
                websiteInput.value = postData.websiteUrl;
            function setPreview(html) { previewBox.innerHTML = html; }
            let currentPreview = null;
            function doPreview() {
                const buyIn = parseFloat(priceInput.value || '0');
                setPreview(renderPreviewState('loading', 'Generating AI metadata', 'WhiteOwl is deriving token metadata, image context and the contract route from this post.'));
                _safeSend({ type: 'wo-x-pumpfun-preview', post: { ...postData, buyIn } }, (resp) => {
                    if (!resp || !resp.ok) {
                        const reason = resp?.error || 'Connection error — is the server running on :3377?';
                        setPreview(renderPreviewState('error', 'Preview failed', reason));
                        return;
                    }
                    currentPreview = resp;
                    const { name, symbol, description, tokenAddress, avatar } = resp;
                    if (name && !nameInput.value)
                        nameInput.value = name;
                    if (symbol && !symInput.value)
                        symInput.value = symbol;
                    if (description && !descInput.value)
                        descInput.value = description;
                    if (avatar && !postData.imageUrl) {
                        imgBox.innerHTML = renderMedia(avatar, symbol || name);
                    }
                    setPreview(renderPreviewState('success', `<span class="wo-pump-preview-meta">${name || 'Untitled'} <span class="wo-pump-preview-meta-symbol">(${symbol || '—'})</span></span>`, (description || 'No description generated yet.').slice(0, 140), tokenAddress ? `<div class="wo-pump-address"><code>${tokenAddress}</code></div>` : ''));
                });
            }
            previewBtn.onclick = doPreview;
            launchBtn.onclick = () => {
                launchBtn.textContent = 'Launching…';
                launchBtn.disabled = true;
                const buyIn = parseFloat(priceInput.value || '0');
                onLaunch({
                    buyIn, close, setPreview, launchBtn,
                    overlay, card,
                    mintSecret: currentPreview?.mintSecret,
                    metadataUri: currentPreview?.metadataUri,
                    name: nameInput.value || currentPreview?.name,
                    symbol: symInput.value || currentPreview?.symbol,
                    description: descInput.value || currentPreview?.description,
                    mayhemMode: card.querySelector('[data-mayhem]').checked,
                    tokenizedAgent: card.querySelector('[data-agent]').checked,
                    cashback: card.querySelector('[data-cashback]').checked,
                    twitter: card.querySelector('[data-twitter]').value,
                    telegram: card.querySelector('[data-telegram]').value,
                    website: card.querySelector('[data-website]').value,
                });
            };
            doPreview();
        }
        const _launchedTokens = {};
        function _rememberLaunch(postUrl, data) {
            if (!postUrl)
                return;
            _launchedTokens[postUrl] = data;
            try {
                localStorage.setItem('wo_launched_tokens', JSON.stringify(_launchedTokens));
            }
            catch { }
        }
        function _recallLaunch(postUrl) {
            return _launchedTokens[postUrl] || null;
        }
        try {
            const stored = JSON.parse(localStorage.getItem('wo_launched_tokens') || '{}');
            Object.assign(_launchedTokens, stored);
        }
        catch { }
        function _showPostDeploy(overlay, card, deployResp, api) {
            _ensurePumpUiStyles();
            const { tokenAddress, tokenUrl, name, symbol, buyIn, tx, description, avatar } = deployResp;
            const shortAddr = tokenAddress.slice(0, 6) + '…' + tokenAddress.slice(-4);
            const SELL_BTNS = [
                { label: '100%', pct: 100 },
                { label: '50%', pct: 50 },
                { label: '25%', pct: 25 },
                { label: '10%', pct: 10 },
            ];
            const owlSrc = _alive() ? chrome.runtime.getURL('icon48.png') : BTN_ICON_SRC;
            let avatarHtml;
            if (avatar) {
                avatarHtml = `<img src="${avatar}" alt="${symbol || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:16px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div style="display:none;width:100%;height:100%;border-radius:16px;background:linear-gradient(135deg,#b8a9c9 0%,#d4caba 100%);align-items:center;justify-content:center;color:#5c4f3d;font-size:24px;font-weight:800">${(symbol || name || 'W').slice(0, 1).toUpperCase()}</div>`;
            }
            else if (typeof generateTokenAvatar === 'function') {
                const genSrc = generateTokenAvatar(symbol || name || 'W');
                avatarHtml = `<img src="${genSrc}" alt="${symbol || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:16px" />`;
            }
            else {
                const letter = (symbol || name || 'W').slice(0, 1).toUpperCase();
                avatarHtml = `<div style="width:100%;height:100%;border-radius:16px;background:linear-gradient(135deg,#b8a9c9 0%,#d4caba 100%);display:flex;align-items:center;justify-content:center;color:#5c4f3d;font-size:24px;font-weight:800">${letter}</div>`;
            }
            card.className = 'wo-pump-shell';
            card.style.cssText = 'width:560px;max-width:96vw;max-height:94vh;padding:0;overflow:hidden';
            card.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;max-height:94vh">
          <div style="position:relative;z-index:2;padding:18px 22px 14px;border-bottom:1px solid rgba(18,18,18,0.06);flex-shrink:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
              <div style="display:flex;align-items:center;gap:12px;min-width:0">
                <img src="${owlSrc}" style="width:28px;height:28px;border-radius:8px" />
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:linear-gradient(180deg,#f0ebdf,#e8e1d1);color:#7c6a3d;border:1px solid rgba(18,18,18,0.08);box-shadow:0 1px 3px rgba(0,0,0,0.06)">Deployed</span>
                  <span style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:rgba(22,163,74,0.08);color:#16a34a;border:1px solid rgba(22,163,74,0.18)">On-chain</span>
                </div>
              </div>
              <button data-close style="width:32px;height:32px;border-radius:10px;border:1px solid rgba(18,18,18,0.08);background:rgba(255,255,255,0.8);color:#1a1a1a;cursor:pointer;font-size:18px;line-height:32px;text-align:center;transition:all .15s;z-index:50;position:relative;padding:0;font-family:system-ui" title="Close">✕</button>
            </div>
          </div>

          <div style="overflow-y:auto;overflow-x:hidden;flex:1;padding:14px 22px 22px;scrollbar-width:thin">

            <div style="display:flex;align-items:center;gap:14px;padding:14px;border-radius:16px;background:rgba(255,255,255,0.55);border:1px solid rgba(18,18,18,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:12px">
              <div style="width:56px;height:56px;flex-shrink:0;border-radius:16px;overflow:hidden;border:2px solid rgba(18,18,18,0.06);box-shadow:0 4px 12px rgba(0,0,0,0.08)">
                ${avatarHtml}
              </div>
              <div style="min-width:0;flex:1">
                <div style="font-size:17px;font-weight:700;color:#1a1a1a;line-height:1.2;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap">
                  ${name || 'Token'}
                  <span style="font-size:12px;font-weight:600;color:#8c8070;background:rgba(18,18,18,0.04);padding:2px 8px;border-radius:6px">${symbol || ''}</span>
                </div>
                ${description ? `<div style="font-size:12px;color:#6b6052;margin-top:4px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${description}</div>` : ''}
                <div data-addr-bar style="font-family:'SF Mono','Fira Code','JetBrains Mono',monospace;font-size:10px;color:#9c8e7c;cursor:pointer;transition:color .15s;margin-top:6px;word-break:break-all" title="Click to copy full address">${tokenAddress}</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
              <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.5);border-radius:12px;border:1px solid rgba(18,18,18,0.06)">
                <div style="font-size:9px;color:#8c8070;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Buy-in</div>
                <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-top:3px">${Number(buyIn || 0).toFixed(2)} SOL</div>
              </div>
              <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.5);border-radius:12px;border:1px solid rgba(18,18,18,0.06)">
                <div style="font-size:9px;color:#8c8070;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Contract</div>
                <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-top:3px">${shortAddr}</div>
              </div>
              <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.5);border-radius:12px;border:1px solid rgba(18,18,18,0.06)">
                <div style="font-size:9px;color:#8c8070;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Network</div>
                <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-top:3px">Solana</div>
              </div>
            </div>

            <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
              <a data-action-hover href="${tokenUrl}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 12px;border-radius:10px;border:1px solid rgba(18,18,18,0.08);background:rgba(255,255,255,0.6);color:#1a1a1a;text-decoration:none;font-size:11px;font-weight:600;transition:all .15s;flex:1;min-width:0">pump.fun ↗</a>
            </div>

            <div style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.55);border:1px solid rgba(18,18,18,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:12px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#1a1a1a">Market Cap</div>
                    <div data-chart-price style="font-size:11px;color:#8c8070;margin-top:2px">Loading…</div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:4px">
                  <button data-refresh-chart style="padding:6px 10px;border-radius:8px;border:1px solid rgba(18,18,18,0.08);background:rgba(255,255,255,0.7);color:#1a1a1a;font-size:10px;cursor:pointer;font-weight:600;transition:all .15s" title="Refresh">&#x21bb;</button>
                </div>
              </div>
              <div style="position:relative;border-radius:12px;overflow:hidden;border:1px solid rgba(18,18,18,0.08)">
                <div data-tv-chart style="width:100%;height:300px"></div>
                <div data-chart-overlay style="position:absolute;inset:0;background:rgba(255,255,255,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;transition:opacity .3s;z-index:10">
                  <div style="width:40px;height:40px;border-radius:10px;background:rgba(18,18,18,0.04);border:1px solid rgba(18,18,18,0.08);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);font-size:18px">📈</div>
                  <div style="font-size:12px;font-weight:600;color:#1a1a1a">Loading chart…</div>
                  <div style="font-size:11px;color:#8c8070;text-align:center;max-width:240px;line-height:1.4">Fetching market cap data…</div>
                </div>
              </div>
            </div>

            <div style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.55);border:1px solid rgba(18,18,18,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.04)">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
                <div>
                  <div style="font-size:13px;font-weight:700;color:#1a1a1a">Position controls</div>
                  <div style="font-size:11px;color:#8c8070;margin-top:2px">Buy more or take profits</div>
                </div>
              </div>

              <div style="margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                  <span style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:3px 10px;border-radius:8px;background:rgba(22,163,74,0.06);color:#16a34a;border:1px solid rgba(22,163,74,0.12)">Buy</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <input data-buy-sol type="number" min="0.01" step="0.01" placeholder="SOL amount" style="flex:1;background:rgba(255,255,255,0.7);color:#1a1a1a;border:1px solid rgba(18,18,18,0.08);border-radius:10px;padding:9px 12px;font-size:12px;outline:none;font-family:inherit" />
                  <button data-buy-exec style="padding:9px 16px;border:none;border-radius:10px;background:linear-gradient(180deg,#22c55e,#16a34a);color:#fff;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(22,163,74,0.2);transition:all .15s">Buy</button>
                </div>
                <div data-buy-status style="margin-top:6px;font-size:11px;color:#8c8070;min-height:16px"></div>
              </div>

              <div style="border-top:1px solid rgba(18,18,18,0.06);padding-top:12px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                  <span style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:3px 10px;border-radius:8px;background:rgba(220,38,38,0.06);color:#dc2626;border:1px solid rgba(220,38,38,0.12)">Sell</span>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
                  ${SELL_BTNS.map((b) => `<button data-sell="${b.pct}" style="flex:1;min-width:68px;padding:9px 4px;border:1px solid rgba(220,38,38,0.12);border-radius:10px;background:rgba(255,255,255,0.6);color:#1a1a1a;font-weight:600;font-size:11px;cursor:pointer;transition:all .15s">${b.label}</button>`).join('')}
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <input data-custom-pct type="number" min="1" max="100" placeholder="Custom %" style="flex:1;background:rgba(255,255,255,0.7);color:#1a1a1a;border:1px solid rgba(18,18,18,0.08);border-radius:10px;padding:9px 12px;font-size:12px;outline:none;font-family:inherit" />
                  <button data-sell-custom style="padding:9px 16px;border:none;border-radius:10px;background:linear-gradient(180deg,#ef4444,#dc2626);color:#fff;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(220,38,38,0.2);transition:all .15s">Sell</button>
                </div>
                <div data-sell-status style="margin-top:6px;font-size:11px;color:#8c8070;min-height:16px"></div>
              </div>
            </div>

          </div>
        </div>`;
            const addrBar = card.querySelector('[data-addr-bar]');
            addrBar.onclick = () => {
                navigator.clipboard.writeText(tokenAddress).then(() => {
                    addrBar.textContent = '✓ Copied!';
                    setTimeout(() => { addrBar.textContent = tokenAddress; }, 1500);
                }).catch(() => { });
            };
            const _tvContainer = card.querySelector('[data-tv-chart]');
            const chartOverlay = card.querySelector('[data-chart-overlay]');
            const chartPriceEl = card.querySelector('[data-chart-price]');
            let chartPollTimer = null;
            const TOTAL_SUPPLY = 1_000_000_000;
            function _fmtMcap(v) {
                if (v >= 1e9)
                    return '$' + (v / 1e9).toFixed(2) + 'B';
                if (v >= 1e6)
                    return '$' + (v / 1e6).toFixed(2) + 'M';
                if (v >= 1e3)
                    return '$' + (v / 1e3).toFixed(1) + 'K';
                return '$' + v.toFixed(0);
            }
            const LWC = window.LightweightCharts;
            let _tvChart = null;
            let _candleSeries = null;
            let _volumeSeries = null;
            let _chartHasData = false;
            function _initChart() {
                if (_tvChart)
                    return;
                _tvChart = LWC.createChart(_tvContainer, {
                    width: _tvContainer.clientWidth,
                    height: 300,
                    layout: {
                        background: { color: '#ffffff' },
                        textColor: '#6b6052',
                        fontSize: 11,
                    },
                    grid: {
                        vertLines: { color: 'rgba(18,18,18,0.04)' },
                        horzLines: { color: 'rgba(18,18,18,0.06)' },
                    },
                    crosshair: {
                        mode: LWC.CrosshairMode.Normal,
                        vertLine: { color: 'rgba(18,18,18,0.2)', style: LWC.LineStyle.Dashed, width: 1, labelBackgroundColor: '#f5f0e8' },
                        horzLine: { color: 'rgba(18,18,18,0.2)', style: LWC.LineStyle.Dashed, width: 1, labelBackgroundColor: '#f5f0e8' },
                    },
                    rightPriceScale: {
                        borderColor: 'rgba(18,18,18,0.06)',
                        scaleMargins: { top: 0.08, bottom: 0.18 },
                    },
                    timeScale: {
                        borderColor: 'rgba(18,18,18,0.06)',
                        timeVisible: true,
                        secondsVisible: false,
                        rightOffset: 5,
                        barSpacing: 10,
                    },
                    handleScroll: { vertTouchDrag: false },
                    localization: {
                        priceFormatter: _fmtMcap,
                    },
                });
                _candleSeries = _tvChart.addCandlestickSeries({
                    upColor: '#16a34a',
                    downColor: '#dc2626',
                    borderUpColor: '#16a34a',
                    borderDownColor: '#dc2626',
                    wickUpColor: '#16a34a',
                    wickDownColor: '#dc2626',
                    priceFormat: { type: 'custom', formatter: _fmtMcap },
                });
                _volumeSeries = _tvChart.addHistogramSeries({
                    priceFormat: { type: 'volume' },
                    priceScaleId: 'vol',
                });
                _tvChart.priceScale('vol').applyOptions({
                    scaleMargins: { top: 0.82, bottom: 0 },
                });
                const ro = new ResizeObserver(() => {
                    if (_tvChart && _tvContainer.clientWidth > 0) {
                        _tvChart.applyOptions({ width: _tvContainer.clientWidth });
                    }
                });
                ro.observe(_tvContainer);
            }
            function _updateChart(candles) {
                if (!candles || !candles.length)
                    return;
                _initChart();
                const candleData = candles.map(c => ({
                    time: c.ts,
                    open: c.open * TOTAL_SUPPLY,
                    high: c.high * TOTAL_SUPPLY,
                    low: c.low * TOTAL_SUPPLY,
                    close: c.close * TOTAL_SUPPLY,
                }));
                const volumeData = candles.map(c => ({
                    time: c.ts,
                    value: c.volume || 0,
                    color: c.close >= c.open ? 'rgba(22,163,74,0.18)' : 'rgba(220,38,38,0.18)',
                }));
                _candleSeries.setData(candleData);
                _volumeSeries.setData(volumeData);
                if (!_chartHasData) {
                    _tvChart.timeScale().fitContent();
                    _chartHasData = true;
                }
                const last = candleData[candleData.length - 1];
                const first = candleData[0];
                const mcap = last.close;
                const pctChange = first.open > 0 ? ((last.close - first.open) / first.open * 100) : 0;
                const pctStr = (pctChange >= 0 ? '+' : '') + pctChange.toFixed(2) + '%';
                const pctColor = pctChange >= 0 ? '#26a69a' : '#ef5350';
                chartPriceEl.innerHTML =
                    '<span style="color:#1a1a1a;font-weight:700">' + _fmtMcap(mcap) + '</span> ' +
                        '<span style="color:' + pctColor + ';font-weight:600">' + pctStr + '</span>';
            }
            const _refreshBtn = card.querySelector('[data-refresh-chart]');
            function fetchAndDraw() {
                if (_refreshBtn)
                    _refreshBtn.style.opacity = '0.5';
                _safeSend({ type: 'wo-x-pumpfun-chart', mint: tokenAddress, api }, (resp) => {
                    if (_refreshBtn)
                        _refreshBtn.style.opacity = '1';
                    if (resp?.ok && resp.candles && resp.candles.length) {
                        resp.candles.sort((a, b) => a.ts - b.ts);
                        _updateChart(resp.candles);
                        chartOverlay.style.opacity = '0';
                        setTimeout(() => { chartOverlay.style.display = 'none'; }, 300);
                    }
                    else {
                        const errMsg = resp?.error || 'No chart data yet — token may still be indexing';
                        chartPriceEl.textContent = errMsg;
                    }
                });
            }
            fetchAndDraw();
            chartPollTimer = setInterval(fetchAndDraw, 10000);
            card.querySelector('[data-refresh-chart]').onclick = () => {
                fetchAndDraw();
            };
            card.querySelectorAll('[data-action-hover]').forEach((btn) => {
                btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.9)'; btn.style.borderColor = 'rgba(18,18,18,0.14)'; btn.style.transform = 'translateY(-1px)'; };
                btn.onmouseleave = () => { btn.style.background = 'rgba(255,255,255,0.6)'; btn.style.borderColor = 'rgba(18,18,18,0.08)'; btn.style.transform = 'translateY(0)'; };
            });
            card.querySelectorAll('[data-sell]').forEach(btn => {
                btn.onmouseenter = () => { btn.style.background = 'rgba(220,38,38,0.06)'; btn.style.borderColor = 'rgba(220,38,38,0.22)'; btn.style.transform = 'translateY(-1px)'; };
                btn.onmouseleave = () => { btn.style.background = 'rgba(255,255,255,0.6)'; btn.style.borderColor = 'rgba(220,38,38,0.12)'; btn.style.transform = 'translateY(0)'; };
            });
            const statusEl = card.querySelector('[data-sell-status]');
            const buyStatusEl = card.querySelector('[data-buy-status]');
            function doBuy(solAmount) {
                buyStatusEl.textContent = `Buying ${solAmount} SOL…`;
                buyStatusEl.style.color = '#2563eb';
                card.querySelector('[data-buy-exec]').disabled = true;
                _safeSend({ type: 'wo-x-pumpfun-buy', tokenAddress, solAmount, api }, (resp) => {
                    card.querySelector('[data-buy-exec]').disabled = false;
                    if (resp?.ok) {
                        buyStatusEl.style.color = '#16a34a';
                        buyStatusEl.textContent = `Bought! tx: ${(resp.txHash || '').slice(0, 16)}…`;
                    }
                    else {
                        buyStatusEl.style.color = '#dc2626';
                        buyStatusEl.textContent = `Buy failed: ${resp?.error || 'unknown'}`;
                    }
                });
            }
            function doSell(pct) {
                statusEl.textContent = `Selling ${pct}%…`;
                statusEl.style.color = '#2563eb';
                card.querySelectorAll('[data-sell],[data-sell-custom]').forEach(b => b.disabled = true);
                _safeSend({ type: 'wo-x-pumpfun-sell', tokenAddress, percent: pct, api }, (resp) => {
                    card.querySelectorAll('[data-sell],[data-sell-custom]').forEach(b => b.disabled = false);
                    if (resp?.ok) {
                        statusEl.style.color = '#16a34a';
                        statusEl.textContent = `Sold ${pct}%! tx: ${(resp.txHash || '').slice(0, 16)}…`;
                    }
                    else {
                        statusEl.style.color = '#dc2626';
                        statusEl.textContent = `Sell failed: ${resp?.error || 'unknown'}`;
                    }
                });
            }
            card.querySelector('[data-close]').onclick = () => { clearInterval(chartPollTimer); overlay.remove(); };
            card.querySelector('[data-buy-exec]').onclick = () => {
                const sol = parseFloat(card.querySelector('[data-buy-sol]').value || '0');
                if (!sol || sol <= 0) {
                    buyStatusEl.textContent = 'Enter a SOL amount';
                    buyStatusEl.style.color = '#dc2626';
                    return;
                }
                doBuy(sol);
            };
            card.querySelectorAll('[data-sell]').forEach(btn => {
                btn.onclick = () => doSell(Number(btn.getAttribute('data-sell')));
            });
            card.querySelector('[data-sell-custom]').onclick = () => {
                const pct = Math.max(1, Math.min(100, parseInt(card.querySelector('[data-custom-pct]').value || '0', 10)));
                if (!pct) {
                    statusEl.textContent = 'Enter a % between 1–100';
                    statusEl.style.color = '#dc2626';
                    return;
                }
                doSell(pct);
            };
        }
        function extractPostData(article) {
            try {
                const textNodes = Array.from(article.querySelectorAll('[data-testid="tweetText"]')).map(n => n.innerText.trim()).filter(Boolean);
                const text = textNodes.join('\n').trim();
                const timeEl = article.querySelector('time');
                const postUrl = timeEl?.parentElement?.getAttribute('href');
                const authorEl = article.querySelector('a[role="link"][data-testid="User-Name"]');
                const handleEl = authorEl?.querySelector('div > div span');
                const nameEl = authorEl?.querySelector('div > div:first-child span');
                const photoImgs = Array.from(article.querySelectorAll('[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]'));
                const videoEl = article.querySelector('video[poster]');
                const imageUrl = (photoImgs.length > 0 ? photoImgs[0].src : null)
                    || (videoEl ? videoEl.poster : null)
                    || null;
                const tweetLinks = Array.from(article.querySelectorAll('[data-testid="tweetText"] a[href]'));
                const externalUrl = tweetLinks
                    .map(a => a.getAttribute('href'))
                    .find(href => href && /^https?:\/\//.test(href) && !/(twitter|x)\.com/.test(href)) || null;
                return {
                    text,
                    postUrl: postUrl ? new URL(postUrl, location.origin).toString() : location.href,
                    authorName: nameEl?.textContent || '',
                    authorHandle: handleEl?.textContent || '',
                    ts: timeEl?.getAttribute('datetime') || null,
                    api: API,
                    imageUrl,
                    websiteUrl: externalUrl,
                };
            }
            catch (e) {
                return null;
            }
        }
        function attachButtons(root) {
            const articles = root.querySelectorAll('article');
            for (const art of articles) {
                if (art.__woPumpAttached)
                    continue;
                const actionRow = art.querySelector('[role="group"]');
                if (!actionRow)
                    continue;
                const peekData = extractPostData(art);
                const existingToken = peekData?.postUrl ? _recallLaunch(peekData.postUrl) : null;
                const btn = makeButton();
                if (existingToken) {
                    setLaunchButtonText(btn, 'View token');
                    btn.addEventListener('click', () => {
                        _ensurePumpUiStyles();
                        const overlay = document.createElement('div');
                        overlay.className = 'wo-pump-overlay';
                        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 18% 10%, rgba(255,255,255,0.24) 0%, transparent 20%),radial-gradient(circle at 78% 0%, rgba(187,192,198,0.12) 0%, transparent 18%),rgba(236,230,220,0.58);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)';
                        const card = document.createElement('div');
                        overlay.appendChild(card);
                        document.body.appendChild(overlay);
                        overlay.addEventListener('click', (e) => { if (e.target === overlay)
                            overlay.remove(); });
                        const postData = extractPostData(art);
                        _showPostDeploy(overlay, card, {
                            tokenAddress: existingToken.tokenAddress,
                            tokenUrl: existingToken.tokenUrl,
                            name: existingToken.name || '',
                            symbol: existingToken.symbol || '',
                            buyIn: existingToken.buyIn || 0,
                            tx: existingToken.tx || '',
                            description: existingToken.description || '',
                            avatar: existingToken.avatar || '',
                        }, postData?.api || API);
                    });
                }
                else {
                    btn.addEventListener('click', () => {
                        const data = extractPostData(art);
                        if (!data || !data.text) {
                            setLaunchButtonText(btn, 'No text');
                            setTimeout(() => setLaunchButtonText(btn, BTN_LABEL), 1200);
                            return;
                        }
                        showModal(data, ({ buyIn, close, setPreview, launchBtn, mintSecret, metadataUri, name, symbol, description, mayhemMode, tokenizedAgent, cashback, twitter, telegram, website, overlay, card }) => {
                            _safeSend({ type: 'wo-x-pumpfun-build', post: { ...data, buyIn, mintSecret, metadataUri, name, symbol, description, mayhemMode, tokenizedAgent, cashback, twitter, telegram, website } }, (resp) => {
                                launchBtn.disabled = false;
                                launchBtn.textContent = '🚀 Create coin';
                                if (!resp || !resp.ok) {
                                    setPreview(`<span style="color:#f85149">Launch failed: ${resp?.error || 'unknown error'}</span>`);
                                    return;
                                }
                                _rememberLaunch(data.postUrl, { tokenAddress: resp.tokenAddress, tokenUrl: resp.tokenUrl, name: resp.name, symbol: resp.symbol, description: resp.description || '', avatar: resp.avatar || '', buyIn: resp.buyIn || 0, tx: resp.tx || '' });
                                setLaunchButtonText(btn, 'View token');
                                btn.disabled = false;
                                btn.onclick = () => {
                                    _ensurePumpUiStyles();
                                    const ov = document.createElement('div');
                                    ov.className = 'wo-pump-overlay';
                                    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 18% 10%, rgba(255,255,255,0.24) 0%, transparent 20%),radial-gradient(circle at 78% 0%, rgba(187,192,198,0.12) 0%, transparent 18%),rgba(236,230,220,0.58);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)';
                                    const cd = document.createElement('div');
                                    ov.appendChild(cd);
                                    document.body.appendChild(ov);
                                    ov.addEventListener('click', (e) => { if (e.target === ov)
                                        ov.remove(); });
                                    _showPostDeploy(ov, cd, resp, data.api || API);
                                };
                                _showPostDeploy(overlay, card, resp, data.api || API);
                            });
                        });
                    });
                }
                actionRow.appendChild(btn);
                art.__woPumpAttached = true;
            }
        }
        const obs = new MutationObserver((muts) => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1)
                        attachButtons(node);
                }
            }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
        attachButtons(document);
    })();
    (function initContractDetection() {
        const host = location.hostname;
        if (!/^(x|twitter)\.com$/.test(host))
            return;
        const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
        const SKIP_ADDRS = new Set([
            'So11111111111111111111111111111111111111112',
            '11111111111111111111111111111111',
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
            'SysvarRent111111111111111111111111111111111',
            'SysvarC1ock11111111111111111111111111111111',
        ]);
        const _infoCache = {};
        const CACHE_TTL = 120_000;
        function formatMcap(n) {
            if (!n || n <= 0)
                return '—';
            if (n >= 1e9)
                return '$' + (n / 1e9).toFixed(2) + 'B';
            if (n >= 1e6)
                return '$' + (n / 1e6).toFixed(2) + 'M';
            if (n >= 1e3)
                return '$' + (n / 1e3).toFixed(1) + 'K';
            return '$' + n.toFixed(0);
        }
        function ensureBadgeStyles() {
            if (document.getElementById('wo-token-badge-styles'))
                return;
            const s = document.createElement('style');
            s.id = 'wo-token-badge-styles';
            s.textContent = `
        .wo-token-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px 3px 8px;
          margin: 2px 0;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(79,120,155,0.12), rgba(79,120,155,0.06));
          border: 1px solid rgba(79,120,155,0.2);
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.4;
          color: #1a1a1a;
          cursor: pointer;
          transition: all 0.15s ease;
          max-width: 100%;
          vertical-align: middle;
        }
        .wo-token-badge:hover {
          background: linear-gradient(135deg, rgba(79,120,155,0.2), rgba(79,120,155,0.1));
          border-color: rgba(79,120,155,0.35);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .wo-token-badge-name {
          font-weight: 700;
          color: #2c5282;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }
        .wo-token-badge-mcap {
          font-weight: 600;
          color: #38a169;
          white-space: nowrap;
        }
        .wo-token-badge-holders {
          font-weight: 600;
          white-space: nowrap;
        }
        .wo-token-badge-holders.warn { color: #e53e3e; }
        .wo-token-badge-holders.ok { color: #38a169; }
        .wo-token-badge-holders.mid { color: #d69e2e; }
        .wo-token-badge-loading {
          color: #888;
          font-style: italic;
          font-size: 11px;
        }
        .wo-token-badge-sep {
          color: rgba(0,0,0,0.2);
          font-size: 10px;
        }
        .wo-token-badge-addr {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 10px;
          color: #718096;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 80px;
        }
        .wo-token-tooltip {
          position: absolute;
          z-index: 999999;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          max-width: 340px;
          min-width: 240px;
          color: #1a1a1a;
          pointer-events: auto;
        }
        .wo-token-tooltip-title {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .wo-token-tooltip-row {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .wo-token-tooltip-row:last-child { border-bottom: none; }
        .wo-token-tooltip-label { color: #718096; font-size: 11px; }
        .wo-token-tooltip-val { font-weight: 600; font-size: 12px; }
        .wo-holder-bar {
          height: 4px;
          border-radius: 2px;
          background: #e2e8f0;
          margin-top: 2px;
          overflow: hidden;
        }
        .wo-holder-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
      `;
            document.head.appendChild(s);
        }
        function fetchTokenInfo(mint, cb) {
            const cached = _infoCache[mint];
            if (cached && Date.now() - cached.ts < CACHE_TTL)
                return cb(cached);
            _safeSend({ type: 'wo-token-info', mint, api: API }, (resp) => {
                if (resp && resp.ok) {
                    const entry = { info: resp.info, holders: resp.holders, ts: Date.now() };
                    _infoCache[mint] = entry;
                    cb(entry);
                }
                else {
                    cb(null);
                }
            });
        }
        function createBadge(mint) {
            const badge = document.createElement('span');
            badge.className = 'wo-token-badge';
            badge.dataset.woMint = mint;
            const short = mint.slice(0, 4) + '…' + mint.slice(-4);
            badge.innerHTML = `<span class="wo-token-badge-addr" title="${mint}">${short}</span><span class="wo-token-badge-loading">loading…</span>`;
            fetchTokenInfo(mint, (data) => {
                if (!data || !data.info) {
                    badge.innerHTML = `<span class="wo-token-badge-addr" title="${mint}">${short}</span><span class="wo-token-badge-sep">·</span><span style="color:#999;font-size:11px">unknown token</span>`;
                    return;
                }
                const info = data.info;
                const holders = data.holders;
                const name = info.symbol || info.name || short;
                const mcap = formatMcap(info.marketCap || info.fdv || 0);
                const top10 = holders?.top10Pct ?? 0;
                let holderClass = 'ok';
                if (top10 > 70)
                    holderClass = 'warn';
                else if (top10 > 40)
                    holderClass = 'mid';
                badge.innerHTML = [
                    `<span class="wo-token-badge-name" title="${info.name || ''} (${info.symbol || ''})">${name}</span>`,
                    `<span class="wo-token-badge-sep">·</span>`,
                    `<span class="wo-token-badge-mcap">${mcap}</span>`,
                    `<span class="wo-token-badge-sep">·</span>`,
                    `<span class="wo-token-badge-holders ${holderClass}" title="Top 10 holders own ${top10}% of supply">Top10: ${top10.toFixed(1)}%</span>`,
                ].join('');
            });
            let tooltip = null;
            badge.addEventListener('mouseenter', () => {
                if (tooltip)
                    return;
                const data = _infoCache[mint];
                if (!data || !data.info)
                    return;
                const info = data.info;
                const holders = data.holders;
                tooltip = document.createElement('div');
                tooltip.className = 'wo-token-tooltip';
                const top10 = holders?.top10Pct ?? 0;
                const holderRows = (holders?.holders || []).slice(0, 10).map((h, i) => {
                    const barColor = h.pct > 20 ? '#e53e3e' : h.pct > 10 ? '#d69e2e' : '#38a169';
                    const addrShort = h.address.slice(0, 4) + '…' + h.address.slice(-4);
                    return `<div class="wo-token-tooltip-row">
            <span class="wo-token-tooltip-label">#${i + 1} <span style="font-family:monospace;font-size:10px">${addrShort}</span></span>
            <span class="wo-token-tooltip-val">${h.pct.toFixed(2)}%</span>
          </div>
          <div class="wo-holder-bar"><div class="wo-holder-bar-fill" style="width:${Math.min(h.pct, 100)}%;background:${barColor}"></div></div>`;
                }).join('');
                tooltip.innerHTML = `
          <div class="wo-token-tooltip-title">
            ${info.logoURI ? `<img src="${info.logoURI}" style="width:20px;height:20px;border-radius:50%">` : ''}
            ${info.name || info.symbol || mint.slice(0, 8)}
            ${info.symbol ? `<span style="color:#718096;font-weight:400;font-size:12px">$${info.symbol}</span>` : ''}
          </div>
          <div class="wo-token-tooltip-row">
            <span class="wo-token-tooltip-label">Market Cap</span>
            <span class="wo-token-tooltip-val">${formatMcap(info.marketCap || info.fdv || 0)}</span>
          </div>
          <div class="wo-token-tooltip-row">
            <span class="wo-token-tooltip-label">Price</span>
            <span class="wo-token-tooltip-val">${info.price ? '$' + info.price.toPrecision(4) : '—'}</span>
          </div>
          <div class="wo-token-tooltip-row">
            <span class="wo-token-tooltip-label">Liquidity</span>
            <span class="wo-token-tooltip-val">${formatMcap(info.liquidity || 0)}</span>
          </div>
          <div class="wo-token-tooltip-row" style="border-bottom:none">
            <span class="wo-token-tooltip-label">Top 10 Holders</span>
            <span class="wo-token-tooltip-val" style="color:${top10 > 70 ? '#e53e3e' : top10 > 40 ? '#d69e2e' : '#38a169'}">${top10.toFixed(1)}%</span>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#718096;font-weight:600">Holders breakdown</div>
          ${holderRows || '<div style="color:#999;font-size:11px;padding:4px 0">No holder data</div>'}
          <div style="margin-top:8px;font-family:monospace;font-size:10px;color:#a0aec0;word-break:break-all;user-select:all">${mint}</div>
        `;
                document.body.appendChild(tooltip);
                const rect = badge.getBoundingClientRect();
                tooltip.style.left = Math.min(rect.left, window.innerWidth - 360) + 'px';
                tooltip.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
            });
            badge.addEventListener('mouseleave', () => {
                if (tooltip) {
                    tooltip.remove();
                    tooltip = null;
                }
            });
            badge.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(mint).then(() => {
                    const orig = badge.innerHTML;
                    badge.innerHTML = '<span style="color:#38a169;font-size:11px;font-weight:600">Copied!</span>';
                    setTimeout(() => { badge.innerHTML = orig; }, 1200);
                });
            });
            return badge;
        }
        function scanTextNodes(root) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    if (node.parentElement?.closest('.wo-token-badge, .wo-token-tooltip'))
                        return NodeFilter.FILTER_REJECT;
                    if (!node.parentElement?.closest('[data-testid="tweetText"]'))
                        return NodeFilter.FILTER_REJECT;
                    if (!SOL_ADDR_RE.test(node.textContent))
                        return NodeFilter.FILTER_REJECT;
                    SOL_ADDR_RE.lastIndex = 0;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            const textNodes = [];
            let n;
            while ((n = walker.nextNode()))
                textNodes.push(n);
            for (const textNode of textNodes) {
                const text = textNode.textContent || '';
                SOL_ADDR_RE.lastIndex = 0;
                const matches = [];
                let m;
                while ((m = SOL_ADDR_RE.exec(text))) {
                    if (m[0].length >= 32 && m[0].length <= 44 && !SKIP_ADDRS.has(m[0])) {
                        matches.push({ addr: m[0], index: m.index });
                    }
                }
                if (matches.length === 0)
                    continue;
                const frag = document.createDocumentFragment();
                let lastIdx = 0;
                for (const match of matches) {
                    if (match.index > lastIdx) {
                        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
                    }
                    ensureBadgeStyles();
                    frag.appendChild(createBadge(match.addr));
                    lastIdx = match.index + match.addr.length;
                }
                if (lastIdx < text.length) {
                    frag.appendChild(document.createTextNode(text.slice(lastIdx)));
                }
                textNode.parentNode.replaceChild(frag, textNode);
            }
        }
        function scanLinks(root) {
            const links = root.querySelectorAll('[data-testid="tweetText"] a[href]');
            for (const link of links) {
                if (link.__woAddrScanned)
                    continue;
                link.__woAddrScanned = true;
                const href = link.getAttribute('href') || '';
                const text = link.textContent || '';
                const combined = href + ' ' + text;
                SOL_ADDR_RE.lastIndex = 0;
                const m = SOL_ADDR_RE.exec(combined);
                if (m && m[0].length >= 32 && m[0].length <= 44 && !SKIP_ADDRS.has(m[0])) {
                    const addr = m[0];
                    if (!link.nextElementSibling?.classList?.contains('wo-token-badge')) {
                        ensureBadgeStyles();
                        const badge = createBadge(addr);
                        badge.style.marginLeft = '4px';
                        link.parentNode.insertBefore(badge, link.nextSibling);
                    }
                }
            }
        }
        function scanAll(root) {
            scanTextNodes(root);
            scanLinks(root);
            injectScanButtons(root);
        }
        const _imgScanned = new WeakSet();
        function ensureImageBadgeStyles() {
            if (document.getElementById('wo-img-badge-styles'))
                return;
            const s = document.createElement('style');
            s.id = 'wo-img-badge-styles';
            s.textContent = `

        .wo-scan-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 9999;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          padding: 5px 10px 5px 6px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255, 252, 246, 0.98), rgba(246, 240, 232, 0.98));
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(18, 18, 18, 0.1);
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #0d0d0d;
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
          white-space: nowrap;
          box-shadow: 0 8px 18px rgba(20, 20, 20, 0.12);
          user-select: none;
        }
        .wo-scan-btn-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, #15171a, #050505);
          color: #fff;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.08em;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .wo-scan-btn-label {
          line-height: 1;
        }
        [data-testid="tweetPhoto"]:hover .wo-scan-btn,
        [data-testid="card.layoutLarge.media"]:hover .wo-scan-btn,
        [data-testid="card.layoutSmall.media"]:hover .wo-scan-btn,
        .wo-scan-btn.wo-scan-btn-visible {
          opacity: 1;
          pointer-events: auto;
        }
        .wo-scan-btn:hover {
          background: linear-gradient(180deg, rgba(255,255,255,1), rgba(248, 243, 236, 1));
          border-color: rgba(18,18,18,0.16);
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(20, 20, 20, 0.16);
        }
        .wo-scan-btn:active { transform: translateY(0); }
        .wo-scan-btn-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(17, 17, 17, 0.18);
          border-top-color: #111111;
          border-radius: 50%;
          animation: wo-spin 0.7s linear infinite;
        }
        @keyframes wo-spin { to { transform: rotate(360deg); } }

        .wo-inline-scan-result {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }

        .wo-token-card {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          margin: 0;
          padding: 14px 16px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255, 252, 246, 0.98), rgba(247, 242, 235, 0.98));
          border: 1px solid rgba(18, 18, 18, 0.1);
          box-shadow: 0 16px 34px rgba(20, 20, 20, 0.11);
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          max-width: 100%;
          box-sizing: border-box;
        }
        .wo-token-card-img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(18,18,18,0.1);
          background: rgba(255,255,255,0.88);
          box-shadow: 0 6px 14px rgba(20,20,20,0.08);
        }
        .wo-token-card-img-placeholder {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          flex-shrink: 0;
          background: linear-gradient(180deg, #15171a 0%, #050505 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          border: 1px solid rgba(18,18,18,0.12);
          letter-spacing: 0.08em;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
        }
        .wo-token-card-body {
          min-width: 0;
          display: grid;
          gap: 6px;
        }
        .wo-token-card-kicker {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #7d858d;
        }
        .wo-token-card-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .wo-token-card-symbol {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.06);
          color: #111111;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        .wo-token-card-body {
          min-width: 0;
        }
        .wo-token-card-name {
          font-size: 15px;
          font-weight: 700;
          color: #0d0d0d;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .wo-token-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .wo-token-card-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid rgba(18,18,18,0.08);
          background: rgba(255,255,255,0.72);
          font-size: 10px;
          font-weight: 700;
          color: #4d5359;
        }
        .wo-token-card-mc {
          color: #127548;
        }
        .wo-token-card-address-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .wo-token-card-address-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.06);
          color: #4d5359;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }
        .wo-token-card-addr {
          font-size: 11px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: #6a7078;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }
        .wo-token-card-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }
        .wo-token-card-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 108px;
          padding: 8px 12px;
          border-radius: 12px;
          background: linear-gradient(180deg, #15171a 0%, #050505 100%);
          border: 1px solid rgba(10,10,10,0.9);
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          white-space: nowrap;
          box-shadow: 0 10px 20px rgba(20,20,20,0.14);
        }
        .wo-token-card-link:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(20,20,20,0.18);
        }
        .wo-token-card-copy {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 108px;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.66);
          border: 1px solid rgba(18, 18, 18, 0.1);
          font-size: 11px;
          font-weight: 700;
          color: #5b636b;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
          white-space: nowrap;
          font-family: inherit;
        }
        .wo-token-card-copy:hover {
          background: rgba(255,255,255,0.94);
          color: #111111;
          transform: translateY(-1px);
        }
        .wo-token-card-not-found {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 12px 14px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,252,246,0.98), rgba(247,242,235,0.98));
          border: 1px solid rgba(18,18,18,0.1);
          font-size: 12px;
          font-weight: 600;
          color: #5b636b;
          font-family: Inter, -apple-system, sans-serif;
          box-shadow: 0 12px 24px rgba(20,20,20,0.08);
        }
      `;
            document.head.appendChild(s);
        }
        function createTokenCard(mint, tokenData) {
            const info = tokenData && tokenData.info ? tokenData.info : null;
            const name = info ? (info.name || info.symbol || mint.slice(0, 8)) : mint.slice(0, 8);
            const symbol = info ? (info.symbol || '') : '';
            const mc = info ? formatMcap(info.marketCap || info.fdv || 0) : '—';
            const logoUrl = info ? (info.image || info.imageUri || info.logo || '') : '';
            const short = mint.slice(0, 6) + '…' + mint.slice(-6);
            const initial = (symbol || name || mint).trim().slice(0, 1).toUpperCase();
            const card = document.createElement('div');
            card.className = 'wo-token-card';
            const logoWrap = document.createElement('div');
            if (logoUrl) {
                const img = document.createElement('img');
                img.className = 'wo-token-card-img';
                img.src = logoUrl;
                img.alt = symbol;
                img.onerror = () => { img.replaceWith(makePlaceholder()); };
                logoWrap.appendChild(img);
            }
            else {
                logoWrap.appendChild(makePlaceholder());
            }
            card.appendChild(logoWrap);
            function makePlaceholder() {
                const el = document.createElement('div');
                el.className = 'wo-token-card-img-placeholder';
                el.textContent = initial || 'T';
                return el;
            }
            const body = document.createElement('div');
            body.className = 'wo-token-card-body';
            const kicker = document.createElement('div');
            kicker.className = 'wo-token-card-kicker';
            kicker.textContent = 'WhiteOwl scan result';
            body.appendChild(kicker);
            const titleRow = document.createElement('div');
            titleRow.className = 'wo-token-card-title-row';
            const nameEl = document.createElement('div');
            nameEl.className = 'wo-token-card-name';
            nameEl.textContent = name;
            titleRow.appendChild(nameEl);
            if (symbol) {
                const symbolEl = document.createElement('span');
                symbolEl.className = 'wo-token-card-symbol';
                symbolEl.textContent = '$' + symbol;
                titleRow.appendChild(symbolEl);
            }
            body.appendChild(titleRow);
            const meta = document.createElement('div');
            meta.className = 'wo-token-card-meta';
            if (mc && mc !== '—') {
                const mcEl = document.createElement('span');
                mcEl.className = 'wo-token-card-chip wo-token-card-mc';
                mcEl.textContent = 'MC ' + mc;
                meta.appendChild(mcEl);
            }
            const sourceEl = document.createElement('span');
            sourceEl.className = 'wo-token-card-chip';
            sourceEl.textContent = 'pump.fun';
            meta.appendChild(sourceEl);
            body.appendChild(meta);
            const addressRow = document.createElement('div');
            addressRow.className = 'wo-token-card-address-row';
            const addressLabel = document.createElement('span');
            addressLabel.className = 'wo-token-card-address-label';
            addressLabel.textContent = 'CA';
            addressRow.appendChild(addressLabel);
            const addrEl = document.createElement('span');
            addrEl.className = 'wo-token-card-addr';
            addrEl.textContent = short;
            addressRow.appendChild(addrEl);
            body.appendChild(addressRow);
            card.appendChild(body);
            const actions = document.createElement('div');
            actions.className = 'wo-token-card-actions';
            const pumpLink = document.createElement('a');
            pumpLink.className = 'wo-token-card-link';
            pumpLink.href = 'https://pump.fun/' + mint;
            pumpLink.target = '_blank';
            pumpLink.rel = 'noopener noreferrer';
            pumpLink.textContent = 'Open pump.fun';
            pumpLink.addEventListener('click', () => {
                _safeSend({ type: 'wo-mint-detected', mint, pageInfo: { name, hostname: 'pump.fun' } });
            });
            actions.appendChild(pumpLink);
            const copyBtn = document.createElement('button');
            copyBtn.className = 'wo-token-card-copy';
            copyBtn.textContent = 'Copy CA';
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                navigator.clipboard.writeText(mint).then(() => {
                    copyBtn.textContent = 'Copied';
                    setTimeout(() => { copyBtn.textContent = 'Copy CA'; }, 1500);
                });
            });
            actions.appendChild(copyBtn);
            card.appendChild(actions);
            return card;
        }
        function _isTweetMediaSrc(src) {
            if (!src || !src.includes('pbs.twimg.com'))
                return false;
            if (src.includes('/profile_images/') || src.includes('/profile_banners/'))
                return false;
            return src.includes('/media/') || src.includes('ext_tw_video_thumb') || src.includes('tweet_video_thumb');
        }
        function ensureScanResultMount(insertTarget) {
            if (!insertTarget || !insertTarget.parentNode)
                return null;
            let mount = insertTarget._woScanResultMount;
            if (!mount || !mount.isConnected) {
                mount = document.createElement('div');
                mount.className = 'wo-inline-scan-result';
                insertTarget.parentNode.insertBefore(mount, insertTarget.nextSibling);
                insertTarget._woScanResultMount = mount;
            }
            mount.innerHTML = '';
            return mount;
        }
        const _imgBtnAdded = new WeakSet();
        function injectScanButton(container) {
            if (_imgBtnAdded.has(container))
                return;
            _imgBtnAdded.add(container);
            ensureImageBadgeStyles();
            const existingPos = getComputedStyle(container).position;
            if (existingPos === 'static')
                container.style.position = 'relative';
            const btn = document.createElement('div');
            btn.className = 'wo-scan-btn';
            btn.innerHTML = '<span class="wo-scan-btn-icon">CA</span><span class="wo-scan-btn-label">Scan CA</span>';
            container.appendChild(btn);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (btn.dataset.scanning)
                    return;
                const img = container.querySelector('img[src*="pbs.twimg.com"]');
                if (!img)
                    return;
                const currentSrc = img.src || '';
                if (!currentSrc.includes('pbs.twimg.com'))
                    return;
                btn.dataset.scanning = '1';
                btn.innerHTML = '<span class="wo-scan-btn-spinner"></span><span class="wo-scan-btn-label">Scanning</span>';
                const highResSrc = currentSrc.replace(/\?.*$/, '') + '?format=jpg&name=large';
                function extractMintsFromTweet() {
                    const article = container.closest('article') || container.closest('[data-testid="tweet"]');
                    if (!article)
                        return [];
                    const textContent = article.innerText || '';
                    const altTexts = Array.from(article.querySelectorAll('img[alt]'))
                        .map(img => img.alt).filter(Boolean).join(' ');
                    const combined = textContent + ' ' + altTexts;
                    if (!combined.trim())
                        return [];
                    const re = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
                    const found = [];
                    let m;
                    while ((m = re.exec(combined))) {
                        if (!SKIP_ADDRS.has(m[0]))
                            found.push(m[0]);
                    }
                    return [...new Set(found)];
                }
                function showMintCards(mints, insertTarget) {
                    const resultMount = ensureScanResultMount(insertTarget);
                    if (!resultMount)
                        return;
                    for (const mint of mints.slice(0, 3)) {
                        if (SKIP_ADDRS.has(mint))
                            continue;
                        const card = createTokenCard(mint, null);
                        resultMount.appendChild(card);
                        fetchTokenInfo(mint, (data) => {
                            const enriched = createTokenCard(mint, data);
                            card.replaceWith(enriched);
                        });
                        _safeSend({ type: 'wo-mint-detected', mint, pageInfo: getPageInfo() });
                    }
                }
                const textMints = extractMintsFromTweet();
                if (textMints.length) {
                    btn.dataset.scanning = '';
                    btn.innerHTML = '<span class="wo-scan-btn-icon">CA</span><span class="wo-scan-btn-label">Scan CA</span>';
                    const article = container.closest('article') || container.closest('[data-testid="tweet"]');
                    showMintCards(textMints, article || container.parentElement);
                    return;
                }
                _safeSend({ type: 'wo-image-scan', imageUrl: highResSrc, api: API }, (resp) => {
                    btn.dataset.scanning = '';
                    btn.innerHTML = '<span class="wo-scan-btn-icon">CA</span><span class="wo-scan-btn-label">Scan CA</span>';
                    const article = container.closest('article') || container.closest('[data-testid="tweet"]');
                    const insertTarget = article || container.parentElement;
                    const mints = (resp && resp.ok && resp.mints) ? resp.mints.filter(m => !SKIP_ADDRS.has(m)) : [];
                    if (mints.length) {
                        showMintCards(mints, insertTarget);
                        return;
                    }
                    const resultMount = ensureScanResultMount(insertTarget);
                    if (!resultMount)
                        return;
                    const notFound = document.createElement('div');
                    notFound.className = 'wo-token-card-not-found';
                    notFound.textContent = 'No contract address found';
                    resultMount.appendChild(notFound);
                    setTimeout(() => notFound.remove(), 4000);
                });
            });
        }
        function injectScanButtons(root) {
            const searchRoot = (root && root.nodeType === 1) ? root : document;
            const containers = Array.from(searchRoot.querySelectorAll('[data-testid="tweetPhoto"],' +
                '[data-testid="card.layoutLarge.media"],' +
                '[data-testid="card.layoutSmall.media"]'));
            for (const container of containers) {
                const img = container.querySelector('img[src*="pbs.twimg.com/media"], img[src*="ext_tw_video_thumb"], img[src*="tweet_video_thumb"]');
                if (!img)
                    continue;
                injectScanButton(container);
            }
        }
        const contractObs = new MutationObserver((muts) => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1)
                        continue;
                    scanAll(node);
                    injectScanButtons(node);
                }
            }
        });
        contractObs.observe(document.documentElement, { childList: true, subtree: true });
        setInterval(() => injectScanButtons(document), 2000);
        setTimeout(() => injectScanButtons(document), 1000);
    })();
    if (_alive())
        try {
            chrome.runtime.onMessage.addListener((msg) => {
                if (msg.type === 'wo-provider-res' && msg.id != null) {
                    if (_providerPending.has(msg.id)) {
                        _providerPending.delete(msg.id);
                        window.postMessage({ type: 'wo-provider-res', id: msg.id, result: msg.result, error: msg.error }, '*');
                    }
                }
                if (msg.type === 'wo-use-original-wallet' && msg.walletName) {
                    window.postMessage({ type: 'wo-use-original-wallet', walletName: msg.walletName }, '*');
                }
                if (msg.type === 'wo-wallet-disconnected') {
                    window.postMessage({ type: 'wo-wallet-disconnected', origin: msg.origin }, '*');
                }
                if (msg.type === 'wo-scan-page-drainer') {
                    const result = scanPageForDrainer();
                    _safeSend({ type: 'wo-scan-page-drainer-result', result });
                }
                if (msg.type === 'wo-collect-page-data') {
                    const pageData = collectPageDataForAI();
                    _safeSend({ type: 'wo-collect-page-data-result', pageData });
                }
            });
        }
        catch (e) { }
    function scanPageForDrainer() {
        const signals = [];
        let riskScore = 0;
        const url = location.href;
        const hostname = location.hostname;
        const fullUrl = url.toLowerCase();
        const trustedDomains = [
            'magiceden.io', 'www.magiceden.io', 'magiceden.com',
            'phantom.app', 'phantom.com',
            'solflare.com',
            'jup.ag', 'jupiter.exchange',
            'raydium.io',
            'backpack.app', 'backpack.exchange',
            'tensor.trade', 'www.tensor.trade',
            'jito.network', 'jito.wtf',
            'helius.dev', 'helius.xyz',
            'metaplex.com',
            'orca.so',
            'drift.trade',
            'marinade.finance',
            'marginfi.com',
            'kamino.finance',
            'pyth.network',
            'wormhole.com',
            'birdeye.so',
            'dexscreener.com',
            'pump.fun',
            'axiom.trade',
            'bullx.io',
            'photon-sol.tinyastro.io',
            'defined.fi',
            'uniswap.org', 'app.uniswap.org',
            'opensea.io',
            'blur.io',
            'lido.fi',
            'metamask.io',
            'eigenlayer.xyz',
            'aave.com',
            'curve.fi',
            '1inch.io',
            'etherscan.io',
            'solscan.io',
            'solana.fm',
            'binance.com', 'coinbase.com', 'kraken.com', 'okx.com', 'bybit.com',
        ];
        const isTrustedDomain = trustedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
        const domainPatterns = [
            { re: /airdrop|claim|reward|bonus|free-?mint|giveaway/i, msg: 'Domain contains bait keyword', score: 15, skipIfTrusted: true },
            { re: /backpack|phantom|solflare|jupiter|raydium|marinade|tensor|jito|helius|metaplex|magic-?eden|orca|drift|mango|serum/i, msg: 'Domain impersonates known Solana project', score: 30, skipIfTrusted: true },
            { re: /metamask|uniswap|opensea|blur|lido|eigen/i, msg: 'Domain impersonates known crypto project', score: 25, skipIfTrusted: true },
            { re: /\.vercel\.app|\.netlify\.app|\.pages\.dev|\.web\.app|\.firebaseapp\.com|\.surge\.sh|\.onrender\.com|\.railway\.app/i, msg: 'Hosted on free deployment platform', score: 8 },
            { re: /\.xyz$|\.ru$|\.tk$|\.ml$|\.ga$|\.cf$|\.gq$|\.top$|\.buzz$|\.icu$/i, msg: 'Suspicious TLD', score: 5, skipIfTrusted: true },
        ];
        for (const dp of domainPatterns) {
            if (isTrustedDomain && dp.skipIfTrusted)
                continue;
            if (dp.re.test(hostname) || dp.re.test(fullUrl)) {
                signals.push({ level: dp.score >= 20 ? 'danger' : 'warning', message: dp.msg + ': ' + hostname });
                riskScore += dp.score;
            }
        }
        if (!isTrustedDomain && /ph[a@]nt[o0][mn]|s[o0]l[a@]n[a@]|jup[i1]t[e3]r|r[a@]yd[i1]um|b[a@]ckp[a@]ck/i.test(hostname)) {
            signals.push({ level: 'danger', message: 'Possible typosquat/homograph domain: ' + hostname });
            riskScore += 30;
        }
        if (/\.vercel\.app|\.netlify\.app|\.pages\.dev/i.test(hostname) && /airdrop|claim|reward|drop|mint|bonus/i.test(fullUrl)) {
            signals.push({ level: 'danger', message: 'Bait keyword + free hosting combo (classic drainer)' });
            riskScore += 20;
        }
        const iframes = document.querySelectorAll('iframe');
        const crossOriginIframes = [];
        const hiddenIframes = [];
        for (const iframe of iframes) {
            const src = iframe.src || iframe.getAttribute('data-src') || '';
            if (src) {
                try {
                    const iframeHost = new URL(src, location.href).hostname;
                    if (iframeHost !== hostname && iframeHost !== 'localhost') {
                        const isTrustedIframe = isTrustedDomain && (iframeHost.endsWith('.' + hostname.replace(/^www\./, '')) ||
                            hostname.replace(/^www\./, '').endsWith('.' + iframeHost.replace(/^www\./, '')) ||
                            /google\.com|gstatic\.com|googleapis\.com|googletagmanager\.com|doubleclick\.net|facebook\.com|twitter\.com|intercom\.io|segment\.io|sentry\.io|datadoghq\.com|amplitude\.com|analytics|cdn\.|static\.|assets\./i.test(iframeHost));
                        if (!isTrustedIframe) {
                            crossOriginIframes.push(iframeHost);
                        }
                    }
                }
                catch { }
            }
            const style = window.getComputedStyle(iframe);
            const w = iframe.offsetWidth || parseInt(style.width) || 0;
            const h = iframe.offsetHeight || parseInt(style.height) || 0;
            if (w <= 1 || h <= 1 || style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                hiddenIframes.push(src || '(no src)');
            }
        }
        if (crossOriginIframes.length > 0) {
            signals.push({ level: 'warning', message: 'Cross-origin iframes: ' + crossOriginIframes.join(', ') });
            riskScore += isTrustedDomain ? 2 : 8;
            const drainerHosts = /vercel\.app|netlify\.app|pages\.dev|web\.app|ipfs\.io|fleek\.co|arweave\.net|cloudflare-ipfs/i;
            for (const h of crossOriginIframes) {
                if (drainerHosts.test(h)) {
                    signals.push({ level: 'danger', message: 'Iframe to free hosting (drainer layering): ' + h });
                    riskScore += 15;
                }
            }
        }
        if (hiddenIframes.length > 0) {
            if (isTrustedDomain) {
                signals.push({ level: 'info', message: 'Hidden iframes detected (' + hiddenIframes.length + ') — normal for this site' });
                riskScore += 2;
            }
            else {
                signals.push({ level: 'danger', message: 'Hidden/invisible iframes detected (' + hiddenIframes.length + ')' });
                riskScore += 20;
            }
        }
        const scripts = document.querySelectorAll('script:not([src])');
        let inlineCode = '';
        for (const s of scripts) {
            inlineCode += (s.textContent || '') + '\n';
        }
        const externalScripts = [];
        document.querySelectorAll('script[src]').forEach(s => {
            externalScripts.push(s.src || s.getAttribute('src') || '');
        });
        const drainerSignatures = [
            { re: /angel[\s_-]?drainer|inferno[\s_-]?drainer|pink[\s_-]?drainer|venom[\s_-]?drainer|medusa[\s_-]?drainer|monkey[\s_-]?drainer|rainbow[\s_-]?drainer|atomic[\s_-]?drainer|ice[\s_-]?phishing/i, msg: '🔴 Known drainer kit name in code!', score: 50 },
            { re: /drainer|drain[_\s]?wallet|drain[_\s]?all[_\s]?tokens/i, msg: '🔴 "drainer" keyword in code', score: 40 },
            { re: /setAuthority|SetAuthority|createSetAuthorityInstruction/i, msg: 'SetAuthority instruction (token takeover)', score: 30 },
            { re: /AuthorityType\s*\.\s*(MintTokens|FreezeAccount|AccountOwner|CloseAccount)/i, msg: 'Authority type change detected', score: 25 },
            { re: /createApproveInstruction|createApproveCheckedInstruction|approve\s*\(\s*[^)]*TOKEN_PROGRAM/i, msg: 'Token Approve instruction (allows draining)', score: 25 },
            { re: /createTransferCheckedInstruction|createTransferInstruction/i, msg: 'Creates transfer instructions', score: 8 },
            { re: /createCloseAccountInstruction/i, msg: 'CloseAccount instruction (empties token account)', score: 15 },
            { re: /signAllTransactions/i, msg: 'Uses signAllTransactions (batch signing)', score: 10 },
            { re: /VersionedTransaction\.deserialize|Transaction\.from\(/i, msg: 'Deserializes external transaction (blind signing)', score: 20 },
            { re: /serialize\([^)]*requireAllSignatures\s*:\s*false/i, msg: 'Partial signature mode', score: 15 },
            { re: /Buffer\.from\(\s*["'][A-Za-z0-9+/]{60,}={0,2}["']\s*,\s*["']base64["']\)/i, msg: 'Large Base64 payload (hidden instruction)', score: 15 },
            { re: /eval\s*\(|Function\s*\(\s*["']return/i, msg: 'Dynamic code execution (eval/Function)', score: 20 },
            { re: /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}|\\u[0-9a-f]{4}\\u[0-9a-f]{4}/i, msg: 'Hex/unicode obfuscation', score: 10 },
            { re: /String\.fromCharCode\s*\(\s*\d+\s*(,\s*\d+\s*){5,}\)/i, msg: 'fromCharCode obfuscation', score: 15 },
            { re: /atob\s*\(\s*["'][A-Za-z0-9+/]{40,}/i, msg: 'atob() with large encoded payload', score: 12 },
            { re: /simulateTransaction[^;]*catch\s*\([^)]*\)\s*\{[^}]*\}/i, msg: 'Simulation error suppression', score: 20 },
            { re: /skipPreflight\s*:\s*true/i, msg: 'Bypasses preflight simulation', score: 15 },
            { re: /devtools|isDevToolsOpen/i, msg: 'DevTools detection (anti-analysis)', score: 15 },
            { re: /debugger\s*;|anti[_-]?debug|console\s*\.\s*clear\s*\(\)/i, msg: 'Anti-debugging code', score: 12 },
            { re: /navigator\.clipboard\.readText/i, msg: 'Reads clipboard (seed theft)', score: 25 },
            { re: /webhook\.site|discord\.com\/api\/webhooks|telegram\.org\/bot/i, msg: 'Exfiltration webhook URL', score: 30 },
            { re: /privateKey|secretKey|mnemonic|seed\s*phrase/i, msg: 'References private keys/seed phrases', score: 20 },
            { re: /window\.ethereum.*window\.solana|window\.solana.*window\.ethereum/i, msg: 'Multi-chain targeting (EVM + Solana)', score: 10 },
            { re: /SystemProgram\.transfer|SystemInstruction\.transfer/i, msg: 'SOL transfer instruction', score: 3 },
            { re: /window\.solana\s*=|window\.phantom\s*=|window\.backpack\s*=|window\.solflare\s*=/i, msg: '🔴 Overrides wallet adapter object!', score: 40 },
            { re: /Proxy\s*\(\s*window\.solana|Proxy\s*\(\s*window\.phantom/i, msg: '🔴 Proxies wallet adapter (intercept)', score: 45 },
            { re: /navigator\.serviceWorker\.register/i, msg: 'Registers Service Worker (persistence)', score: 15 },
            { re: /caches\.open|CacheStorage/i, msg: 'Uses Cache API (possible persistence)', score: 5 },
            { re: /fetch\s*\(\s*["']https?:\/\/[^"']*(?:webhook|exfil|collect|steal|log|track)/i, msg: 'Fetch to suspicious exfil-like endpoint', score: 20 },
            { re: /advanceNonce|DurableNonce|createAdvanceNonceInstruction/i, msg: 'Uses durable nonce (delayed execution)', score: 10 },
            { re: /ComputeBudgetProgram\.setComputeUnitPrice|setComputeUnitLimit/i, msg: 'Sets priority fee (may rush malicious tx)', score: 5 },
            { re: /AddressLookupTableAccount|getAddressLookupTable/i, msg: 'Uses Address Lookup Tables (can hide destinations)', score: 8 },
        ];
        for (const sig of drainerSignatures) {
            if (sig.re.test(inlineCode)) {
                signals.push({ level: sig.score >= 20 ? 'danger' : sig.score >= 10 ? 'warning' : 'info', message: sig.msg });
                riskScore += sig.score;
            }
        }
        for (const s of scripts) {
            const txt = (s.textContent || '').trim();
            if (txt.length > 5000) {
                const lines = txt.split('\n');
                const avgLen = txt.length / Math.max(lines.length, 1);
                if (avgLen > 2000) {
                    signals.push({ level: 'warning', message: 'Heavily obfuscated script (' + Math.round(txt.length / 1024) + 'KB, ' + lines.length + ' lines)' });
                    riskScore += 12;
                    break;
                }
            }
        }
        const suspiciousScriptHosts = /unpkg\.com|pastebin\.com|paste\.ee|raw\.githubusercontent\.com|ipfs\.io|fleek\.co|arweave\.net|cloudflare-ipfs|dweb\.link|w3s\.link/i;
        for (const src of externalScripts) {
            if (suspiciousScriptHosts.test(src)) {
                signals.push({ level: 'warning', message: 'Script from suspicious source: ' + src.substring(0, 80) });
                riskScore += 10;
            }
        }
        const bodyText = (document.body?.innerText || '').substring(0, 8000).toLowerCase();
        const phishingPhrases = [
            { re: /claim\s+(?:your\s+)?(?:airdrop|tokens?|reward|bonus|nft)/i, msg: 'Phishing: "claim airdrop/tokens"', score: 15 },
            { re: /connect\s+(?:your\s+)?wallet\s+to\s+(?:claim|receive|get|verify|check)/i, msg: 'Phishing: "connect wallet to claim"', score: 20 },
            { re: /(?:limited|hurry|expires?\s+(?:in|soon)|last\s+chance|act\s+now|don.?t\s+miss)/i, msg: 'Urgency manipulation', score: 10 },
            { re: /eligible\s+for\s+(?:airdrop|claim|reward|distribution|allocation)/i, msg: 'Fake eligibility bait', score: 15 },
            { re: /verify\s+(?:your\s+)?wallet|wallet\s+verification/i, msg: '"Verify wallet" phishing', score: 20 },
            { re: /enter\s+(?:your\s+)?(?:seed|recovery|mnemonic|secret)\s+phrase/i, msg: '🔴 Requests seed phrase!', score: 50 },
            { re: /synchronize?\s+(?:your\s+)?wallet/i, msg: '"Synchronize wallet" phishing', score: 20 },
            { re: /check\s+(?:your\s+)?eligibility|check\s+allocation/i, msg: 'Eligibility check bait', score: 10 },
            { re: /retroactive\s+(?:airdrop|reward|distribution)/i, msg: 'Fake retroactive airdrop', score: 12 },
            { re: /restore\s+(?:your\s+)?wallet|import\s+(?:your\s+)?wallet/i, msg: '"Restore/import wallet" phishing', score: 20 },
            { re: /connect\s+(?:to\s+)?(?:receive|unlock|access)\s+(?:your|the)/i, msg: '"Connect to unlock" phishing', score: 15 },
            { re: /(?:congratulations?|congrats).*(?:won|selected|eligible|qualified)/i, msg: 'Fake congratulations bait', score: 18 },
        ];
        for (const pp of phishingPhrases) {
            if (pp.re.test(bodyText)) {
                signals.push({ level: pp.score >= 20 ? 'danger' : 'warning', message: pp.msg });
                riskScore += pp.score;
            }
        }
        const allButtons = document.querySelectorAll('button, [role="button"], a[href="#"], a[href="javascript"]');
        let walletConnectButtons = 0;
        for (const btn of allButtons) {
            const txt = (btn.textContent || '').toLowerCase().trim();
            if (/connect\s*wallet|claim\s*(?:now|airdrop|tokens)|get\s*(?:started|tokens)/i.test(txt))
                walletConnectButtons++;
        }
        if (walletConnectButtons > 3) {
            signals.push({ level: 'warning', message: 'Multiple "connect wallet" buttons (' + walletConnectButtons + ')' });
            riskScore += 8;
        }
        const inputs = document.querySelectorAll('input[type="text"], input[type="password"], textarea');
        for (const inp of inputs) {
            const ph = (inp.placeholder || '').toLowerCase() + ' ' + (inp.name || '').toLowerCase();
            if (/seed|mnemonic|private.?key|secret.?key|recovery|12.?words?|24.?words?/i.test(ph)) {
                signals.push({ level: 'danger', message: '🔴 Input field for seed/private key!' });
                riskScore += 40;
                break;
            }
        }
        if (location.protocol === 'http:' && hostname !== 'localhost' && !/^127\.|^192\.168\.|^10\./.test(hostname)) {
            signals.push({ level: 'warning', message: 'Site uses HTTP (not HTTPS)' });
            riskScore += 10;
        }
        const socialLinks = document.querySelectorAll('a[href*="twitter"], a[href*="discord"], a[href*="telegram"], a[href*="x.com"]');
        let fakeSocials = 0;
        for (const link of socialLinks) {
            const href = link.getAttribute('href') || '';
            if (href === '#' || href === '' || href === 'javascript:void(0)')
                fakeSocials++;
        }
        if (fakeSocials > 0) {
            signals.push({ level: 'warning', message: 'Fake social links (' + fakeSocials + ' broken)' });
            riskScore += 8;
        }
        riskScore = Math.min(riskScore, 100);
        const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';
        return { riskScore, riskLevel, signals, url: location.href, hostname, crossOriginIframes, scriptsCount: externalScripts.length + scripts.length };
    }
    function collectPageDataForAI() {
        const scripts = document.querySelectorAll('script:not([src])');
        let inlineCode = '';
        for (const s of scripts) {
            const txt = (s.textContent || '').trim();
            if (txt.length > 0 && txt.length < 100000)
                inlineCode += txt.substring(0, 30000) + '\n---SCRIPT_BOUNDARY---\n';
        }
        const externalScripts = [];
        document.querySelectorAll('script[src]').forEach(s => {
            externalScripts.push(s.src || s.getAttribute('src') || '');
        });
        const iframes = [];
        document.querySelectorAll('iframe').forEach(f => {
            const src = f.src || f.getAttribute('data-src') || '';
            const style = window.getComputedStyle(f);
            iframes.push({
                src,
                width: f.offsetWidth,
                height: f.offsetHeight,
                hidden: style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0 || f.offsetWidth <= 1 || f.offsetHeight <= 1,
                sandbox: f.getAttribute('sandbox') || '',
                allow: f.getAttribute('allow') || '',
            });
        });
        const metaTags = {};
        document.querySelectorAll('meta[property], meta[name]').forEach(m => {
            const key = m.getAttribute('property') || m.getAttribute('name') || '';
            if (key && m.content)
                metaTags[key] = m.content.substring(0, 300);
        });
        const links = [];
        document.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = (a.textContent || '').trim().substring(0, 80);
            if (href === '#' || href === '' || href.startsWith('javascript:void') || href === 'javascript:;') {
                links.push({ href: '(fake/void)', text, broken: true });
            }
            else if (href.startsWith('http') && text) {
                try {
                    const h = new URL(href).hostname;
                    if (h !== location.hostname)
                        links.push({ href, text, external: true });
                    else
                        links.push({ href, text });
                }
                catch { }
            }
            else if (text) {
                links.push({ href, text });
            }
        });
        const ctas = [];
        document.querySelectorAll('button, [role="button"], a.btn, a.button, input[type="submit"]').forEach(b => {
            const text = (b.textContent || b.value || '').trim().substring(0, 100);
            if (text)
                ctas.push(text);
        });
        const inputs = [];
        document.querySelectorAll('input, textarea').forEach(inp => {
            const type = inp.type || 'text';
            const name = inp.name || '';
            const ph = inp.placeholder || '';
            if (name || ph)
                inputs.push({ type, name: name.substring(0, 50), placeholder: ph.substring(0, 80) });
        });
        let storageKeys = [];
        try {
            storageKeys = Object.keys(localStorage).slice(0, 30);
        }
        catch { }
        const walletPatterns = [];
        const fullInline = inlineCode;
        const patternChecks = [
            { re: /signTransaction|signAllTransactions|signAndSendTransaction/g, label: 'Transaction signing API calls' },
            { re: /setAuthority|createSetAuthorityInstruction|AuthorityType/g, label: 'Token authority change instructions' },
            { re: /createApproveInstruction|approve\s*\(/g, label: 'Token approval/delegation' },
            { re: /createCloseAccountInstruction|closeAccount/g, label: 'Close account instructions' },
            { re: /VersionedTransaction\.deserialize|Transaction\.from\b/g, label: 'Deserializing externally-built transactions' },
            { re: /eval\s*\(|Function\s*\(|fromCharCode/g, label: 'Dynamic code execution (eval/Function/fromCharCode)' },
            { re: /atob\s*\(\s*['"][A-Za-z0-9+\/=]{50,}/g, label: 'Large base64 payload decoding' },
            { re: /webhook\.site|discord\.com\/api\/webhooks|api\.telegram\.org\/bot/g, label: 'Exfiltration webhook URLs' },
            { re: /clipboard\.readText|navigator\.clipboard/g, label: 'Clipboard access' },
            { re: /debugger\b|console\.clear\(\)|devtools/gi, label: 'Anti-debugging techniques' },
            { re: /seed.?phrase|private.?key|mnemonic|secret.?recovery/gi, label: 'Seed phrase / private key references' },
            { re: /skipPreflight\s*:\s*true/g, label: 'skipPreflight:true (simulation bypass)' },
            { re: /solana-wallet-adapter|@solana\/wallet-adapter/g, label: 'Standard Solana wallet adapter (legitimate)' },
            { re: /phantom|solflare|backpack|WalletMultiButton/gi, label: 'Known wallet provider references' },
            { re: /createTransferInstruction|SystemProgram\.transfer/g, label: 'SOL/token transfer instructions' },
            { re: /getProgramAccounts|getTokenAccountsByOwner/g, label: 'Token balance enumeration' },
            { re: /window\.solana|window\.phantom|window\.backpack/g, label: 'Global wallet object access' },
            { re: /createLookupTable|AddressLookupTableProgram/g, label: 'Address lookup table usage' },
            { re: /ComputeBudgetProgram|setComputeUnitPrice|setComputeUnitLimit/g, label: 'Priority fee / compute budget' },
            { re: /DurableNonce|advanceNonceAccount/g, label: 'Durable nonce usage' },
        ];
        for (const pc of patternChecks) {
            const matches = fullInline.match(pc.re);
            if (matches)
                walletPatterns.push({ pattern: pc.label, count: matches.length });
        }
        const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"], [class*="popup"], [id*="overlay"], [id*="modal"]');
        const hiddenDivs = [];
        overlays.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                const text = (el.textContent || '').trim().substring(0, 200);
                if (text.length > 10)
                    hiddenDivs.push(text);
            }
        });
        const cookies = [];
        try {
            cookies.push(...document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(Boolean).slice(0, 15));
        }
        catch { }
        return {
            url: location.href,
            hostname: location.hostname,
            origin: location.origin,
            title: document.title,
            protocol: location.protocol,
            hasServiceWorker: !!navigator.serviceWorker?.controller,
            bodyText: (document.body?.innerText || '').substring(0, 8000),
            inlineCode: inlineCode.substring(0, 50000),
            externalScripts: externalScripts.slice(0, 40),
            iframes,
            metaTags,
            links: links.slice(0, 40),
            ctas: ctas.slice(0, 25),
            inputs: inputs.slice(0, 20),
            storageKeys,
            walletPatterns,
            hiddenOverlays: hiddenDivs.slice(0, 5),
            cookieNames: cookies,
            documentForms: document.forms.length,
            totalScripts: document.querySelectorAll('script').length,
            totalIframes: document.querySelectorAll('iframe').length,
        };
    }
    let currentMint = null;
    function detectMint() {
        const m = location.pathname.match(/\/(?:coin|token)\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (m)
            return m[1];
        const d = location.pathname.match(/\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (d)
            return d[1];
        const dt = location.pathname.match(/\/pair\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (dt)
            return dt[1];
        if (/pump\.fun|axiom\.trade/.test(location.hostname)) {
            const direct = location.pathname.match(/^\/([1-9A-HJ-NP-Za-km-z]{32,44})\/?$/);
            if (direct)
                return direct[1];
        }
        const fb = location.pathname.match(/\/(?:address|account|mint)\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (fb)
            return fb[1];
        return null;
    }
    function getPageInfo() {
        let userAvatar = null;
        try {
            const avatarImg = document.querySelector('article [data-testid^="UserAvatar-Container"] img,' +
                'article [data-testid="Tweet-User-Avatar"] img,' +
                '[data-testid="UserAvatar-Container"] img');
            if (avatarImg && avatarImg.src && avatarImg.src.startsWith('https://pbs.twimg.com/profile_images/')) {
                userAvatar = avatarImg.src;
            }
        }
        catch { }
        const title = (document.title || '').trim();
        const titleMatch = title.match(/^(.+?)\s*\(\$?([^)]+)\)\s*[|—\-]/);
        if (titleMatch) {
            const tName = titleMatch[1].trim();
            const tTicker = titleMatch[2].trim();
            return { name: tName + ' (' + tTicker + ')', hostname: location.hostname, userAvatar };
        }
        const dexMatch = title.match(/^\$?(\S+)\s*\/\s*\S+\s*[|—\-]/);
        if (dexMatch) {
            return { name: dexMatch[1], hostname: location.hostname, userAvatar };
        }
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) {
            const ogMatch = ogTitle.content.match(/^(.+?)\s*\(\$?([^)]+)\)/);
            if (ogMatch) {
                return { name: ogMatch[1].trim() + ' (' + ogMatch[2].trim() + ')', hostname: location.hostname, userAvatar };
            }
            if (ogTitle.content.length > 1 && ogTitle.content.length < 60) {
                return { name: ogTitle.content.trim(), hostname: location.hostname, userAvatar };
            }
        }
        const nameEl = document.querySelector('[data-testid="token-name"], '
            + '[class*="coin-name"], [class*="token-name"], [class*="TokenName"], '
            + '[class*="tokenName"], [class*="coin_name"], [class*="token_name"], '
            + 'h1');
        if (nameEl) {
            const text = nameEl.textContent.trim().replace(/\s+/g, ' ');
            if (text && text.length > 0 && text.length < 80) {
                return { name: text.slice(0, 60), hostname: location.hostname, userAvatar };
            }
        }
        if (title.length > 1) {
            const cleaned = title.replace(/\s*[|—\-]\s*[^|—\-]+$/, '').trim();
            if (cleaned.length > 0 && cleaned.length < 60) {
                return { name: cleaned, hostname: location.hostname, userAvatar };
            }
        }
        return { name: 'Unknown Token', hostname: location.hostname, userAvatar };
    }
    let _pageInfoRetryTimer = null;
    let _lastSentName = null;
    function checkToken() {
        const mint = detectMint();
        if (mint && mint !== currentMint) {
            currentMint = mint;
            _lastSentName = null;
            if (_pageInfoRetryTimer) {
                clearInterval(_pageInfoRetryTimer);
                _pageInfoRetryTimer = null;
            }
            const info = getPageInfo();
            _lastSentName = info.name;
            _safeSend({ type: 'wo-mint-detected', mint, pageInfo: info });
            let retries = 0;
            _pageInfoRetryTimer = setInterval(() => {
                retries++;
                if (retries > 10 || currentMint !== mint) {
                    clearInterval(_pageInfoRetryTimer);
                    _pageInfoRetryTimer = null;
                    return;
                }
                const updated = getPageInfo();
                if (updated.name !== _lastSentName && updated.name !== 'Unknown Token') {
                    _lastSentName = updated.name;
                    clearInterval(_pageInfoRetryTimer);
                    _pageInfoRetryTimer = null;
                    _safeSend({ type: 'wo-mint-detected', mint, pageInfo: updated });
                }
            }, 500);
        }
        else if (!mint && currentMint) {
            currentMint = null;
            _lastSentName = null;
            if (_pageInfoRetryTimer) {
                clearInterval(_pageInfoRetryTimer);
                _pageInfoRetryTimer = null;
            }
            _safeSend({ type: 'wo-mint-cleared' });
        }
    }
    function observeNav() {
        let lastUrl = location.href;
        function onNavChange() {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                checkToken();
            }
        }
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        history.pushState = function () {
            origPush.apply(this, arguments);
            onNavChange();
        };
        history.replaceState = function () {
            origReplace.apply(this, arguments);
            onNavChange();
        };
        window.addEventListener('popstate', onNavChange);
        const obs = new MutationObserver(onNavChange);
        const target = document.body || document.documentElement;
        if (target) {
            obs.observe(target, { childList: true, subtree: true });
        }
        else {
            const waitObs = new MutationObserver(() => {
                if (document.body) {
                    waitObs.disconnect();
                    obs.observe(document.body, { childList: true, subtree: true });
                    checkToken();
                }
            });
            waitObs.observe(document.documentElement || document, { childList: true, subtree: true });
        }
    }
    let inspecting = false, hlEl = null;
    function getSelector(el) {
        if (el.id)
            return '#' + el.id;
        const parts = [];
        let cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
            const tag = cur.tagName.toLowerCase();
            if (cur.id) {
                parts.unshift('#' + cur.id);
                break;
            }
            if (cur.className && typeof cur.className === 'string') {
                parts.unshift(tag + '.' + cur.className.trim().split(/\s+/).slice(0, 2).join('.'));
            }
            else {
                parts.unshift(tag);
            }
            cur = cur.parentElement;
        }
        return parts.join(' > ');
    }
    function clearHL() { if (hlEl) {
        hlEl.style.outline = hlEl._wo_o || '';
        hlEl.style.backgroundColor = hlEl._wo_b || '';
        hlEl = null;
    } }
    function inspOnOver(e) {
        if (!inspecting)
            return;
        clearHL();
        hlEl = e.target;
        e.target._wo_o = e.target.style.outline;
        e.target._wo_b = e.target.style.backgroundColor;
        e.target.style.outline = '3px solid #507b9e';
        e.target.style.backgroundColor = 'rgba(80,123,158,0.08)';
    }
    function inspOnOut(e) { if (inspecting && e.target === hlEl)
        clearHL(); }
    function inspOnClick(e) {
        if (!inspecting)
            return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        clearHL();
        let htm = e.target.outerHTML;
        if (htm.length > 800)
            htm = htm.substring(0, 800) + '...';
        const payload = { selector: getSelector(e.target), tag: e.target.tagName.toLowerCase(), html: htm, text: (e.target.innerText || '').substring(0, 200), url: location.href };
        _safeSend({ type: 'wo-inspector-capture', payload });
    }
    function inspOnKey(e) { if (e.key === 'Escape' && inspecting)
        stopInspector(); }
    function startInspector() {
        inspecting = true;
        document.addEventListener('mouseover', inspOnOver, true);
        document.addEventListener('mouseout', inspOnOut, true);
        document.addEventListener('click', inspOnClick, true);
        document.addEventListener('keydown', inspOnKey, true);
    }
    function stopInspector() {
        inspecting = false;
        clearHL();
        document.removeEventListener('mouseover', inspOnOver, true);
        document.removeEventListener('mouseout', inspOnOut, true);
        document.removeEventListener('click', inspOnClick, true);
        document.removeEventListener('keydown', inspOnKey, true);
        _safeSend({ type: 'wo-inspector-stopped' });
    }
    if (_alive())
        try {
            chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
                if (msg.type === 'wo-get-mint') {
                    const mint = detectMint();
                    if (mint) {
                        const info = getPageInfo();
                        if (info.name !== 'Unknown Token') {
                            sendResponse({ mint, pageInfo: info });
                        }
                        else {
                            sendResponse({ mint, pageInfo: info });
                            let retries = 0;
                            const t = setInterval(() => {
                                retries++;
                                if (retries > 6) {
                                    clearInterval(t);
                                    return;
                                }
                                const updated = getPageInfo();
                                if (updated.name !== 'Unknown Token') {
                                    clearInterval(t);
                                    _safeSend({ type: 'wo-mint-detected', mint, pageInfo: updated });
                                }
                            }, 500);
                        }
                    }
                    else {
                        sendResponse({ mint: null });
                    }
                    return true;
                }
                if (msg.type === 'wo-inspector-start') {
                    startInspector();
                }
                if (msg.type === 'wo-inspector-stop') {
                    stopInspector();
                }
                return false;
            });
        }
        catch (e) { }
    (function initTokenOverlay() {
        if (!/axiom\.trade|pump\.fun/.test(location.hostname))
            return;
        const POLL_INTERVAL = 10000;
        let tokenMap = new Map();
        const BADGE_ATTR = 'data-wo-overlay';
        const MINT_RE = /([1-9A-HJ-NP-Za-km-z]{32,44})/g;
        const BADGE_LOGO_URL = (() => {
            try {
                return chrome.runtime.getURL('logo.png');
            }
            catch {
                return '';
            }
        })();
        let _overlayReady = false;
        function injectStyles() {
            if (document.getElementById('wo-overlay-styles'))
                return;
            const style = document.createElement('style');
            style.id = 'wo-overlay-styles';
            style.textContent = `
        .wo-overlay-host {
          position: relative !important;
        }
        .wo-overlay-badge {
          display: inline-flex; align-items: center; gap: 6px;
          max-width: min(180px, calc(100% - 20px));
          font-size: 11px; font-weight: 700; font-family: Oxanium, Inter, 'Segoe UI', sans-serif;
          padding: 5px 9px 5px 6px; border-radius: 999px;
          pointer-events: none; vertical-align: middle;
          line-height: 1; white-space: nowrap; overflow: hidden;
          background: linear-gradient(180deg, rgba(18,22,30,0.96), rgba(11,14,21,0.92));
          border: 1px solid rgba(210,224,244,0.12);
          box-shadow: 0 10px 28px rgba(0,0,0,0.42), 0 0 18px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          color: #f3f7fd;
          z-index: 9999;
        }
        .wo-overlay-badge--inline {
          position: static;
          margin-left: 6px;
          max-width: none;
          min-width: 18px;
          padding: 0;
          gap: 0;
          overflow: visible;
          border: none;
          border-radius: 6px;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
        }
        .wo-overlay-badge--inline .wo-overlay-badge__icon {
          width: 21px;
          min-width: 21px;
          height: 21px;
          padding: 0;
          border-radius: 7px;
          font-size: 7px;
          letter-spacing: 0.04em;
          line-height: 1;
        }
        .wo-overlay-badge--inline .wo-overlay-badge__body {
          display: none;
        }
        .wo-overlay-badge--floating {
          position: absolute;
          left: 10px;
          bottom: 10px;
        }
        .wo-overlay-badge__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          width: 26px;
          height: 26px;
          padding: 0;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border: 1px solid rgba(212,168,67,0.18);
          background: radial-gradient(circle at 30% 30%, rgba(192,170,255,0.28), rgba(139,92,246,0.14) 55%, rgba(18,22,30,0.22) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 10px rgba(139,92,246,0.18);
          overflow: hidden;
          flex: 0 0 auto;
        }
        .wo-overlay-badge__icon img {
          width: 124%;
          height: 124%;
          object-fit: cover;
          object-position: center;
          mix-blend-mode: screen;
          opacity: 0.98;
          filter: brightness(1.28) contrast(1.35) drop-shadow(0 1px 3px rgba(0,0,0,0.35));
        }
        .wo-overlay-badge--inline .wo-overlay-badge__icon img {
          width: 136%;
          height: 136%;
        }
        .wo-overlay-badge__body {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          min-width: 0;
        }
        .wo-overlay-badge__value {
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #f3f7fd;
          text-shadow: 0 0 10px rgba(139,92,246,0.12);
        }
        .wo-overlay-badge__label {
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #c0aaff;
        }
        .wo-overlay-badge--bought {
          border-color: rgba(59,232,160,0.24);
        }
        .wo-overlay-badge--analyzed {
          border-color: rgba(192,170,255,0.3);
        }
        .wo-overlay-badge--profit {
          border-color: rgba(59,232,160,0.34);
        }
        .wo-overlay-badge--loss {
          border-color: rgba(255,106,136,0.34);
        }
        .wo-overlay-badge--bought .wo-overlay-badge__icon {
          color: #3be8a0;
          background: radial-gradient(circle at 30% 30%, rgba(59,232,160,0.28), rgba(59,232,160,0.12) 55%, rgba(18,22,30,0.22) 100%);
          border-color: rgba(59,232,160,0.24);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 10px rgba(59,232,160,0.12);
        }
        .wo-overlay-badge--analyzed .wo-overlay-badge__icon {
          color: #c0aaff;
          background: radial-gradient(circle at 30% 30%, rgba(192,170,255,0.26), rgba(139,92,246,0.14) 55%, rgba(18,22,30,0.22) 100%);
        }

        [data-wo-card-status="bought"] {
          box-shadow: 0 0 0 1px rgba(104,224,165,0.16), 0 14px 28px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(104,224,165,0.1) !important;
          border-color: rgba(104,224,165,0.28) !important;
        }
        [data-wo-card-status="analyzed"] {
          box-shadow: 0 0 0 1px rgba(168,85,247,0.12), 0 10px 20px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(168,85,247,0.06) !important;
          border-color: rgba(168,85,247,0.22) !important;
        }
        .wo-overlay-indicator {
          position: fixed; bottom: 8px; left: 8px; z-index: 99999;
          font-size: 10px; font-family: Inter, Arial, sans-serif; font-weight: 600;
          padding: 3px 8px; border-radius: 6px;
          background: rgba(0,0,0,0.7); color: #888; border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none; transition: all 0.3s;
        }
        .wo-overlay-indicator--active {
          color: #00ff88; border-color: rgba(0,255,136,0.3);
        }
        .wo-position-tooltip {
          position: fixed;
          width: min(320px, calc(100vw - 24px));
          padding: 14px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(14,18,24,0.98), rgba(8,10,14,0.96));
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.07);
          color: #eef3fb;
          font-family: Inter, Arial, sans-serif;
          backdrop-filter: blur(16px);
          pointer-events: none;
          z-index: 2147483645;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity .16s ease, transform .16s ease;
        }
        .wo-position-tooltip.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .wo-position-tooltip__head,
        .wo-position-tooltip__meta,
        .wo-position-tooltip__signals,
        .wo-position-tooltip__footer {
          position: relative;
          z-index: 1;
        }
        .wo-position-tooltip__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .wo-position-tooltip__kicker {
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(214,224,238,0.65);
          margin-bottom: 5px;
        }
        .wo-position-tooltip__symbol {
          font-size: 18px;
          font-weight: 800;
          line-height: 1.05;
          color: #f7faff;
        }
        .wo-position-tooltip__sub {
          margin-top: 5px;
          font-size: 11px;
          color: rgba(214,224,238,0.72);
        }
        .wo-position-tooltip__mode {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7df0c0;
          background: rgba(104,224,165,0.1);
        }
        .wo-position-tooltip__mode.is-paper {
          color: #f3cf82;
          background: rgba(211,170,98,0.12);
          border-color: rgba(211,170,98,0.24);
        }
        .wo-position-tooltip__grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }
        .wo-position-tooltip__stat {
          padding: 10px 11px;
          border-radius: 13px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          min-width: 0;
        }
        .wo-position-tooltip__stat span {
          display: block;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(214,224,238,0.58);
          margin-bottom: 6px;
        }
        .wo-position-tooltip__stat strong {
          display: block;
          font-size: 14px;
          line-height: 1.12;
          color: #f7faff;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .wo-position-tooltip__stat small {
          display: block;
          margin-top: 4px;
          font-size: 10px;
          color: rgba(214,224,238,0.7);
        }
        .wo-position-tooltip__stat strong.is-profit { color: #7df0c0; }
        .wo-position-tooltip__stat strong.is-loss { color: #ff8da5; }
        .wo-position-tooltip__meta,
        .wo-position-tooltip__signals {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }
        .wo-position-tooltip__pill,
        .wo-position-tooltip__signal {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 9px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05);
          color: rgba(233,240,250,0.84);
          font-size: 10px;
        }
        .wo-position-tooltip__signal {
          color: #d8c3ff;
          border-color: rgba(168,85,247,0.2);
          background: rgba(168,85,247,0.1);
        }
        .wo-position-tooltip__footer {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-top: 11px;
          font-size: 10px;
          color: rgba(214,224,238,0.72);
        }
        .wo-position-tooltip__footer strong {
          color: #eef3fb;
          font-weight: 700;
        }
      `;
            (document.head || document.documentElement).appendChild(style);
        }
        let _indicator = null;
        let _positionTooltip = null;
        function updateIndicator(count) {
            if (!_indicator) {
                _indicator = document.createElement('div');
                _indicator.className = 'wo-overlay-indicator';
                (document.body || document.documentElement).appendChild(_indicator);
            }
            if (count > 0) {
                _indicator.className = 'wo-overlay-indicator wo-overlay-indicator--active';
                _indicator.textContent = '🦉 ' + count + ' tracked';
            }
            else {
                _indicator.className = 'wo-overlay-indicator';
                _indicator.textContent = '🦉 overlay';
            }
        }
        function formatMcap(value) {
            const num = Number(value);
            if (!Number.isFinite(num) || num <= 0)
                return '--';
            const abs = Math.abs(num);
            if (abs >= 1_000_000_000)
                return '$' + (num / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 2) + 'B';
            if (abs >= 1_000_000)
                return '$' + (num / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 2) + 'M';
            if (abs >= 1_000)
                return '$' + (num / 1_000).toFixed(abs >= 100_000 ? 0 : 1) + 'K';
            return '$' + num.toFixed(abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
        }
        function formatSol(value, signed) {
            const num = Number(value);
            if (!Number.isFinite(num))
                return '--';
            const abs = Math.abs(num);
            const digits = abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
            const prefix = signed ? (num >= 0 ? '+' : '') : '';
            return prefix + num.toFixed(digits) + ' SOL';
        }
        function formatPercent(value) {
            const num = Number(value);
            if (!Number.isFinite(num))
                return '--';
            return (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
        }
        function formatTokens(value) {
            const num = Number(value);
            if (!Number.isFinite(num) || num <= 0)
                return '--';
            const abs = Math.abs(num);
            if (abs >= 1_000_000_000)
                return (num / 1_000_000_000).toFixed(2) + 'B';
            if (abs >= 1_000_000)
                return (num / 1_000_000).toFixed(2) + 'M';
            if (abs >= 1_000)
                return (num / 1_000).toFixed(1) + 'K';
            return num.toFixed(0);
        }
        function formatHold(minutes) {
            const mins = Math.max(0, Math.round(Number(minutes) || 0));
            if (mins < 60)
                return mins + 'm';
            const hours = Math.floor(mins / 60);
            const rem = mins % 60;
            if (hours < 24)
                return hours + 'h ' + rem + 'm';
            const days = Math.floor(hours / 24);
            return days + 'd ' + (hours % 24) + 'h';
        }
        function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[char] || char));
        }
        function ensurePositionTooltip() {
            if (_positionTooltip?.isConnected)
                return _positionTooltip;
            _positionTooltip = document.createElement('div');
            _positionTooltip.className = 'wo-position-tooltip';
            _positionTooltip.hidden = true;
            (document.body || document.documentElement).appendChild(_positionTooltip);
            return _positionTooltip;
        }
        function hidePositionTooltip() {
            if (!_positionTooltip)
                return;
            _positionTooltip.classList.remove('is-visible');
            _positionTooltip.hidden = true;
        }
        function placePositionTooltip(anchor) {
            if (!_positionTooltip || !_positionTooltip.isConnected || !_positionTooltip.classList.contains('is-visible'))
                return;
            const rect = anchor.getBoundingClientRect();
            const tipRect = _positionTooltip.getBoundingClientRect();
            const gap = 12;
            let left = rect.right + gap;
            if (left + tipRect.width > window.innerWidth - 8) {
                left = Math.max(8, rect.left - tipRect.width - gap);
            }
            let top = rect.top;
            if (top + tipRect.height > window.innerHeight - 8) {
                top = Math.max(8, window.innerHeight - tipRect.height - 8);
            }
            _positionTooltip.style.left = left + 'px';
            _positionTooltip.style.top = top + 'px';
        }
        function showPositionTooltip(anchor, token) {
            if (!token?.position)
                return;
            const tip = ensurePositionTooltip();
            const position = token.position;
            const isProfit = Number(position.pnlPercent || 0) >= 0;
            const signals = Array.isArray(position.exitSignals) ? position.exitSignals.slice(0, 4) : [];
            const tpText = Array.isArray(position.dynamicTpLevels) && position.dynamicTpLevels.length > 0
                ? position.dynamicTpLevels.map((level) => `${level.at}%/${level.sellPercent}%`).join(' · ')
                : 'No TP';
            tip.innerHTML = `
        <div class="wo-position-tooltip__head">
          <div>
            <div class="wo-position-tooltip__kicker">WhiteOwl Position</div>
            <div class="wo-position-tooltip__symbol">$${escapeHtml(position.symbol || token.symbol || '')}</div>
            <div class="wo-position-tooltip__sub">${escapeHtml(position.mint.slice(0, 8))}... · ${token.paperMode ? 'paper tracked' : 'live tracked'}</div>
          </div>
          <div class="wo-position-tooltip__mode ${token.paperMode ? 'is-paper' : ''}">${token.paperMode ? 'Paper' : 'Live'}</div>
        </div>
        <div class="wo-position-tooltip__grid">
          <div class="wo-position-tooltip__stat">
            <span>Invested</span>
            <strong>${formatSol(position.investedSol, false)}</strong>
            <small>${formatTokens(position.amountTokens)} tokens</small>
          </div>
          <div class="wo-position-tooltip__stat">
            <span>P&amp;L</span>
            <strong class="${isProfit ? 'is-profit' : 'is-loss'}">${formatPercent(position.pnlPercent)}</strong>
            <small>${formatSol(position.pnlSol, true)}</small>
          </div>
          <div class="wo-position-tooltip__stat">
            <span>Entry MC</span>
            <strong>${formatMcap(position.entryMcap)}</strong>
            <small>Peak ${formatMcap(position.peakMcap)}</small>
          </div>
          <div class="wo-position-tooltip__stat">
            <span>Current MC</span>
            <strong>${formatMcap(position.currentMcap)}</strong>
            <small>${position.graduated ? 'Graduated' : 'Bond ' + Math.round(Number(position.bondingProgress) || 0) + '%'}</small>
          </div>
        </div>
        <div class="wo-position-tooltip__meta">
          <span class="wo-position-tooltip__pill">Hold ${formatHold(position.holdMinutes)}</span>
          <span class="wo-position-tooltip__pill">Holders ${Number(position.holders || 0)}</span>
          <span class="wo-position-tooltip__pill">Bundle ${Number(position.bundlePct || 0).toFixed(1)}%</span>
          <span class="wo-position-tooltip__pill">Cluster ${Number(position.clusterPct || 0).toFixed(1)}%</span>
        </div>
        ${signals.length ? `<div class="wo-position-tooltip__signals">${signals.map((signal) => `<span class="wo-position-tooltip__signal">${escapeHtml(signal)}</span>`).join('')}</div>` : ''}
        <div class="wo-position-tooltip__footer">
          <div><strong>TP</strong> ${escapeHtml(tpText)}</div>
          <div><strong>SL</strong> ${formatPercent(-Math.abs(Number(position.dynamicStopLoss) || 0))}</div>
        </div>
      `;
            tip.hidden = false;
            tip.classList.add('is-visible');
            placePositionTooltip(anchor);
        }
        function bindPositionPreview(anchor, token) {
            if (!anchor)
                return;
            anchor._woPositionToken = token;
            if (anchor._woPositionPreviewBound)
                return;
            anchor._woPositionPreviewBound = true;
            anchor.addEventListener('mouseenter', () => {
                if (anchor._woPositionToken?.position) {
                    showPositionTooltip(anchor, anchor._woPositionToken);
                }
            });
            anchor.addEventListener('mousemove', () => placePositionTooltip(anchor));
            anchor.addEventListener('mouseleave', hidePositionTooltip);
            anchor.addEventListener('click', hidePositionTooltip, true);
        }
        function bgFetch(url) {
            return new Promise((resolve, reject) => {
                if (!_alive())
                    return reject(new Error('context dead'));
                try {
                    chrome.runtime.sendMessage({ type: 'wo-fetch', url: url, method: 'GET' }, (resp) => {
                        void chrome.runtime.lastError;
                        if (!resp)
                            return reject(new Error('no response'));
                        if (!resp.ok)
                            return reject(new Error('status ' + resp.status));
                        try {
                            resolve(JSON.parse(resp.body));
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                }
                catch (e) {
                    reject(e);
                }
            });
        }
        function extractMintsFromDOM() {
            const found = [];
            const seen = new Set();
            document.querySelectorAll('a[href]').forEach(a => {
                const href = a.getAttribute('href') || '';
                const resolved = a.href || '';
                for (const str of [href, resolved]) {
                    const matches = str.matchAll(MINT_RE);
                    for (const m of matches) {
                        const mint = m[1];
                        if (mint.length >= 32 && mint.length <= 44 && tokenMap.has(mint)) {
                            const key = mint + ':' + (a._woId || (a._woId = Math.random().toString(36).slice(2)));
                            if (!seen.has(key)) {
                                seen.add(key);
                                found.push({ el: a, mint });
                            }
                        }
                    }
                }
            });
            document.querySelectorAll('[data-address],[data-mint],[data-token],[data-ca],[data-contract]').forEach(el => {
                const addr = el.getAttribute('data-address') || el.getAttribute('data-mint') ||
                    el.getAttribute('data-token') || el.getAttribute('data-ca') ||
                    el.getAttribute('data-contract') || '';
                if (addr.length >= 32 && addr.length <= 44 && tokenMap.has(addr)) {
                    const key = addr + ':data:' + (el._woId || (el._woId = Math.random().toString(36).slice(2)));
                    if (!seen.has(key)) {
                        seen.add(key);
                        found.push({ el, mint: addr });
                    }
                }
            });
            if (tokenMap.size > 0) {
                const prefixMap = new Map();
                for (const [mint] of tokenMap) {
                    if (mint.length >= 8) {
                        const prefix = mint.slice(0, 4);
                        if (!prefixMap.has(prefix))
                            prefixMap.set(prefix, []);
                        prefixMap.get(prefix).push(mint);
                    }
                }
                document.querySelectorAll('[title],[aria-label]').forEach(el => {
                    const text = el.getAttribute('title') || el.getAttribute('aria-label') || '';
                    const matches = text.matchAll(MINT_RE);
                    for (const m of matches) {
                        if (tokenMap.has(m[1])) {
                            const key = m[1] + ':title:' + (el._woId || (el._woId = Math.random().toString(36).slice(2)));
                            if (!seen.has(key)) {
                                seen.add(key);
                                const wrapper = el.closest('a, [role="row"], [role="listitem"], tr, [class*="card"], [class*="row"], [class*="token"], [class*="pair"]') || el;
                                found.push({ el: wrapper, mint: m[1] });
                            }
                        }
                    }
                });
            }
            return found;
        }
        function canFloatOnHost(host) {
            if (!host)
                return false;
            const tag = (host.tagName || '').toUpperCase();
            if (tag === 'TABLE' || tag === 'TBODY' || tag === 'THEAD' || tag === 'TR')
                return false;
            const style = getComputedStyle(host);
            if (style.display.includes('table'))
                return false;
            if (style.display === 'inline' || style.display === 'contents')
                return false;
            if (style.overflowX === 'hidden' || style.overflowX === 'clip' || style.overflowY === 'hidden' || style.overflowY === 'clip')
                return false;
            const rect = host.getBoundingClientRect();
            return rect.width >= 80 && rect.height >= 28;
        }
        function getBadgeHost(el, card) {
            const candidates = [];
            const seen = new Set();
            function collect(start) {
                let node = start;
                let depth = 0;
                while (node && node !== document.body && depth < 6) {
                    if (!seen.has(node)) {
                        seen.add(node);
                        if (canFloatOnHost(node))
                            candidates.push(node);
                    }
                    node = node.parentElement;
                    depth++;
                }
            }
            collect(card || el);
            collect(el);
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
                return candidates[0];
            }
            return el;
        }
        function buildBadgeContent(badge, token) {
            const icon = document.createElement('span');
            icon.className = 'wo-overlay-badge__icon';
            const body = document.createElement('span');
            body.className = 'wo-overlay-badge__body';
            const value = document.createElement('span');
            value.className = 'wo-overlay-badge__value';
            const label = document.createElement('span');
            label.className = 'wo-overlay-badge__label';
            let badgeTitle = '';
            if (BADGE_LOGO_URL) {
                const logo = document.createElement('img');
                logo.src = BADGE_LOGO_URL;
                logo.alt = 'WhiteOwl';
                icon.appendChild(logo);
            }
            else {
                icon.textContent = 'WO';
            }
            if (token.status === 'bought') {
                const pnlVal = Number(token.pnl || 0);
                value.textContent = token.symbol || '?';
                label.textContent = token.pnl !== undefined ? `${pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(1)}%` : 'open';
                badgeTitle = `${token.symbol || 'Token'} • ${label.textContent}`;
                badge.classList.add(pnlVal >= 0 ? 'wo-overlay-badge--profit' : 'wo-overlay-badge--loss');
            }
            else {
                value.textContent = token.score !== undefined ? String(Math.round(Number(token.score) || 0)) : 'seen';
                label.textContent = token.score !== undefined ? 'scan' : 'watch';
                badgeTitle = token.score !== undefined
                    ? `WhiteOwl checked • ${value.textContent} pts`
                    : 'WhiteOwl checked';
            }
            body.appendChild(value);
            body.appendChild(label);
            badge.title = badgeTitle;
            badge.setAttribute('aria-label', badgeTitle);
            badge.replaceChildren(icon, body);
        }
        function updateBadge(badge, token, floating) {
            badge.setAttribute(BADGE_ATTR, token.mint);
            badge.className = 'wo-overlay-badge wo-overlay-badge--' + token.status + ' ' + (floating ? 'wo-overlay-badge--floating' : 'wo-overlay-badge--inline');
            buildBadgeContent(badge, token);
        }
        function createBadge(token, floating) {
            const badge = document.createElement('span');
            updateBadge(badge, token, floating);
            return badge;
        }
        function scanPage() {
            if (tokenMap.size === 0)
                return;
            const found = extractMintsFromDOM();
            let badged = 0;
            for (const { el, mint } of found) {
                const token = tokenMap.get(mint);
                if (!token)
                    continue;
                const card = el.closest('[class*="card"], [class*="row"], [class*="pair"], [class*="token"], tr, li') || el;
                card.setAttribute('data-wo-card-status', token.status);
                const host = getBadgeHost(el, card);
                const floating = host !== el;
                const mount = floating ? host : (host.parentElement || host);
                if (floating) {
                    host.classList.add('wo-overlay-host');
                }
                const previewAnchor = card && card !== document.body ? card : host;
                const selector = '[' + BADGE_ATTR + '="' + mint + '"]';
                let existing = mount.querySelector(selector);
                if (!floating && mount !== host) {
                    host.querySelectorAll(selector).forEach((legacy) => legacy.remove());
                }
                if (!existing && host !== el) {
                    const legacy = el.querySelector(selector);
                    if (legacy)
                        legacy.remove();
                }
                if (!existing) {
                    const badge = createBadge({ ...token, mint }, floating);
                    try {
                        if (floating || mount === host)
                            mount.appendChild(badge);
                        else
                            mount.insertBefore(badge, host.nextSibling);
                        badged++;
                    }
                    catch { }
                }
                else {
                    updateBadge(existing, { ...token, mint }, floating);
                }
                if (token.status === 'bought' && token.position) {
                    bindPositionPreview(previewAnchor, { ...token, mint });
                }
            }
            return badged;
        }
        async function pollTokens() {
            try {
                const data = await bgFetch(API + '/api/sniper/tokens');
                const newMap = new Map();
                for (const t of (data.tokens || [])) {
                    newMap.set(t.mint, t);
                }
                tokenMap = newMap;
                updateIndicator(tokenMap.size);
                if (tokenMap.size > 0)
                    scanPage();
            }
            catch (err) {
                updateIndicator(0);
            }
        }
        (function initFullTokenPositionCard() {
            if (!/pump\.fun|axiom\.trade/.test(location.hostname))
                return;
            const CARD_ID = 'wo-token-position-card';
            const STYLE_ID = 'wo-token-position-card-styles';
            const POLL_INTERVAL = 8000;
            let lastUrl = location.href;
            let inflight = false;
            function isFullTokenPage() {
                const mint = detectMint();
                if (!mint)
                    return false;
                return /\/(?:coin|token)\//.test(location.pathname)
                    || /^\/([1-9A-HJ-NP-Za-km-z]{32,44})\/?$/.test(location.pathname);
            }
            function injectCardStyles() {
                if (document.getElementById(STYLE_ID))
                    return;
                const style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent = `
          .wo-token-position-card {
            position: fixed;
            top: 88px;
            right: 16px;
            width: min(360px, calc(100vw - 32px));
            padding: 16px;
            border-radius: 20px;
            background: linear-gradient(180deg, rgba(14,18,24,0.96), rgba(8,10,14,0.94));
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 24px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.07);
            backdrop-filter: blur(18px);
            color: #eef3fb;
            z-index: 2147483644;
            pointer-events: none;
            overflow: hidden;
            font-family: Inter, Arial, sans-serif;
          }
          .wo-token-position-card::before {
            content: '';
            position: absolute;
            inset: 0 0 auto 0;
            height: 54%;
            background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0));
            pointer-events: none;
          }
          .wo-token-position-head,
          .wo-token-position-footer,
          .wo-token-position-rail {
            position: relative;
            z-index: 1;
          }
          .wo-token-position-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }
          .wo-token-position-kicker {
            font-size: 10px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: rgba(212,223,237,0.68);
            margin-bottom: 6px;
          }
          .wo-token-position-symbol {
            font-size: 22px;
            font-weight: 800;
            line-height: 1;
            letter-spacing: -0.02em;
          }
          .wo-token-position-sub {
            margin-top: 6px;
            font-size: 12px;
            color: rgba(212,223,237,0.78);
          }
          .wo-token-position-mode {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 28px;
            padding: 0 10px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.05);
          }
          .wo-token-position-mode.is-paper {
            color: #f3cf82;
            background: rgba(211,170,98,0.12);
            border-color: rgba(211,170,98,0.26);
          }
          .wo-token-position-mode.is-live {
            color: #7df0c0;
            background: rgba(104,224,165,0.12);
            border-color: rgba(104,224,165,0.24);
          }
          .wo-token-position-grid {
            position: relative;
            z-index: 1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px;
          }
          .wo-token-position-stat {
            padding: 11px 12px;
            border-radius: 14px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            min-width: 0;
          }
          .wo-token-position-stat span {
            display: block;
            font-size: 10px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(212,223,237,0.6);
            margin-bottom: 7px;
          }
          .wo-token-position-stat strong {
            display: block;
            font-size: 15px;
            font-weight: 800;
            line-height: 1.15;
            color: #f7faff;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .wo-token-position-stat small {
            display: block;
            margin-top: 5px;
            font-size: 11px;
            color: rgba(212,223,237,0.72);
          }
          .wo-token-position-stat strong.is-profit {
            color: #7df0c0;
          }
          .wo-token-position-stat strong.is-loss {
            color: #ff8da5;
          }
          .wo-token-position-rail {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
          }
          .wo-token-position-pill,
          .wo-token-position-signal {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 0 10px;
            border-radius: 999px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            font-size: 11px;
            color: rgba(233,240,250,0.84);
          }
          .wo-token-position-signals {
            position: relative;
            z-index: 1;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
          }
          .wo-token-position-signal {
            color: #d8c3ff;
            border-color: rgba(168,85,247,0.2);
            background: rgba(168,85,247,0.1);
          }
          .wo-token-position-footer {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-top: 14px;
            font-size: 11px;
            color: rgba(212,223,237,0.72);
          }
          .wo-token-position-footer strong {
            color: #eef3fb;
            font-weight: 700;
          }
          @media (max-width: 900px) {
            .wo-token-position-card {
              top: auto;
              right: 12px;
              bottom: 12px;
              left: 12px;
              width: auto;
            }
          }
        `;
                (document.head || document.documentElement).appendChild(style);
            }
            function ensureCard() {
                if (!document.body)
                    return null;
                let card = document.getElementById(CARD_ID);
                if (!card) {
                    card = document.createElement('aside');
                    card.id = CARD_ID;
                    card.className = 'wo-token-position-card';
                    document.body.appendChild(card);
                }
                return card;
            }
            function removeCard() {
                const card = document.getElementById(CARD_ID);
                if (card)
                    card.remove();
            }
            function escapeHtml(value) {
                return String(value || '').replace(/[&<>"']/g, (char) => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                }[char] || char));
            }
            function formatMcap(value) {
                const num = Number(value);
                if (!Number.isFinite(num) || num <= 0)
                    return '--';
                const abs = Math.abs(num);
                if (abs >= 1_000_000_000)
                    return '$' + (num / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 2) + 'B';
                if (abs >= 1_000_000)
                    return '$' + (num / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 2) + 'M';
                if (abs >= 1_000)
                    return '$' + (num / 1_000).toFixed(abs >= 100_000 ? 0 : 1) + 'K';
                return '$' + num.toFixed(abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
            }
            function formatSol(value, signed) {
                const num = Number(value);
                if (!Number.isFinite(num))
                    return '--';
                const abs = Math.abs(num);
                const digits = abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
                const prefix = signed ? (num >= 0 ? '+' : '') : '';
                return prefix + num.toFixed(digits) + ' SOL';
            }
            function formatPercent(value) {
                const num = Number(value);
                if (!Number.isFinite(num))
                    return '--';
                return (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
            }
            function formatTokens(value) {
                const num = Number(value);
                if (!Number.isFinite(num) || num <= 0)
                    return '--';
                const abs = Math.abs(num);
                if (abs >= 1_000_000_000)
                    return (num / 1_000_000_000).toFixed(2) + 'B';
                if (abs >= 1_000_000)
                    return (num / 1_000_000).toFixed(2) + 'M';
                if (abs >= 1_000)
                    return (num / 1_000).toFixed(1) + 'K';
                return num.toFixed(0);
            }
            function formatHold(minutes) {
                const mins = Math.max(0, Math.round(Number(minutes) || 0));
                if (mins < 60)
                    return mins + 'm';
                const hours = Math.floor(mins / 60);
                const rem = mins % 60;
                if (hours < 24)
                    return hours + 'h ' + rem + 'm';
                const days = Math.floor(hours / 24);
                return days + 'd ' + (hours % 24) + 'h';
            }
            function renderCard(data) {
                if (!data?.position) {
                    removeCard();
                    return;
                }
                const card = ensureCard();
                if (!card)
                    return;
                const position = data.position;
                const isProfit = Number(position.pnlPercent || 0) >= 0;
                const signals = Array.isArray(position.exitSignals) ? position.exitSignals.slice(0, 4) : [];
                const tpText = Array.isArray(position.dynamicTpLevels) && position.dynamicTpLevels.length > 0
                    ? position.dynamicTpLevels.map((level) => `${level.at}%/${level.sellPercent}%`).join(' · ')
                    : 'No TP levels';
                card.innerHTML = `
          <div class="wo-token-position-head">
            <div>
              <div class="wo-token-position-kicker">WhiteOwl Position</div>
              <div class="wo-token-position-symbol">$${escapeHtml(position.symbol || position.mint.slice(0, 8))}</div>
              <div class="wo-token-position-sub">${escapeHtml(position.mint.slice(0, 8))}... · ${data.paperMode ? 'paper tracked' : 'live tracked'}</div>
            </div>
            <div class="wo-token-position-mode ${data.paperMode ? 'is-paper' : 'is-live'}">${data.paperMode ? 'Paper' : 'Live'}</div>
          </div>
          <div class="wo-token-position-grid">
            <div class="wo-token-position-stat">
              <span>Invested</span>
              <strong>${formatSol(position.investedSol, false)}</strong>
              <small>${formatTokens(position.amountTokens)} tokens</small>
            </div>
            <div class="wo-token-position-stat">
              <span>P&amp;L</span>
              <strong class="${isProfit ? 'is-profit' : 'is-loss'}">${formatPercent(position.pnlPercent)}</strong>
              <small>${formatSol(position.pnlSol, true)}</small>
            </div>
            <div class="wo-token-position-stat">
              <span>Entry MC</span>
              <strong>${formatMcap(position.entryMcap)}</strong>
              <small>Peak ${formatMcap(position.peakMcap)}</small>
            </div>
            <div class="wo-token-position-stat">
              <span>Current MC</span>
              <strong>${formatMcap(position.currentMcap)}</strong>
              <small>${position.graduated ? 'Graduated' : 'Bond ' + Math.round(Number(position.bondingProgress) || 0) + '%'}</small>
            </div>
            <div class="wo-token-position-stat">
              <span>Held</span>
              <strong>${formatHold(position.holdMinutes)}</strong>
              <small>Updated ${new Date(position.lastUpdated).toLocaleTimeString()}</small>
            </div>
            <div class="wo-token-position-stat">
              <span>Chart</span>
              <strong>${escapeHtml(position.chartVerdict || 'initial')}</strong>
              <small>SL ${formatPercent(-Math.abs(Number(position.dynamicStopLoss) || 0))}</small>
            </div>
          </div>
          <div class="wo-token-position-rail">
            <span class="wo-token-position-pill">Holders ${Number(position.holders || 0)}</span>
            <span class="wo-token-position-pill">Peak holders ${Number(position.peakHolders || 0)}</span>
            <span class="wo-token-position-pill">Bundle ${Number(position.bundlePct || 0).toFixed(1)}%</span>
            <span class="wo-token-position-pill">Cluster ${Number(position.clusterPct || 0).toFixed(1)}%</span>
            <span class="wo-token-position-pill">Partials ${Number(position.partialsSold || 0)}</span>
          </div>
          ${signals.length ? `<div class="wo-token-position-signals">${signals.map((signal) => `<span class="wo-token-position-signal">${escapeHtml(signal)}</span>`).join('')}</div>` : ''}
          <div class="wo-token-position-footer">
            <div><strong>TP</strong> ${escapeHtml(tpText)}</div>
            <div><strong>${data.paperMode ? 'Paper bal' : 'Real bal'}</strong> ${formatSol(data.paperMode ? data.paperBalance : data.realBalance, false)}</div>
          </div>
        `;
            }
            async function refreshCard() {
                if (inflight)
                    return;
                if (!isFullTokenPage()) {
                    removeCard();
                    return;
                }
                const mint = detectMint();
                if (!mint) {
                    removeCard();
                    return;
                }
                inflight = true;
                try {
                    const response = await bgFetch(API + '/api/sniper/position/' + mint, { method: 'GET' });
                    const data = JSON.parse(response.body || '{}');
                    renderCard(data);
                }
                catch (err) {
                }
                finally {
                    inflight = false;
                }
            }
            function start() {
                injectCardStyles();
                refreshCard();
                setInterval(() => {
                    if (location.href !== lastUrl) {
                        lastUrl = location.href;
                        removeCard();
                    }
                    refreshCard();
                }, POLL_INTERVAL);
                let refreshTimer = null;
                const observer = new MutationObserver(() => {
                    if (refreshTimer)
                        return;
                    refreshTimer = setTimeout(() => {
                        refreshTimer = null;
                        if (location.href !== lastUrl) {
                            lastUrl = location.href;
                            removeCard();
                        }
                        refreshCard();
                    }, 700);
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
            if (document.body) {
                start();
            }
            else {
                const waitObs = new MutationObserver(() => {
                    if (document.body) {
                        waitObs.disconnect();
                        start();
                    }
                });
                waitObs.observe(document.documentElement || document, { childList: true, subtree: true });
            }
        })();
        function start() {
            if (_overlayReady)
                return;
            _overlayReady = true;
            injectStyles();
            pollTokens();
            setInterval(pollTokens, POLL_INTERVAL);
            let scanTimer = null;
            const obs = new MutationObserver(() => {
                if (scanTimer)
                    return;
                scanTimer = setTimeout(() => {
                    scanTimer = null;
                    if (tokenMap.size > 0)
                        scanPage();
                }, 500);
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
        if (document.body) {
            start();
        }
        else {
            const waitObs = new MutationObserver(() => {
                if (document.body) {
                    waitObs.disconnect();
                    start();
                }
            });
            waitObs.observe(document.documentElement || document, { childList: true, subtree: true });
        }
    })();
    if (document.body) {
        checkToken();
        observeNav();
    }
    else {
        const initObs = new MutationObserver(() => {
            if (document.body) {
                initObs.disconnect();
                checkToken();
                observeNav();
            }
        });
        initObs.observe(document.documentElement || document, { childList: true, subtree: true });
    }
})();
