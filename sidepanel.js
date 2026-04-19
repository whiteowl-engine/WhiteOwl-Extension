(function () {
    'use strict';
    if (window.trustedTypes && trustedTypes.createPolicy) {
        try {
            trustedTypes.createPolicy('default', { createHTML: s => s });
        }
        catch { }
    }
    document.addEventListener('error', function (e) {
        const t = e.target;
        if (t.tagName === 'IMG' && t.classList.contains('wo-token-icon-img')) {
            t.style.display = 'none';
            const sib = t.nextElementSibling;
            if (sib)
                sib.style.display = 'flex';
        }
        if (t.tagName === 'IMG' && t.classList.contains('wo-nft-img')) {
            t.style.display = 'none';
            const sib = t.nextElementSibling;
            if (sib)
                sib.style.display = 'flex';
        }
        if (t.tagName === 'IMG' && t.classList.contains('wo-swap-agg-logo')) {
            t.style.display = 'none';
        }
    }, true);
    let API = 'http://localhost:3377';
    const _apiReady = (async () => { try {
        const r = await chrome.storage.local.get('wo_server_url');
        if (r?.wo_server_url)
            API = r.wo_server_url;
    }
    catch { } })();
    let ws = null, connected = false, reconnTimer = null;
    let currentMint = null, activeTab = 'token';
    let authToken = null;
    let _panelOnline = false;
    let _panelCheckTimer = null;
    let cachedTokenImage = null;
    let cachedUserAvatar = null;
    let _liveDataTimer = null;
    let _cachedPumpData = null;
    const captures = [];
    let _chats = [];
    let _activeChatId = null;
    let _chatListOpen = false;
    function _genChatId() { return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
    function _initDefaultChat() {
        if (_chats.length === 0) {
            const id = _genChatId();
            _chats.push({ id: id, name: 'New Chat', created: Date.now(), domHTML: '' });
            _activeChatId = id;
        }
        _updateChatTitle();
        _persistChats();
    }
    function _persistChats() {
        try {
            const save = _chats.map(function (c) { return { id: c.id, name: c.name, created: c.created }; });
            chrome.storage.local.set({ wo_chats: save, wo_active_chat: _activeChatId });
        }
        catch { }
    }
    async function _loadChats() {
        try {
            const r = await chrome.storage.local.get(['wo_chats', 'wo_active_chat']);
            if (r.wo_chats && Array.isArray(r.wo_chats) && r.wo_chats.length) {
                _chats = r.wo_chats.map(function (c) { return { id: c.id, name: c.name, created: c.created, domHTML: '' }; });
                _activeChatId = r.wo_active_chat || _chats[0].id;
                if (!_chats.find(function (c) { return c.id === _activeChatId; }))
                    _activeChatId = _chats[0].id;
            }
        }
        catch { }
        if (_chats.length === 0)
            _initDefaultChat();
        _updateChatTitle();
    }
    function _updateChatTitle() {
        var el = $('#wo-chat-title');
        var chat = _chats.find(function (c) { return c.id === _activeChatId; });
        if (el && chat)
            el.textContent = chat.name;
    }
    function _createNewChat() {
        _saveChatDOM();
        var id = _genChatId();
        _chats.unshift({ id: id, name: 'New Chat', created: Date.now(), domHTML: '' });
        _activeChatId = id;
        var msgs = $('#wo-messages');
        if (msgs)
            msgs.innerHTML = '<div class="wo-msg sys">Connect to WhiteOwl to start chatting</div>';
        resetStreamState();
        removeTyping();
        showHero();
        _updateChatTitle();
        _persistChats();
        _renderChatList();
        _closeChatList();
    }
    function _switchChat(id) {
        if (id === _activeChatId) {
            _closeChatList();
            return;
        }
        _saveChatDOM();
        _activeChatId = id;
        _restoreChatDOM();
        resetStreamState();
        removeTyping();
        _updateChatTitle();
        _persistChats();
        _renderChatList();
        _closeChatList();
        var msgs = $('#wo-messages');
        var hasConv = msgs && msgs.querySelectorAll('.wo-msg.user, .wo-msg.ai').length > 0;
        if (hasConv)
            hideHero();
        else
            showHero();
    }
    function _deleteChat(id) {
        if (_chats.length <= 1)
            return;
        _chats = _chats.filter(function (c) { return c.id !== id; });
        if (_activeChatId === id) {
            _activeChatId = _chats[0].id;
            _restoreChatDOM();
            _updateChatTitle();
            var msgs = $('#wo-messages');
            var hasConv = msgs && msgs.querySelectorAll('.wo-msg.user, .wo-msg.ai').length > 0;
            if (hasConv)
                hideHero();
            else
                showHero();
        }
        _persistChats();
        _renderChatList();
    }
    function _saveChatDOM() {
        var msgs = $('#wo-messages');
        var chat = _chats.find(function (c) { return c.id === _activeChatId; });
        if (msgs && chat)
            chat.domHTML = msgs.innerHTML;
    }
    function _restoreChatDOM() {
        var msgs = $('#wo-messages');
        var chat = _chats.find(function (c) { return c.id === _activeChatId; });
        if (msgs && chat)
            msgs.innerHTML = chat.domHTML || '<div class="wo-msg sys">Connect to WhiteOwl to start chatting</div>';
    }
    function _autoNameChat(msg) {
        var chat = _chats.find(function (c) { return c.id === _activeChatId; });
        if (chat && chat.name === 'New Chat') {
            chat.name = msg.slice(0, 40) + (msg.length > 40 ? '…' : '');
            _updateChatTitle();
            _persistChats();
        }
    }
    function _toggleChatList() {
        _setChatListOpen(!_chatListOpen);
    }
    function _closeChatList() {
        _setChatListOpen(false);
    }
    function _setChatListOpen(open) {
        _chatListOpen = !!open;
        var overlay = $('#wo-chat-list-overlay');
        var btn = $('#wo-chat-list-btn');
        if (overlay) {
            overlay.classList.toggle('is-open', _chatListOpen);
            overlay.setAttribute('aria-hidden', _chatListOpen ? 'false' : 'true');
        }
        if (btn) {
            btn.classList.toggle('is-active', _chatListOpen);
            btn.setAttribute('aria-expanded', _chatListOpen ? 'true' : 'false');
        }
        if (_chatListOpen)
            _renderChatList();
    }
    function _renderChatList() {
        var container = $('#wo-chat-list-items');
        if (!container)
            return;
        container.innerHTML = _chats.map(function (c) {
            var isActive = c.id === _activeChatId;
            var time = new Date(c.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return '<div class="wo-chat-list-item' + (isActive ? ' active' : '') + '" data-chat-id="' + c.id + '">'
                + '<div class="wo-chat-list-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg></div>'
                + '<div class="wo-chat-list-item-body">'
                + '<div class="wo-chat-list-item-name">' + c.name.replace(/</g, '&lt;') + '</div>'
                + '<div class="wo-chat-list-item-time">' + time + '</div>'
                + '</div>'
                + (_chats.length > 1 ? '<button class="wo-chat-list-item-del" data-del-id="' + c.id + '" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>' : '')
                + '</div>';
        }).join('');
        container.querySelectorAll('.wo-chat-list-item').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (e.target.closest('.wo-chat-list-item-del'))
                    return;
                _switchChat(el.dataset.chatId);
            });
        });
        container.querySelectorAll('.wo-chat-list-item-del').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                _deleteChat(el.dataset.delId);
            });
        });
    }
    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }
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
        defs += `<clipPath id="${u}clip"><circle cx="50" cy="50" r="50"/></clipPath>`;
        bg = `<circle cx="50" cy="50" r="50" fill="url(#${u}bg)"/><circle cx="50" cy="50" r="50" fill="url(#${u}rg)"/><circle cx="50" cy="50" r="50" fill="url(#${u}rg2)"/>`;
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
                const cx = 20 + rng() * 60, cy = 20 + rng() * 60, sides = 3 + ~~(rng() * 4), sz = 8 + rng() * 20, rot = rng() * T;
                let pts = '';
                for (let si = 0; si < sides; si++) {
                    const a = rot + si / sides * T;
                    pts += `${(cx + sz * Math.cos(a)).toFixed(1)},${(cy + sz * Math.sin(a)).toFixed(1)} `;
                }
                layers += `<polygon points="${pts.trim()}" fill="${pal[3 + (i % 3)]}" opacity="${(.1 + rng() * .2).toFixed(2)}" filter="url(#${u}gl)"/><polygon points="${pts.trim()}" fill="none" stroke="${pal[4]}" stroke-width=".5" opacity="${(.3 + rng() * .4).toFixed(2)}"/>`;
            }
            for (let i = 0; i < 3; i++) {
                const a = rng() * T, len = 30 + rng() * 50;
                layers += `<line x1="50" y1="50" x2="${(50 + len * Math.cos(a)).toFixed(1)}" y2="${(50 + len * Math.sin(a)).toFixed(1)}" stroke="${pal[5]}" stroke-width=".6" opacity="${(.15 + rng() * .2).toFixed(2)}"/>`;
            }
        }
        else if (theme === 2) {
            for (let i = 0; i < 7; i++) {
                const bx = 15 + rng() * 70, by = 80 - rng() * 20, h = 25 + rng() * 45, w = 8 + rng() * 16;
                layers += `<path d="M${bx.toFixed(1)},${by.toFixed(1)} C${(bx - w * (.5 + rng())).toFixed(1)},${(by - h * .4).toFixed(1)} ${(bx + w * (.5 + rng())).toFixed(1)},${(by - h * .6).toFixed(1)} ${(bx + (rng() - .5) * 10).toFixed(1)},${(by - h).toFixed(1)}" fill="none" stroke="${pal[3 + (i % 3)]}" stroke-width="${(2 + rng() * 6).toFixed(1)}" opacity="${(.2 + rng() * .3).toFixed(2)}" stroke-linecap="round" filter="url(#${u}gl)"/>`;
            }
            for (let i = 0; i < 12; i++) {
                const ex = 15 + rng() * 70, ey = 10 + rng() * 70, er = .5 + rng() * 2;
                layers += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${er.toFixed(1)}" fill="${pal[4 + (i % 2)]}" opacity="${(.4 + rng() * .6).toFixed(2)}"/>`;
            }
        }
        else if (theme === 3) {
            const cols = 5, rows = 5, sp = 20;
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++) {
                    const nx = 10 + c * sp + (rng() - .5) * 6, ny = 10 + r * sp + (rng() - .5) * 6;
                    if (rng() > .3) {
                        const dir = ~~(rng() * 4), len = sp * (.5 + rng() * .8), dx = [len, 0, -len, 0][dir], dy = [0, len, 0, -len][dir];
                        layers += `<line x1="${nx.toFixed(1)}" y1="${ny.toFixed(1)}" x2="${(nx + dx).toFixed(1)}" y2="${(ny + dy).toFixed(1)}" stroke="${pal[3 + (c % 3)]}" stroke-width="${(.4 + rng() * .8).toFixed(1)}" opacity="${(.2 + rng() * .4).toFixed(2)}"/>`;
                    }
                    layers += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${(.8 + rng() * 2).toFixed(1)}" fill="${pal[4]}" opacity="${(.3 + rng() * .5).toFixed(2)}"/>`;
                }
            for (let i = 0; i < 3; i++)
                layers += `<circle cx="${(rng() * 100).toFixed(0)}" cy="${(rng() * 100).toFixed(0)}" r="12" fill="${pal[5]}" opacity=".08" filter="url(#${u}gl2)"/>`;
        }
        else if (theme === 4) {
            for (let i = 0; i < 6; i++) {
                const y = 5 + i * 16 + rng() * 8, amp = 4 + rng() * 12, freq = .5 + rng() * 1.5;
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
                const r = 6 + i * 7 + rng() * 4, dx = (rng() - .5) * 8, dy = (rng() - .5) * 8;
                layers += `<ellipse cx="${(cx0 + dx).toFixed(1)}" cy="${(cy0 + dy).toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * (.7 + rng() * .6)).toFixed(1)}" fill="none" stroke="${pal[3 + (i % 3)]}" stroke-width="${(.5 + rng() * 1).toFixed(1)}" opacity="${(.2 + rng() * .35).toFixed(2)}" transform="rotate(${(rng() * 40 - 20).toFixed(0)} ${cx0.toFixed(0)} ${cy0.toFixed(0)})"/>`;
            }
            for (let i = 0; i < 15; i++)
                layers += `<circle cx="${(rng() * 100).toFixed(0)}" cy="${(rng() * 100).toFixed(0)}" r="${(.5 + rng() * 1.5).toFixed(1)}" fill="${pal[4]}" opacity="${(.2 + rng() * .5).toFixed(2)}"/>`;
        }
        else if (theme === 6) {
            for (let i = 0; i < 5; i++) {
                const cx = 15 + rng() * 70, cy = 15 + rng() * 70, rx = 10 + rng() * 22, ry = 10 + rng() * 22;
                layers += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${pal[3 + (i % 3)]}" opacity="${(.18 + rng() * .22).toFixed(2)}" filter="url(#${u}gl2)" transform="rotate(${(rng() * 360).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
            }
            for (let i = 0; i < 4; i++) {
                const cx = 20 + rng() * 60, cy = 20 + rng() * 60;
                layers += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(5 + rng() * 10).toFixed(1)}" ry="${(3 + rng() * 6).toFixed(1)}" fill="white" opacity="${(.03 + rng() * .06).toFixed(2)}" filter="url(#${u}gl)"/>`;
            }
        }
        else {
            for (let i = 0; i < 12; i++) {
                const x = rng() * 90, y = rng() * 90, w = 8 + rng() * 20, h = 8 + rng() * 20, rot = ~~(rng() * 45) - 22;
                layers += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(1 + rng() * 4).toFixed(1)}" fill="${pal[3 + (i % 3)]}" opacity="${(.08 + rng() * .18).toFixed(2)}" transform="rotate(${rot} ${(x + w / 2).toFixed(0)} ${(y + h / 2).toFixed(0)})"/>`;
            }
            layers += `<circle cx="50" cy="50" r="30" fill="${pal[5]}" opacity=".06" filter="url(#${u}gl2)"/>`;
        }
        const textLayer = `<circle cx="50" cy="50" r="22" fill="${pal[0]}" opacity=".45" filter="url(#${u}gl)"/><text x="50" y="53" text-anchor="middle" dominant-baseline="central" font-size="36" font-weight="800" fill="white" fill-opacity=".95" font-family="'Inter','SF Pro Display',system-ui,sans-serif" filter="url(#${u}sh)" letter-spacing="1">${letter}</text>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs><g clip-path="url(#${u}clip)">${bg}${layers}${textLayer}</g></svg>`;
        return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    const _B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    function base58Encode(bytes) {
        const b = Array.from(bytes);
        let zeros = 0;
        while (zeros < b.length && b[zeros] === 0)
            zeros++;
        const size = ((b.length - zeros) * 138 / 100 + 1) >>> 0;
        const buf = new Uint8Array(size);
        let hi = size - 1;
        for (let i = zeros; i < b.length; i++) {
            let carry = b[i];
            let j = size - 1;
            for (; (carry !== 0 || j > hi) && j >= 0; j--) {
                carry += 256 * buf[j];
                buf[j] = carry % 58;
                carry = (carry / 58) >>> 0;
            }
            hi = j;
        }
        let k = 0;
        while (k < size && buf[k] === 0)
            k++;
        let str = '';
        for (let i = 0; i < zeros; i++)
            str += _B58[0];
        for (let i = k; i < size; i++)
            str += _B58[buf[i]];
        return str;
    }
    function base58Decode(str) {
        const map = {};
        for (let i = 0; i < _B58.length; i++)
            map[_B58[i]] = i;
        let zeros = 0;
        while (zeros < str.length && str[zeros] === '1')
            zeros++;
        const size = ((str.length - zeros) * 733 / 1000 + 1) >>> 0;
        const buf = new Uint8Array(size);
        let hi = size - 1;
        for (let i = zeros; i < str.length; i++) {
            let carry = map[str[i]];
            if (carry === undefined)
                throw new Error('Invalid base58 character');
            let j = size - 1;
            for (; (carry !== 0 || j > hi) && j >= 0; j--) {
                carry += 58 * buf[j];
                buf[j] = carry % 256;
                carry = (carry / 256) >>> 0;
            }
            hi = j;
        }
        let k = 0;
        while (k < size && buf[k] === 0)
            k++;
        const result = new Uint8Array(zeros + (size - k));
        for (let i = 0; i < zeros; i++)
            result[i] = 0;
        for (let i = k; i < size; i++)
            result[zeros + (i - k)] = buf[i];
        return result;
    }
    async function generateKeypairOffline() {
        const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
        const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
        const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privBytes = Uint8Array.from(atob(privJwk.d.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const pubBytes = Uint8Array.from(atob(pubJwk.x.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const secretKey = new Uint8Array(64);
        secretKey.set(privBytes, 0);
        secretKey.set(pubBytes, 32);
        return { publicKey: pubBytes, secretKey, address: base58Encode(pubBytes), privateKey: base58Encode(secretKey) };
    }
    function mdRender(t) {
        if (!t)
            return '';
        return esc(t)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(96,165,250,.1);padding:1px 5px;border-radius:4px;font-size:11px;color:#60a5fa">$1</code>')
            .replace(/^### (.+)$/gm, '<div style="font-weight:700;margin-top:8px;color:#60a5fa">$1</div>')
            .replace(/^## (.+)$/gm, '<div style="font-weight:700;font-size:14px;margin-top:8px;color:#3b82f6">$1</div>')
            .replace(/^# (.+)$/gm, '<div style="font-weight:700;font-size:15px;margin-top:8px;color:#f0f4fc">$1</div>')
            .replace(/^- (.+)$/gm, '<div style="padding-left:12px">\u2022 $1</div>')
            .replace(/\n/g, '<br>');
    }
    function bgFetch(url, opts, timeoutMs) {
        opts = opts || {};
        var ms = timeoutMs || 8000;
        const headers = Object.assign({}, opts.headers || {});
        if (authToken && !headers['Authorization'])
            headers['Authorization'] = 'Bearer ' + authToken;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('bgFetch timeout')), ms);
            chrome.runtime.sendMessage({ type: 'wo-fetch', url, method: opts.method, headers, body: opts.body }, (resp) => {
                clearTimeout(timer);
                if (chrome.runtime.lastError)
                    return reject(new Error(chrome.runtime.lastError.message));
                if (!resp || !resp.ok)
                    return reject(new Error((resp && resp.body) || 'Request failed'));
                resolve(resp);
            });
        });
    }
    function showSwapProgressOverlay() {
        let el = document.getElementById('wo-swap-progress-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'wo-swap-progress-overlay';
            el.className = 'wo-swap-progress-overlay';
            el.innerHTML = '<div class="wo-swap-progress-overlay__blur"></div>'
                + '<video class="wo-swap-progress-overlay__video" src="swap-progress.webm" autoplay muted playsinline></video>';
            document.body.appendChild(el);
        }
        else {
            const vid = el.querySelector('video');
            if (vid) {
                vid.currentTime = 0;
                vid.play().catch(() => { });
            }
        }
        requestAnimationFrame(() => el.classList.add('is-visible'));
    }
    function hideSwapProgressOverlay() {
        const el = document.getElementById('wo-swap-progress-overlay');
        if (!el)
            return;
        el.classList.remove('is-visible');
        const vid = el.querySelector('video');
        setTimeout(() => { if (vid)
            vid.pause(); if (el.parentNode)
            el.remove(); }, 350);
    }
    function showSwapSuccessFx() { }
    function switchTab(name) {
        activeTab = name;
        const root = $('#wo-root');
        if (name === 'wallet') {
            root.classList.add('wallet-fullscreen');
        }
        else {
            root.classList.remove('wallet-fullscreen');
        }
        $$('.wo-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        $$('.wo-tab-content').forEach(c => c.classList.toggle('active', c.dataset.tab === name));
    }
    function renderTokenCard(mint, name, ticker, hostname, imageUrl) {
        const noTk = $('#wo-no-token'), info = $('#wo-token-info');
        if (noTk)
            noTk.style.display = 'none';
        if (info)
            info.style.display = 'block';
        $('#wo-tk-name').textContent = name.replace(/\([^)]+\)/, '').trim();
        $('#wo-tk-ticker').textContent = '$' + ticker;
        $('#wo-tk-mint').textContent = mint.slice(0, 6) + '...' + mint.slice(-4);
        const iconEl = $('#wo-tk-icon');
        if (imageUrl) {
            iconEl.innerHTML = '<img class="wo-token-icon-img" src="' + esc(imageUrl) + '" alt=""><span class="wo-tk-icon-letter" style="display:none">' + esc((name[0] || '?').toUpperCase()) + '</span>';
        }
        else if (cachedUserAvatar) {
            iconEl.innerHTML = '<img class="wo-token-icon-img" src="' + esc(cachedUserAvatar) + '" alt="">';
        }
        else {
            iconEl.innerHTML = '<img class="wo-token-icon-img" src="' + generateTokenAvatar(ticker || name) + '" alt="">';
        }
        $('#wo-tk-stats').innerHTML = [
            ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>', 'Mint', esc(mint.slice(0, 10) + '...' + mint.slice(-4)), 'mono'],
            ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>', 'Platform', esc(hostname), 'bold'],
            ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>', 'Status', '<span class="wo-tk-status-dot ready"></span>Ready', 'bold'],
            ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><polyline points="18 9 13 14 9 10 3 16"></polyline></svg>', 'Analysis', '<span class="wo-tk-status-dot idle"></span>Not run', 'bold'],
        ].map(([i, l, v, c]) => '<div class="wo-tk-stat-item"><div class="wo-tk-stat-icon">' + i + '</div><div class="wo-tk-stat-label">' + l + '</div><div class="wo-tk-stat-value ' + c + '">' + v + '</div></div>').join('');
    }
    let _metaFetchedForMint = null;
    function showTokenCard(mint, pageInfo) {
        const name = (pageInfo && pageInfo.name) || 'Unknown Token';
        const ticker = name.match(/\(([^)]+)\)/)?.[1] || name.split(/\s/)[0].toUpperCase().slice(0, 6);
        const hostname = (pageInfo && pageInfo.hostname) || '';
        if (pageInfo && pageInfo.userAvatar)
            cachedUserAvatar = pageInfo.userAvatar;
        renderTokenCard(mint, name, ticker, hostname, cachedTokenImage);
        if (activeTab !== 'chat')
            switchTab('token');
        if (_metaFetchedForMint !== mint) {
            _metaFetchedForMint = mint;
            fetchTokenMeta(mint, hostname);
        }
    }
    function fmtNum(n) {
        if (n == null || isNaN(n))
            return '—';
        if (n >= 1e9)
            return '$' + (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6)
            return '$' + (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3)
            return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + Number(n).toFixed(2);
    }
    function fmtPct(n) {
        if (n == null || isNaN(n))
            return '—';
        const sign = n >= 0 ? '+' : '';
        return sign + Number(n).toFixed(1) + '%';
    }
    function fmtAge(ts) {
        if (!ts)
            return '—';
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 60)
            return mins + 'm';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)
            return hrs + 'h ' + (mins % 60) + 'm';
        const days = Math.floor(hrs / 24);
        return days + 'd ' + (hrs % 24) + 'h';
    }
    function pctClass(n) {
        if (n == null || isNaN(n))
            return '';
        return n >= 0 ? 'wo-pct-up' : 'wo-pct-down';
    }
    function renderLiveData(pump) {
        const el = $('#wo-tk-live');
        if (!el)
            return;
        if (!pump) {
            el.innerHTML = '<div class="wo-live-loading">Loading live data…</div>';
            return;
        }
        const totalSupply = pump.total_supply || 0;
        const usdMcap = pump.usd_market_cap || 0;
        const solMcap = pump.market_cap || 0;
        const price = totalSupply > 0 ? usdMcap / (totalSupply / 1e6) : null;
        const solPrice = solMcap > 0 ? usdMcap / solMcap : null;
        const liqSol = pump.real_sol_reserves ? pump.real_sol_reserves / 1e9 : null;
        const liqUsd = liqSol && solPrice ? liqSol * solPrice : null;
        const age = pump.created_timestamp;
        const complete = pump.complete;
        const athMcap = pump.ath_market_cap;
        const replies = pump.reply_count;
        const lastTrade = pump.last_trade_timestamp;
        const koth = pump.king_of_the_hill_timestamp;
        const rows = [
            { label: 'Price', value: price ? '$' + price.toFixed(price < 0.0001 ? 10 : price < 0.001 ? 8 : price < 1 ? 6 : 4) : '—', cls: '' },
            { label: 'Market Cap', value: fmtNum(usdMcap), cls: '' },
            { label: 'MCap (SOL)', value: solMcap ? Number(solMcap).toLocaleString('en', { maximumFractionDigits: 0 }) + ' SOL' : '—', cls: '' },
            { label: 'Liquidity', value: liqUsd ? fmtNum(liqUsd) : (liqSol ? liqSol.toFixed(2) + ' SOL' : '—'), cls: '' },
            { label: 'SOL Price', value: solPrice ? '$' + solPrice.toFixed(2) : '—', cls: '' },
            { label: 'Age', value: fmtAge(age), cls: '' },
        ];
        if (complete != null)
            rows.push({ label: 'Bonding', value: complete ? 'Graduated ✓' : 'In Bonding Curve', cls: complete ? 'wo-pct-up' : '' });
        if (athMcap)
            rows.push({ label: 'ATH MCap', value: fmtNum(athMcap), cls: '' });
        if (replies != null)
            rows.push({ label: 'Replies', value: replies.toLocaleString(), cls: '' });
        if (lastTrade)
            rows.push({ label: 'Last Trade', value: fmtAge(lastTrade) + ' ago', cls: '' });
        if (koth)
            rows.push({ label: 'KOTH', value: fmtAge(koth) + ' ago', cls: '' });
        el.innerHTML = '<div class="wo-live-header"><span class="wo-live-dot"></span>Live Data</div>'
            + '<div class="wo-live-grid">' + rows.map(r => '<div class="wo-live-cell"><span class="wo-live-label">' + r.label + '</span><span class="wo-live-val ' + r.cls + '">' + r.value + '</span></div>').join('') + '</div>';
    }
    function fetchLiveData(mint) {
        bgFetch('https://frontend-api-v3.pump.fun/coins/' + encodeURIComponent(mint), {
            method: 'GET',
            headers: { 'Origin': 'https://pump.fun', 'Referer': 'https://pump.fun/' }
        }).then(resp => {
            if (!resp || !resp.body || currentMint !== mint)
                return;
            try {
                const data = JSON.parse(resp.body);
                _cachedPumpData = data;
                renderLiveData(data);
            }
            catch { }
        }).catch(() => { });
    }
    function startLivePolling(mint) {
        stopLivePolling();
        fetchLiveData(mint);
        _liveDataTimer = setInterval(() => {
            if (currentMint !== mint) {
                stopLivePolling();
                return;
            }
            fetchLiveData(mint);
        }, 8000);
    }
    function stopLivePolling() {
        if (_liveDataTimer) {
            clearInterval(_liveDataTimer);
            _liveDataTimer = null;
        }
    }
    function fetchTokenMeta(mint, hostname) {
        _cachedPumpData = null;
        bgFetch('https://frontend-api-v3.pump.fun/coins-v2/' + encodeURIComponent(mint), {
            method: 'GET',
            headers: { 'Origin': 'https://pump.fun', 'Referer': 'https://pump.fun/' }
        }).then(resp => {
            if (!resp || !resp.body)
                return;
            try {
                const data = JSON.parse(resp.body);
                if (data && currentMint === mint) {
                    _cachedPumpData = data;
                    if (data.name) {
                        const tkName = data.name + (data.symbol ? ' (' + data.symbol + ')' : '');
                        const tkTicker = data.symbol || data.name.split(/\s/)[0].toUpperCase().slice(0, 6);
                        if (data.image_uri)
                            cachedTokenImage = data.image_uri;
                        renderTokenCard(mint, tkName, tkTicker, hostname, cachedTokenImage);
                    }
                }
            }
            catch { }
        }).catch(() => { });
        startLivePolling(mint);
    }
    function hideTokenCard() {
        const noTk = $('#wo-no-token'), info = $('#wo-token-info'), result = $('#wo-token-result');
        if (noTk)
            noTk.style.display = '';
        if (info)
            info.style.display = 'none';
        if (result)
            result.style.display = 'none';
        cachedTokenImage = null;
        cachedUserAvatar = null;
        _metaFetchedForMint = null;
        _cachedPumpData = null;
        stopLivePolling();
        const liveEl = $('#wo-tk-live');
        if (liveEl)
            liveEl.innerHTML = '';
    }
    function showTokenResult(html) {
        const result = $('#wo-token-result');
        if (!result)
            return;
        result.innerHTML = '<div class="wo-msg ai"><div class="wo-msg-head"><span class="wo-msg-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> WHITEOWL</div>' + html + '</div>';
        result.style.display = 'block';
    }
    function connectWS() {
        if (reconnTimer) {
            clearTimeout(reconnTimer);
            reconnTimer = null;
        }
        const url = API.replace(/^http/, 'ws') + '/ws';
        try {
            ws = new WebSocket(url);
        }
        catch {
            setStatus(false);
            schedReconn();
            return;
        }
        ws.onopen = () => {
            setStatus(true);
            const msgs = $('#wo-messages');
            const hasConversation = msgs && msgs.querySelectorAll('.wo-msg.user, .wo-msg.ai').length > 0;
            if (!hasConversation)
                showHero();
            ws.send(JSON.stringify({ type: 'subscribe', event: '*' }));
        };
        ws.onmessage = (e) => { try {
            handleMsg(JSON.parse(e.data));
        }
        catch { } };
        ws.onclose = () => { setStatus(false); schedReconn(); };
        ws.onerror = () => { setStatus(false); };
    }
    function schedReconn() { if (!reconnTimer)
        reconnTimer = setTimeout(connectWS, 5000); }
    function setStatus(ok) {
        connected = ok;
        if (ok)
            _panelOnline = true;
        const el = $('#wo-conn');
        if (el) {
            el.textContent = _panelOnline ? 'Connected' : 'Offline (local)';
            el.className = 'wo-status ' + (_panelOnline ? 'online' : 'offline');
        }
        _updateSetupOverlay();
    }
    async function checkPanel() {
        await _apiReady;
        try {
            const r = await fetch(API + '/api/health', { signal: AbortSignal.timeout(3000) });
            if (r.ok) {
                const wasOffline = !_panelOnline;
                _panelOnline = true;
                if (wasOffline)
                    onPanelOnline();
                if (WLT.unlocked && WLT._lastPin && WLT.data?.address) {
                    keystoreHas(WLT.data.address).then(has => { if (!has)
                        _syncKeystoreFromServer(); });
                }
            }
            else if (!connected) {
                if (_panelOnline)
                    onPanelOffline();
                _panelOnline = false;
            }
        }
        catch {
            if (!connected) {
                if (_panelOnline)
                    onPanelOffline();
                _panelOnline = false;
            }
        }
        updatePanelIndicator();
    }
    function startPanelDetect() {
        checkPanel();
        if (_panelCheckTimer)
            clearInterval(_panelCheckTimer);
        _panelCheckTimer = setInterval(checkPanel, 8000);
    }
    function onPanelOnline() {
        updatePanelIndicator();
        initAuth().then(() => {
            connectWS();
            loadWalletData({ silent: true });
            syncOfflineWallets();
        }).catch(() => { });
    }
    function onPanelOffline() {
        if (WLT.data && WLT.data.address) {
            chrome.storage.local.set({ wo_cached_wallet: JSON.parse(JSON.stringify(WLT.data)) });
            if (WLT._cachedTokens)
                chrome.storage.local.set({ wo_cached_tokens: WLT._cachedTokens });
        }
        updatePanelIndicator();
    }
    function updatePanelIndicator() {
        const el = $('#wo-conn');
        if (el) {
            el.textContent = _panelOnline ? 'Connected' : 'Offline (local)';
            el.className = 'wo-status ' + (_panelOnline ? 'online' : 'offline');
        }
        _updateSetupOverlay();
    }
    let _setupOverlayDismissed = false;
    function _updateSetupOverlay() {
        const ov = document.getElementById('wo-setup-overlay');
        if (!ov)
            return;
        if (_panelOnline || _setupOverlayDismissed) {
            ov.style.display = 'none';
            if (_panelOnline)
                _setupOverlayDismissed = true;
        }
        else {
            ov.style.display = 'flex';
        }
    }
    function requirePanel(feature) {
        if (_panelOnline)
            return true;
        checkPanel();
        showPanelRequiredToast(feature);
        return false;
    }
    function showPanelRequiredToast(feature) {
        const existing = document.querySelectorAll('.wo-panel-toast');
        if (existing.length > 2)
            existing[0].remove();
        const toast = document.createElement('div');
        toast.className = 'wo-panel-toast';
        toast.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🔌</span><div><strong>' + esc(feature || 'This feature') + '</strong> — connect the main panel to proceed.<br><span style="opacity:0.6;font-size:10px">Run: npx tsx src/index.ts server</span></div></div>';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('wo-panel-toast-show'));
        setTimeout(() => { toast.classList.remove('wo-panel-toast-show'); setTimeout(() => toast.remove(), 300); }, 4000);
    }
    async function directRpcBalance(address) {
        const rpc = WLT.solRpc || 'https://api.mainnet-beta.solana.com';
        const r = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
            signal: AbortSignal.timeout(5000)
        });
        const data = await r.json();
        return (data.result && data.result.value || 0) / 1e9;
    }
    async function directSolPrice() {
        try {
            const r = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112', { signal: AbortSignal.timeout(5000) });
            const data = await r.json();
            return Number(data.data && data.data['So11111111111111111111111111111111111111112'] && data.data['So11111111111111111111111111111111111111112'].price) || 0;
        }
        catch {
            return 0;
        }
    }
    async function directRpcTokens(address) {
        const rpc = WLT.solRpc || 'https://api.mainnet-beta.solana.com';
        const r = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [address, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }] }),
            signal: AbortSignal.timeout(10000)
        });
        const data = await r.json();
        if (!data.result || !data.result.value)
            return [];
        return data.result.value.map(function (a) {
            var info = a.account.data.parsed.info;
            return {
                mint: info.mint,
                amount: Number(info.tokenAmount.uiAmountString || 0),
                decimals: info.tokenAmount.decimals,
                symbol: info.mint.slice(0, 4).toUpperCase(),
                name: '',
                logoURI: '',
            };
        }).filter(function (t) { return t.amount > 0; });
    }
    async function loadCachedWalletData() {
        const stored = await new Promise(function (r) {
            chrome.storage.local.get(['wo_cached_wallet', 'wo_cached_tokens'], function (res) { r(res); });
        });
        if (stored.wo_cached_wallet && stored.wo_cached_wallet.address) {
            WLT.data = stored.wo_cached_wallet;
            WLT._cachedTokens = stored.wo_cached_tokens || [];
            WLT._cachedNfts = [];
            WLT.lastLoadedAt = Date.now();
            WLT.tokensLoadedAt = 0;
            return true;
        }
        return false;
    }
    function handleMsg(m) {
        if (m.type === 'wallet-changed') {
            loadWalletData();
            return;
        }
        if (m.type === 'chat_token') {
            streamToken(m.token, m.final);
            return;
        }
        if (m.type === 'chat_response') {
            finalizeStream(m.response || m.data);
            return;
        }
        if (m.type === 'chat_status' && m.status === 'thinking') {
            showTyping();
            return;
        }
        if (m.type === 'chat_checkpoint') {
            insertCheckpoint(m.id, m.timestamp, m.preview);
            return;
        }
        if (m.type === 'checkpoint_restored') {
            handleCheckpointRestored(m);
            return;
        }
        if (m.type === 'chat_tool_call') {
            const tool = m.data?.tool || m.tool || 'tool';
            showTyping('Using ' + tool + '...');
            addActivityStep(tool, 'running');
            return;
        }
        if (m.type === 'chat_tool_result') {
            updateActivityStep(m.tool, 'done', m.durationMs);
            return;
        }
        if (m.type === 'chat_error') {
            removeTyping();
            resetStreamState();
            addMsg('sys', (m.error || 'Error'));
            return;
        }
        if (m.type === 'chat_image') {
            const c = $('#wo-messages');
            if (!c)
                return;
            const d = document.createElement('div');
            d.className = 'wo-msg ai';
            let html = '<div class="wo-msg-head"><span class="wo-msg-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> WHITEOWL</div>';
            html += '<img src="data:image/png;base64,' + m.image + '" style="max-width:100%;border-radius:8px;margin-top:6px;" />';
            if (m.caption)
                html += '<div style="margin-top:4px;font-size:12px;opacity:0.7;">' + m.caption.replace(/</g, '&lt;') + '</div>';
            d.innerHTML = html;
            c.appendChild(d);
            c.scrollTop = c.scrollHeight;
            return;
        }
        if (m.event === 'trenches:alert') {
            addMsg('sys', m.data.symbol + ' (score:' + m.data.score + ')');
        }
        if (m.event === 'trenches:buy') {
            addMsg('sys', 'Auto-buy: ' + m.data.symbol);
        }
    }
    let _streamEl = null;
    let _streamBuf = '';
    let _streamFinalizeTimer = null;
    function cancelStreamFinalizeFallback() {
        if (_streamFinalizeTimer) {
            clearTimeout(_streamFinalizeTimer);
            _streamFinalizeTimer = null;
        }
    }
    function resetStreamState() {
        cancelStreamFinalizeFallback();
        if (_streamEl)
            _streamEl.classList.remove('streaming');
        _streamEl = null;
        _streamBuf = '';
    }
    function streamToken(token, isFinal) {
        removeTyping();
        cancelStreamFinalizeFallback();
        const c = $('#wo-messages');
        if (!c)
            return;
        _streamBuf += token || '';
        if (!_streamEl) {
            _streamEl = document.createElement('div');
            _streamEl.className = 'wo-msg ai streaming';
            _streamEl.innerHTML = '<div class="wo-msg-head"><span class="wo-msg-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> WHITEOWL</div><div class="wo-stream-body"></div>';
            c.appendChild(_streamEl);
        }
        const body = _streamEl.querySelector('.wo-stream-body');
        if (body)
            body.innerHTML = mdRender(_streamBuf);
        c.scrollTop = c.scrollHeight;
        if (isFinal) {
            const finalSnapshot = _streamBuf;
            _streamFinalizeTimer = setTimeout(function () {
                if (_streamEl && _streamBuf === finalSnapshot)
                    finalizeStream(finalSnapshot);
            }, 120);
        }
    }
    function finalizeStream(fullContent) {
        removeTyping();
        clearActivityLog();
        cancelStreamFinalizeFallback();
        const c = $('#wo-messages');
        if (!c)
            return;
        const resolvedContent = fullContent || _streamBuf;
        if (_streamEl) {
            _streamEl.classList.remove('streaming');
            const body = _streamEl.querySelector('.wo-stream-body');
            if (body)
                body.innerHTML = mdRender(resolvedContent);
            if (activeTab === 'token' && currentMint)
                showTokenResult(mdRender(resolvedContent));
            resetStreamState();
            c.scrollTop = c.scrollHeight;
        }
        else {
            addMsg('ai', resolvedContent);
            resetStreamState();
        }
    }
    function hideHero() {
        const hero = document.querySelector('.wo-chat-hero');
        if (hero && !hero.classList.contains('wo-hero-hidden')) {
            hero.classList.remove('wo-hero-showing');
            hero.classList.add('wo-hero-hidden');
        }
    }
    function showHero() {
        const hero = document.querySelector('.wo-chat-hero');
        if (hero) {
            hero.classList.remove('wo-hero-hidden');
            hero.classList.add('wo-hero-showing');
            hero.addEventListener('animationend', () => hero.classList.remove('wo-hero-showing'), { once: true });
        }
    }
    function sendChat(msg) {
        if (!msg.trim() && !window._quotedText)
            return;
        if (!_panelOnline || !connected || !ws || ws.readyState !== WebSocket.OPEN) {
            if (!_panelOnline) {
                checkPanel();
                addMsg('sys', 'AI Chat requires the WhiteOwl panel. Start it with: npx tsx src/index.ts server');
            }
            else {
                addMsg('sys', 'Not connected (' + API + ')');
            }
            return;
        }
        hideHero();
        clearActivityLog();
        resetStreamState();
        removeTyping();
        var fullMsg = msg;
        if (window._quotedText) {
            var quote = window._quotedText.split('\n').map(function (l) { return '> ' + l; }).join('\n');
            fullMsg = quote + '\n\n' + msg;
            if (typeof window.clearQuotePreview === 'function')
                window.clearQuotePreview();
        }
        addMsg('user', fullMsg);
        showTyping();
        _autoNameChat(msg.trim());
        ws.send(JSON.stringify({ type: 'chat', agent: 'commander', message: fullMsg, chatId: _activeChatId }));
    }
    function addMsg(type, content) {
        const c = $('#wo-messages');
        if (!c)
            return;
        const d = document.createElement('div');
        d.className = 'wo-msg ' + type;
        if (type === 'ai') {
            d.innerHTML = '<div class="wo-msg-head"><span class="wo-msg-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> WHITEOWL</div>' + mdRender(content);
            if (activeTab === 'token' && currentMint)
                showTokenResult(mdRender(content));
        }
        else if (type === 'user') {
            d.textContent = content;
        }
        else {
            d.innerHTML = content;
        }
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }
    function showTyping(txt) {
        removeTyping();
        const c = $('#wo-messages');
        if (!c)
            return;
        const d = document.createElement('div');
        d.className = 'wo-typing';
        d.id = 'wo-typing';
        d.innerHTML = '<div class="wo-typing-header">' +
            '<span class="wo-msg-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> ' +
            '<span class="wo-typing-copy"><span class="wo-typing-text">' + esc(txt || 'Thinking...') + '</span><span class="wo-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span></span>' +
            '<span class="wo-typing-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>' +
            '</div>' +
            '<div class="wo-activity-log" id="wo-activity-log"></div>';
        d.querySelector('.wo-typing-header').addEventListener('click', () => {
            d.classList.toggle('expanded');
            const c2 = $('#wo-messages');
            if (c2)
                c2.scrollTop = c2.scrollHeight;
        });
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }
    function removeTyping() { const el = $('#wo-typing'); if (el)
        el.remove(); }
    let _activitySteps = [];
    let _activityStartTime = 0;
    function addActivityStep(tool, status) {
        if (!_activityStartTime)
            _activityStartTime = Date.now();
        _activitySteps.push({ tool, status, ts: Date.now() });
        renderActivityLog();
    }
    function updateActivityStep(tool, status, durationMs) {
        for (let i = _activitySteps.length - 1; i >= 0; i--) {
            if (_activitySteps[i].tool === tool && _activitySteps[i].status === 'running') {
                _activitySteps[i].status = status;
                _activitySteps[i].durationMs = durationMs;
                break;
            }
        }
        renderActivityLog();
    }
    function clearActivityLog() {
        _activitySteps = [];
        _activityStartTime = 0;
    }
    function renderActivityLog() {
        const log = $('#wo-activity-log');
        if (!log)
            return;
        const elapsed = ((Date.now() - _activityStartTime) / 1000).toFixed(1);
        log.innerHTML = '<div class="wo-al-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Activity \u00b7 ' + elapsed + 's</div>' +
            _activitySteps.map(s => {
                const icon = s.status === 'done'
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>'
                    : '<span class="wo-al-spinner"></span>';
                const dur = s.durationMs ? ' <span class="wo-al-dur">' + (s.durationMs / 1000).toFixed(1) + 's</span>' : '';
                return '<div class="wo-al-step ' + s.status + '">' + icon + '<span class="wo-al-tool">' + esc(s.tool) + '</span>' + dur + '</div>';
            }).join('');
        const c = $('#wo-messages');
        if (c)
            c.scrollTop = c.scrollHeight;
    }
    function insertCheckpoint(id, timestamp, preview) {
        const c = $('#wo-messages');
        if (!c)
            return;
        const d = document.createElement('div');
        d.className = 'wo-checkpoint';
        d.setAttribute('data-checkpoint-id', id);
        const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        d.innerHTML =
            '<div class="wo-checkpoint-line"></div>' +
                '<div class="wo-checkpoint-pill">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' +
                'CP #' + id + ' \u00b7 ' + esc(time) +
                '</div>' +
                '<button class="wo-checkpoint-btn" data-cp-id="' + id + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>' +
                'Restore' +
                '</button>' +
                '<div class="wo-checkpoint-line"></div>';
        d.querySelector('.wo-checkpoint-btn').addEventListener('click', function (e) {
            e.preventDefault();
            restoreCheckpoint(id);
        });
        c.appendChild(d);
    }
    function restoreCheckpoint(cpId) {
        if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
            addMsg('sys', 'Not connected');
            return;
        }
        const cpEl = document.querySelector('.wo-checkpoint[data-checkpoint-id="' + cpId + '"]');
        if (cpEl)
            cpEl.classList.add('restoring');
        ws.send(JSON.stringify({ type: 'restore_checkpoint', agent: 'commander', checkpointId: cpId, chatId: _activeChatId }));
    }
    function handleCheckpointRestored(m) {
        if (!m.ok) {
            addMsg('sys', 'Checkpoint not found');
            $$('.wo-checkpoint.restoring').forEach(el => el.classList.remove('restoring'));
            return;
        }
        const c = $('#wo-messages');
        if (!c)
            return;
        const cpId = m.checkpointId;
        const cpEl = document.querySelector('.wo-checkpoint[data-checkpoint-id="' + cpId + '"]');
        if (cpEl) {
            while (cpEl.nextElementSibling) {
                cpEl.nextElementSibling.remove();
            }
            cpEl.classList.remove('restoring');
        }
        $$('.wo-checkpoint').forEach(el => {
            const elId = parseInt(el.getAttribute('data-checkpoint-id'), 10);
            if (elId > cpId)
                el.remove();
        });
        resetStreamState();
        removeTyping();
        addMsg('sys', '\u21a9\ufe0f Restored to checkpoint #' + cpId + ' (' + m.removedMessages + ' messages removed)');
        c.scrollTop = c.scrollHeight;
    }
    function captureChart() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'wo-capture-tab' }, (resp) => {
                if (chrome.runtime.lastError || !resp || !resp.ok) {
                    resolve(null);
                }
                else {
                    resolve(resp.dataUrl);
                }
            });
        });
    }
    function buildLiveContext() {
        const el = $('#wo-tk-live');
        if (!el)
            return '';
        const cells = el.querySelectorAll('.wo-live-cell');
        if (!cells.length)
            return '';
        const parts = [];
        cells.forEach(c => {
            const label = c.querySelector('.wo-live-label');
            const val = c.querySelector('.wo-live-val');
            if (label && val)
                parts.push(label.textContent + ': ' + val.textContent);
        });
        return parts.join(' | ');
    }
    function sendAnalysis(promptPrefix) {
        if (!currentMint)
            return;
        hideHero();
        const mint = currentMint;
        const liveCtx = buildLiveContext();
        switchTab('chat');
        addMsg('sys', 'Capturing chart screenshot…');
        showTyping('Capturing chart…');
        captureChart().then(screenshot => {
            removeTyping();
            const msgs = $('#wo-messages');
            if (msgs && msgs.lastElementChild && msgs.lastElementChild.textContent.includes('Capturing chart')) {
                msgs.lastElementChild.remove();
            }
            const fullMsg = promptPrefix + mint
                + (liveCtx ? '\n\nLive market data: ' + liveCtx : '')
                + (screenshot ? '\n[Chart screenshot attached]' : '');
            if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
                addMsg('sys', 'Not connected (' + API + ')');
                return;
            }
            addMsg('user', promptPrefix + mint + (liveCtx ? ' (+ live data + chart screenshot)' : ''));
            showTyping();
            const payload = { type: 'chat', agent: 'commander', message: fullMsg, chatId: _activeChatId };
            if (screenshot)
                payload.screenshot = screenshot;
            if (liveCtx)
                payload.context = liveCtx;
            ws.send(JSON.stringify(payload));
        });
    }
    function updateInspUI() {
        const count = $('#wo-insp-count');
        if (count)
            count.textContent = captures.length + ' captured';
        renderCaptures();
    }
    function renderCaptures() {
        const list = $('#wo-insp-list');
        if (!list)
            return;
        if (!captures.length) {
            list.innerHTML = '<div class="wo-insp-empty"><span class="wo-insp-empty-count" id="wo-insp-count">0 captured</span>No elements captured yet.</div>';
            return;
        }
        list.innerHTML = captures.map((c, i) => '<div class="wo-insp-item"><span class="wo-insp-item-tag">' + esc(c.tag) + '</span><span class="wo-insp-item-sel">' + esc(c.selector.substring(0, 50)) + '</span><button class="wo-insp-item-del" data-i="' + i + '">\u00D7</button></div>').join('');
        list.querySelectorAll('.wo-insp-item-del').forEach(btn => {
            btn.addEventListener('click', (e) => { captures.splice(parseInt(e.target.dataset.i, 10), 1); updateInspUI(); });
        });
    }
    function sendAllCaptures() {
        if (!captures.length)
            return;
        let sent = 0;
        captures.forEach(p => {
            bgFetch(API + '/api/browser/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
                .then(() => { sent++; if (sent === captures.length)
                addMsg('sys', 'Sent ' + sent + ' elements'); })
                .catch(() => { });
        });
    }
    function startInspector() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0])
                chrome.tabs.sendMessage(tabs[0].id, { type: 'wo-inspector-start' }, () => { void chrome.runtime.lastError; });
        });
        const active = $('#wo-insp-active');
        if (active)
            active.classList.add('visible');
        const btn = $('#wo-insp-start-btn');
        if (btn) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Stop Inspector';
            btn.className = 'wo-btn wo-btn-danger wo-btn-sm wo-btn-full';
        }
    }
    function stopInspector() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0])
                chrome.tabs.sendMessage(tabs[0].id, { type: 'wo-inspector-stop' }, () => { void chrome.runtime.lastError; });
        });
        const active = $('#wo-insp-active');
        if (active)
            active.classList.remove('visible');
        const btn = $('#wo-insp-start-btn');
        if (btn) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Start Inspector';
            btn.className = 'wo-btn wo-btn-primary wo-btn-sm wo-btn-full';
        }
    }
    let inspectorActive = false;
    function toggleInspector() {
        inspectorActive = !inspectorActive;
        if (inspectorActive)
            startInspector();
        else
            stopInspector();
    }
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'wo-mint-detected') {
            if (msg.mint !== currentMint) {
                cachedTokenImage = null;
                cachedUserAvatar = null;
                _metaFetchedForMint = null;
            }
            currentMint = msg.mint;
            showTokenCard(msg.mint, msg.pageInfo);
        }
        if (msg.type === 'wo-mint-cleared') {
            currentMint = null;
            hideTokenCard();
        }
        if (msg.type === 'wo-inspector-capture') {
            captures.push(msg.payload);
            updateInspUI();
            bgFetch(API + '/api/browser/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg.payload) }).catch(() => { });
        }
        if (msg.type === 'wo-inspector-stopped') {
            inspectorActive = false;
            const active = $('#wo-insp-active');
            if (active)
                active.classList.remove('visible');
            const btn = $('#wo-insp-start-btn');
            if (btn) {
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Start Inspector';
                btn.className = 'wo-btn wo-btn-primary wo-btn-sm wo-btn-full';
            }
        }
        if (msg.type === 'wo-wallet-connect') {
            sendResponse({ ack: true });
            const { origin, favicon, tabId, reqId, detectedWallets } = msg;
            const modal = document.getElementById('wo-connect-approve-modal');
            try {
                let hostname = origin || '';
                try {
                    hostname = new URL(origin).hostname;
                }
                catch { }
                const siteNameEl = document.getElementById('wo-connect-site-name');
                if (siteNameEl)
                    siteNameEl.textContent = hostname;
                const siteUrlEl = document.getElementById('wo-connect-site-url');
                if (siteUrlEl)
                    siteUrlEl.textContent = origin || '';
                const iconEl = document.getElementById('wo-connect-site-icon');
                if (favicon && iconEl)
                    iconEl.innerHTML = `<img src="${esc(favicon)}" alt="">`;
                const addr = WLT.data?.address || '—';
                const walletAddrEl = document.getElementById('wo-connect-wallet-addr');
                if (walletAddrEl)
                    walletAddrEl.textContent = addr;
                const aiScanSection = document.getElementById('wo-connect-ai-scan-section');
                const aiScanBtn = document.getElementById('wo-connect-ai-scan-btn');
                const aiScanLoading = document.getElementById('wo-connect-ai-scan-loading');
                const aiScanResult = document.getElementById('wo-connect-ai-scan-result');
                if (aiScanSection)
                    aiScanSection.style.display = '';
                if (aiScanBtn)
                    aiScanBtn.style.display = '';
                if (aiScanLoading)
                    aiScanLoading.style.display = 'none';
                if (aiScanResult)
                    aiScanResult.style.display = 'none';
                if (modal) {
                    modal._aiScanRunning = false;
                    modal._aiScanDone = false;
                }
                const approveBtn = document.getElementById('wo-connect-approve');
                if (approveBtn) {
                    approveBtn.className = 'wo-btn wo-btn-primary wo-btn-sm wo-btn-full';
                    approveBtn.textContent = 'Connect';
                }
                const altRow = document.getElementById('wo-connect-alt-wallets');
                if (altRow) {
                    if (detectedWallets && detectedWallets.length > 0) {
                        altRow.innerHTML = detectedWallets.map(name => `<button class="wo-btn wo-btn-sm wo-btn-full wo-alt-wallet-btn" data-wallet="${esc(name)}" style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);color:var(--primary2);font-size:12px;gap:4px;display:flex;align-items:center;justify-content:center">`
                            + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
                            + `Use ${esc(name)}</button>`).join('');
                        altRow.style.display = 'flex';
                    }
                    else {
                        altRow.innerHTML = '';
                        altRow.style.display = 'none';
                    }
                }
            }
            catch (e) {
            }
            if (modal) {
                modal.classList.add('visible');
                modal._pending = { tabId, reqId };
            }
            return true;
        }
        if (msg.type === 'wo-scan-page-drainer-result' && msg.result) {
            const modal = document.getElementById('wo-connect-approve-modal');
            if (modal)
                modal._nativeScanResult = msg.result;
        }
        if (msg.type === 'wo-collect-page-data-result' && msg.pageData) {
            const aiBtn = document.getElementById('wo-connect-ai-scan-btn');
            const aiLoading = document.getElementById('wo-connect-ai-scan-loading');
            const aiResult = document.getElementById('wo-connect-ai-scan-result');
            const modal = document.getElementById('wo-connect-approve-modal');
            if (modal._aiScanDone)
                return;
            if (aiBtn)
                aiBtn.style.display = 'none';
            if (aiLoading)
                aiLoading.style.display = '';
            const payload = msg.pageData;
            walletFetch('/api/wallet/ai-scan-page', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), timeout: 30000 })
                .catch(function () { return { verdict: 'unknown', summary: 'AI scan failed — tap Retry to try again', risks: [], recommendation: 'Proceed with caution', _failed: true }; })
                .then(function (ai) {
                if (aiLoading)
                    aiLoading.style.display = 'none';
                if (ai._failed) {
                    if (modal) {
                        modal._aiScanRunning = false;
                        modal._aiScanDone = false;
                    }
                    if (aiBtn) {
                        aiBtn.style.display = '';
                        aiBtn.textContent = '🔄 Retry AI Scan';
                    }
                    if (aiResult)
                        aiResult.style.display = 'none';
                    return;
                }
                if (modal) {
                    modal._aiScanRunning = false;
                    modal._aiScanDone = true;
                }
                var verdictEl = document.getElementById('wo-connect-ai-verdict');
                var summaryEl = document.getElementById('wo-connect-ai-summary');
                var risksEl = document.getElementById('wo-connect-ai-risks');
                var recEl = document.getElementById('wo-connect-ai-recommendation');
                var approveBtn = document.getElementById('wo-connect-approve');
                var v = ai.verdict || 'unknown';
                if (verdictEl) {
                    verdictEl.textContent = v === 'dangerous' ? '🚨 DANGEROUS' : v === 'suspicious' ? '⚠️ Suspicious' : v === 'safe' ? '✅ Safe' : '❓ Unknown';
                    verdictEl.style.color = v === 'dangerous' ? 'var(--red)' : v === 'suspicious' ? '#f59e0b' : v === 'safe' ? '#22c55e' : 'var(--text2)';
                }
                if (summaryEl)
                    summaryEl.textContent = ai.summary || '';
                if (risksEl && ai.risks && ai.risks.length) {
                    risksEl.innerHTML = ai.risks.map(function (r) {
                        return '<div style="color:var(--red);display:flex;gap:4px;align-items:flex-start"><span style="flex-shrink:0">🚫</span><span>' + esc(r) + '</span></div>';
                    }).join('');
                }
                else if (risksEl) {
                    risksEl.innerHTML = '';
                }
                if (recEl)
                    recEl.textContent = ai.recommendation || '';
                if (approveBtn && v === 'dangerous') {
                    approveBtn.className = 'wo-btn wo-btn-sm wo-btn-full risk-high';
                    approveBtn.textContent = '⚠️ Connect Anyway (DANGEROUS)';
                }
                else if (approveBtn && v === 'suspicious') {
                    approveBtn.className = 'wo-btn wo-btn-sm wo-btn-full wo-btn-warning';
                    approveBtn.textContent = '⚠️ Connect (Suspicious)';
                }
                if (aiResult)
                    aiResult.style.display = '';
            });
        }
        if (msg.type === 'wo-wallet-sign-tx') {
            sendResponse({ ack: true });
            const { origin, favicon, tabId, reqId, txType, transaction, signMessageData } = msg;
            var isSignMessage = txType === 'Sign Message' || (!transaction && !!signMessageData);
            var modal = document.getElementById('wo-tx-approve-modal');
            var simLoading = document.getElementById('wo-tx-sim-loading');
            var shield = document.getElementById('wo-tx-shield');
            var title = document.getElementById('wo-tx-title');
            var riskSection = document.getElementById('wo-tx-risk-section');
            var riskFill = document.getElementById('wo-tx-risk-fill');
            var riskValue = document.getElementById('wo-tx-risk-value');
            var ixSection = document.getElementById('wo-tx-instructions');
            var warningsEl = document.getElementById('wo-tx-warnings');
            var aiSection = document.getElementById('wo-tx-ai-section');
            var approveBtn = document.getElementById('wo-tx-approve-confirm');
            var aiScanBtn = document.getElementById('wo-tx-ai-scan');
            if (modal) {
                modal._pending = { tabId, reqId };
                modal._transaction = transaction || null;
                modal._simResult = null;
            }
            try {
                var hostname = '';
                try {
                    hostname = new URL(origin).hostname;
                }
                catch {
                    hostname = origin || 'unknown';
                }
                const siteNameEl = document.getElementById('wo-tx-site-name');
                if (siteNameEl)
                    siteNameEl.textContent = hostname;
                const siteUrlEl = document.getElementById('wo-tx-site-url');
                if (siteUrlEl)
                    siteUrlEl.textContent = origin;
                const iconEl = document.getElementById('wo-tx-site-icon');
                if (favicon && iconEl)
                    iconEl.innerHTML = `<img src="${esc(favicon)}" alt="">`;
                const txTypeEl = document.getElementById('wo-tx-type');
                if (txTypeEl)
                    txTypeEl.textContent = txType || 'Transaction';
                if (shield)
                    shield.textContent = '🛡️';
                if (title)
                    title.textContent = 'Approve Transaction';
                if (riskSection)
                    riskSection.style.display = 'none';
                if (ixSection) {
                    ixSection.style.display = 'none';
                    ixSection.innerHTML = '';
                }
                if (warningsEl) {
                    warningsEl.style.display = 'none';
                    warningsEl.innerHTML = '';
                }
                if (aiSection)
                    aiSection.style.display = 'none';
                if (approveBtn) {
                    approveBtn.className = 'wo-btn wo-btn-primary wo-btn-sm wo-btn-full';
                    approveBtn.disabled = false;
                }
                if (aiScanBtn) {
                    aiScanBtn.disabled = isSignMessage;
                    if (isSignMessage)
                        aiScanBtn.title = 'AI scan not available for message signing';
                }
                if (isSignMessage && signMessageData) {
                    try {
                        var msgText = new TextDecoder().decode(new Uint8Array(signMessageData));
                        if (ixSection) {
                            ixSection.style.display = '';
                            ixSection.innerHTML = '<div class="wo-tx-ix-title">Message to Sign</div>'
                                + '<div class="wo-tx-ix-item" style="white-space:pre-wrap;word-break:break-all;font-size:11px;padding:6px 8px;background:var(--bg2);border-radius:6px">' + esc(msgText) + '</div>';
                        }
                    }
                    catch (e) { }
                    if (shield)
                        shield.textContent = '✉️';
                    if (title)
                        title.textContent = 'Sign Message';
                }
                if (modal)
                    modal.classList.add('visible');
            }
            catch {
                if (modal)
                    modal.classList.add('visible');
            }
            if (transaction && simLoading && _panelOnline) {
                simLoading.style.display = '';
                walletFetch('/api/wallet/simulate-dapp-tx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transaction, origin }),
                    timeout: 15000,
                }).then(function (data) {
                    if (simLoading)
                        simLoading.style.display = 'none';
                    if (!data || data.error)
                        return;
                    if (modal)
                        modal._simResult = data;
                    if (riskSection)
                        riskSection.style.display = '';
                    if (riskFill) {
                        riskFill.style.width = data.riskScore + '%';
                        riskFill.className = 'wo-safety-risk-fill risk-' + data.riskLevel;
                    }
                    if (riskValue) {
                        riskValue.textContent = data.riskScore + '/100';
                        riskValue.style.color = data.riskLevel === 'high' ? 'var(--red)' : data.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';
                    }
                    if (shield)
                        shield.textContent = data.riskLevel === 'high' ? '🚨' : data.riskLevel === 'medium' ? '⚠️' : '✅';
                    if (title)
                        title.textContent = data.riskLevel === 'high' ? '🚨 Dangerous Transaction!' : data.riskLevel === 'medium' ? '⚠️ Review Carefully' : 'Transaction Looks Safe';
                    if (data.instructions && data.instructions.length && ixSection) {
                        ixSection.style.display = '';
                        ixSection.innerHTML = '<div class="wo-tx-ix-title">Decoded Instructions</div>' +
                            data.instructions.map(function (ix) {
                                var isRisky = ix.type.includes('Approve') || ix.type.includes('SetAuthority') || ix.type.includes('Assign');
                                var iconStr = isRisky ? '🚫' : ix.type.includes('Transfer') ? '💸' : ix.type.includes('Swap') || ix.programName.includes('Jupiter') || ix.programName.includes('Raydium') ? '🔄' : 'ℹ️';
                                var detailStr = '';
                                if (ix.details.amount != null)
                                    detailStr += ' ' + ix.details.amount + ' SOL';
                                if (ix.details.delegate)
                                    detailStr += ' → delegate: ' + ix.details.delegate.slice(0, 8) + '…';
                                if (ix.details.direction === 'outgoing')
                                    detailStr += ' [OUTGOING]';
                                return '<div class="wo-tx-ix-item' + (isRisky ? ' wo-tx-ix-risky' : '') + '">'
                                    + '<span class="wo-tx-ix-icon">' + iconStr + '</span>'
                                    + '<span class="wo-tx-ix-label">' + esc(ix.type) + '</span>'
                                    + '<span class="wo-tx-ix-prog">' + esc(ix.programName) + '</span>'
                                    + (detailStr ? '<span class="wo-tx-ix-detail">' + esc(detailStr) + '</span>' : '')
                                    + '</div>';
                            }).join('');
                    }
                    if (data.warnings && data.warnings.length && warningsEl) {
                        warningsEl.style.display = '';
                        warningsEl.innerHTML = data.warnings.map(function (w) {
                            var icon = w.level === 'danger' ? '🚫' : w.level === 'warning' ? '⚠️' : 'ℹ️';
                            return '<div class="wo-safety-warn-item ' + esc(w.level || 'info') + '">'
                                + '<span class="wo-safety-warn-icon">' + icon + '</span>'
                                + '<span>' + esc(w.message) + '</span></div>';
                        }).join('');
                    }
                    if (approveBtn && data.riskLevel === 'high') {
                        approveBtn.className = 'wo-btn wo-btn-sm wo-btn-full risk-high';
                    }
                }).catch(function () {
                    if (simLoading)
                        simLoading.style.display = 'none';
                });
            }
            else if (simLoading) {
                simLoading.style.display = 'none';
            }
            return true;
        }
    });
    function bindEvents() {
        $$('.wo-tab').forEach(t => { t.addEventListener('click', () => switchTab(t.dataset.tab)); });
        $('#wo-wlt-back-ai').addEventListener('click', () => switchTab('chat'));
        $('#wo-analyze-btn').addEventListener('click', () => { sendAnalysis('Analyze this token: '); });
        $('#wo-rate-btn').addEventListener('click', () => { sendAnalysis('Rate this project 1-10 and explain why: '); });
        $('#wo-deep-btn').addEventListener('click', () => {
            sendAnalysis('Deep search and full analysis of token — check socials, holders, liquidity, dev wallet, contract safety, community activity: ');
        });
        const inp = $('#wo-input');
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChat(inp.value);
            inp.value = '';
            inp.style.height = '36px';
        } });
        inp.addEventListener('input', () => { inp.style.height = '36px'; inp.style.height = Math.min(inp.scrollHeight, 100) + 'px'; });
        $('#wo-send-btn').addEventListener('click', () => { sendChat(inp.value); inp.value = ''; inp.style.height = '36px'; });
        $$('.wo-qbtn').forEach(b => {
            b.addEventListener('click', () => {
                const map = { trenches: 'Show Trenches status', monitor: 'Show monitor status', trending: 'What tokens are trending right now?', news: 'What are the latest Solana/crypto news?', portfolio: 'Show my portfolio' };
                sendChat(map[b.dataset.cmd] || b.dataset.cmd);
            });
        });
        $('#wo-insp-start-btn').addEventListener('click', toggleInspector);
        $('#wo-insp-stop-btn2').addEventListener('click', () => { inspectorActive = false; stopInspector(); });
        $('#wo-insp-send-btn').addEventListener('click', sendAllCaptures);
        $('#wo-insp-clear-btn').addEventListener('click', () => { captures.length = 0; updateInspUI(); });
        $('#wo-chat-list-btn').addEventListener('click', _toggleChatList);
        $('#wo-chat-list-backdrop')?.addEventListener('click', _closeChatList);
        $('#wo-chat-list-close')?.addEventListener('click', _closeChatList);
        $('#wo-chat-new-btn').addEventListener('click', _createNewChat);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && _chatListOpen)
                _closeChatList();
        });
    }
    function requestCurrentMint() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'wo-get-mint' }, (resp) => {
                    if (chrome.runtime.lastError)
                        return;
                    if (resp && resp.mint) {
                        currentMint = resp.mint;
                        showTokenCard(resp.mint, resp.pageInfo);
                    }
                });
            }
        });
    }
    const SVG_SOL = `<svg viewBox="0 0 397.7 311.7" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px"><defs><linearGradient id="sol-jg" x1="360" y1="351" x2="-95" y2="-44" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#9945ff"/><stop offset="100%" stop-color="#14f195"/></linearGradient></defs><path fill="url(#sol-jg)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7zm0-164.6c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7zM333.1 3.8C330.7 1.4 327.4 0 323.9 0H6.5C.7 0-2.2 7 1.9 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1L333.1 3.8z"/></svg>`;
    const SVG_EVM = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px"><path fill="#627eea" d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16z"/><g fill="#fff" fill-rule="evenodd"><path fill-opacity=".6" d="M16.498 4v8.87l7.497 3.35z"/><path d="M16.498 4L9 16.22l7.498-3.35z"/><path fill-opacity=".6" d="M16.498 21.968v6.027L24 17.616z"/><path d="M16.498 27.995v-6.028L9 17.616z"/><path fill-opacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z"/><path fill-opacity=".6" d="M9 16.22l7.498 4.353v-7.701z"/></g></svg>`;
    const WLT = {
        unlocked: false,
        pinInput: '',
        pinMode: 'unlock',
        setupPinFirst: '',
        data: null,
        autoLockTimer: null,
        autoLockMins: 10,
        pinResolve: null,
        networks: {},
        customNetworks: [],
        solRpc: 'https://api.mainnet-beta.solana.com',
        _rpcPrompted: false,
        homeTab: 'tokens',
        tabsBound: false,
        loadingPromise: null,
        lastLoadedAt: 0,
        tokensLoadedAt: 0,
    };
    async function sha256hex(text) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function wltView(id) {
        document.querySelectorAll('.wo-wlt-view').forEach(v => v.classList.remove('wlt-active'));
        const el = document.getElementById(id);
        if (el)
            el.classList.add('wlt-active');
        if (id !== 'wo-wlt-home')
            stopBalancePolling();
    }
    async function wltInit() {
        if (!WLT._authReady && _panelOnline) {
            WLT._pendingInit = true;
            showWalletLoadingState();
            return;
        }
        if (!WLT.unlocked && !WLT._pinCheckDone) {
            const stored = await new Promise(r => chrome.storage.local.get(['wo_pin_hash'], r));
            if (!stored.wo_pin_hash) {
                WLT._pinCheckDone = true;
                const ok = await requirePin();
                if (!ok)
                    return;
            }
            else {
                WLT._pinCheckDone = true;
            }
        }
        if (!WLT._rpcPrompted && WLT.solRpc === 'https://api.mainnet-beta.solana.com') {
            WLT._rpcPrompted = true;
            chrome.storage.local.set({ wo_rpc_prompted: true });
            openSolRpcModal();
        }
        if (WLT.data && WLT.data.configured) {
            renderWalletHome();
            if (Date.now() - (WLT.lastLoadedAt || 0) < 15000 && !WLT.loadingPromise)
                return;
            if (_panelOnline)
                loadWalletData({ silent: true });
            return;
        }
        if (!_panelOnline) {
            await checkPanel();
        }
        if (!_panelOnline) {
            const loaded = await loadCachedWalletData();
            if (loaded) {
                WLT.data.configured = true;
                renderWalletHome();
                offlineRefresh();
                return;
            }
            showSetupView();
            showPanelRequiredToast('Wallet Setup');
            return;
        }
        if (WLT.loadingPromise) {
            showWalletLoadingState();
            await WLT.loadingPromise;
            if (!WLT.data)
                loadWalletData();
            return;
        }
        showWalletLoadingState();
        loadWalletData();
    }
    async function offlineRefresh() {
        if (!WLT.data || !WLT.data.address)
            return;
        try {
            const bal = await directRpcBalance(WLT.data.address);
            WLT.data.balance = bal;
            _lastBal = bal;
            const el = document.getElementById('wo-wlt-bal-num');
            if (el)
                el.textContent = bal.toFixed(4);
            updateUsdDisplay(bal);
        }
        catch { }
        try {
            const price = await directSolPrice();
            if (price) {
                _solPrice = price;
                if (_lastBal !== null)
                    updateUsdDisplay(_lastBal);
            }
        }
        catch { }
        try {
            const tokens = await directRpcTokens(WLT.data.address);
            if (tokens.length) {
                WLT._cachedTokens = tokens;
                WLT.tokensLoadedAt = Date.now();
                renderTokenList(tokens);
                chrome.storage.local.set({ wo_cached_tokens: tokens });
            }
        }
        catch { }
    }
    function requirePin() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['wo_pin_hash'], (res) => {
                const cur = document.querySelector('.wo-wlt-view.wlt-active');
                const prevId = cur ? cur.id : null;
                const wrappedResolve = (ok) => { if (prevId)
                    wltView(prevId); resolve(ok); };
                if (!res.wo_pin_hash) {
                    WLT.pinMode = 'setup';
                    WLT.pinInput = '';
                    WLT.pinResolve = wrappedResolve;
                    updatePinUI('Set a 6-digit PIN', 'You need a PIN to protect wallet access');
                    const forgot = document.getElementById('wo-pin-forgot');
                    if (forgot)
                        forgot.style.display = 'none';
                    wltView('wo-wlt-pin');
                    renderNumpad();
                }
                else if (!WLT.unlocked) {
                    WLT.pinMode = 'unlock';
                    WLT.pinInput = '';
                    WLT.pinResolve = wrappedResolve;
                    updatePinUI('Enter PIN', 'Enter your PIN to continue');
                    const forgot = document.getElementById('wo-pin-forgot');
                    if (forgot)
                        forgot.style.display = 'block';
                    wltView('wo-wlt-pin');
                    renderNumpad();
                }
                else {
                    startAutoLock();
                    resolve(true);
                }
            });
        });
    }
    function updatePinUI(title, subtitle) {
        const t = document.getElementById('wo-pin-title');
        const s = document.getElementById('wo-pin-subtitle');
        if (t)
            t.textContent = title;
        if (s)
            s.textContent = subtitle;
        updatePinDots();
        const err = document.getElementById('wo-pin-error');
        if (err)
            err.textContent = '';
    }
    function updatePinDots() {
        const dots = document.querySelectorAll('#wo-pin-dots span');
        dots.forEach((d, i) => {
            d.classList.toggle('filled', i < WLT.pinInput.length);
            d.classList.remove('err');
        });
    }
    function renderNumpad() {
        const numpad = document.getElementById('wo-pin-numpad');
        if (!numpad)
            return;
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '→'];
        numpad.innerHTML = keys.map(k => {
            let cls = 'wo-numpad-btn';
            if (k === '⌫')
                cls += ' del';
            else if (k === '→')
                cls += ' submit';
            return `<button class="${cls}" data-key="${k}">${k}</button>`;
        }).join('');
        numpad.querySelectorAll('.wo-numpad-btn').forEach(btn => {
            btn.addEventListener('click', () => handlePinKey(btn.dataset.key));
        });
    }
    async function handlePinKey(key) {
        const errEl = document.getElementById('wo-pin-error');
        if (errEl)
            errEl.textContent = '';
        if (key === '⌫') {
            WLT.pinInput = WLT.pinInput.slice(0, -1);
            updatePinDots();
        }
        else if (key === '→') {
            if (WLT.pinInput.length === 6)
                await submitPin();
        }
        else if (/^\d$/.test(key) && WLT.pinInput.length < 6) {
            WLT.pinInput += key;
            updatePinDots();
            if (WLT.pinInput.length === 6)
                setTimeout(() => submitPin(), 120);
        }
    }
    async function submitPin() {
        const pin = WLT.pinInput;
        WLT.pinInput = '';
        updatePinDots();
        const errEl = document.getElementById('wo-pin-error');
        if (WLT.pinMode === 'setup') {
            WLT.setupPinFirst = pin;
            WLT.pinMode = 'confirm';
            updatePinUI('Confirm PIN', 'Re-enter your 6-digit PIN to confirm');
        }
        else if (WLT.pinMode === 'confirm') {
            if (pin === WLT.setupPinFirst) {
                const hash = await sha256hex(pin);
                chrome.storage.local.set({ wo_pin_hash: hash });
                WLT.unlocked = true;
                WLT._lastPin = pin;
                WLT.setupPinFirst = '';
                startAutoLock();
                if (WLT.pinResolve) {
                    WLT.pinResolve(true);
                    WLT.pinResolve = null;
                }
                else
                    loadWalletData();
            }
            else {
                WLT.setupPinFirst = '';
                WLT.pinMode = 'setup';
                updatePinUI('Set a 6-digit PIN', 'PINs did not match — try again');
                if (errEl)
                    errEl.textContent = 'PINs do not match';
                document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.add('err'));
                setTimeout(() => document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.remove('err')), 600);
            }
        }
        else if (WLT.pinMode === 'change-old') {
            const hash = await sha256hex(pin);
            chrome.storage.local.get(['wo_pin_hash'], (res) => {
                if (res.wo_pin_hash === hash) {
                    WLT.pinMode = 'change-new';
                    WLT.pinInput = '';
                    updatePinUI('New PIN', 'Enter your new 6-digit PIN');
                }
                else {
                    WLT.pinInput = '';
                    updatePinDots();
                    if (errEl)
                        errEl.textContent = 'Incorrect current PIN';
                    document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.add('err'));
                    setTimeout(() => document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.remove('err')), 600);
                }
            });
        }
        else if (WLT.pinMode === 'change-new') {
            WLT.setupPinFirst = pin;
            WLT.pinMode = 'change-confirm';
            updatePinUI('Confirm New PIN', 'Re-enter your new 6-digit PIN');
        }
        else if (WLT.pinMode === 'change-confirm') {
            if (pin === WLT.setupPinFirst) {
                const oldPin = WLT._lastPin;
                const hash = await sha256hex(pin);
                chrome.storage.local.set({ wo_pin_hash: hash });
                WLT.setupPinFirst = '';
                WLT.unlocked = true;
                WLT._lastPin = pin;
                if (oldPin && oldPin !== pin)
                    keystoreReencryptAll(oldPin, pin).catch(() => { });
                startAutoLock();
                renderSettings();
                wltView('wo-wlt-settings');
                if (errEl) {
                    errEl.style.color = 'var(--green)';
                    errEl.textContent = 'PIN changed!';
                    setTimeout(() => { errEl.textContent = ''; errEl.style.color = ''; }, 1500);
                }
            }
            else {
                WLT.setupPinFirst = '';
                WLT.pinMode = 'change-new';
                updatePinUI('New PIN', 'PINs did not match — try again');
                if (errEl)
                    errEl.textContent = 'PINs do not match';
                document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.add('err'));
                setTimeout(() => document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.remove('err')), 600);
            }
        }
        else {
            const hash = await sha256hex(pin);
            chrome.storage.local.get(['wo_pin_hash'], async (res) => {
                if (res.wo_pin_hash === hash) {
                    WLT.unlocked = true;
                    WLT._lastPin = pin;
                    startAutoLock();
                    if (WLT.pinResolve) {
                        WLT.pinResolve(true);
                        WLT.pinResolve = null;
                        _syncKeystoreFromServer();
                    }
                    else
                        loadWalletData();
                }
                else {
                    if (errEl)
                        errEl.textContent = 'Incorrect PIN';
                    document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.add('err'));
                    setTimeout(() => document.querySelectorAll('#wo-pin-dots span').forEach(d => d.classList.remove('err')), 600);
                }
            });
        }
    }
    function wltLock() {
        WLT.unlocked = false;
        WLT._lastPin = null;
        if (WLT.autoLockTimer) {
            clearTimeout(WLT.autoLockTimer);
            WLT.autoLockTimer = null;
        }
        loadWalletData();
    }
    function startAutoLock() {
        if (WLT.autoLockTimer)
            clearTimeout(WLT.autoLockTimer);
        if (WLT.autoLockMins === 0)
            return;
        WLT.autoLockTimer = setTimeout(wltLock, WLT.autoLockMins * 60 * 1000);
    }
    async function _ksDerive(pin, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async function keystoreEncrypt(privateKeyBase58, pin) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await _ksDerive(pin, salt);
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(privateKeyBase58));
        return {
            salt: btoa(String.fromCharCode(...salt)),
            iv: btoa(String.fromCharCode(...iv)),
            ct: btoa(String.fromCharCode(...new Uint8Array(ct)))
        };
    }
    async function keystoreDecrypt(blob, pin) {
        const salt = Uint8Array.from(atob(blob.salt), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(blob.iv), c => c.charCodeAt(0));
        const ct = Uint8Array.from(atob(blob.ct), c => c.charCodeAt(0));
        const key = await _ksDerive(pin, salt);
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        return new TextDecoder().decode(pt);
    }
    async function keystoreSave(address, privateKeyBase58, pin) {
        const blob = await keystoreEncrypt(privateKeyBase58, pin);
        const ks = await new Promise(r => chrome.storage.local.get(['wo_keystore'], res => r(res.wo_keystore || {})));
        ks[address] = blob;
        await new Promise(r => chrome.storage.local.set({ wo_keystore: ks }, r));
    }
    async function keystoreGet(address, pin) {
        const ks = await new Promise(r => chrome.storage.local.get(['wo_keystore'], res => r(res.wo_keystore || {})));
        if (!ks[address])
            return null;
        return keystoreDecrypt(ks[address], pin);
    }
    async function keystoreHas(address) {
        const ks = await new Promise(r => chrome.storage.local.get(['wo_keystore'], res => r(res.wo_keystore || {})));
        return !!ks[address];
    }
    async function keystoreReencryptAll(oldPin, newPin) {
        const ks = await new Promise(r => chrome.storage.local.get(['wo_keystore'], res => r(res.wo_keystore || {})));
        const newKs = {};
        for (const addr of Object.keys(ks)) {
            try {
                const pk = await keystoreDecrypt(ks[addr], oldPin);
                newKs[addr] = await keystoreEncrypt(pk, newPin);
            }
            catch {
                newKs[addr] = ks[addr];
            }
        }
        await new Promise(r => chrome.storage.local.set({ wo_keystore: newKs }, r));
    }
    async function _importEd25519Key(secretKeyBytes) {
        const seed = secretKeyBytes.slice(0, 32);
        const jwk = {
            kty: 'OKP', crv: 'Ed25519',
            d: btoa(String.fromCharCode(...seed)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            x: btoa(String.fromCharCode(...secretKeyBytes.slice(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        };
        return crypto.subtle.importKey('jwk', jwk, 'Ed25519', false, ['sign']);
    }
    async function signTransactionLocal(txBase64, privateKeyBase58) {
        const secretKey = base58Decode(privateKeyBase58);
        const txBytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
        const sigCount = txBytes[0];
        const msgOffset = 1 + sigCount * 64;
        const message = txBytes.slice(msgOffset);
        const key = await _importEd25519Key(secretKey);
        const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', key, message));
        const signed = new Uint8Array(txBytes.length);
        signed.set(txBytes);
        signed.set(sig, 1);
        return { signedTx: btoa(String.fromCharCode(...signed)), signature: base58Encode(sig) };
    }
    async function doClientSwap(fromMint, toMint, amount, slippage, privateKeyBase58, rpcUrl) {
        const rpc = rpcUrl || WLT.solRpc;
        const secretKey = base58Decode(privateKeyBase58);
        const pubkey = base58Encode(secretKey.slice(32));
        let decimals = 9;
        if (fromMint !== 'So11111111111111111111111111111111111111112') {
            const accRes = await fetch(rpc, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [fromMint, { encoding: 'jsonParsed' }] })
            }).then(r => r.json());
            const parsed = accRes?.result?.value?.data?.parsed;
            if (parsed?.info?.decimals !== undefined)
                decimals = parsed.info.decimals;
        }
        const lamports = Math.round(amount * Math.pow(10, decimals));
        const slipBps = Math.round(slippage * 100);
        const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${lamports}&slippageBps=${slipBps}`;
        const quote = await fetch(quoteUrl).then(r => r.json());
        if (quote.error)
            throw new Error(quote.error);
        const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteResponse: quote, userPublicKey: pubkey, wrapAndUnwrapSol: true })
        }).then(r => r.json());
        if (swapRes.error)
            throw new Error(swapRes.error);
        const { signedTx, signature } = await signTransactionLocal(swapRes.swapTransaction, privateKeyBase58);
        const sendRes = await fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: [signedTx, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }] })
        }).then(r => r.json());
        if (sendRes.error)
            throw new Error(sendRes.error.message || JSON.stringify(sendRes.error));
        return { signature: sendRes.result || signature };
    }
    async function doClientSendSol(toPubkeyB58, amountSol, privateKeyBase58, rpcUrl) {
        const rpc = rpcUrl || WLT.solRpc;
        const secretKey = base58Decode(privateKeyBase58);
        const fromPub = secretKey.slice(32);
        const toPub = base58Decode(toPubkeyB58);
        const lamports = BigInt(Math.round(amountSol * 1e9));
        const bhRes = await fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'confirmed' }] })
        }).then(r => r.json());
        const blockhash = bhRes.result.value.blockhash;
        const bhBytes = base58Decode(blockhash);
        const SYSTEM_PROGRAM = new Uint8Array(32);
        const transferIx = new Uint8Array(4 + 8);
        const dv = new DataView(transferIx.buffer);
        dv.setUint32(0, 2, true);
        dv.setBigUint64(4, lamports, true);
        const keys = [fromPub, toPub, SYSTEM_PROGRAM];
        const numSigs = 1, numReadonlySigned = 0, numReadonlyUnsigned = 1;
        const compactLen = (n) => n < 128 ? [n] : [n & 0x7f | 0x80, n >> 7];
        const header = [numSigs, numReadonlySigned, numReadonlyUnsigned];
        const keysFlat = new Uint8Array(keys.length * 32);
        keys.forEach((k, i) => keysFlat.set(k, i * 32));
        const ixData = transferIx;
        const ix = new Uint8Array([
            ...compactLen(1),
            0, 2,
        ]);
        const ixSerialized = new Uint8Array([
            2,
            ...compactLen(2),
            0, 1,
            ...compactLen(ixData.length),
            ...ixData
        ]);
        const msgParts = [
            new Uint8Array(header),
            new Uint8Array(compactLen(keys.length)),
            keysFlat,
            bhBytes,
            new Uint8Array(compactLen(1)),
            ixSerialized
        ];
        const msgLen = msgParts.reduce((s, p) => s + p.length, 0);
        const message = new Uint8Array(msgLen);
        let off = 0;
        msgParts.forEach(p => { message.set(p, off); off += p.length; });
        const key = await _importEd25519Key(secretKey);
        const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', key, message));
        const tx = new Uint8Array(1 + 64 + message.length);
        tx[0] = 1;
        tx.set(sig, 1);
        tx.set(message, 65);
        const txB64 = btoa(String.fromCharCode(...tx));
        const sendRes = await fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: [txB64, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }] })
        }).then(r => r.json());
        if (sendRes.error)
            throw new Error(sendRes.error.message || JSON.stringify(sendRes.error));
        return { signature: sendRes.result || base58Encode(sig) };
    }
    async function doClientSendToken(toPubkeyB58, mintB58, amountRaw, decimals, privateKeyBase58, rpcUrl) {
        const rpc = rpcUrl || WLT.solRpc;
        const secretKey = base58Decode(privateKeyBase58);
        const fromPub = secretKey.slice(32);
        const toPub = base58Decode(toPubkeyB58);
        const mintPub = base58Decode(mintB58);
        const TOKEN_PROGRAM = base58Decode('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const ATA_PROGRAM = base58Decode('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
        const SYSTEM = new Uint8Array(32);
        const lamports = BigInt(Math.round(amountRaw * Math.pow(10, decimals)));
        function sha256(data) { return crypto.subtle.digest('SHA-256', data); }
        async function findATA(owner, mint) {
            const r = await fetch(rpc, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
                    params: [base58Encode(owner), { mint: base58Encode(mint) }, { encoding: 'jsonParsed' }] })
            }).then(r => r.json());
            if (r.result?.value?.length)
                return base58Decode(r.result.value[0].pubkey);
            return null;
        }
        const fromATA = await findATA(fromPub, mintPub);
        if (!fromATA)
            throw new Error('Source token account not found');
        let toATA = await findATA(toPub, mintPub);
        let createATAix = null;
        if (!toATA) {
            throw new Error('Recipient has no token account. Send from panel (online) to auto-create it.');
        }
        const bhRes = await fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'confirmed' }] })
        }).then(r => r.json());
        const bhBytes = base58Decode(bhRes.result.value.blockhash);
        const ixData = new Uint8Array(1 + 8);
        ixData[0] = 3;
        const dv2 = new DataView(ixData.buffer);
        dv2.setBigUint64(1, lamports, true);
        const keys = [fromPub, fromATA, toATA, toPub, TOKEN_PROGRAM];
        const compactLen = (n) => n < 128 ? [n] : [n & 0x7f | 0x80, n >> 7];
        const ixSer = new Uint8Array([
            4,
            ...compactLen(3),
            1, 2, 3,
            ...compactLen(ixData.length),
            ...ixData
        ]);
        const ixSerialized = new Uint8Array([
            4,
            ...compactLen(3),
            1, 2, 0,
            ...compactLen(ixData.length),
            ...ixData
        ]);
        const numSigs = 1, numReadonlySigned = 0, numReadonlyUnsigned = 2;
        const header = [numSigs, numReadonlySigned, numReadonlyUnsigned];
        const keysFlat = new Uint8Array(keys.length * 32);
        keys.forEach((k, i) => keysFlat.set(k, i * 32));
        const msgParts = [
            new Uint8Array(header),
            new Uint8Array(compactLen(keys.length)),
            keysFlat,
            bhBytes,
            new Uint8Array(compactLen(1)),
            ixSerialized
        ];
        const msgLen = msgParts.reduce((s, p) => s + p.length, 0);
        const message = new Uint8Array(msgLen);
        let moff = 0;
        msgParts.forEach(p => { message.set(p, moff); moff += p.length; });
        const key = await _importEd25519Key(secretKey);
        const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', key, message));
        const txBuf = new Uint8Array(1 + 64 + message.length);
        txBuf[0] = 1;
        txBuf.set(sig, 1);
        txBuf.set(message, 65);
        const txB64 = btoa(String.fromCharCode(...txBuf));
        const sendRes = await fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: [txB64, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }] })
        }).then(r => r.json());
        if (sendRes.error)
            throw new Error(sendRes.error.message || JSON.stringify(sendRes.error));
        return { signature: sendRes.result || base58Encode(sig) };
    }
    function requirePinRaw() {
        return new Promise((resolve) => {
            if (WLT.unlocked && WLT._lastPin) {
                resolve(WLT._lastPin);
                return;
            }
            requirePin().then((ok) => { resolve(ok ? WLT._lastPin : null); });
        });
    }
    async function _syncKeystoreFromServer() {
        if (!WLT.unlocked || !WLT._lastPin || !WLT.data)
            return;
        const addr = WLT.data.address;
        if (!addr)
            return;
        const has = await keystoreHas(addr);
        if (has)
            return;
        try {
            let pk;
            try {
                const fetchOpts = { method: 'GET', headers: {}, signal: AbortSignal.timeout(5000) };
                if (authToken)
                    fetchOpts.headers['Authorization'] = 'Bearer ' + authToken;
                const r = await fetch(API + '/api/wallet/export', fetchOpts);
                if (r.ok) {
                    const d = await r.json();
                    pk = d.privateKey;
                }
            }
            catch { }
            if (!pk) {
                try {
                    const res = await bgFetch(API + '/api/wallet/export', { method: 'GET', headers: {} });
                    const d = JSON.parse(res.body);
                    pk = d.privateKey;
                }
                catch { }
            }
            if (pk) {
                await keystoreSave(addr, pk, WLT._lastPin);
            }
        }
        catch { }
    }
    async function _getLocalKey(addr) {
        let pin = WLT._lastPin;
        if (!pin) {
            pin = await requirePinRaw();
            if (!pin)
                return null;
        }
        let pk = await keystoreGet(addr, pin);
        if (pk)
            return pk;
        try {
            try {
                const fetchOpts = { method: 'GET', headers: {}, signal: AbortSignal.timeout(5000) };
                if (authToken)
                    fetchOpts.headers['Authorization'] = 'Bearer ' + authToken;
                const r = await fetch(API + '/api/wallet/export', fetchOpts);
                if (r.ok) {
                    const d = await r.json();
                    if (d.privateKey) {
                        await keystoreSave(addr, d.privateKey, pin);
                        return d.privateKey;
                    }
                }
            }
            catch { }
            const res = await bgFetch(API + '/api/wallet/export', { method: 'GET', headers: {} });
            const data = JSON.parse(res.body);
            if (data.privateKey) {
                await keystoreSave(addr, data.privateKey, pin);
                return data.privateKey;
            }
        }
        catch { }
        return null;
    }
    async function loadNetworkSettings() {
        const stored = await new Promise(r => chrome.storage.local.get(['wo_networks', 'wo_autolock', 'wo_custom_nets', 'wo_sol_rpc', 'wo_rpc_prompted'], res => r(res)));
        WLT.networks = stored.wo_networks || {};
        WLT.customNetworks = stored.wo_custom_nets || [];
        if (stored.wo_autolock !== undefined)
            WLT.autoLockMins = stored.wo_autolock;
        if (stored.wo_sol_rpc)
            WLT.solRpc = stored.wo_sol_rpc;
        if (stored.wo_rpc_prompted)
            WLT._rpcPrompted = true;
    }
    function renderNetworks() {
        const list = document.getElementById('wo-networks-list');
        if (!list)
            return;
        const evmOn = WLT.networks['evm'] !== false;
        list.innerHTML = `
      <div class="wo-sett-row wo-sett-row-soon" id="wo-evm-row">
        <div class="wo-sett-row-info">
          <div class="wo-net-icon evm">${SVG_EVM}</div>
          <div>
            <div class="wo-sett-row-name">EVM Networks <span class="wo-soon-badge">Soon</span></div>
            <div class="wo-sett-row-sub">ETH, BNB, Polygon, Arbitrum</div>
          </div>
        </div>
      </div>
      <div id="wo-custom-nets-list"></div>
    `;
        renderCustomNets();
    }
    function renderCustomNets() {
        const list = document.getElementById('wo-custom-nets-list');
        if (!list)
            return;
        list.innerHTML = WLT.customNetworks.map((n, i) => `
      <div class="wo-sett-row">
        <div class="wo-sett-row-info">
          <div class="wo-net-icon custom">${esc(n.symbol.slice(0, 3))}</div>
          <div>
            <div class="wo-sett-row-name">${esc(n.name)}</div>
            <div class="wo-sett-row-sub">Chain ID: ${n.chainId}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="wo-btn wo-btn-xs" data-edit-net="${i}" title="Edit">✏️</button>
          <button class="wo-btn wo-btn-xs" style="color:var(--red);border-color:rgba(248,113,113,0.2)" data-del-net="${i}" title="Remove">×</button>
        </div>
      </div>
    `).join('');
        list.querySelectorAll('[data-del-net]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                WLT.customNetworks.splice(parseInt(btn.dataset.delNet), 1);
                chrome.storage.local.set({ wo_custom_nets: WLT.customNetworks });
                renderCustomNets();
            });
        });
        list.querySelectorAll('[data-edit-net]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openCustomNetModal(parseInt(btn.dataset.editNet));
            });
        });
    }
    function renderSolanaRpc() {
        const lbl = document.getElementById('wo-sol-rpc-label');
        if (!lbl)
            return;
        try {
            const host = new URL(WLT.solRpc).hostname;
            lbl.textContent = host;
        }
        catch (_) {
            lbl.textContent = WLT.solRpc || 'api.mainnet-beta.solana.com';
        }
    }
    function openSolRpcModal() {
        const modal = document.getElementById('wo-sol-rpc-modal');
        if (!modal)
            return;
        const inp = document.getElementById('wo-sol-rpc-input');
        if (inp)
            inp.value = WLT.solRpc;
        const err = document.getElementById('wo-rpc-error');
        if (err)
            err.textContent = '';
        modal.classList.add('visible');
    }
    function saveSolRpc() {
        const inp = document.getElementById('wo-sol-rpc-input');
        const st = document.getElementById('wo-rpc-status');
        const val = inp ? inp.value.trim() : '';
        if (!val) {
            if (st) {
                st.style.color = 'var(--red)';
                st.textContent = 'RPC URL is required';
            }
            return;
        }
        if (!/^https?:\/\//i.test(val)) {
            if (st) {
                st.style.color = 'var(--red)';
                st.textContent = 'Must start with http(s)://';
            }
            return;
        }
        if (st)
            st.textContent = '';
        WLT.solRpc = val;
        WLT._rpcPrompted = true;
        chrome.storage.local.set({ wo_sol_rpc: val, wo_rpc_prompted: true });
        syncRpcToServer(val);
        document.getElementById('wo-sol-rpc-modal').classList.remove('visible');
        renderSolanaRpc();
    }
    async function syncRpcToServer(rpcUrl) {
        if (!authToken || !_panelOnline)
            return;
        try {
            await walletFetch('/api/rpc/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ solana: rpcUrl })
            });
        }
        catch { }
    }
    async function checkSolRpc() {
        const inp = document.getElementById('wo-sol-rpc-input');
        const st = document.getElementById('wo-rpc-status');
        const btn = document.getElementById('wo-rpc-check');
        const url = inp ? inp.value.trim() : '';
        if (!url || !/^https?:\/\//i.test(url)) {
            if (st) {
                st.style.color = 'var(--red)';
                st.textContent = 'Enter a valid URL first';
            }
            return;
        }
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Checking…';
        }
        if (st) {
            st.style.color = 'var(--muted)';
            st.textContent = '';
        }
        const t0 = Date.now();
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot' }),
                signal: AbortSignal.timeout(8000)
            });
            const ms = Date.now() - t0;
            if (r.ok) {
                const d = await r.json();
                if (d.error) {
                    st.style.color = 'var(--red)';
                    st.textContent = '✗ ' + (d.error.message || JSON.stringify(d.error)).slice(0, 60);
                }
                else if (d.result !== undefined) {
                    st.style.color = '#22c55e';
                    st.textContent = '✓ Connected — ' + ms + 'ms (slot ' + d.result + ')';
                }
                else {
                    st.style.color = '#f59e0b';
                    st.textContent = '⚠ Unexpected response';
                }
            }
            else {
                st.style.color = 'var(--red)';
                st.textContent = '✗ HTTP ' + r.status;
            }
        }
        catch (e) {
            st.style.color = 'var(--red)';
            st.textContent = '✗ ' + (e.name === 'TimeoutError' ? 'Timeout (8s)' : e.message);
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Check RPC';
        }
    }
    async function forceRefreshBalance() {
        const btn = document.getElementById('wo-bal-refresh');
        if (btn) {
            btn.classList.add('wo-spinning');
            btn.disabled = true;
        }
        try {
            let balance;
            if (_panelOnline) {
                const res = await walletFetch('/api/wallet/balance');
                if (res && res.balance !== undefined)
                    balance = res.balance;
            }
            else if (WLT.data && WLT.data.address) {
                balance = await directRpcBalance(WLT.data.address);
            }
            if (balance !== undefined && balance !== null) {
                _lastBal = balance;
                if (WLT.data)
                    WLT.data.balance = balance;
                const el = document.getElementById('wo-wlt-bal-num');
                if (el)
                    el.textContent = balance.toFixed(4);
                updateUsdDisplay(balance);
                if (WLT._cachedTokens)
                    renderTokenList(WLT._cachedTokens);
            }
        }
        catch { }
        if (btn) {
            btn.classList.remove('wo-spinning');
            btn.disabled = false;
        }
    }
    function openCustomNetModal(editIdx) {
        const existing = editIdx !== undefined ? WLT.customNetworks[editIdx] : null;
        const modal = document.getElementById('wo-custom-net-modal');
        if (!modal)
            return;
        document.getElementById('wo-cn-name').value = existing ? existing.name : '';
        document.getElementById('wo-cn-chainid').value = existing ? existing.chainId : '';
        document.getElementById('wo-cn-rpc').value = existing ? existing.rpc : '';
        document.getElementById('wo-cn-symbol').value = existing ? existing.symbol : '';
        document.getElementById('wo-cn-editidx').value = editIdx !== undefined ? editIdx : '';
        modal.classList.add('visible');
    }
    function saveCustomNet() {
        const name = document.getElementById('wo-cn-name').value.trim();
        const chainId = parseInt(document.getElementById('wo-cn-chainid').value.trim(), 10);
        const rpc = document.getElementById('wo-cn-rpc').value.trim();
        const symbol = document.getElementById('wo-cn-symbol').value.trim();
        const errEl = document.getElementById('wo-cn-error');
        if (!name || !chainId || !rpc || !symbol) {
            if (errEl)
                errEl.textContent = 'All fields required';
            return;
        }
        if (!/^https?:\/\//i.test(rpc)) {
            if (errEl)
                errEl.textContent = 'RPC must start with http(s)://';
            return;
        }
        if (errEl)
            errEl.textContent = '';
        const editIdx = document.getElementById('wo-cn-editidx').value;
        const net = { id: 'custom_' + chainId, name, chainId, rpc, symbol };
        if (editIdx !== '')
            WLT.customNetworks[parseInt(editIdx)] = net;
        else
            WLT.customNetworks.push(net);
        chrome.storage.local.set({ wo_custom_nets: WLT.customNetworks });
        document.getElementById('wo-custom-net-modal').classList.remove('visible');
        renderCustomNets();
    }
    function renderSettings() {
        renderWalletList();
        renderNetworks();
        renderSolanaRpc();
        if (WLT.data) {
            const isVault = !!(WLT.data.vaultMode && WLT.data.vaultMode.active);
            const wallets = WLT.data.wallets || [];
            const active = wallets.find(w => w.address === WLT.data.address) || wallets[0];
            const nameEl = document.getElementById('wo-sett-active-name');
            const addrEl = document.getElementById('wo-sett-active-addr');
            const avatarEl = document.getElementById('wo-sett-avatar');
            const subEl = document.getElementById('wo-cat-sub-wallets');
            if (isVault) {
                if (nameEl)
                    nameEl.textContent = (WLT.data.vaultMode.name || 'Vault') + ' (Vault)';
                if (avatarEl)
                    avatarEl.textContent = 'V';
            }
            else {
                if (nameEl && active)
                    nameEl.textContent = active.name || 'Wallet';
                if (avatarEl && active)
                    avatarEl.textContent = (active.name || 'W')[0].toUpperCase();
            }
            if (addrEl && WLT.data.address) {
                const a = WLT.data.address;
                addrEl.textContent = a.slice(0, 6) + '\u2026' + a.slice(-4);
            }
            const cnt = wallets.length;
            if (subEl)
                subEl.textContent = cnt === 1 ? '1 wallet' : `${cnt} wallets`;
        }
        const sel = document.getElementById('wo-autolock-select');
        if (sel)
            sel.value = String(WLT.autoLockMins);
        const safetyToggle = document.getElementById('wo-safety-toggle');
        if (safetyToggle)
            safetyToggle.classList.toggle('on', _txSafetyAutoCheck);
    }
    function startChangePinFlow() {
        WLT.pinMode = 'change-old';
        WLT.pinInput = '';
        updatePinUI('Enter Current PIN', 'Verify your current PIN first');
        const forgot = document.getElementById('wo-pin-forgot');
        if (forgot)
            forgot.style.display = 'none';
        wltView('wo-wlt-pin');
        renderNumpad();
    }
    async function walletFetch(path, opts) {
        const timeout = (opts && opts.timeout) || 8000;
        const fetchOpts = { method: (opts && opts.method) || 'GET', headers: {} };
        if (authToken)
            fetchOpts.headers['Authorization'] = 'Bearer ' + authToken;
        if (opts && opts.headers)
            Object.assign(fetchOpts.headers, opts.headers);
        if (opts && opts.body)
            fetchOpts.body = opts.body;
        fetchOpts.signal = AbortSignal.timeout(timeout);
        try {
            const r = await fetch(API + path, fetchOpts);
            if (!r.ok)
                throw new Error(`HTTP ${r.status}`);
            return r.json();
        }
        catch (e) {
            try {
                const res = await bgFetch(API + path, opts || { method: 'GET', headers: {} });
                return JSON.parse(res.body);
            }
            catch {
                throw new Error('walletFetch failed: ' + path);
            }
        }
    }
    async function loadWalletData(opts) {
        const options = opts || {};
        if (WLT.loadingPromise)
            return WLT.loadingPromise;
        if (!options.silent && !WLT.data)
            showWalletLoadingState();
        WLT.loadingPromise = (async () => {
            try {
                const walletP = walletFetch('/api/wallet');
                const tokensP = walletFetch('/api/wallet/tokens').catch(() => null);
                const walletRes = await walletP;
                if (!walletRes || walletRes.error || (typeof walletRes !== 'object')) {
                    throw new Error('Invalid wallet response');
                }
                WLT.data = walletRes;
                WLT.lastLoadedAt = Date.now();
                chrome.storage.local.set({ wo_cached_wallet: JSON.parse(JSON.stringify(walletRes)) });
                const tokRes = await tokensP;
                if (tokRes && !tokRes.error) {
                    WLT._cachedTokens = tokRes.tokens || [];
                    WLT._cachedNfts = tokRes.nfts || [];
                    WLT.tokensLoadedAt = Date.now();
                    chrome.storage.local.set({ wo_cached_tokens: WLT._cachedTokens });
                }
                if (!WLT.data.configured) {
                    if (WLT.data.wallets && WLT.data.wallets.length > 0) {
                        try {
                            await walletFetch('/api/wallet/switch', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ address: WLT.data.wallets[0].address })
                            });
                            WLT.data = await walletFetch('/api/wallet');
                            WLT.lastLoadedAt = Date.now();
                            renderWalletHome();
                        }
                        catch {
                            showSetupView();
                        }
                    }
                    else {
                        showSetupView();
                    }
                }
                else {
                    renderWalletHome();
                    _syncKeystoreFromServer();
                }
            }
            catch {
                if (!WLT.data) {
                    const loaded = await loadCachedWalletData();
                    if (loaded) {
                        WLT.data.configured = true;
                        renderWalletHome();
                        offlineRefresh();
                        return;
                    }
                }
                if (!WLT.data) {
                    if (!options.silent)
                        showSetupView();
                }
            }
            finally {
                WLT.loadingPromise = null;
            }
        })();
        return WLT.loadingPromise;
    }
    function showWalletLoadingState() {
        wltView('wo-wlt-home');
        bindWalletHomeTabs();
        setWalletHomeTab(WLT.homeTab || 'tokens', false);
        const card = document.querySelector('.wo-wlt-balance-card');
        if (card)
            card.classList.add('is-loading');
        const balEl = document.getElementById('wo-wlt-bal-num');
        const usdEl = document.getElementById('wo-wlt-bal-usd');
        const addrEl = document.getElementById('wo-wlt-addr-short');
        const nameEl = document.getElementById('wo-wlt-wallet-name');
        if (balEl)
            balEl.textContent = '0.0000';
        if (usdEl)
            usdEl.textContent = 'Syncing wallet…';
        if (addrEl)
            addrEl.textContent = 'Loading address…';
        if (nameEl)
            nameEl.textContent = 'Preparing wallet';
        const tokenList = document.getElementById('wo-wlt-token-list');
        if (tokenList && !WLT._cachedTokens) {
            tokenList.innerHTML = `<div class="wo-token-item wo-token-item-skeleton"><div class="wo-token-icon wo-skeleton"></div><div class="wo-token-info"><div class="wo-skeleton wo-line-lg"></div><div class="wo-skeleton wo-line-sm"></div></div><div class="wo-token-balance"><div class="wo-skeleton wo-line-md"></div><div class="wo-skeleton wo-pill-sm"></div></div></div><div class="wo-token-item wo-token-item-skeleton"><div class="wo-token-icon wo-skeleton"></div><div class="wo-token-info"><div class="wo-skeleton wo-line-lg"></div><div class="wo-skeleton wo-line-sm"></div></div><div class="wo-token-balance"><div class="wo-skeleton wo-line-md"></div></div></div>`;
        }
        const recentList = document.getElementById('wo-wlt-recent-list');
        if (recentList && !(WLT.data && WLT.data.recentTxs && WLT.data.recentTxs.length)) {
            recentList.innerHTML = `<div class="wo-tx-item wo-tx-item-skeleton"><div class="wo-tx-icon wo-skeleton"></div><div class="wo-tx-info"><div class="wo-skeleton wo-line-lg"></div><div class="wo-skeleton wo-line-sm"></div></div><div class="wo-skeleton wo-dot-link"></div></div>`;
        }
    }
    function showSetupView() {
        document.querySelectorAll('.wo-wlt-form').forEach(f => f.classList.remove('visible'));
        const opts = document.getElementById('wo-wlt-options');
        if (opts)
            opts.style.display = '';
        wltView('wo-wlt-setup');
    }
    let _balTimer = null;
    let _priceTimer = null;
    let _solPrice = 0;
    let _lastBal = null;
    let _balFetching = false;
    chrome.storage.local.get(['wo_sol_price'], (r) => { if (r.wo_sol_price > 0)
        _solPrice = r.wo_sol_price; });
    function startBalancePolling() {
        stopBalancePolling();
        Promise.all([pollBalance(), pollSolPrice()]);
        _balTimer = setInterval(pollBalance, 15000);
        _priceTimer = setInterval(pollSolPrice, 60000);
        document.addEventListener('visibilitychange', _onVisChange);
    }
    function stopBalancePolling() {
        if (_balTimer) {
            clearInterval(_balTimer);
            _balTimer = null;
        }
        if (_priceTimer) {
            clearInterval(_priceTimer);
            _priceTimer = null;
        }
        document.removeEventListener('visibilitychange', _onVisChange);
    }
    function _onVisChange() {
        if (document.hidden) {
            if (_balTimer) {
                clearInterval(_balTimer);
                _balTimer = null;
            }
        }
        else {
            if (!_balTimer) {
                pollBalance();
                _balTimer = setInterval(pollBalance, 15000);
            }
        }
    }
    async function pollBalance() {
        if (_balFetching || document.hidden)
            return;
        const homeActive = document.getElementById('wo-wlt-home')?.classList.contains('wlt-active');
        if (!homeActive)
            return;
        _balFetching = true;
        try {
            let balance;
            if (_panelOnline) {
                const res = await walletFetch('/api/wallet/balance');
                balance = res && res.balance;
            }
            else if (WLT.data && WLT.data.address) {
                balance = await directRpcBalance(WLT.data.address);
            }
            if (balance !== undefined && balance !== null && balance !== _lastBal) {
                _lastBal = balance;
                if (WLT.data)
                    WLT.data.balance = balance;
                const el = document.getElementById('wo-wlt-bal-num');
                if (el)
                    el.textContent = balance.toFixed(4);
                updateUsdDisplay(balance);
                if (WLT._cachedTokens)
                    renderTokenList(WLT._cachedTokens);
            }
        }
        catch { }
        _balFetching = false;
        if (_panelOnline && !WLT.data?.recentTxs?.length) {
            try {
                const wr = await walletFetch('/api/wallet');
                if (wr && wr.recentTxs && wr.recentTxs.length) {
                    WLT.data.recentTxs = wr.recentTxs;
                    renderRecentTxs(wr.recentTxs);
                }
            }
            catch { }
        }
    }
    let _lastPricePoll = 0;
    async function pollSolPrice() {
        _lastPricePoll = Date.now();
        try {
            let price;
            if (_panelOnline) {
                try {
                    const res = await walletFetch('/api/sol-price');
                    if (res && res.price)
                        price = res.price;
                }
                catch (e) {
                }
            }
            if (!price) {
                price = await directSolPrice();
            }
            if (price) {
                _solPrice = price;
                chrome.storage.local.set({ wo_sol_price: price });
                if (_lastBal !== null)
                    updateUsdDisplay(_lastBal);
            }
        }
        catch { }
    }
    function toFiniteNumber(value) {
        const num = typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : Number(value);
        return Number.isFinite(num) ? num : null;
    }
    function getTokenUsdValue(token) {
        if (!token || !token.mint)
            return 0;
        if (token.mint === 'So11111111111111111111111111111111111111112')
            return 0;
        const directValue = toFiniteNumber(token.valueUsd) ??
            toFiniteNumber(token.usdValue) ??
            toFiniteNumber(token.totalUsd) ??
            toFiniteNumber(token.balanceUsd) ??
            toFiniteNumber(token.amountUsd) ??
            toFiniteNumber(token.marketValueUsd) ??
            toFiniteNumber(token.usd);
        if (directValue !== null)
            return Math.max(0, directValue);
        const amount = toFiniteNumber(token.amount);
        const price = toFiniteNumber(token.priceUsd) ??
            toFiniteNumber(token.usdPrice) ??
            toFiniteNumber(token.tokenPriceUsd) ??
            toFiniteNumber(token.price);
        if (amount !== null && price !== null)
            return Math.max(0, amount * price);
        return 0;
    }
    function getSplTokensUsdTotal(tokens) {
        if (!Array.isArray(tokens) || !tokens.length)
            return 0;
        return tokens.reduce((sum, token) => sum + getTokenUsdValue(token), 0);
    }
    function updateUsdDisplay(solAmount) {
        const el = document.getElementById('wo-wlt-bal-usd');
        if (!el)
            return;
        const solUsd = _solPrice > 0 ? solAmount * _solPrice : 0;
        const splUsd = getSplTokensUsdTotal(WLT._cachedTokens);
        const totalUsd = solUsd + splUsd;
        if (totalUsd > 0) {
            const usd = totalUsd.toFixed(2);
            el.textContent = '≈ $' + usd;
        }
        else {
            el.textContent = '';
        }
    }
    function refreshConnectedSite() {
        chrome.runtime.sendMessage({ type: 'wo-get-connected-sites' }, (resp) => {
            if (chrome.runtime.lastError || !resp)
                return;
            const siteEl = document.getElementById('wo-wlt-connected-site');
            const labelEl = document.getElementById('wo-wlt-conn-label');
            if (!siteEl || !labelEl)
                return;
            const sites = resp.sites || [];
            if (sites.length > 0) {
                const hostnames = sites.map(s => { try {
                    return new URL(s.origin).hostname;
                }
                catch {
                    return s.origin;
                } });
                labelEl.textContent = 'Connected: ' + hostnames.join(', ');
                siteEl.classList.remove('disconnected');
            }
            else {
                labelEl.textContent = 'Not connected to any dApp';
                siteEl.classList.add('disconnected');
            }
            siteEl.style.display = 'flex';
            const subEl = document.getElementById('wo-cat-sub-connsites');
            if (subEl)
                subEl.textContent = sites.length ? `${sites.length} active` : 'No connections';
        });
    }
    function renderConnectedSites() {
        const listEl = document.getElementById('wo-conn-sites-list');
        const disconnAllBtn = document.getElementById('wo-disconnect-all-btn');
        if (!listEl)
            return;
        listEl.innerHTML = '<div class="wo-conn-empty" style="text-align:center;padding:20px;color:var(--text3)">Loading…</div>';
        chrome.runtime.sendMessage({ type: 'wo-get-connected-sites' }, (resp) => {
            if (chrome.runtime.lastError || !resp) {
                listEl.innerHTML = '<div class="wo-conn-empty">Failed to load</div>';
                return;
            }
            const sites = resp.sites || [];
            if (!sites.length) {
                listEl.innerHTML = '<div class="wo-conn-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;margin:0 auto 8px;display:block;opacity:0.3"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>No connected sites</div>';
                if (disconnAllBtn)
                    disconnAllBtn.style.display = 'none';
                return;
            }
            if (disconnAllBtn)
                disconnAllBtn.style.display = sites.length > 1 ? 'flex' : 'none';
            listEl.innerHTML = sites.map(s => {
                let hostname;
                try {
                    hostname = new URL(s.origin).hostname;
                }
                catch {
                    hostname = s.origin;
                }
                const domain = hostname.replace(/^www\./, '');
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                const initials = domain.slice(0, 2).toUpperCase();
                return `<div class="wo-conn-site-row" data-origin="${esc(s.origin)}">
          <div class="wo-conn-site-icon">
            <img class="wo-conn-site-fav" src="${esc(faviconUrl)}" data-initials="${esc(initials)}" style="width:28px;height:28px;border-radius:7px">
            <div class="wo-conn-site-fallback" style="display:none">
              <span style="font-size:11px;font-weight:700;line-height:1">${esc(initials)}</span>
            </div>
          </div>
          <div class="wo-conn-site-info">
            <div class="wo-conn-site-name">${esc(hostname)}</div>
            <div class="wo-conn-site-addr">${esc(s.address ? s.address.slice(0, 6) + '…' + s.address.slice(-4) : '')}</div>
          </div>
          <button class="wo-conn-site-disconnect" data-origin="${esc(s.origin)}" title="Disconnect">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
        </div>`;
            }).join('');
            listEl.querySelectorAll('.wo-conn-site-fav').forEach(img => {
                img.addEventListener('error', () => {
                    img.style.display = 'none';
                    const fallback = img.nextElementSibling;
                    if (fallback)
                        fallback.style.display = 'flex';
                });
            });
        });
    }
    function disconnectSite(origin) {
        chrome.runtime.sendMessage({ type: 'wo-disconnect-site', origin }, () => {
            renderConnectedSites();
            refreshConnectedSite();
        });
    }
    function renderWalletHome() {
        const d = WLT.data;
        const tokensAreFresh = Date.now() - (WLT.tokensLoadedAt || 0) < 15000;
        const isVault = !!(d.vaultMode && d.vaultMode.active);
        wltView('wo-wlt-home');
        const card = document.querySelector('.wo-wlt-balance-card');
        if (card)
            card.classList.remove('is-loading');
        const balEl = document.getElementById('wo-wlt-bal-num');
        if (balEl)
            balEl.textContent = (d.balance || 0).toFixed(4);
        _lastBal = d.balance || 0;
        updateUsdDisplay(_lastBal);
        const addrEl = document.getElementById('wo-wlt-addr-short');
        if (addrEl)
            addrEl.textContent = d.address ? d.address.slice(0, 6) + '...' + d.address.slice(-4) : '—';
        const nameEl = document.getElementById('wo-wlt-wallet-name');
        let existingVaultBar = document.getElementById('wo-vault-mode-bar');
        if (existingVaultBar)
            existingVaultBar.remove();
        if (isVault) {
            if (nameEl) {
                nameEl.innerHTML = esc(d.vaultMode.name || 'Vault') +
                    ' <span style="font-size:.6rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7c3aed;background:rgba(139,92,246,.13);border:1px solid rgba(139,92,246,.22);padding:1px 5px;border-radius:5px;vertical-align:middle;margin-left:4px">VAULT ' + (d.vaultMode.threshold || '?') + '/' + ((d.vaultMode.members || []).length || '?') + '</span>';
            }
            const balCard = document.querySelector('.wo-wlt-balance-card');
            if (balCard) {
                const bar = document.createElement('div');
                bar.id = 'wo-vault-mode-bar';
                bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:8px;margin:6px 12px 0;font-size:.72rem;color:#7c3aed';
                bar.innerHTML = '<span style="font-weight:600">Vault Mode Active</span><button id="wo-vault-exit-btn" class="wo-btn wo-btn-sm" style="font-size:.65rem;padding:2px 8px;background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.2)">Exit Vault</button>';
                balCard.parentNode.insertBefore(bar, balCard.nextSibling);
                document.getElementById('wo-vault-exit-btn').addEventListener('click', async () => {
                    if (!requirePanel('Exit Vault'))
                        return;
                    try {
                        await bgFetch(API + '/api/vault-mode/deactivate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                        await loadWalletData();
                    }
                    catch { }
                });
            }
        }
        else {
            const active = (d.wallets || []).find(w => w.address === d.address);
            if (nameEl) {
                let nameHtml = esc(active ? active.name : '');
                if (active && active.isBurn)
                    nameHtml += ' <span class="wo-burn-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>Burn</span>';
                nameEl.innerHTML = nameHtml;
            }
            const isBurn = !!(active && active.isBurn);
            chrome.runtime.sendMessage({ type: 'wo-set-burn-mode', enabled: isBurn, address: isBurn ? d.address : '' }).catch(() => { });
        }
        refreshConnectedSite();
        renderRecentTxs(d.recentTxs || []);
        if (_panelOnline && (!d.recentTxs || !d.recentTxs.length)) {
            if (!WLT._activityRetry) {
                WLT._activityRetry = setTimeout(async () => {
                    WLT._activityRetry = null;
                    try {
                        const r2 = await walletFetch('/api/wallet');
                        if (r2 && r2.recentTxs && r2.recentTxs.length) {
                            WLT.data.recentTxs = r2.recentTxs;
                            renderRecentTxs(r2.recentTxs);
                            if (document.getElementById('wo-wlt-history')?.classList.contains('wlt-active'))
                                renderFullHistory();
                        }
                    }
                    catch { }
                }, 3000);
            }
        }
        bindWalletHomeTabs();
        setWalletHomeTab(WLT.homeTab || 'tokens', false);
        if (WLT._cachedTokens)
            renderTokenList(WLT._cachedTokens);
        if (WLT._cachedNfts)
            renderNftList(WLT._cachedNfts);
        if (!tokensAreFresh || !Array.isArray(WLT._cachedTokens) || !Array.isArray(WLT._cachedNfts)) {
            loadTokensAndNfts();
        }
        if (_solPrice === 0)
            pollSolPrice();
        else if (Date.now() - (_lastPricePoll || 0) > 30000)
            pollSolPrice();
        startBalancePolling();
    }
    function bindWalletHomeTabs() {
        updateBridgeVisibility();
        if (WLT.tabsBound)
            return;
        const strip = document.querySelector('.wo-wlt-tabs');
        if (strip && !strip.dataset.scrollBound) {
            let isPointerDown = false;
            let startX = 0;
            let startScrollLeft = 0;
            strip.addEventListener('wheel', (event) => {
                const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
                if (!delta)
                    return;
                strip.scrollLeft += delta;
                event.preventDefault();
            }, { passive: false });
            strip.addEventListener('pointerdown', (event) => {
                isPointerDown = true;
                startX = event.clientX;
                startScrollLeft = strip.scrollLeft;
                strip.classList.add('is-dragging');
            });
            strip.addEventListener('pointermove', (event) => {
                if (!isPointerDown)
                    return;
                strip.scrollLeft = startScrollLeft - (event.clientX - startX);
            });
            const stopDragging = () => {
                isPointerDown = false;
                strip.classList.remove('is-dragging');
            };
            strip.addEventListener('pointerup', stopDragging);
            strip.addEventListener('pointercancel', stopDragging);
            strip.addEventListener('pointerleave', stopDragging);
            strip.dataset.scrollBound = '1';
        }
        document.querySelectorAll('.wo-wlt-tab').forEach(tab => {
            if (tab.classList.contains('wo-wlt-tab-soon'))
                return;
            tab.addEventListener('click', () => setWalletHomeTab(tab.dataset.wltTab));
        });
        WLT.tabsBound = true;
    }
    function setWalletHomeTab(id, runInit) {
        const shouldRunInit = runInit !== false;
        WLT.homeTab = id || 'tokens';
        document.querySelectorAll('.wo-wlt-tab').forEach(t => t.classList.toggle('active', t.dataset.wltTab === WLT.homeTab));
        const activeTab = document.querySelector(`.wo-wlt-tab[data-wlt-tab="${WLT.homeTab}"]`);
        if (activeTab) {
            requestAnimationFrame(() => {
                const strip = activeTab.closest('.wo-wlt-tabs');
                if (!strip)
                    return;
                const tabLeft = activeTab.offsetLeft;
                const tabRight = tabLeft + activeTab.offsetWidth;
                const viewLeft = strip.scrollLeft;
                const viewRight = viewLeft + strip.clientWidth;
                const targetLeft = Math.max(0, tabLeft - Math.max(12, (strip.clientWidth - activeTab.offsetWidth) / 2));
                if (tabLeft < viewLeft || tabRight > viewRight) {
                    strip.scrollTo({ left: targetLeft, behavior: 'smooth' });
                }
            });
        }
        document.querySelectorAll('.wo-wlt-tab-content').forEach(c => c.style.display = 'none');
        const target = document.getElementById('wo-wlt-tab-' + WLT.homeTab);
        if (target)
            target.style.display = 'flex';
        if (!shouldRunInit)
            return;
        if (WLT.homeTab === 'swap')
            initSwapTab();
        if (WLT.homeTab === 'bridge')
            initBridgeTab();
        if (WLT.homeTab === 'settings') {
            renderSettings();
            wltView('wo-wlt-settings');
        }
        if (WLT.homeTab === 'activity')
            refreshActivityTab();
    }
    function updateBridgeVisibility() {
        const bridgeTab = document.querySelector('.wo-wlt-tab[data-wlt-tab="bridge"]');
        if (bridgeTab)
            bridgeTab.style.display = '';
        const locked = document.getElementById('wo-bridge-locked');
        const active = document.getElementById('wo-bridge-active');
        if (locked)
            locked.style.display = 'none';
        if (active)
            active.style.display = '';
        const evmOn = WLT.networks?.['evm'] !== false;
        const notice = document.getElementById('wo-bridge-evm-notice');
        if (notice) {
            if (evmOn) {
                notice.classList.add('hidden');
            }
            else {
                notice.classList.remove('hidden');
            }
        }
    }
    const SWAP = {
        fromMint: 'So11111111111111111111111111111111111111112',
        toMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        slippage: 0.5,
        quoteTimer: null,
    };
    function initSwapTab() {
        updateSwapBalances();
    }
    async function updateSwapBalances() {
        if (!WLT.data?.address)
            return;
        try {
            let tokens;
            const tokensFresh = Date.now() - (WLT.tokensLoadedAt || 0) < 15000;
            if (tokensFresh && Array.isArray(WLT._cachedTokens)) {
                tokens = WLT._cachedTokens;
            }
            else if (_panelOnline) {
                const res = await walletFetch('/api/wallet/tokens');
                if (!res || res.error)
                    return;
                tokens = res.tokens || [];
                WLT._cachedTokens = tokens;
                WLT._cachedNfts = res.nfts || [];
                WLT.tokensLoadedAt = Date.now();
            }
            else {
                tokens = WLT._cachedTokens || [];
            }
            const fromBal = SWAP.fromMint === 'So11111111111111111111111111111111111111112'
                ? (WLT.data.balance || 0).toFixed(4)
                : (tokens.find(t => t.mint === SWAP.fromMint)?.amount?.toFixed(4) || '0');
            const toBal = SWAP.toMint === 'So11111111111111111111111111111111111111112'
                ? (WLT.data.balance || 0).toFixed(4)
                : (tokens.find(t => t.mint === SWAP.toMint)?.amount?.toFixed(4) || '0');
            const fromBalEl = document.getElementById('wo-swap-from-bal');
            const toBalEl = document.getElementById('wo-swap-to-bal');
            if (fromBalEl)
                fromBalEl.textContent = 'Balance: ' + fromBal;
            if (toBalEl)
                toBalEl.textContent = 'Balance: ' + toBal;
            SWAP._fromDecimals = SWAP.fromMint === 'So11111111111111111111111111111111111111112' ? 9 : (tokens.find(t => t.mint === SWAP.fromMint)?.decimals || 6);
            SWAP._toDecimals = SWAP.toMint === 'So11111111111111111111111111111111111111112' ? 9 : (tokens.find(t => t.mint === SWAP.toMint)?.decimals || 6);
        }
        catch { }
    }
    async function fetchSwapQuote() {
        const amt = parseFloat(document.getElementById('wo-swap-from-amt')?.value);
        if (!amt || amt <= 0) {
            const toEl = document.getElementById('wo-swap-to-amt');
            if (toEl)
                toEl.value = '';
            hideQuotesSection();
            return;
        }
        const statusEl = document.getElementById('wo-swap-status');
        try {
            const decimals = SWAP._fromDecimals || (SWAP.fromMint === 'So11111111111111111111111111111111111111112' ? 9 : 6);
            const lamports = Math.round(amt * Math.pow(10, decimals));
            const slip = Math.round(SWAP.slippage * 100);
            const outDecimals = SWAP._toDecimals || (SWAP.toMint === 'So11111111111111111111111111111111111111112' ? 9 : 6);
            if (statusEl)
                statusEl.textContent = '';
            if (_quotesRefreshTimer) {
                clearInterval(_quotesRefreshTimer);
                _quotesRefreshTimer = null;
            }
            fetchMultiQuotes(lamports, slip, outDecimals, false);
        }
        catch (e) {
            if (statusEl) {
                statusEl.textContent = 'Quote error: ' + e.message;
                statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
            }
            hideQuotesSection();
        }
    }
    function hideQuotesSection() {
        const sec = document.getElementById('wo-swap-quotes-section');
        if (sec)
            sec.style.display = 'none';
        const routeRow = document.getElementById('wo-swap-route-row');
        if (routeRow)
            routeRow.style.display = 'none';
        if (_quotesRefreshTimer) {
            clearInterval(_quotesRefreshTimer);
            _quotesRefreshTimer = null;
        }
    }
    const QUOTE_PROVIDER_STYLES = {
        'Jupiter': { bg: 'rgba(198,235,163,0.15)', color: '#c6eba3', logo: 'https://jup.ag/svg/jupiter-logo.svg' },
        'Raydium': { bg: 'rgba(99,179,237,0.15)', color: '#63b3ed', logo: 'https://raydium.io/logo.png' },
        'OKX': { bg: 'rgba(255,255,255,0.10)', color: '#fff', logo: 'https://static.okx.com/cdn/oksupport/asset/currency/icon/okb.png' },
        'Ultra': { bg: 'rgba(168,85,247,0.15)', color: '#a855f7', logo: 'https://jup.ag/svg/jupiter-logo.svg' },
        'Meteora': { bg: 'rgba(233,69,96,0.12)', color: '#e94560', logo: 'https://app.meteora.ag/icons/logo.svg' },
        'Meteora DLMM': { bg: 'rgba(233,69,96,0.12)', color: '#e94560', logo: 'https://app.meteora.ag/icons/logo.svg' },
        'Orca': { bg: 'rgba(255,210,51,0.12)', color: '#ffd233', logo: 'https://www.orca.so/android-chrome-192x192.png' },
        'Whirlpool': { bg: 'rgba(43,200,137,0.12)', color: '#2bc889', logo: 'https://www.orca.so/android-chrome-192x192.png' },
        'Phoenix': { bg: 'rgba(230,126,34,0.12)', color: '#e67e22', logo: 'https://phoenix.trade/logo.svg' },
        'Lifinity': { bg: 'rgba(93,63,211,0.12)', color: '#5d3fd3', logo: '' },
    };
    let _quotesRefreshTimer = null;
    let _lastQuotesParams = null;
    function startQuotesAutoRefresh(lamports, slipBps, outDecimals) {
        if (_quotesRefreshTimer)
            clearInterval(_quotesRefreshTimer);
        _lastQuotesParams = { lamports, slipBps, outDecimals };
        _quotesRefreshTimer = setInterval(() => {
            const swapTab = document.getElementById('wo-wlt-tab-swap');
            if (!swapTab || swapTab.style.display === 'none')
                return;
            const amt = parseFloat(document.getElementById('wo-swap-from-amt')?.value);
            if (!amt || amt <= 0) {
                hideQuotesSection();
                return;
            }
            fetchMultiQuotes(lamports, slipBps, outDecimals, true);
        }, 3000);
    }
    async function fetchMultiQuotes(lamports, slipBps, outDecimals, isRefresh) {
        try {
            let data;
            if (_panelOnline) {
                try {
                    const params = new URLSearchParams({
                        inputMint: SWAP.fromMint,
                        outputMint: SWAP.toMint,
                        amount: String(lamports),
                        slippageBps: String(slipBps),
                    });
                    data = await walletFetch('/api/wallet/quotes?' + params.toString());
                }
                catch (serverErr) {
                }
            }
            if (!data) {
                const encode = encodeURIComponent;
                const jupUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${encode(SWAP.fromMint)}&outputMint=${encode(SWAP.toMint)}&amount=${encode(String(lamports))}&slippageBps=${encode(String(slipBps))}`;
                const jupRes = await fetch(jupUrl, { signal: AbortSignal.timeout(8000) }).then(r => r.json());
                if (jupRes && jupRes.outAmount) {
                    const routes = (jupRes.routePlan || []).map(r => r.swapInfo?.label).filter(Boolean);
                    data = { quotes: [{ provider: 'Jupiter', outAmount: String(jupRes.outAmount), routeLabel: routes.join(', '), best: true }] };
                }
            }
            if (!data || !data.quotes || !data.quotes.length) {
                hideQuotesSection();
                return;
            }
            const section = document.getElementById('wo-swap-quotes-section');
            const listEl = document.getElementById('wo-swap-quotes-list');
            const viaEl = document.getElementById('wo-swap-quotes-via');
            const countEl = document.getElementById('wo-swap-quotes-count');
            if (!section || !listEl)
                return;
            if (countEl)
                countEl.textContent = data.quotes.length + '≥';
            const bestOut = BigInt(data.quotes[0]?.outAmount || '0');
            const bestOutNum = Number(data.quotes[0]?.outAmount || 0) / Math.pow(10, outDecimals);
            const isOutputSol = SWAP.toMint === 'So11111111111111111111111111111111111111112';
            const isOutputStable = ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmKfr9j12o9YEKnCRVpsOQ7bG88GiA3kU'].includes(SWAP.toMint);
            const outUsdRate = isOutputSol ? _solPrice : isOutputStable ? 1 : 0;
            const allRoutes = data.quotes.map(q => q.routeLabel).filter(Boolean);
            if (viaEl) {
                viaEl.textContent = allRoutes.length ? 'via ' + allRoutes.slice(0, 2).join(', ') + (allRoutes.length > 2 ? ` & ${allRoutes.length - 2} more` : '') : '';
            }
            let quotesHtml = '';
            data.quotes.forEach((q, i) => {
                const style = QUOTE_PROVIDER_STYLES[q.provider] || { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', logo: '' };
                const outNum = Number(q.outAmount) / Math.pow(10, outDecimals);
                const isBest = q.best;
                let priceStr = '';
                let diffStr = '';
                if (outUsdRate > 0) {
                    const usd = outNum * outUsdRate;
                    priceStr = '$' + usd.toFixed(2);
                    if (isBest) {
                        if (data.quotes.length > 1) {
                            const secondOut = Number(data.quotes[1].outAmount) / Math.pow(10, outDecimals);
                            const d = (outNum - secondOut) * outUsdRate;
                            if (d > 0.001)
                                diffStr = '+$' + d.toFixed(2);
                        }
                    }
                    else {
                    }
                }
                else {
                    priceStr = outNum < 0.001 ? outNum.toExponential(3) : outNum.toFixed(outDecimals > 6 ? 6 : 4);
                    if (!isBest && bestOut > 0n) {
                        const pctDiff = ((outNum - bestOutNum) / bestOutNum * 100).toFixed(2);
                        if (parseFloat(pctDiff) !== 0)
                            diffStr = pctDiff + '%';
                    }
                }
                const bestBadge = isBest ? '<span class="wo-quote-best-badge">Best Price</span>' : '';
                const diffHtml = diffStr ? `<span class="wo-quote-diff wo-quote-diff-green">${diffStr}</span>` : '';
                quotesHtml += `<div class="wo-quote-item${isBest ? ' wo-quote-best' : ''}${isRefresh ? ' wo-quote-enter' : ''}" style="${isRefresh ? '' : 'animation-delay:' + (i * 80) + 'ms'}">
          <div class="wo-quote-provider">
            <span class="wo-quote-provider-icon" style="background:${style.bg}">${style.logo ? `<img src="${style.logo}" alt="" class="wo-quote-logo">` : `<span style="color:${style.color};font-size:11px;font-weight:700">${esc(q.provider).charAt(0)}</span>`}</span>
            <span class="wo-quote-provider-name">${esc(q.provider)}</span>
            ${bestBadge}
          </div>
          <div class="wo-quote-amount">
            ${diffHtml}
            <span class="wo-quote-out">${priceStr}</span>
          </div>
        </div>`;
            });
            listEl.innerHTML = quotesHtml;
            section.style.display = '';
            if (!isRefresh) {
                requestAnimationFrame(() => {
                    listEl.querySelectorAll('.wo-quote-item').forEach(el => el.classList.add('wo-quote-enter'));
                });
            }
            if (data.quotes.length > 0) {
                const bestQ = data.quotes[0];
                const bestOutNum = Number(bestQ.outAmount) / Math.pow(10, outDecimals);
                const toEl = document.getElementById('wo-swap-to-amt');
                if (toEl)
                    toEl.value = bestOutNum.toFixed(6);
                const inputAmt = Number(lamports) / Math.pow(10, SWAP._fromDecimals || 9);
                if (inputAmt > 0) {
                    const rate = bestOutNum / inputAmt;
                    const rateRow = document.getElementById('wo-swap-rate-row');
                    const rateEl = document.getElementById('wo-swap-rate');
                    const routeRow = document.getElementById('wo-swap-route-row');
                    const routeRate = document.getElementById('wo-swap-route-rate');
                    if (rateRow)
                        rateRow.style.display = '';
                    if (rateEl)
                        rateEl.textContent = `1 ${SWAP.fromSymbol} ≈ ${rate.toFixed(4)} ${SWAP.toSymbol}`;
                    if (routeRow)
                        routeRow.style.display = '';
                    if (routeRate)
                        routeRate.textContent = `1 ${SWAP.fromSymbol} ≈ ${rate.toFixed(4)} ${SWAP.toSymbol}`;
                }
            }
            if (!_quotesRefreshTimer) {
                startQuotesAutoRefresh(lamports, slipBps, outDecimals);
            }
        }
        catch (e) {
        }
    }
    let _quickSellApproval = true;
    chrome.storage.local.get(['wo_quicksell_approve'], (r) => {
        if (r.wo_quicksell_approve === false)
            _quickSellApproval = false;
    });
    let _txSafetyAutoCheck = true;
    chrome.storage.local.get(['wo_safety_autocheck'], (r) => {
        if (r.wo_safety_autocheck === false)
            _txSafetyAutoCheck = false;
    });
    function showSafetyCheck(txInfo) {
        return new Promise((resolve) => {
            const modal = document.getElementById('wo-safety-modal');
            if (!modal) {
                resolve(true);
                return;
            }
            const riskSection = document.getElementById('wo-safety-risk-section');
            const warningsEl = document.getElementById('wo-safety-warnings');
            const aiSection = document.getElementById('wo-safety-ai-section');
            const loadingEl = document.getElementById('wo-safety-loading');
            const loadingText = document.getElementById('wo-safety-loading-text');
            const proceedBtn = document.getElementById('wo-safety-proceed');
            const aiBtn = document.getElementById('wo-safety-ai-btn');
            const shield = document.getElementById('wo-safety-shield');
            const riskFill = document.getElementById('wo-safety-risk-fill');
            const riskValue = document.getElementById('wo-safety-risk-value');
            if (riskSection)
                riskSection.style.display = 'none';
            if (warningsEl) {
                warningsEl.style.display = 'none';
                warningsEl.innerHTML = '';
            }
            if (aiSection)
                aiSection.style.display = 'none';
            if (loadingEl)
                loadingEl.style.display = 'none';
            if (proceedBtn) {
                proceedBtn.className = 'wo-btn wo-btn-primary wo-btn-sm';
                proceedBtn.disabled = false;
            }
            if (aiBtn)
                aiBtn.disabled = false;
            if (shield)
                shield.textContent = '🛡️';
            if (riskFill) {
                riskFill.style.width = '0%';
                riskFill.className = 'wo-safety-risk-fill';
            }
            const summaryEl = document.getElementById('wo-safety-tx-summary');
            if (summaryEl) {
                let desc = '';
                if (txInfo.type === 'swap') {
                    desc = `Swap <strong>${esc(String(txInfo.amount))} ${esc(txInfo.fromSymbol || '?')}</strong> → <strong>${esc(txInfo.toSymbol || '?')}</strong>`;
                }
                else if (txInfo.type === 'send') {
                    desc = `Send <strong>${esc(String(txInfo.amount))} ${esc(txInfo.tokenSymbol || 'SOL')}</strong> to <strong>${esc((txInfo.toAddress || '').slice(0, 6))}…${esc((txInfo.toAddress || '').slice(-4))}</strong>`;
                }
                else if (txInfo.type === 'private-send') {
                    desc = `Private Send <strong>${esc(String(txInfo.amount))} SOL</strong> to <strong>${esc((txInfo.toAddress || '').slice(0, 6))}…${esc((txInfo.toAddress || '').slice(-4))}</strong>`;
                }
                else {
                    desc = `${esc(txInfo.type || 'Transaction')}: <strong>${esc(String(txInfo.amount || '?'))}</strong>`;
                }
                summaryEl.innerHTML = desc;
            }
            let resolved = false;
            function cleanup() {
                if (resolved)
                    return;
                resolved = true;
                modal.classList.remove('visible');
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                proceedBtn.removeEventListener('click', onProceed);
                aiBtn.removeEventListener('click', onAiCheck);
            }
            function onCancel() { cleanup(); resolve(false); }
            function onProceed() { cleanup(); resolve(true); }
            const cancelBtn = document.getElementById('wo-safety-cancel');
            const closeBtn = document.getElementById('wo-safety-close');
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            proceedBtn.addEventListener('click', onProceed);
            function displayRisk(data) {
                if (!data)
                    return;
                const score = data.riskScore || 0;
                const level = data.riskLevel || 'low';
                if (riskSection)
                    riskSection.style.display = '';
                if (riskFill) {
                    riskFill.style.width = score + '%';
                    riskFill.className = 'wo-safety-risk-fill risk-' + level;
                }
                if (riskValue) {
                    riskValue.textContent = score + '/100';
                    riskValue.style.color = level === 'high' ? 'var(--red)' : level === 'medium' ? '#f59e0b' : '#22c55e';
                }
                if (shield)
                    shield.textContent = level === 'high' ? '🚨' : level === 'medium' ? '⚠️' : '✅';
                const title = document.getElementById('wo-safety-title');
                if (title)
                    title.textContent = level === 'high' ? 'High Risk!' : level === 'medium' ? 'Caution' : 'Looks Safe';
                const warnings = data.warnings || [];
                if (warnings.length && warningsEl) {
                    warningsEl.style.display = '';
                    warningsEl.innerHTML = warnings.map(w => {
                        const icon = w.level === 'danger' ? '🚫' : w.level === 'warning' ? '⚠️' : 'ℹ️';
                        return `<div class="wo-safety-warn-item ${esc(w.level || 'info')}"><span class="wo-safety-warn-icon">${icon}</span><span>${esc(w.message)}</span></div>`;
                    }).join('');
                }
                if (proceedBtn && level === 'high') {
                    proceedBtn.className = 'wo-btn wo-btn-sm risk-high';
                }
            }
            async function onAiCheck() {
                if (!_panelOnline)
                    await checkPanel();
                if (!_panelOnline) {
                    if (aiSection)
                        aiSection.style.display = '';
                    const bodyEl = document.getElementById('wo-safety-ai-body');
                    if (bodyEl)
                        bodyEl.innerHTML = '<div style="color:var(--muted)">AI Safety Check requires the WhiteOwl panel to be running.</div>';
                    return;
                }
                if (aiBtn)
                    aiBtn.disabled = true;
                if (loadingEl)
                    loadingEl.style.display = '';
                if (loadingText)
                    loadingText.textContent = 'AI is analyzing…';
                try {
                    const res = await walletFetch('/api/wallet/ai-drainer-check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(txInfo),
                        timeout: 30000,
                    });
                    if (loadingEl)
                        loadingEl.style.display = 'none';
                    if (res && !res.error) {
                        if (aiSection)
                            aiSection.style.display = '';
                        const verdictEl = document.getElementById('wo-safety-ai-verdict');
                        const bodyEl = document.getElementById('wo-safety-ai-body');
                        const v = res.verdict || 'unknown';
                        if (verdictEl) {
                            verdictEl.textContent = v.toUpperCase();
                            verdictEl.className = 'wo-safety-ai-verdict ' + v;
                        }
                        let html = '';
                        if (res.summary)
                            html += `<div style="margin-bottom:6px">${esc(res.summary)}</div>`;
                        if (res.risks && res.risks.length) {
                            html += res.risks.map(r => `<div style="font-size:10px;color:var(--red)">• ${esc(r)}</div>`).join('');
                        }
                        if (res.recommendation)
                            html += `<div style="font-size:10px;color:var(--text2);margin-top:4px">💡 ${esc(res.recommendation)}</div>`;
                        if (res.confidence)
                            html += `<div style="font-size:9px;color:var(--muted);margin-top:4px">Confidence: ${res.confidence}%</div>`;
                        if (bodyEl)
                            bodyEl.innerHTML = html || '<div style="color:var(--muted)">No details</div>';
                        if (v === 'dangerous' && proceedBtn) {
                            proceedBtn.className = 'wo-btn wo-btn-sm risk-high';
                            if (shield)
                                shield.textContent = '🚨';
                        }
                    }
                    else {
                        if (aiSection)
                            aiSection.style.display = '';
                        const bodyEl = document.getElementById('wo-safety-ai-body');
                        if (bodyEl)
                            bodyEl.innerHTML = `<div style="color:var(--red)">${esc(res?.error || 'AI check failed')}</div>`;
                    }
                }
                catch (e) {
                    if (loadingEl)
                        loadingEl.style.display = 'none';
                    if (aiSection)
                        aiSection.style.display = '';
                    const bodyEl = document.getElementById('wo-safety-ai-body');
                    if (bodyEl)
                        bodyEl.innerHTML = `<div style="color:var(--red)">Error: ${esc(e.message)}</div>`;
                }
            }
            aiBtn.addEventListener('click', onAiCheck);
            modal.classList.add('visible');
            if (_txSafetyAutoCheck && _panelOnline) {
                if (loadingEl)
                    loadingEl.style.display = '';
                if (loadingText)
                    loadingText.textContent = 'Checking transaction safety…';
                walletFetch('/api/wallet/tx-safety-check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(txInfo),
                    timeout: 15000,
                }).then(data => {
                    if (loadingEl)
                        loadingEl.style.display = 'none';
                    if (data && !data.error)
                        displayRisk(data);
                }).catch(() => {
                    if (loadingEl)
                        loadingEl.style.display = 'none';
                });
            }
        });
    }
    async function quickSellToken(mint, symbol, balance, decimals) {
        const addr = WLT.data?.address;
        if (!WLT.data?.address)
            return;
        if (_quickSellApproval) {
            const confirmed = await showQuickSellConfirm(symbol, balance, mint);
            if (!confirmed)
                return;
        }
        const statusEl = document.getElementById('wo-swap-status');
        const tokenList = document.getElementById('wo-wlt-token-list');
        const item = tokenList?.querySelector(`.wo-token-item[data-mint="${CSS.escape(mint)}"]`);
        const sellBtn = item?.querySelector('.wo-token-sell-btn');
        if (sellBtn) {
            sellBtn.textContent = '…';
            sellBtn.disabled = true;
        }
        showSwapProgressOverlay();
        try {
            const res = await walletFetch('/api/wallet/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromMint: mint,
                    toMint: 'So11111111111111111111111111111111111111112',
                    amount: balance,
                    slippage: SWAP.slippage || 0.5,
                }),
                timeout: 60000,
            });
            hideSwapProgressOverlay();
            if (res?.signature) {
                if (sellBtn) {
                    sellBtn.textContent = '✓';
                    sellBtn.className = 'wo-token-sell-btn wo-sell-success';
                }
                showSwapSuccessFx({
                    signature: res.signature,
                    fromAmount: balance,
                    fromSymbol: symbol,
                    toAmount: '~SOL',
                    toSymbol: 'SOL',
                });
                setTimeout(() => { loadWalletData(); }, 2000);
            }
            else {
                if (sellBtn) {
                    sellBtn.textContent = '✗';
                    sellBtn.className = 'wo-token-sell-btn wo-sell-fail';
                }
            }
        }
        catch {
            hideSwapProgressOverlay();
            if (sellBtn) {
                sellBtn.textContent = '✗';
                sellBtn.className = 'wo-token-sell-btn wo-sell-fail';
            }
        }
        setTimeout(() => {
            if (sellBtn) {
                sellBtn.textContent = 'Sell';
                sellBtn.disabled = false;
                sellBtn.className = 'wo-token-sell-btn';
            }
        }, 3000);
    }
    function showQuickSellConfirm(symbol, balance, mint) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'wo-modal-overlay active';
            overlay.innerHTML = `<div class="wo-modal-box" style="max-width:340px">
        <div class="wo-modal-hd">
          <span class="wo-modal-title">Quick Sell</span>
          <button class="wo-modal-close wo-qs-close">&times;</button>
        </div>
        <div class="wo-modal-body" style="gap:10px">
          <div style="text-align:center;font-size:13px;color:var(--text2)">
            Sell <strong style="color:var(--text)">${esc(String(balance))} ${esc(symbol)}</strong> for <strong style="color:var(--text)">SOL</strong>?
          </div>
          <div style="font-size:10px;color:var(--muted);text-align:center">
            ${esc(mint.slice(0, 6))}…${esc(mint.slice(-4))} · Slippage: ${SWAP.slippage}%
          </div>
          <label class="wo-qs-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text2);margin-top:4px;cursor:pointer">
            <input type="checkbox" class="wo-qs-skip-check" ${!_quickSellApproval ? 'checked' : ''}>
            Don't ask again
          </label>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button class="wo-btn wo-btn-sm wo-btn-full wo-qs-cancel">Cancel</button>
            <button class="wo-btn wo-btn-primary wo-btn-sm wo-btn-full wo-qs-confirm">Sell</button>
          </div>
        </div>
      </div>`;
            document.body.appendChild(overlay);
            const cleanup = (result) => {
                const check = overlay.querySelector('.wo-qs-skip-check');
                if (check?.checked) {
                    _quickSellApproval = false;
                    chrome.storage.local.set({ wo_quicksell_approve: false });
                }
                overlay.remove();
                resolve(result);
            };
            overlay.querySelector('.wo-qs-close')?.addEventListener('click', () => cleanup(false));
            overlay.querySelector('.wo-qs-cancel')?.addEventListener('click', () => cleanup(false));
            overlay.querySelector('.wo-qs-confirm')?.addEventListener('click', () => cleanup(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay)
                cleanup(false); });
        });
    }
    const BRIDGE = {
        fromChain: 'solana',
        toChain: 'ethereum',
        fromToken: 'SOL',
        toToken: 'ETH',
        chains: [],
        quoteTimer: null,
        lastQuote: null,
        routes: [],
        selectedRoute: null,
    };
    function initBridgeTab() {
        updateBridgeVisibility();
        if (!BRIDGE.chains.length)
            loadBridgeChains();
        updateBridgeBalance();
    }
    async function loadBridgeChains() {
        if (!_panelOnline)
            return;
        try {
            const data = await walletFetch('/api/wallet/bridge/chains');
            if (data?.chains)
                BRIDGE.chains = data.chains;
        }
        catch { }
    }
    function updateBridgeBalance() {
        const balEl = document.getElementById('wo-bridge-from-bal');
        if (!balEl || !WLT.data)
            return;
        if (BRIDGE.fromChain === 'solana') {
            if (BRIDGE.fromToken === 'SOL') {
                balEl.textContent = 'Balance: ' + (WLT.data.balance ?? 0).toFixed(4) + ' SOL';
            }
            else {
                const tok = (WLT.data.tokens || []).find(t => t.symbol === BRIDGE.fromToken);
                balEl.textContent = tok ? 'Balance: ' + Number(tok.uiAmount).toFixed(4) + ' ' + tok.symbol : 'Balance: 0';
            }
        }
        else {
            balEl.textContent = 'Balance: —';
        }
    }
    function scheduleBridgeQuote() {
        clearTimeout(BRIDGE.quoteTimer);
        BRIDGE.quoteTimer = setTimeout(fetchBridgeRoutes, 500);
    }
    async function fetchBridgeRoutes() {
        if (!requirePanel('Bridge'))
            return;
        const amtEl = document.getElementById('wo-bridge-from-amt');
        const outEl = document.getElementById('wo-bridge-to-amt');
        const routesEl = document.getElementById('wo-bridge-routes');
        const loadingEl = document.getElementById('wo-bridge-routes-loading');
        const noRoutesEl = document.getElementById('wo-bridge-no-routes');
        const feeRow = document.getElementById('wo-bridge-fee-row');
        const timeRow = document.getElementById('wo-bridge-time-row');
        const viaRow = document.getElementById('wo-bridge-via-row');
        const amt = parseFloat(amtEl?.value);
        if (!amt || amt <= 0) {
            if (outEl)
                outEl.value = '';
            if (routesEl)
                routesEl.style.display = 'none';
            if (loadingEl)
                loadingEl.style.display = 'none';
            if (noRoutesEl)
                noRoutesEl.style.display = 'none';
            if (feeRow)
                feeRow.style.display = 'none';
            if (timeRow)
                timeRow.style.display = 'none';
            if (viaRow)
                viaRow.style.display = 'none';
            BRIDGE.routes = [];
            BRIDGE.selectedRoute = null;
            BRIDGE.lastQuote = null;
            return;
        }
        if (routesEl)
            routesEl.style.display = 'none';
        if (loadingEl)
            loadingEl.style.display = '';
        if (noRoutesEl)
            noRoutesEl.style.display = 'none';
        try {
            const params = new URLSearchParams({
                fromChain: BRIDGE.fromChain, toChain: BRIDGE.toChain,
                fromToken: BRIDGE.fromToken, toToken: BRIDGE.toToken,
                amount: String(amt),
                sender: WLT.data?.address || '',
            });
            const data = await walletFetch('/api/wallet/bridge/routes?' + params);
            if (loadingEl)
                loadingEl.style.display = 'none';
            if (data?.routes?.length) {
                BRIDGE.routes = data.routes;
                BRIDGE.selectedRoute = 0;
                renderBridgeRoutes();
                selectBridgeRoute(0);
            }
            else {
                BRIDGE.routes = [];
                BRIDGE.selectedRoute = null;
                BRIDGE.lastQuote = null;
                if (outEl)
                    outEl.value = '';
                if (routesEl)
                    routesEl.style.display = 'none';
                if (noRoutesEl)
                    noRoutesEl.style.display = '';
                if (feeRow)
                    feeRow.style.display = 'none';
                if (timeRow)
                    timeRow.style.display = 'none';
                if (viaRow)
                    viaRow.style.display = 'none';
            }
        }
        catch {
            if (loadingEl)
                loadingEl.style.display = 'none';
            if (outEl)
                outEl.value = '';
            BRIDGE.routes = [];
            BRIDGE.selectedRoute = null;
            BRIDGE.lastQuote = null;
        }
    }
    const BRIDGE_AGG_COLORS = {
        'deBridge': { bg: 'rgba(139,92,246,.15)', color: '#a78bfa', letter: 'dB' },
        'Li.Fi': { bg: 'rgba(96,165,250,.15)', color: '#60a5fa', letter: 'LF' },
        'Socket': { bg: 'rgba(251,191,36,.15)', color: '#fbbf24', letter: 'SK' },
    };
    function renderBridgeRoutes() {
        const routesEl = document.getElementById('wo-bridge-routes');
        if (!routesEl || !BRIDGE.routes.length)
            return;
        routesEl.innerHTML = BRIDGE.routes.map((r, i) => {
            const c = BRIDGE_AGG_COLORS[r.aggregator] || { bg: 'rgba(139,92,246,.15)', color: '#a78bfa', letter: r.aggregator.slice(0, 2) };
            const tags = r.tags || [];
            const badges = tags.map(t => {
                if (t === 'best')
                    return '<span class="wo-bridge-route-badge best">Best</span>';
                if (t === 'fast')
                    return '<span class="wo-bridge-route-badge fast">Fast</span>';
                return '';
            }).join('');
            return `<div class="wo-bridge-route ${i === BRIDGE.selectedRoute ? 'selected' : ''}" data-route-idx="${i}">
        <div class="wo-bridge-route-logo" style="background:${c.bg};color:${c.color}">${esc(c.letter)}</div>
        <div class="wo-bridge-route-info">
          <div class="wo-bridge-route-top">
            <span class="wo-bridge-route-name">${esc(r.aggregator)}</span>
            ${badges}
          </div>
          <div class="wo-bridge-route-bottom">
            <span class="wo-bridge-route-detail">Fee: $${esc(r.feeUsd)}</span>
            <span class="wo-bridge-route-detail">${esc(r.estimatedTime)}</span>
          </div>
        </div>
        <div class="wo-bridge-route-amount">${Number(r.outAmount).toFixed(6)} ${esc(r.outSymbol)}</div>
      </div>`;
        }).join('');
        routesEl.style.display = '';
        routesEl.querySelectorAll('[data-route-idx]').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.routeIdx);
                selectBridgeRoute(idx);
            });
        });
    }
    function selectBridgeRoute(idx) {
        if (idx < 0 || idx >= BRIDGE.routes.length)
            return;
        BRIDGE.selectedRoute = idx;
        const r = BRIDGE.routes[idx];
        BRIDGE.lastQuote = r;
        const outEl = document.getElementById('wo-bridge-to-amt');
        if (outEl)
            outEl.value = Number(r.outAmount).toFixed(6);
        const feeEl = document.getElementById('wo-bridge-fee');
        const timeEl = document.getElementById('wo-bridge-time');
        const viaEl = document.getElementById('wo-bridge-via');
        const feeRow = document.getElementById('wo-bridge-fee-row');
        const timeRow = document.getElementById('wo-bridge-time-row');
        const viaRow = document.getElementById('wo-bridge-via-row');
        if (feeEl)
            feeEl.textContent = '$' + r.feeUsd;
        if (timeEl)
            timeEl.textContent = r.estimatedTime;
        if (viaEl)
            viaEl.textContent = r.aggregator;
        if (feeRow)
            feeRow.style.display = '';
        if (timeRow)
            timeRow.style.display = '';
        if (viaRow)
            viaRow.style.display = '';
        document.querySelectorAll('.wo-bridge-route').forEach((el, i) => {
            el.classList.toggle('selected', i === idx);
        });
    }
    async function fetchBridgeQuote() {
        if (!requirePanel('Bridge quote'))
            return;
        const amtEl = document.getElementById('wo-bridge-from-amt');
        const outEl = document.getElementById('wo-bridge-to-amt');
        const feeEl = document.getElementById('wo-bridge-fee');
        const timeEl = document.getElementById('wo-bridge-time');
        const feeRow = document.getElementById('wo-bridge-fee-row');
        const timeRow = document.getElementById('wo-bridge-time-row');
        const amt = parseFloat(amtEl?.value);
        if (!amt || amt <= 0) {
            if (outEl)
                outEl.value = '';
            if (feeRow)
                feeRow.style.display = 'none';
            if (timeRow)
                timeRow.style.display = 'none';
            BRIDGE.lastQuote = null;
            return;
        }
        try {
            const params = new URLSearchParams({
                fromChain: BRIDGE.fromChain, toChain: BRIDGE.toChain,
                fromToken: BRIDGE.fromToken, toToken: BRIDGE.toToken,
                amount: String(amt),
            });
            const data = await walletFetch('/api/wallet/bridge/quote?' + params);
            if (data?.outAmount) {
                if (outEl)
                    outEl.value = Number(data.outAmount).toFixed(6);
                if (feeEl)
                    feeEl.textContent = '$' + data.feeUsd;
                if (timeEl)
                    timeEl.textContent = data.estimatedTime || '1-3 min';
                if (feeRow)
                    feeRow.style.display = '';
                if (timeRow)
                    timeRow.style.display = '';
                BRIDGE.lastQuote = data;
            }
            else {
                if (outEl)
                    outEl.value = '';
                if (feeRow)
                    feeRow.style.display = 'none';
                if (timeRow)
                    timeRow.style.display = 'none';
                BRIDGE.lastQuote = null;
            }
        }
        catch {
            if (outEl)
                outEl.value = '';
            BRIDGE.lastQuote = null;
        }
    }
    function openBridgeChainPicker(side) {
        const chains = BRIDGE.chains.length ? BRIDGE.chains : [
            { key: 'solana', name: 'Solana' }, { key: 'ethereum', name: 'Ethereum' },
            { key: 'bsc', name: 'BSC' }, { key: 'polygon', name: 'Polygon' },
            { key: 'arbitrum', name: 'Arbitrum' }, { key: 'base', name: 'Base' },
            { key: 'optimism', name: 'Optimism' }, { key: 'avalanche', name: 'Avalanche' },
        ];
        const overlay = document.createElement('div');
        overlay.className = 'wo-modal-overlay active';
        overlay.innerHTML = `<div class="wo-modal" style="max-width:320px">
      <div class="wo-modal-header"><span class="wo-modal-title">Select ${side === 'from' ? 'Source' : 'Destination'} Chain</span>
        <button class="wo-modal-close">&times;</button></div>
      <div class="wo-modal-body" style="padding:8px">
        ${chains.map(c => `<button class="wo-sett-cat" style="width:100%;margin:2px 0" data-chain="${esc(c.key)}">
          <div class="wo-sett-cat-icon" style="width:28px;height:28px;border-radius:8px;font-size:11px;font-weight:700">${esc(c.name.slice(0, 2))}</div>
          <div style="flex:1;text-align:left"><div class="wo-sett-row-name" style="font-size:13px">${esc(c.name)}</div></div>
        </button>`).join('')}
      </div></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.wo-modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay)
            overlay.remove(); });
        overlay.querySelectorAll('[data-chain]').forEach(btn => {
            btn.addEventListener('click', () => {
                const chain = btn.dataset.chain;
                if (side === 'from') {
                    BRIDGE.fromChain = chain;
                    const ch = chains.find(c => c.key === chain);
                    const span = document.querySelector('#wo-bridge-from-chain span');
                    if (span)
                        span.textContent = ch?.name || chain;
                    const chData = BRIDGE.chains.find(c => c.key === chain);
                    BRIDGE.fromToken = chData?.nativeToken || ch?.name?.slice(0, 3).toUpperCase() || 'SOL';
                    const ft = document.querySelector('#wo-bridge-from-token span');
                    if (ft)
                        ft.textContent = BRIDGE.fromToken;
                }
                else {
                    BRIDGE.toChain = chain;
                    const ch = chains.find(c => c.key === chain);
                    const span = document.querySelector('#wo-bridge-to-chain span');
                    if (span)
                        span.textContent = ch?.name || chain;
                    const chData = BRIDGE.chains.find(c => c.key === chain);
                    BRIDGE.toToken = chData?.nativeToken || ch?.name?.slice(0, 3).toUpperCase() || 'ETH';
                    const tt = document.querySelector('#wo-bridge-to-token span');
                    if (tt)
                        tt.textContent = BRIDGE.toToken;
                }
                overlay.remove();
                updateBridgeBalance();
                scheduleBridgeQuote();
            });
        });
    }
    function openBridgeTokenPicker(side) {
        const chainKey = side === 'from' ? BRIDGE.fromChain : BRIDGE.toChain;
        const ch = BRIDGE.chains.find(c => c.key === chainKey);
        const tokens = ch?.tokens || [{ symbol: BRIDGE_CHAINS_FALLBACK[chainKey] || 'SOL' }];
        const overlay = document.createElement('div');
        overlay.className = 'wo-modal-overlay active';
        overlay.innerHTML = `<div class="wo-modal" style="max-width:300px">
      <div class="wo-modal-header"><span class="wo-modal-title">Select Token</span>
        <button class="wo-modal-close">&times;</button></div>
      <div class="wo-modal-body" style="padding:8px">
        ${tokens.map(t => `<button class="wo-sett-cat" style="width:100%;margin:2px 0" data-tok="${esc(t.symbol)}">
          <div class="wo-sett-cat-icon" style="width:28px;height:28px;border-radius:8px;font-size:11px;font-weight:700">${esc(t.symbol.slice(0, 2))}</div>
          <div style="flex:1;text-align:left"><div class="wo-sett-row-name" style="font-size:13px">${esc(t.symbol)}</div></div>
        </button>`).join('')}
      </div></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.wo-modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay)
            overlay.remove(); });
        overlay.querySelectorAll('[data-tok]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tok = btn.dataset.tok;
                if (side === 'from') {
                    BRIDGE.fromToken = tok;
                    const ft = document.querySelector('#wo-bridge-from-token span');
                    if (ft)
                        ft.textContent = tok;
                }
                else {
                    BRIDGE.toToken = tok;
                    const tt = document.querySelector('#wo-bridge-to-token span');
                    if (tt)
                        tt.textContent = tok;
                }
                overlay.remove();
                updateBridgeBalance();
                scheduleBridgeQuote();
            });
        });
    }
    const BRIDGE_CHAINS_FALLBACK = { solana: 'SOL', ethereum: 'ETH', bsc: 'BNB', polygon: 'POL', arbitrum: 'ETH', base: 'ETH', optimism: 'ETH', avalanche: 'AVAX' };
    function buildTokenDetailMarkup(data, opts = {}) {
        const useLabel = opts.useLabel || '';
        const showUseButton = !!opts.showUseButton;
        const v = data.verified
            ? '<span class="wo-sp-detail-verified"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="2" fill="none"/></svg> Verified</span>'
            : '<span class="wo-sp-detail-unverified">⚠ Unverified</span>';
        const price = data.price ? `$${data.price < 0.01 ? data.price.toExponential(2) : data.price.toFixed(6)}` : '—';
        const vol = data.daily_volume ? `$${Number(data.daily_volume).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
        const liq = data.liquidity ? `$${Number(data.liquidity).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
        const mcap = data.marketCap ? `$${Number(data.marketCap).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
        const chg = data.priceChange24h != null && data.priceChange24h !== 0 ? `<span style="color:${data.priceChange24h >= 0 ? '#22c55e' : '#ef4444'}">${data.priceChange24h >= 0 ? '+' : ''}${data.priceChange24h.toFixed(1)}%</span>` : '';
        const routes = (data.routePlan || []).map(r => `<div class="wo-sp-detail-route">${esc(r.amm)}</div>`).join('') || '<div class="wo-sp-detail-route">No routes</div>';
        const swappable = data.swappable ? '<span style="color:var(--green)">✓ Swappable</span>' : '<span style="color:var(--red)">✗ No liquidity</span>';
        return `
      <div class="wo-sp-detail-header">
        <button class="wo-sp-detail-back">← Back</button>
      </div>
      <div class="wo-sp-detail-token">
        <div class="wo-sp-detail-icon">
          ${data.logoURI ? `<img src="${esc(data.logoURI)}" class="wo-token-icon-img" alt="">` : `<span class="wo-swap-picker-token-badge">${esc((data.symbol || '?').slice(0, 2))}</span>`}
        </div>
        <div class="wo-sp-detail-name-wrap">
          <span class="wo-sp-detail-sym">${esc(data.symbol || '???')}</span> ${v}
          <span class="wo-sp-detail-name">${esc(data.name || '')}</span>
        </div>
      </div>
      <div class="wo-sp-detail-grid">
        <div class="wo-sp-detail-cell"><span class="wo-sp-detail-label">Price ${chg}</span><span class="wo-sp-detail-val">${price}</span></div>
        <div class="wo-sp-detail-cell"><span class="wo-sp-detail-label">24h Volume</span><span class="wo-sp-detail-val">${vol}</span></div>
        <div class="wo-sp-detail-cell"><span class="wo-sp-detail-label">Liquidity</span><span class="wo-sp-detail-val">${liq}</span></div>
        <div class="wo-sp-detail-cell"><span class="wo-sp-detail-label">Market Cap</span><span class="wo-sp-detail-val">${mcap}</span></div>
        <div class="wo-sp-detail-cell"><span class="wo-sp-detail-label">Decimals</span><span class="wo-sp-detail-val">${data.decimals ?? '—'}</span></div>
        <div class="wo-sp-detail-cell"><span class="wo-sp-detail-label">Status</span><span class="wo-sp-detail-val">${swappable}</span></div>
      </div>
      <div class="wo-sp-detail-addr-row">
        <span class="wo-sp-detail-label">Contract</span>
        <span class="wo-sp-detail-addr" title="${esc(data.address)}">${data.address.slice(0, 6)}…${data.address.slice(-4)}</span>
        <button class="wo-sp-detail-copy" data-copy="${esc(data.address)}" title="Copy address">📋</button>
      </div>
      <div class="wo-sp-detail-routes-hd">Routes</div>
      <div class="wo-sp-detail-routes">${routes}</div>
      ${showUseButton ? `<button class="wo-btn wo-btn-primary wo-btn-sm wo-sp-detail-use" style="width:100%;margin-top:12px">Use ${esc(useLabel || data.symbol || 'Token')}</button>` : ''}
    `;
    }
    function bindTokenDetailCopy(container) {
        container.querySelector('.wo-sp-detail-copy')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            navigator.clipboard.writeText(ev.currentTarget.dataset.copy);
            ev.currentTarget.textContent = '✓';
            setTimeout(() => { ev.currentTarget.textContent = '📋'; }, 1200);
        });
    }
    async function renderTokenDetailPanel(mint, container, opts = {}) {
        if (!_panelOnline) {
            try {
                await _apiReady;
                const h = await fetch(API + '/api/health', { signal: AbortSignal.timeout(3000) });
                if (h.ok) {
                    _panelOnline = true;
                    updatePanelIndicator();
                }
            }
            catch { }
        }
        if (!_panelOnline) {
            container.innerHTML = '<div class="wo-sp-detail-err">Token info requires the panel to be online.</div>';
            return null;
        }
        container.innerHTML = '<div class="wo-sp-detail-loading"><div class="wo-spin-sm"></div> Loading token info…</div>';
        try {
            const data = await walletFetch('/api/token/info/' + encodeURIComponent(mint));
            if (!data || data.error)
                throw new Error(data?.error || 'Failed');
            container.dataset.mint = data.address;
            container.dataset.sym = data.symbol || '???';
            container.dataset.decimals = data.decimals || '9';
            container.innerHTML = buildTokenDetailMarkup(data, opts);
            bindTokenDetailCopy(container);
            return data;
        }
        catch (err) {
            container.innerHTML = `<div class="wo-sp-detail-header"><button class="wo-sp-detail-back">← Back</button></div><div class="wo-sp-detail-err">Failed to load token info: ${esc(String(err.message || err))}</div>`;
            return null;
        }
    }
    function openWalletTokenDetail(mint) {
        const overlay = document.createElement('div');
        overlay.className = 'wo-modal-overlay active';
        overlay.innerHTML = `<div class="wo-modal" style="max-width:420px;padding:0;background:transparent;border:none;box-shadow:none;overflow:visible">
      <div class="wo-swap-picker-detail" style="position:relative;inset:auto;display:flex;max-height:min(80vh,680px)"></div>
    </div>`;
        document.body.appendChild(overlay);
        const detailEl = overlay.querySelector('.wo-swap-picker-detail');
        renderTokenDetailPanel(mint, detailEl);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('.wo-sp-detail-back')) {
                overlay.remove();
            }
        });
    }
    function buildNftDetailMarkup(data) {
        const name = esc(data.name || 'Unknown NFT');
        const desc = data.description ? `<div class="wo-nft-detail-desc">${esc(data.description)}</div>` : '';
        const imgSrc = data.image ? esc(data.image) : '';
        const imgBlock = imgSrc
            ? `<img src="${imgSrc}" class="wo-nft-detail-img" alt="${name}">`
            : `<div class="wo-nft-detail-img-ph">${name[0] || '?'}</div>`;
        let priceHtml = '';
        if (data.listingPrice != null) {
            priceHtml += `<div class="wo-nft-detail-cell"><span class="wo-nft-detail-label">Listing Price</span><span class="wo-nft-detail-val">${data.listingPrice} SOL</span></div>`;
        }
        if (data.floorPrice != null) {
            priceHtml += `<div class="wo-nft-detail-cell"><span class="wo-nft-detail-label">Floor Price</span><span class="wo-nft-detail-val">${data.floorPrice.toFixed(3)} SOL</span></div>`;
        }
        if (data.listedCount != null) {
            priceHtml += `<div class="wo-nft-detail-cell"><span class="wo-nft-detail-label">Listed</span><span class="wo-nft-detail-val">${data.listedCount}</span></div>`;
        }
        if (data.royalty) {
            priceHtml += `<div class="wo-nft-detail-cell"><span class="wo-nft-detail-label">Royalty</span><span class="wo-nft-detail-val">${data.royalty}%</span></div>`;
        }
        let attrsHtml = '';
        if (data.attributes && data.attributes.length > 0) {
            attrsHtml = `<div class="wo-nft-detail-attrs-hd">Attributes</div><div class="wo-nft-detail-attrs">` +
                data.attributes.map(a => `<div class="wo-nft-detail-attr"><span class="wo-nft-detail-attr-trait">${esc(a.trait)}</span><span class="wo-nft-detail-attr-val">${esc(String(a.value))}</span></div>`).join('') +
                `</div>`;
        }
        const mkts = (data.marketplaces || []).map(m => `<a href="${esc(m.url)}" target="_blank" rel="noopener" class="wo-nft-detail-mkt-btn"><span class="wo-nft-detail-mkt-icon">${esc(m.icon)}</span>${esc(m.name)}</a>`).join('');
        return `
      <div class="wo-sp-detail-header">
        <button class="wo-sp-detail-back">← Back</button>
      </div>
      <div class="wo-nft-detail-hero">${imgBlock}</div>
      <div class="wo-nft-detail-name">${name}</div>
      ${data.collectionName ? `<div class="wo-nft-detail-collection">${esc(data.collectionName)}</div>` : ''}
      ${desc}
      ${priceHtml ? `<div class="wo-nft-detail-grid">${priceHtml}</div>` : ''}
      <div class="wo-sp-detail-addr-row">
        <span class="wo-sp-detail-label">Mint</span>
        <span class="wo-sp-detail-addr" title="${esc(data.address)}">${data.address.slice(0, 6)}…${data.address.slice(-4)}</span>
        <button class="wo-sp-detail-copy" data-copy="${esc(data.address)}" title="Copy address">📋</button>
      </div>
      ${attrsHtml}
      ${mkts ? `<div class="wo-nft-detail-mkts-hd">Marketplaces</div><div class="wo-nft-detail-mkts">${mkts}</div>` : ''}
    `;
    }
    async function renderNftDetailPanel(mint, container) {
        container.innerHTML = '<div class="wo-sp-detail-loading"><div class="wo-spin-sm"></div> Loading NFT info…</div>';
        try {
            const data = await walletFetch('/api/nft/info/' + encodeURIComponent(mint));
            if (!data || data.error)
                throw new Error(data?.error || 'Failed');
            container.innerHTML = buildNftDetailMarkup(data);
            bindTokenDetailCopy(container);
            return data;
        }
        catch (err) {
            container.innerHTML = `<div class="wo-sp-detail-header"><button class="wo-sp-detail-back">← Back</button></div><div class="wo-sp-detail-err">Failed to load NFT info: ${esc(String(err.message || err))}</div>`;
            return null;
        }
    }
    function openWalletNftDetail(mint) {
        const overlay = document.createElement('div');
        overlay.className = 'wo-modal-overlay active';
        overlay.innerHTML = `<div class="wo-modal" style="max-width:420px;padding:0;background:transparent;border:none;box-shadow:none;overflow:visible">
      <div class="wo-swap-picker-detail wo-nft-detail-panel" style="position:relative;inset:auto;display:flex;max-height:min(85vh,720px)"></div>
    </div>`;
        document.body.appendChild(overlay);
        const detailEl = overlay.querySelector('.wo-swap-picker-detail');
        renderNftDetailPanel(mint, detailEl);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('.wo-sp-detail-back')) {
                overlay.remove();
            }
        });
    }
    function openSwapTokenPicker(side) {
        const defaultTokens = [
            { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png', verified: true },
            { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png', verified: true },
            { symbol: 'USDT', name: 'Tether USD', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg', verified: true },
            { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I', verified: true },
            { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', logoURI: 'https://static.jup.ag/jup/icon.png', verified: true },
            { symbol: 'RAY', name: 'Raydium', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png', verified: true },
            { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', logoURI: 'https://bafkreibk3covs5ltyqxa272uodhber6fjt3wqonpat7au3aqle6fqphm2m.ipfs.nftstorage.link', verified: true },
            { symbol: 'PYTH', name: 'Pyth Network', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', logoURI: 'https://pyth.network/token.svg', verified: true },
        ];
        const ownedTokens = WLT._cachedTokens || [];
        for (const t of ownedTokens) {
            if (!defaultTokens.find(tk => tk.mint === t.mint)) {
                defaultTokens.push({
                    symbol: t.symbol || '?',
                    name: t.name || t.mint?.slice(0, 6),
                    mint: t.mint,
                    logoURI: t.image || t.logoURI || '',
                    verified: false,
                });
            }
        }
        function renderTokenItem(t) {
            const vBadge = t.verified ? '<span class="wo-swap-picker-verified" title="Verified on Jupiter"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="2" fill="none"/></svg></span>' : '';
            const priceHtml = t.price ? `<span class="wo-swap-picker-price">$${Number(t.price) < 0.01 ? Number(t.price).toExponential(2) : Number(t.price).toFixed(4)}</span>` : '';
            return `<button type="button" class="wo-swap-picker-item" data-mint="${esc(t.mint || t.address)}" data-sym="${esc(t.symbol)}" data-decimals="${t.decimals || ''}" data-logo="${esc(t.logoURI || '')}">
        <span class="wo-swap-picker-token-media">
          ${t.logoURI ? `<img src="${esc(t.logoURI)}" alt="${esc(t.symbol)}" class="wo-token-icon-img">` : ''}
          <span class="wo-swap-picker-token-badge" ${t.logoURI ? 'style="display:none"' : ''}>${esc((t.symbol || '?').slice(0, 2))}</span>
        </span>
        <span class="wo-swap-picker-copy">
          <span class="wo-swap-picker-sym-row">
            <span class="wo-swap-picker-sym">${esc(t.symbol)}</span>${vBadge}
          </span>
          <span class="wo-swap-picker-name">${esc(t.name)}</span>
        </span>
        <span class="wo-swap-picker-right">
          ${priceHtml}
        </span>
      </button>`;
        }
        const html = defaultTokens.map(renderTokenItem).join('');
        const overlay = document.createElement('div');
        overlay.className = 'wo-swap-picker-overlay';
        overlay.innerHTML = `<div class="wo-swap-picker-box">
      <div class="wo-swap-picker-hd"><span>Select Token</span><button type="button" class="wo-swap-picker-close">&times;</button></div>
      <div class="wo-swap-picker-search-wrap"><input type="text" class="wo-swap-picker-search" placeholder="Search name, symbol, or paste contract address…"></div>
      <div class="wo-sp-tabs">
        <button class="wo-sp-tab active" data-sptab="yours">Your tokens</button>
        <button class="wo-sp-tab" data-sptab="trending">Trending</button>
      </div>
      <div class="wo-swap-picker-list" id="wo-sp-list">${html}</div>
      <div class="wo-swap-picker-loading" id="wo-sp-loading" style="display:none"><div class="wo-spin-sm"></div> Searching…</div>
      <div class="wo-swap-picker-empty" id="wo-sp-empty" style="display:none">No tokens found</div>
    </div>
    <div class="wo-swap-picker-detail" id="wo-sp-detail" style="display:none"></div>`;
        document.body.appendChild(overlay);
        const listEl = overlay.querySelector('#wo-sp-list');
        const loadingEl = overlay.querySelector('#wo-sp-loading');
        const emptyEl = overlay.querySelector('#wo-sp-empty');
        const detailEl = overlay.querySelector('#wo-sp-detail');
        let searchTimer = null;
        let _trendingCache = null;
        overlay.querySelectorAll('.wo-sp-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                overlay.querySelectorAll('.wo-sp-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                emptyEl.style.display = 'none';
                if (tab.dataset.sptab === 'yours') {
                    listEl.innerHTML = defaultTokens.map(renderTokenItem).join('');
                    listEl.style.display = '';
                }
                else if (tab.dataset.sptab === 'trending') {
                    if (_trendingCache) {
                        listEl.innerHTML = _trendingCache.map(renderTokenItem).join('');
                        listEl.style.display = '';
                        return;
                    }
                    loadingEl.style.display = 'flex';
                    listEl.innerHTML = '';
                    try {
                        const data = await walletFetch('/api/tokens/trending');
                        const tokens = Array.isArray(data) ? data : (data?.tokens || []);
                        if (tokens.length) {
                            _trendingCache = tokens.map(t => ({
                                symbol: t.symbol || '???',
                                name: t.name || t.mint?.slice(0, 6),
                                mint: t.mint || t.address,
                                logoURI: t.logoURI || t.image || '',
                                verified: !!t.verified,
                                price: t.price,
                                decimals: t.decimals,
                            }));
                            listEl.innerHTML = _trendingCache.map(renderTokenItem).join('');
                            listEl.style.display = '';
                        }
                        else {
                            emptyEl.style.display = 'block';
                        }
                    }
                    catch {
                        emptyEl.style.display = 'block';
                    }
                    finally {
                        loadingEl.style.display = 'none';
                    }
                }
            });
        });
        const searchEl = overlay.querySelector('.wo-swap-picker-search');
        if (searchEl) {
            searchEl.focus();
            searchEl.addEventListener('input', () => {
                const q = searchEl.value.trim();
                if (searchTimer)
                    clearTimeout(searchTimer);
                if (detailEl)
                    detailEl.style.display = 'none';
                if (!q) {
                    listEl.innerHTML = defaultTokens.map(renderTokenItem).join('');
                    listEl.style.display = '';
                    loadingEl.style.display = 'none';
                    emptyEl.style.display = 'none';
                    return;
                }
                const ql = q.toLowerCase();
                const isAddr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
                if (!isAddr) {
                    const localMatches = defaultTokens.filter(t => t.symbol.toLowerCase().includes(ql) || t.name.toLowerCase().includes(ql));
                    if (localMatches.length > 0) {
                        listEl.innerHTML = localMatches.map(renderTokenItem).join('');
                    }
                }
                searchTimer = setTimeout(async () => {
                    loadingEl.style.display = 'flex';
                    emptyEl.style.display = 'none';
                    try {
                        const data = await walletFetch('/api/token/search?q=' + encodeURIComponent(q));
                        if (searchEl.value.trim() !== q)
                            return;
                        if (data && data.tokens && data.tokens.length > 0) {
                            listEl.innerHTML = data.tokens.map(t => renderTokenItem({
                                symbol: t.symbol,
                                name: t.name,
                                mint: t.address,
                                logoURI: t.logoURI || '',
                                verified: t.verified,
                                price: t.price,
                                decimals: t.decimals,
                            })).join('');
                            listEl.style.display = '';
                            emptyEl.style.display = 'none';
                        }
                        else {
                            listEl.innerHTML = '';
                            emptyEl.style.display = 'block';
                        }
                    }
                    catch {
                        if (!_panelOnline) {
                            emptyEl.style.display = 'block';
                            listEl.innerHTML = '';
                        }
                    }
                    finally {
                        loadingEl.style.display = 'none';
                    }
                }, isAddr ? 200 : 350);
            });
        }
        overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('wo-swap-picker-overlay') || e.target.classList.contains('wo-swap-picker-close')) {
                overlay.remove();
                return;
            }
            if (e.target.classList.contains('wo-sp-detail-back')) {
                detailEl.style.display = 'none';
                overlay.querySelector('.wo-swap-picker-box').style.display = '';
                return;
            }
            if (e.target.classList.contains('wo-sp-detail-use') || e.target.closest('.wo-sp-detail-use')) {
                const mint = detailEl.dataset.mint;
                const sym = detailEl.dataset.sym;
                const dec = parseInt(detailEl.dataset.decimals) || undefined;
                selectToken(mint, sym, dec);
                overlay.remove();
                return;
            }
            const item = e.target.closest('.wo-swap-picker-item');
            if (!item)
                return;
            const mint = item.dataset.mint;
            const sym = item.dataset.sym;
            const dec = parseInt(item.dataset.decimals) || undefined;
            selectToken(mint, sym, dec);
            overlay.remove();
        });
        function selectToken(mint, sym, decimals) {
            if (side === 'from') {
                SWAP.fromMint = mint;
                SWAP.fromSymbol = sym;
                if (decimals)
                    SWAP._fromDecimals = decimals;
                const btn = document.querySelector('#wo-swap-from-token span');
                if (btn)
                    btn.textContent = sym;
            }
            else {
                SWAP.toMint = mint;
                SWAP.toSymbol = sym;
                if (decimals)
                    SWAP._toDecimals = decimals;
                const btn = document.querySelector('#wo-swap-to-token span');
                if (btn)
                    btn.textContent = sym;
            }
            updateSwapBalances();
            fetchSwapQuote();
        }
    }
    let _tokensLoading = false;
    async function loadTokensAndNfts() {
        if (_tokensLoading)
            return;
        _tokensLoading = true;
        try {
            if (_panelOnline) {
                const res = await walletFetch('/api/wallet/tokens');
                if (res && !res.error) {
                    WLT._cachedTokens = res.tokens || [];
                    WLT._cachedNfts = res.nfts || [];
                    WLT.tokensLoadedAt = Date.now();
                    chrome.storage.local.set({ wo_cached_tokens: WLT._cachedTokens });
                    renderTokenList(res.tokens || []);
                    renderNftList(res.nfts || []);
                    if (res.rpcError) {
                        const tokenList = document.getElementById('wo-wlt-token-list');
                        if (tokenList) {
                            const warn = document.createElement('div');
                            warn.className = 'wo-rpc-warn';
                            warn.innerHTML = '<span style="color:var(--red);font-size:11px;padding:6px 10px;display:block">⚠ RPC error — check your RPC settings. ' + esc(res.rpcError).slice(0, 80) + '</span>';
                            tokenList.prepend(warn);
                        }
                    }
                }
                else {
                    WLT._cachedTokens = [];
                    WLT._cachedNfts = [];
                    WLT.tokensLoadedAt = Date.now();
                    renderTokenList([]);
                    renderNftList([]);
                }
            }
            else if (WLT.data && WLT.data.address) {
                const tokens = await directRpcTokens(WLT.data.address);
                WLT._cachedTokens = tokens;
                WLT._cachedNfts = [];
                WLT.tokensLoadedAt = Date.now();
                chrome.storage.local.set({ wo_cached_tokens: tokens });
                renderTokenList(tokens);
                renderNftList([]);
            }
        }
        catch {
            if (!WLT._cachedTokens)
                WLT._cachedTokens = [];
            if (!WLT._cachedNfts)
                WLT._cachedNfts = [];
            WLT.tokensLoadedAt = Date.now();
            renderTokenList(WLT._cachedTokens);
            renderNftList(WLT._cachedNfts);
        }
        _tokensLoading = false;
    }
    let _pickerTokens = [];
    let _pickerNfts = [];
    async function renderSendPicker() {
        const list = document.getElementById('wo-send-picker-list');
        if (!list)
            return;
        list.innerHTML = '<div class="wo-wlt-empty-sm">Loading…</div>';
        const tokensFresh = Date.now() - (WLT.tokensLoadedAt || 0) < 15000;
        if (tokensFresh && Array.isArray(WLT._cachedTokens)) {
            _pickerTokens = WLT._cachedTokens;
            _pickerNfts = WLT._cachedNfts || [];
        }
        else if (_panelOnline) {
            try {
                const res = await walletFetch('/api/wallet/tokens');
                _pickerTokens = (res && res.tokens) || [];
                _pickerNfts = (res && res.nfts) || [];
                WLT._cachedTokens = _pickerTokens;
                WLT._cachedNfts = _pickerNfts;
                WLT.tokensLoadedAt = Date.now();
            }
            catch {
                _pickerTokens = [];
                _pickerNfts = [];
            }
        }
        renderPickerItems('');
        const q = document.getElementById('wo-send-picker-q');
        if (q) {
            q.value = '';
            q.oninput = () => renderPickerItems(q.value.trim().toLowerCase());
        }
    }
    function renderPickerItems(filter) {
        const list = document.getElementById('wo-send-picker-list');
        if (!list)
            return;
        const solBal = WLT.data ? (WLT.data.balance || 0) : 0;
        const assetRows = [];
        const nftRows = [];
        if (!filter || 'solana'.includes(filter) || 'sol'.includes(filter)) {
            assetRows.push(`<div class="wo-picker-item wo-picker-item-asset" data-pick-type="sol">
        <div class="wo-token-icon"><img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" class="wo-token-icon-img"></div>
        <div class="wo-token-info"><div class="wo-token-name">Solana <span class="wo-token-sym">SOL</span></div><div class="wo-token-mint-short">Native asset</div></div>
        <div class="wo-token-balance"><div class="wo-token-amount">${solBal.toFixed(4)}</div><div class="wo-picker-item-meta">Ready</div></div>
      </div>`);
        }
        for (const t of _pickerTokens) {
            const sym = esc(t.symbol || '???');
            const name = esc(t.name || t.mint.slice(0, 8) + '…');
            if (filter && !name.toLowerCase().includes(filter) && !sym.toLowerCase().includes(filter) && !t.mint.toLowerCase().includes(filter))
                continue;
            const amt = t.amount < 0.0001 ? t.amount.toExponential(2) : t.amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
            const iconLetter = sym[0] || '?';
            const icon = t.image
                ? `<img src="${esc(t.image)}" class="wo-token-icon-img">`
                : `<img src="${generateTokenAvatar(sym)}" class="wo-token-icon-img">`;
            assetRows.push(`<div class="wo-picker-item wo-picker-item-asset" data-pick-type="token" data-mint="${esc(t.mint)}" data-decimals="${t.decimals}" data-symbol="${sym}" data-balance="${t.amount}">
        <div class="wo-token-icon">${icon}<span class="wo-token-icon-letter" style="display:none">${iconLetter}</span></div>
        <div class="wo-token-info"><div class="wo-token-name">${name} <span class="wo-token-sym">${sym}</span></div><div class="wo-token-mint-short">${t.mint.slice(0, 4)}…${t.mint.slice(-4)}</div></div>
        <div class="wo-token-balance"><div class="wo-token-amount">${amt}</div><div class="wo-picker-item-meta">SPL token</div></div>
      </div>`);
        }
        for (const n of _pickerNfts) {
            const name = esc(n.name || n.mint.slice(0, 8) + '…');
            if (filter && !name.toLowerCase().includes(filter) && !n.mint.toLowerCase().includes(filter))
                continue;
            nftRows.push(`<div class="wo-picker-item wo-picker-item-nft" data-pick-type="nft" data-mint="${esc(n.mint)}">
        <div class="wo-token-icon">${n.image ? `<img src="${esc(n.image)}" class="wo-token-icon-img">` : `<img src="${generateTokenAvatar(name)}" class="wo-token-icon-img">`}<span class="wo-token-icon-letter" style="display:none">${name[0] || '?'}</span></div>
        <div class="wo-token-info"><div class="wo-token-name">${name} <span class="wo-token-sym">NFT</span></div><div class="wo-token-mint-short">${n.mint.slice(0, 4)}…${n.mint.slice(-4)}</div></div>
        <div class="wo-token-balance"><div class="wo-token-amount">1</div><div class="wo-picker-item-meta">Collectible</div></div>
      </div>`);
        }
        const sections = [];
        sections.push(`
      <section class="wo-send-picker-section">
        <div class="wo-send-picker-section-hd">
          <div>
            <div class="wo-send-picker-section-kicker">Assets</div>
            <div class="wo-send-picker-section-title">Tokens & native balance</div>
          </div>
          <span class="wo-send-picker-section-count">${assetRows.length}</span>
        </div>
        <div class="wo-send-picker-grid ${assetRows.length ? '' : 'is-empty'}">
          ${assetRows.length ? assetRows.join('') : '<div class="wo-send-picker-empty-card"><div class="wo-send-picker-empty-title">No assets found</div><div class="wo-send-picker-empty-sub">Try a different symbol, name, or contract.</div></div>'}
        </div>
      </section>
    `);
        sections.push(`
      <section class="wo-send-picker-section wo-send-picker-section-nfts">
        <div class="wo-send-picker-section-hd">
          <div>
            <div class="wo-send-picker-section-kicker">NFTs</div>
            <div class="wo-send-picker-section-title">Collectibles in a separate lane</div>
          </div>
          <span class="wo-send-picker-section-count">${nftRows.length}</span>
        </div>
        <div class="wo-send-picker-grid wo-send-picker-grid-nfts ${nftRows.length ? '' : 'is-empty'}">
          ${nftRows.length ? nftRows.join('') : '<div class="wo-send-picker-empty-card wo-send-picker-empty-card-nft"><div class="wo-send-picker-empty-title">No NFTs matched</div><div class="wo-send-picker-empty-sub">Your collectibles will appear here when available.</div></div>'}
        </div>
      </section>
    `);
        list.innerHTML = sections.join('');
    }
    function renderTokenList(tokens) {
        WLT._cachedTokens = tokens;
        const list = document.getElementById('wo-wlt-token-list');
        if (!list)
            return;
        const solBal = WLT.data ? (WLT.data.balance || 0) : (_lastBal !== null ? _lastBal : 0);
        const solUsd = _solPrice > 0 ? (solBal * _solPrice).toFixed(2) : '';
        const solSvgDataUri = 'data:image/svg+xml,' + encodeURIComponent(SVG_SOL);
        let html = `<div class="wo-token-item" data-mint="So11111111111111111111111111111111111111112" data-type="sol">
      <div class="wo-token-icon"><img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" class="wo-token-icon-img"></div>
      <div class="wo-token-info">
        <div class="wo-token-name">Solana <span class="wo-token-sym">SOL</span></div>
        <div class="wo-token-mint-short">Native</div>
      </div>
      <div class="wo-token-balance">
        <div class="wo-token-amount">${solBal.toFixed(4)}</div>
        ${solUsd ? '<div class="wo-token-usd">$' + solUsd + '</div>' : ''}
        <button class="wo-token-send-btn" title="Send SOL">Send</button>
      </div>
    </div>`;
        if (!tokens.length) {
            html += '<div class="wo-wlt-empty-sm">No SPL tokens found</div>';
        }
        else {
            for (const t of tokens) {
                const sym = esc(t.symbol || '???');
                const name = esc(t.name || t.mint.slice(0, 8) + '…');
                const mintShort = t.mint.slice(0, 4) + '…' + t.mint.slice(-4);
                const amt = t.amount < 0.0001 ? t.amount.toExponential(2) : t.amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
                const iconLetter = sym[0] || '?';
                const icon = t.image
                    ? `<img src="${esc(t.image)}" class="wo-token-icon-img">`
                    : `<img src="${generateTokenAvatar(sym)}" class="wo-token-icon-img">`;
                html += `<div class="wo-token-item" data-mint="${esc(t.mint)}" data-type="token" data-decimals="${t.decimals}" data-symbol="${sym}" data-balance="${t.amount}">
          <div class="wo-token-icon">${icon}<span class="wo-token-icon-letter" style="display:none">${iconLetter}</span></div>
          <div class="wo-token-info">
            <div class="wo-token-name">${name} <span class="wo-token-sym">${sym}</span></div>
            <div class="wo-token-mint-short">${mintShort}</div>
          </div>
          <div class="wo-token-balance">
            <div class="wo-token-amount">${amt}</div>
            <div class="wo-token-actions">
              <button class="wo-token-sell-btn" title="Quick sell ${sym} for SOL">Sell</button>
              <button class="wo-token-send-btn" title="Send ${sym}">Send</button>
            </div>
          </div>
        </div>`;
            }
        }
        list.innerHTML = html;
        updateUsdDisplay(solBal);
    }
    function renderNftList(nfts) {
        const list = document.getElementById('wo-wlt-nft-list');
        if (!list)
            return;
        if (!nfts.length) {
            list.innerHTML = '<div class="wo-wlt-empty-sm">No NFTs found</div>';
            return;
        }
        let html = '<div class="wo-nft-grid">';
        for (const n of nfts) {
            const name = esc(n.name || n.mint.slice(0, 8) + '…');
            const mintShort = n.mint.slice(0, 4) + '…' + n.mint.slice(-4);
            const img = n.image
                ? `<img src="${esc(n.image)}" class="wo-nft-img">`
                : '';
            html += `<div class="wo-nft-card" data-mint="${esc(n.mint)}" data-type="nft">
        <div class="wo-nft-preview">
          ${img}
          <div class="wo-nft-placeholder" ${n.image ? 'style="display:none"' : ''}>${name[0] || '?'}</div>
        </div>
        <div class="wo-nft-meta">
          <div class="wo-nft-name">${name}</div>
          <div class="wo-nft-mint">${mintShort}</div>
          <button class="wo-nft-send-btn" title="Send NFT">Send</button>
        </div>
      </div>`;
        }
        html += '</div>';
        list.innerHTML = html;
    }
    async function refreshActivityTab() {
        renderRecentTxs(WLT.data && WLT.data.recentTxs ? WLT.data.recentTxs : []);
        if (!WLT.data || !WLT.data.recentTxs || !WLT.data.recentTxs.length) {
            try {
                const r = await walletFetch('/api/wallet');
                if (r && r.recentTxs && r.recentTxs.length) {
                    WLT.data.recentTxs = r.recentTxs;
                    renderRecentTxs(r.recentTxs);
                }
            }
            catch { }
        }
    }
    function renderRecentTxs(txs) {
        const list = document.getElementById('wo-wlt-recent-list');
        if (!list)
            return;
        if (!txs.length) {
            list.innerHTML = '<div class="wo-wlt-empty-sm">No recent transactions</div>';
            return;
        }
        list.innerHTML = txs.slice(0, 5).map(tx => txHTML(tx)).join('');
    }
    function txHTML(tx) {
        const status = tx.status === 'success' ? 'success' : 'failed';
        const tt = tx.tokenTransfer;
        let icon, label, detail;
        function fmtAmt(a) { return a < 0.0001 && a > 0 ? a.toExponential(2) : Number(a).toLocaleString(undefined, { maximumFractionDigits: 4 }); }
        if (tt) {
            if (tt.direction === 'swap' && tt.swapFrom && tt.swapTo) {
                icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>';
                label = `${fmtAmt(tt.swapFrom.amount)} ${esc(tt.swapFrom.symbol || '?')} → ${fmtAmt(tt.swapTo.amount)} ${esc(tt.swapTo.symbol || '?')}`;
                detail = '';
            }
            else if (tt.direction === 'sent') {
                icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
                label = `Sent ${fmtAmt(tt.amount)} ${esc(tt.symbol || tt.type.toUpperCase())}`;
            }
            else if (tt.direction === 'received') {
                icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
                label = `Received ${fmtAmt(tt.amount)} ${esc(tt.symbol || tt.type.toUpperCase())}`;
            }
            else {
                icon = tx.status === 'success'
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                label = `${esc(tt.symbol || tt.type.toUpperCase())} transfer`;
            }
            if (tt.direction !== 'swap') {
                const cp = tt.counterparty ? tt.counterparty.slice(0, 4) + '…' + tt.counterparty.slice(-4) : '';
                detail = cp ? (tt.direction === 'sent' ? 'To ' + cp : 'From ' + cp) : '';
            }
        }
        else {
            icon = tx.status === 'success'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            label = 'Contract interaction';
            detail = tx.signature.slice(0, 4) + '…' + tx.signature.slice(-4);
        }
        const dirClass = tt ? (tt.direction === 'sent' ? 'tx-sent' : tt.direction === 'received' ? 'tx-received' : tt.direction === 'swap' ? 'tx-swap' : '') : '';
        const time = tx.time ? new Date(tx.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="wo-tx-item ${status} ${dirClass}">
      <div class="wo-tx-icon">${icon}</div>
      <div class="wo-tx-info">
        <div class="wo-tx-sig">${label}</div>
        <div class="wo-tx-time">${esc(time)}${detail ? ' · ' + esc(detail) : ''}${tx.memo ? ' · ' + esc(tx.memo) : ''}</div>
      </div>
      <a class="wo-tx-link" href="https://solscan.io/tx/${tx.signature}" target="_blank" title="View on Solscan">↗</a>
    </div>`;
    }
    function renderFullHistory() {
        const list = document.getElementById('wo-wlt-tx-list');
        if (!list)
            return;
        const txs = (WLT.data && WLT.data.recentTxs) || [];
        if (!txs.length) {
            list.innerHTML = '<div class="wo-wlt-empty">No transactions found</div>';
            return;
        }
        list.innerHTML = txs.map(tx => txHTML(tx)).join('');
    }
    function renderDepositView() {
        const addr = WLT.data && WLT.data.address;
        const textEl = document.getElementById('wo-deposit-addr-text');
        if (textEl)
            textEl.textContent = addr || '—';
        if (addr)
            drawQR(addr);
    }
    async function drawQR(addr) {
        const container = document.getElementById('wo-qr-inner');
        if (!container)
            return;
        try {
            const res = await bgFetch(API + '/api/wallet/qr', { method: 'GET', headers: {} });
            const data = JSON.parse(res.body);
            if (data.qr) {
                container.innerHTML = `<img src="${data.qr}" alt="QR" style="width:180px;height:180px;border-radius:12px;display:block">`;
                return;
            }
        }
        catch { }
        try {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(addr)}&bgcolor=ffffff&color=000000&margin=8`;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { container.innerHTML = ''; container.appendChild(img); };
            img.onerror = () => { drawQRCanvas(container, addr); };
            img.src = url;
            img.alt = 'QR';
            img.style.cssText = 'width:180px;height:180px;border-radius:12px;display:block';
        }
        catch {
            drawQRCanvas(container, addr);
        }
    }
    function drawQRCanvas(container, text) {
        const SIZE_TABLE = [0, 21, 25, 29, 33, 37, 41];
        const EC_TABLE = [0, 7, 10, 15, 20, 26, 36];
        const ALIGN_POS = [0, 0, 18, 22, 26, 30, 34];
        function version(len) { const dl = [0, 17, 32, 53, 78, 106, 134]; for (let v = 1; v <= 6; v++)
            if (len <= dl[v])
                return v; return 6; }
        const v = version(text.length);
        const size = SIZE_TABLE[v];
        const grid = Array.from({ length: size }, () => new Uint8Array(size));
        const used = Array.from({ length: size }, () => new Uint8Array(size));
        function set(r, c, val) { if (r >= 0 && r < size && c >= 0 && c < size) {
            grid[r][c] = val ? 1 : 0;
            used[r][c] = 1;
        } }
        function finder(r, c) { for (let dr = -1; dr <= 7; dr++)
            for (let dc = -1; dc <= 7; dc++) {
                const inside = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6);
                const ring = (dr === 0 || dr === 6 || dc === 0 || dc === 6);
                const inner = (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
                set(r + dr, c + dc, inside && (ring || inner));
            } }
        finder(0, 0);
        finder(0, size - 7);
        finder(size - 7, 0);
        for (let i = 8; i < size - 8; i++) {
            set(6, i, i % 2 === 0);
            set(i, 6, i % 2 === 0);
        }
        if (v >= 2) {
            const p = ALIGN_POS[v];
            for (let dr = -2; dr <= 2; dr++)
                for (let dc = -2; dc <= 2; dc++)
                    set(p + dr, p + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (!dr && !dc));
        }
        const bytes = [];
        for (let i = 0; i < text.length; i++)
            bytes.push(text.charCodeAt(i));
        let bits = '0100' + text.length.toString(2).padStart(8, '0');
        for (const b of bytes)
            bits += b.toString(2).padStart(8, '0');
        bits += '0000';
        while (bits.length % 8)
            bits += '0';
        const cap = EC_TABLE[v];
        const dataCap = ((size * size - 1) - cap * 2 - (v >= 2 ? 25 : 0) - 31 * 3 - 1 - 15 * 2 - (size - 16) * 2 + 1) >> 3;
        while (bits.length < dataCap * 8)
            bits += (bits.length / 8 % 2 === 0) ? '11101100' : '00010001';
        const dataBytes = [];
        for (let i = 0; i < bits.length; i += 8)
            dataBytes.push(parseInt(bits.substr(i, 8), 2));
        const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
        let x = 1;
        for (let i = 0; i < 255; i++) {
            GF_EXP[i] = x;
            GF_LOG[x] = i;
            x <<= 1;
            if (x & 256)
                x ^= 285;
        }
        for (let i = 255; i < 512; i++)
            GF_EXP[i] = GF_EXP[i - 255];
        function gfMul(a, b) { return (!a || !b) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]; }
        function rsEncode(data, nsym) { const gen = new Uint8Array(nsym + 1); gen[0] = 1; for (let i = 0; i < nsym; i++) {
            for (let j = nsym; j > 0; j--)
                gen[j] = gen[j] ^ gfMul(gen[j - 1], GF_EXP[i]);
            gen[0] = gfMul(gen[0], GF_EXP[i]);
        } const r = new Uint8Array(nsym); for (const b of data) {
            const fb = b ^ r[0];
            for (let j = 0; j < nsym - 1; j++)
                r[j] = r[j + 1] ^ gfMul(gen[nsym - j - 1], fb);
            r[nsym - 1] = gfMul(gen[0], fb);
        } return r; }
        const ec = rsEncode(dataBytes, cap);
        const all = [...dataBytes, ...ec];
        let bi = 0;
        for (let right = size - 1; right >= 1; right -= 2) {
            if (right === 6)
                right = 5;
            for (let vert = 0; vert < size; vert++) {
                const upward = ((Math.floor((size - 1 - right) / 2)) % 2 === 0);
                const row = upward ? size - 1 - vert : vert;
                for (let dx = 0; dx <= 1; dx++) {
                    const c = right - dx;
                    if (!used[row][c]) {
                        if (bi < all.length * 8) {
                            grid[row][c] = (all[bi >> 3] >> (7 - (bi & 7))) & 1;
                            bi++;
                        }
                    }
                }
            }
        }
        for (let r = 0; r < size; r++)
            for (let c = 0; c < size; c++)
                if (!used[r][c]) {
                    if ((r + c) % 2 === 0)
                        grid[r][c] ^= 1;
                }
        const fmt = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
        const fmtPos = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
        const fmtPos2 = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]];
        for (let i = 0; i < 15; i++) {
            grid[fmtPos[i][0]][fmtPos[i][1]] = fmt[i];
            grid[fmtPos2[i][0]][fmtPos2[i][1]] = fmt[i];
        }
        const px = 4, margin = 4, totalPx = (size + margin * 2) * px;
        const cvs = document.createElement('canvas');
        cvs.width = totalPx;
        cvs.height = totalPx;
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, totalPx, totalPx);
        ctx.fillStyle = '#000';
        for (let r = 0; r < size; r++)
            for (let c = 0; c < size; c++)
                if (grid[r][c])
                    ctx.fillRect((c + margin) * px, (r + margin) * px, px, px);
        container.innerHTML = '';
        const img = new Image();
        img.src = cvs.toDataURL();
        img.alt = 'QR';
        img.style.cssText = 'width:180px;height:180px;border-radius:12px;display:block;background:#fff';
        container.appendChild(img);
    }
    async function renderWalletList() {
        const list = document.getElementById('wo-wlt-list');
        if (!list || !WLT.data)
            return;
        const wallets = WLT.data.wallets || [];
        const active = WLT.data.address;
        let multisigs = [];
        try {
            const res = await bgFetch(API + '/api/multisig/list');
            const data = JSON.parse(res.body);
            multisigs = data.multisigs || [];
        }
        catch {
            multisigs = [];
        }
        if (!wallets.length && !multisigs.length) {
            list.innerHTML = '<div class="wo-wlt-empty">No wallets stored</div>';
            return;
        }
        const _isVaultModeOn = !!(WLT.data && WLT.data.vaultMode && WLT.data.vaultMode.active);
        const walletHtml = wallets.map(w => `
      <div class="wo-wlt-item ${!_isVaultModeOn && w.address === active ? 'active' : ''}">
        <div class="wo-wlt-item-info">
          <div class="wo-wlt-item-name">${esc(w.name)}</div>
          <div class="wo-wlt-item-addr">${w.address.slice(0, 6)}...${w.address.slice(-4)}</div>
        </div>
        <div class="wo-wlt-item-actions">
          ${!_isVaultModeOn && w.address === active
            ? '<span class="wo-wlt-active-badge">Active</span>'
            : `<button class="wo-btn wo-btn-xs wo-btn-primary" data-switch="${esc(w.address)}">Switch</button><button class="wo-wlt-del-btn" data-delete="${esc(w.address)}" title="Delete wallet">&times;</button>`}
        </div>
      </div>
    `).join('');
        const isVaultActive = !!(WLT.data && WLT.data.vaultMode && WLT.data.vaultMode.active);
        const activeVaultPda = isVaultActive ? WLT.data.vaultMode.multisigPda : '';
        const multisigHtml = multisigs.map(v => `
      <div class="wo-wlt-item wo-wlt-item-multisig ${v.multisigPda === activeVaultPda ? 'active' : ''}">
        <div class="wo-wlt-item-info" data-vault-open="${esc(v.multisigPda)}">
          <div class="wo-wlt-item-name">${esc(v.name)}<span class="wo-wlt-multisig-badge">MULTISIG</span></div>
          <div class="wo-wlt-item-addr">${v.vault ? v.vault.slice(0, 6) + '...' + v.vault.slice(-4) : v.multisigPda.slice(0, 6) + '...' + v.multisigPda.slice(-4)}</div>
        </div>
        <div class="wo-wlt-item-actions">
          ${v.multisigPda === activeVaultPda
            ? '<span class="wo-wlt-active-badge">Active</span>'
            : '<button class="wo-btn wo-btn-xs wo-btn-primary" data-vault-use="' + esc(v.multisigPda) + '" style="font-size:.65rem;padding:3px 8px">Use as Wallet</button>'}
          <span class="wo-wlt-vault-open-btn" data-vault-open="${esc(v.multisigPda)}" style="font-size:.7rem;cursor:pointer;color:var(--muted)">Details →</span>
        </div>
      </div>
    `).join('');
        list.innerHTML = walletHtml + multisigHtml;
        list.querySelectorAll('[data-switch]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!requirePanel('Wallet switch'))
                    return;
                btn.disabled = true;
                btn.textContent = 'Switching…';
                try {
                    const addr = btn.dataset.switch;
                    if (WLT.data && WLT.data.vaultMode && WLT.data.vaultMode.active) {
                        await bgFetch(API + '/api/vault-mode/deactivate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                    }
                    await walletFetch('/api/wallet/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr }) });
                    WLT.data = null;
                    WLT.loadingPromise = null;
                    await loadWalletData();
                    renderWalletList();
                }
                catch (e) {
                    btn.disabled = false;
                    btn.textContent = 'Switch';
                }
            });
        });
        list.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!requirePanel('Delete wallet'))
                    return;
                const addr = btn.dataset.delete;
                const short = addr.slice(0, 6) + '...' + addr.slice(-4);
                if (!confirm('Delete wallet ' + short + '? This cannot be undone.'))
                    return;
                try {
                    await bgFetch(API + '/api/wallet/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr }) });
                    await loadWalletData();
                    renderWalletList();
                }
                catch (e) { }
            });
        });
        list.querySelectorAll('[data-vault-open]').forEach(el => {
            el.addEventListener('click', (e) => { e.stopPropagation(); openVaultDetail(el.dataset.vaultOpen); });
        });
        list.querySelectorAll('[data-vault-use]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!requirePanel('Vault mode'))
                    return;
                btn.disabled = true;
                btn.textContent = 'Activating…';
                try {
                    const res = await bgFetch(API + '/api/vault-mode/activate', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ multisigPda: btn.dataset.vaultUse })
                    });
                    const data = JSON.parse(res.body);
                    if (data.error)
                        throw new Error(data.error);
                    await loadWalletData();
                    renderWalletList();
                }
                catch (err) {
                    btn.textContent = 'Use as Wallet';
                    btn.disabled = false;
                    alert('Failed: ' + (err.message || 'Unknown error'));
                }
            });
        });
    }
    async function sendSol() {
        const addr = WLT.data?.address;
        const toEl = document.getElementById('wo-send-to');
        const amtEl = document.getElementById('wo-send-amt');
        const statusEl = document.getElementById('wo-send-status');
        const to = toEl ? toEl.value.trim() : '';
        const amount = parseFloat(amtEl ? amtEl.value : '');
        if (!to || isNaN(amount) || amount <= 0) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Enter a valid address and amount</span>';
            return;
        }
        var isVault = !!(WLT.data && WLT.data.vaultMode && WLT.data.vaultMode.active);
        const confirmBtn = document.getElementById('wo-send-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = isVault ? 'Sending via vault…' : 'Sending...';
        }
        if (statusEl)
            statusEl.innerHTML = isVault ? '<span style="color:var(--muted);font-size:11px">⏳ Vault transactions take ~20s (4 on-chain steps)…</span>' : '';
        try {
            var timeout = isVault ? 60000 : 15000;
            const res = await bgFetch(API + '/api/wallet/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, amount })
            }, timeout);
            const data = JSON.parse(res.body);
            if (data.signature) {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Sent! <a href="https://solscan.io/tx/${data.signature}" target="_blank" style="color:var(--primary2)">View →</a></span>`;
                if (toEl)
                    toEl.value = '';
                if (amtEl)
                    amtEl.value = '';
                setTimeout(() => loadWalletData(), 1500);
            }
            else if (data.pending) {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-ok" style="color:#f59e0b">⏳ Proposal created (${data.approvalsHave}/${data.approvalsNeeded} approvals). Waiting for external signers on <a href="https://app.squads.so" target="_blank" style="color:var(--primary2)">app.squads.so</a></span>`;
                if (toEl)
                    toEl.value = '';
                if (amtEl)
                    amtEl.value = '';
            }
            else {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error || 'Send failed')}</span>`;
            }
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">Error: ${esc(e.message)}</span>`;
        }
        finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send';
            }
        }
    }
    let _sendTokenMeta = null;
    function openSendToken(mint, decimals, symbol, balance, type) {
        _sendTokenMeta = { mint, decimals: Number(decimals) || 0, symbol: symbol || '???', balance: Number(balance) || 0, type: type || 'token' };
        const isNft = type === 'nft';
        const titleEl = document.getElementById('wo-send-token-title');
        if (titleEl)
            titleEl.textContent = isNft ? 'Send NFT' : `Send ${_sendTokenMeta.symbol}`;
        const availEl = document.getElementById('wo-send-token-avail');
        if (availEl)
            availEl.textContent = isNft ? 'NFT (1 of 1)' : `Available: ${_sendTokenMeta.balance} ${esc(_sendTokenMeta.symbol)}`;
        const infoEl = document.getElementById('wo-send-token-info');
        if (infoEl)
            infoEl.textContent = mint.slice(0, 8) + '…' + mint.slice(-6);
        const amtField = document.getElementById('wo-send-token-amt-field');
        if (amtField)
            amtField.style.display = isNft ? 'none' : '';
        const amtEl = document.getElementById('wo-send-token-amt');
        if (amtEl) {
            amtEl.value = isNft ? '1' : '';
        }
        const toEl = document.getElementById('wo-send-token-to');
        if (toEl)
            toEl.value = '';
        const statusEl = document.getElementById('wo-send-token-status');
        if (statusEl)
            statusEl.innerHTML = '';
        wltView('wo-wlt-send-token');
    }
    async function sendToken() {
        const addr = WLT.data?.address;
        if (!_sendTokenMeta)
            return;
        const toEl = document.getElementById('wo-send-token-to');
        const amtEl = document.getElementById('wo-send-token-amt');
        const statusEl = document.getElementById('wo-send-token-status');
        const to = toEl ? toEl.value.trim() : '';
        const amount = _sendTokenMeta.type === 'nft' ? 1 : parseFloat(amtEl ? amtEl.value : '');
        if (!to || isNaN(amount) || amount <= 0) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Enter a valid address and amount</span>';
            return;
        }
        const confirmBtn = document.getElementById('wo-send-token-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Sending...';
        }
        if (statusEl)
            statusEl.innerHTML = '';
        try {
            const res = await bgFetch(API + '/api/wallet/send-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, mint: _sendTokenMeta.mint, amount, decimals: _sendTokenMeta.decimals })
            });
            const data = JSON.parse(res.body);
            if (data.signature) {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Sent! <a href="https://solscan.io/tx/${data.signature}" target="_blank" style="color:var(--primary2)">View →</a></span>`;
                if (toEl)
                    toEl.value = '';
                if (amtEl)
                    amtEl.value = '';
                setTimeout(() => loadWalletData(), 1500);
            }
            else {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error || 'Send failed')}</span>`;
            }
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">Error: ${esc(e.message)}</span>`;
        }
        finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send';
            }
        }
    }
    function openGuardianModal() {
        const modal = document.getElementById('wo-guardian-modal');
        if (!modal)
            return;
        const chk = document.getElementById('wo-guardian-enabled');
        const fields = document.getElementById('wo-guardian-fields');
        const keyEl = document.getElementById('wo-guardian-key');
        const removeBtn = document.getElementById('wo-guardian-remove');
        const addrShow = document.getElementById('wo-guardian-addr-show');
        const addrText = document.getElementById('wo-guardian-addr-text');
        const statusEl = document.getElementById('wo-guardian-status');
        if (statusEl)
            statusEl.innerHTML = '';
        chrome.storage.local.get(['wo_guardian'], (r) => {
            const g = r.wo_guardian;
            if (g && g.enabled && g.key) {
                if (chk)
                    chk.checked = true;
                if (fields)
                    fields.style.display = '';
                if (keyEl)
                    keyEl.value = '••••••••';
                if (addrShow)
                    addrShow.style.display = '';
                if (addrText)
                    addrText.textContent = g.address || 'unknown';
                if (removeBtn)
                    removeBtn.style.display = '';
            }
            else {
                if (chk)
                    chk.checked = false;
                if (fields)
                    fields.style.display = 'none';
                if (keyEl)
                    keyEl.value = '';
                if (addrShow)
                    addrShow.style.display = 'none';
                if (removeBtn)
                    removeBtn.style.display = 'none';
            }
            modal.classList.add('visible');
        });
    }
    async function saveGuardian() {
        const chk = document.getElementById('wo-guardian-enabled');
        const keyEl = document.getElementById('wo-guardian-key');
        const statusEl = document.getElementById('wo-guardian-status');
        if (!chk || !chk.checked) {
            chrome.storage.local.remove(['wo_guardian']);
            await bgFetch(API + '/api/wallet/guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-ok">Guardian disabled</span>';
            updateGuardianStatusText(false);
            setTimeout(() => { document.getElementById('wo-guardian-modal')?.classList.remove('visible'); }, 800);
            return;
        }
        const key = keyEl ? keyEl.value.trim() : '';
        if (!key || key === '••••••••') {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Enter the guardian private key</span>';
            return;
        }
        try {
            const res = await bgFetch(API + '/api/wallet/guardian', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true, privateKey: key })
            });
            const data = JSON.parse(res.body);
            if (data.error) {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error)}</span>`;
                return;
            }
            chrome.storage.local.set({ wo_guardian: { enabled: true, key, address: data.address } });
            const addrShow = document.getElementById('wo-guardian-addr-show');
            const addrText = document.getElementById('wo-guardian-addr-text');
            if (addrShow)
                addrShow.style.display = '';
            if (addrText)
                addrText.textContent = data.address;
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-ok">✓ Guardian saved & active!</span>';
            document.getElementById('wo-guardian-remove').style.display = '';
            updateGuardianStatusText(true);
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(e.message)}</span>`;
        }
    }
    async function removeGuardian() {
        if (!confirm('Remove guardian wallet? Transfers will no longer require cosigning.'))
            return;
        chrome.storage.local.remove(['wo_guardian']);
        await bgFetch(API + '/api/wallet/guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) }).catch(() => { });
        document.getElementById('wo-guardian-modal')?.classList.remove('visible');
        updateGuardianStatusText(false);
    }
    function updateGuardianStatusText(active) {
        const el = document.getElementById('wo-guardian-status-text');
        if (el)
            el.textContent = active ? '✓ Active — cosigning enabled' : 'Cosigner for outgoing transfers';
        if (el)
            el.style.color = active ? '#22c55e' : '';
    }
    function syncGuardianToServer() {
        if (!_panelOnline)
            return;
        chrome.storage.local.get(['wo_guardian'], (r) => {
            const g = r.wo_guardian;
            if (g && g.enabled && g.key) {
                bgFetch(API + '/api/wallet/guardian', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: true, privateKey: g.key })
                }).catch(() => { });
                updateGuardianStatusText(true);
            }
        });
    }
    async function _offlineGenerate(name, isBurn, prefix) {
        if (prefix) {
            let kp, attempts = 0;
            const max = 500000;
            do {
                attempts++;
                kp = await generateKeypairOffline();
                if (kp.address.startsWith(prefix))
                    break;
                if (attempts >= max)
                    throw new Error(`Could not find '${prefix}' prefix after ${attempts.toLocaleString()} attempts`);
            } while (true);
            await _storeOfflineWallet(kp, name || 'Wallet ' + kp.address.slice(0, 6), isBurn);
            return { address: kp.address, privateKey: kp.privateKey, attempts };
        }
        const kp = await generateKeypairOffline();
        await _storeOfflineWallet(kp, name || 'Wallet ' + kp.address.slice(0, 6), isBurn);
        return { address: kp.address, privateKey: kp.privateKey };
    }
    async function _storeOfflineWallet(kp, name, isBurn) {
        const entry = { address: kp.address, name, isBurn: !!isBurn, privateKey: kp.privateKey, createdOffline: true, ts: Date.now() };
        const stored = await new Promise(r => chrome.storage.local.get(['wo_offline_wallets'], res => r(res.wo_offline_wallets || [])));
        stored.push(entry);
        await new Promise(r => chrome.storage.local.set({ wo_offline_wallets: stored }, r));
        WLT.data = WLT.data || {};
        WLT.data.address = kp.address;
        WLT.data.configured = true;
        WLT.data.balance = 0;
        WLT.data.wallets = (WLT.data.wallets || []).concat([{ address: kp.address, name, isBurn: !!isBurn }]);
        chrome.storage.local.set({ wo_cached_wallet: JSON.parse(JSON.stringify(WLT.data)) });
        renderWalletHome();
    }
    async function syncOfflineWallets() {
        if (!_panelOnline)
            return;
        const wallets = await new Promise(r => chrome.storage.local.get(['wo_offline_wallets'], res => r(res.wo_offline_wallets || [])));
        if (!wallets.length)
            return;
        const remaining = [];
        for (const w of wallets) {
            try {
                await bgFetch(API + '/api/wallet/import', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ privateKey: w.privateKey, name: w.name, isBurn: w.isBurn })
                });
            }
            catch {
                remaining.push(w);
            }
        }
        chrome.storage.local.set({ wo_offline_wallets: remaining });
        if (remaining.length < wallets.length)
            loadWalletData();
    }
    async function generateWallet(prefix) {
        const seedBtn = document.getElementById('wo-wlt-gen-seed-btn');
        const vanityBtn = document.getElementById('wo-wlt-gen-vanity-btn');
        const clickedBtn = prefix ? vanityBtn : seedBtn;
        if (seedBtn)
            seedBtn.disabled = true;
        if (vanityBtn)
            vanityBtn.disabled = true;
        const origTitle = clickedBtn ? clickedBtn.querySelector('.wo-wlt-option-title')?.textContent : '';
        if (clickedBtn) {
            const titleEl = clickedBtn.querySelector('.wo-wlt-option-title');
            if (titleEl)
                titleEl.textContent = prefix ? 'Searching for Wo-address…' : 'Generating…';
        }
        try {
            if (_panelOnline) {
                const body = { name: 'My Wallet' };
                if (prefix)
                    body.prefix = prefix;
                const res = await bgFetch(API + '/api/wallet/generate', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                });
                const data = JSON.parse(res.body);
                if (data.address) {
                    if (data.privateKey && WLT._lastPin)
                        keystoreSave(data.address, data.privateKey, WLT._lastPin).catch(() => { });
                    await loadWalletData();
                    const extra = data.attempts ? ` (${data.attempts.toLocaleString()} attempts)` : '';
                    showKeyModal({ title: 'Wallet Created' + extra, address: data.address, privateKey: data.privateKey, mnemonic: data.mnemonic, warnText: 'Save your seed phrase and private key — they will <strong>not</strong> be shown again.' });
                }
                else {
                    showKeyModal({ title: 'Error', privateKey: data.error || 'Unknown error', warnText: 'Something went wrong.' });
                }
            }
            else {
                const data = await _offlineGenerate('My Wallet', false, prefix || undefined);
                if (data.privateKey && WLT._lastPin)
                    keystoreSave(data.address, data.privateKey, WLT._lastPin).catch(() => { });
                const extra = data.attempts ? ` (${data.attempts.toLocaleString()} attempts)` : '';
                showKeyModal({ title: 'Wallet Created (Offline)' + extra, address: data.address, privateKey: data.privateKey, warnText: 'Save your private key — it will <strong>not</strong> be shown again.<br><span style="color:#f59e0b;font-size:11px">⚠ Created offline. Will sync to server when connected.</span>' });
            }
        }
        catch (e) {
            showKeyModal({ title: 'Error', privateKey: e.message, warnText: 'Something went wrong.' });
        }
        if (seedBtn)
            seedBtn.disabled = false;
        if (vanityBtn)
            vanityBtn.disabled = false;
        if (clickedBtn) {
            const titleEl = clickedBtn.querySelector('.wo-wlt-option-title');
            if (titleEl)
                titleEl.textContent = origTitle;
        }
    }
    async function generateBurnWallet() {
        const btn = document.getElementById('wo-wlt-gen-burn-btn');
        if (btn) {
            btn.disabled = true;
            const titleEl = btn.querySelector('.wo-wlt-option-title');
            if (titleEl)
                titleEl.textContent = 'Creating Burn Wallet…';
        }
        try {
            if (_panelOnline) {
                const res = await bgFetch(API + '/api/wallet/generate', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Burn Wallet', isBurn: true })
                });
                const data = JSON.parse(res.body);
                if (data.address) {
                    if (data.privateKey && WLT._lastPin)
                        keystoreSave(data.address, data.privateKey, WLT._lastPin).catch(() => { });
                    await loadWalletData();
                    showKeyModal({ title: 'Burn Wallet Created', address: data.address, privateKey: data.privateKey, mnemonic: data.mnemonic,
                        warnText: '<strong>Burn Wallet</strong> — all dApp connection & signing requests will be <strong>auto-approved</strong> without popups. Save the private key to recover.' });
                }
                else {
                    showKeyModal({ title: 'Error', privateKey: data.error || 'Unknown error', warnText: 'Something went wrong.' });
                }
            }
            else {
                const data = await _offlineGenerate('Burn Wallet', true);
                if (data.privateKey && WLT._lastPin)
                    keystoreSave(data.address, data.privateKey, WLT._lastPin).catch(() => { });
                showKeyModal({ title: 'Burn Wallet Created (Offline)', address: data.address, privateKey: data.privateKey,
                    warnText: '<strong>Burn Wallet</strong> — auto-approve mode. Save the private key.<br><span style="color:#f59e0b;font-size:11px">⚠ Created offline. Will sync to server when connected.</span>' });
            }
        }
        catch (e) {
            showKeyModal({ title: 'Error', privateKey: e.message, warnText: 'Something went wrong.' });
        }
        if (btn) {
            btn.disabled = false;
            const titleEl = btn.querySelector('.wo-wlt-option-title');
            if (titleEl)
                titleEl.textContent = 'Burn Wallet';
        }
    }
    let _psendQuote = null;
    let _psendQuoteTimer = null;
    let _psendPollTimer = null;
    function psendFetchQuote() {
        if (!requirePanel('Private Send'))
            return;
        const amtEl = document.getElementById('wo-psend-amt');
        const quoteBox = document.getElementById('wo-psend-quote');
        if (!amtEl || !quoteBox)
            return;
        const amount = parseFloat(amtEl.value);
        _psendQuote = null;
        if (isNaN(amount) || amount <= 0) {
            quoteBox.style.display = 'none';
            return;
        }
        clearTimeout(_psendQuoteTimer);
        _psendQuoteTimer = setTimeout(async () => {
            try {
                const res = await bgFetch(API + '/api/wallet/private-send/quote?amount=' + encodeURIComponent(amount));
                const data = JSON.parse(res.body);
                if (data.error) {
                    quoteBox.style.display = 'block';
                    quoteBox.innerHTML = `<div style="font-size:11px;color:#ef4444">${esc(data.error)}</div>`;
                    return;
                }
                _psendQuote = data;
                const recvEl = document.getElementById('wo-psend-q-receive');
                const feeEl = document.getElementById('wo-psend-q-fee');
                const etaEl = document.getElementById('wo-psend-q-eta');
                if (recvEl)
                    recvEl.textContent = (data.receiveAmount || '?') + ' SOL';
                if (feeEl) {
                    const totalFee = Number(data.fee || 0) + Number(data.serviceFee || 0);
                    feeEl.textContent = totalFee ? '~' + totalFee.toFixed(6) + ' SOL' : data.serviceFee || '—';
                }
                if (etaEl)
                    etaEl.textContent = data.estimatedTime || '2-5 min';
                quoteBox.style.display = 'block';
            }
            catch {
                quoteBox.style.display = 'none';
            }
        }, 600);
    }
    function _psendSetStep(step) {
        const steps = ['deposit', 'confirming', 'exchanging', 'sending', 'finished'];
        const stepIdx = steps.indexOf(step);
        for (let i = 0; i < steps.length; i++) {
            const el = document.getElementById('wo-psend-s' + (i + 1));
            if (!el)
                continue;
            el.classList.remove('active', 'done', 'fail');
            if (i < stepIdx)
                el.classList.add('done');
            else if (i === stepIdx)
                el.classList.add('active');
        }
    }
    function _psendSetFail(step) {
        const steps = ['deposit', 'confirming', 'exchanging', 'sending', 'finished'];
        const stepIdx = steps.indexOf(step);
        for (let i = 0; i < steps.length; i++) {
            const el = document.getElementById('wo-psend-s' + (i + 1));
            if (!el)
                continue;
            el.classList.remove('active', 'done', 'fail');
            if (i < stepIdx)
                el.classList.add('done');
            else if (i === stepIdx)
                el.classList.add('fail');
        }
    }
    async function privateSend() {
        if (!requirePanel('Private Send'))
            return;
        const toEl = document.getElementById('wo-psend-to');
        const amtEl = document.getElementById('wo-psend-amt');
        const statusEl = document.getElementById('wo-psend-status');
        const progressEl = document.getElementById('wo-psend-progress');
        const to = toEl ? toEl.value.trim() : '';
        const amount = parseFloat(amtEl ? amtEl.value : '');
        if (!to || isNaN(amount) || amount <= 0) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Enter a valid address and amount</span>';
            return;
        }
        const confirmBtn = document.getElementById('wo-psend-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Creating exchange…';
        }
        if (statusEl)
            statusEl.innerHTML = '';
        if (progressEl)
            progressEl.style.display = 'block';
        _psendSetStep('deposit');
        try {
            const data = await walletFetch('/api/wallet/private-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, amount, quoteId: _psendQuote?.quoteId }),
                timeout: 90000
            });
            if (data.error) {
                _psendSetFail('deposit');
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error)}</span>`;
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = _psendBtnHtml();
                }
                return;
            }
            _psendSetStep('confirming');
            if (statusEl)
                statusEl.innerHTML = `<span style="color:var(--text2)">Deposit sent — <a href="https://solscan.io/tx/${esc(data.depositTx)}" target="_blank" style="color:var(--primary2)">tx</a></span>`;
            const exchangeId = data.exchangeId;
            if (exchangeId) {
                _psendPollStatus(exchangeId, toEl, amtEl, statusEl, confirmBtn);
            }
            else {
                if (statusEl)
                    statusEl.innerHTML = '<span class="wo-wlt-status-ok">✓ Private send deposited</span>';
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = _psendBtnHtml();
                }
                setTimeout(() => loadWalletData(), 2000);
            }
        }
        catch (e) {
            _psendSetFail('deposit');
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">Error: ${esc(e.message)}</span>`;
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = _psendBtnHtml();
            }
        }
    }
    function _psendPollStatus(exchangeId, toEl, amtEl, statusEl, confirmBtn) {
        if (_psendPollTimer)
            clearInterval(_psendPollTimer);
        let polls = 0;
        const maxPolls = 120;
        _psendPollTimer = setInterval(async () => {
            polls++;
            if (!_panelOnline || polls > maxPolls) {
                clearInterval(_psendPollTimer);
                _psendSetFail('exchanging');
                if (statusEl)
                    statusEl.innerHTML = '<span class="wo-wlt-status-err">Timed out — check exchange status manually</span>';
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = _psendBtnHtml();
                }
                return;
            }
            try {
                const data = await walletFetch('/api/wallet/private-send/status/' + encodeURIComponent(exchangeId));
                const st = (data.status || '').toLowerCase();
                if (st.includes('wait') || st.includes('confirm'))
                    _psendSetStep('confirming');
                else if (st.includes('exchang') || st.includes('process'))
                    _psendSetStep('exchanging');
                else if (st.includes('send'))
                    _psendSetStep('sending');
                if (st.includes('finish') || st.includes('complet') || st.includes('done')) {
                    clearInterval(_psendPollTimer);
                    _psendSetStep('finished');
                    const link = data.receiveTx ? ` <a href="https://solscan.io/tx/${esc(data.receiveTx)}" target="_blank" style="color:var(--primary2)">View →</a>` : '';
                    if (statusEl)
                        statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Private send complete!${link}</span>`;
                    if (toEl)
                        toEl.value = '';
                    if (amtEl)
                        amtEl.value = '';
                    const quoteBox = document.getElementById('wo-psend-quote');
                    if (quoteBox)
                        quoteBox.style.display = 'none';
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = _psendBtnHtml();
                    }
                    setTimeout(() => loadWalletData(), 2000);
                }
                else if (st.includes('fail') || st.includes('error') || st.includes('refund')) {
                    clearInterval(_psendPollTimer);
                    _psendSetFail(st.includes('send') ? 'sending' : 'exchanging');
                    if (statusEl)
                        statusEl.innerHTML = `<span class="wo-wlt-status-err">Exchange failed: ${esc(data.status)}</span>`;
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = _psendBtnHtml();
                    }
                }
            }
            catch { }
        }, 5000);
    }
    function _psendBtnHtml() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Private Send';
    }
    async function loadHoudiniKeysUI() {
        const keyEl = document.getElementById('wo-houdini-key');
        const secEl = document.getElementById('wo-houdini-secret');
        const statusEl = document.getElementById('wo-houdini-status');
        if (!keyEl || !secEl)
            return;
        keyEl.value = '';
        secEl.value = '';
        if (statusEl)
            statusEl.textContent = '';
        if (!_panelOnline)
            await checkPanel();
        if (!_panelOnline) {
            if (statusEl) {
                statusEl.style.color = 'var(--red)';
                statusEl.textContent = 'Server offline';
            }
            return;
        }
        try {
            const res = await bgFetch(API + '/api/keys/config', { method: 'GET' });
            const data = JSON.parse(res.body);
            const keys = data.keys || data;
            if (keys.houdini_key)
                keyEl.value = keys.houdini_key;
            if (keys.houdini_secret)
                secEl.value = keys.houdini_secret;
            if (keys.houdini_key && keys.houdini_secret) {
                if (statusEl) {
                    statusEl.style.color = '#22c55e';
                    statusEl.textContent = '✓ Keys configured';
                }
            }
        }
        catch { }
    }
    async function saveHoudiniKeys() {
        const keyEl = document.getElementById('wo-houdini-key');
        const secEl = document.getElementById('wo-houdini-secret');
        const statusEl = document.getElementById('wo-houdini-status');
        const btn = document.getElementById('wo-houdini-save');
        if (!keyEl || !secEl)
            return;
        if (!_panelOnline)
            await checkPanel();
        if (!_panelOnline) {
            if (statusEl) {
                statusEl.style.color = 'var(--red)';
                statusEl.textContent = 'Server offline — cannot save';
            }
            return;
        }
        const key = keyEl.value.trim();
        const secret = secEl.value.trim();
        if (!key && !secret) {
            if (statusEl) {
                statusEl.style.color = 'var(--red)';
                statusEl.textContent = 'Enter at least one key';
            }
            return;
        }
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saving…';
        }
        try {
            const body = { keys: {} };
            body.keys.houdini_key = key;
            body.keys.houdini_secret = secret;
            const res = await bgFetch(API + '/api/keys/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = JSON.parse(res.body);
            if (data.success) {
                if (statusEl) {
                    statusEl.style.color = '#22c55e';
                    statusEl.textContent = '✓ Keys saved';
                }
            }
            else {
                if (statusEl) {
                    statusEl.style.color = 'var(--red)';
                    statusEl.textContent = data.error || 'Save failed';
                }
            }
        }
        catch (e) {
            if (statusEl) {
                statusEl.style.color = 'var(--red)';
                statusEl.textContent = 'Error: ' + e.message;
            }
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Save Houdini Keys';
            }
        }
    }
    function showKeyModal({ title, address, privateKey, mnemonic, warnText }) {
        const modal = document.getElementById('wo-key-modal');
        if (!modal)
            return;
        const titleEl = document.getElementById('wo-key-modal-title');
        if (titleEl)
            titleEl.textContent = title || 'Key';
        const warnEl = document.getElementById('wo-key-warn-text');
        if (warnEl)
            warnEl.innerHTML = warnText || '';
        const addrWrap = document.getElementById('wo-key-addr-wrap');
        const addrEl = document.getElementById('wo-key-addr');
        if (address) {
            if (addrWrap)
                addrWrap.style.display = '';
            if (addrEl)
                addrEl.textContent = address;
        }
        else {
            if (addrWrap)
                addrWrap.style.display = 'none';
        }
        const seedWrap = document.getElementById('wo-key-seed-wrap');
        const seedEl = document.getElementById('wo-key-seed');
        if (mnemonic) {
            if (seedWrap)
                seedWrap.style.display = '';
            if (seedEl)
                seedEl.textContent = mnemonic;
            const copySeedBtn = document.getElementById('wo-key-copy-seed');
            if (copySeedBtn) {
                copySeedBtn.onclick = () => {
                    navigator.clipboard.writeText(mnemonic).then(() => {
                        copySeedBtn.textContent = '✓ Copied!';
                        setTimeout(() => { copySeedBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Seed Phrase'; }, 2000);
                    });
                };
            }
        }
        else {
            if (seedWrap)
                seedWrap.style.display = 'none';
        }
        const pkEl = document.getElementById('wo-key-pk');
        if (pkEl)
            pkEl.textContent = privateKey || '';
        const copyBtn = document.getElementById('wo-key-copy');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(privateKey || '').then(() => {
                    copyBtn.textContent = '✓ Copied!';
                    setTimeout(() => { copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Private Key'; }, 2000);
                });
            };
        }
        modal.classList.add('visible');
    }
    function showImportForm() {
        document.querySelectorAll('.wo-wlt-form').forEach(f => f.classList.remove('visible'));
        const f = document.getElementById('wo-wlt-import-form');
        if (f)
            f.classList.add('visible');
        const opts = document.getElementById('wo-wlt-options');
        if (opts)
            opts.style.display = 'none';
    }
    function showSeedForm() {
        document.querySelectorAll('.wo-wlt-form').forEach(f => f.classList.remove('visible'));
        const f = document.getElementById('wo-wlt-seed-form');
        if (f)
            f.classList.add('visible');
        const opts = document.getElementById('wo-wlt-options');
        if (opts)
            opts.style.display = 'none';
    }
    function hideSetupForms() {
        document.querySelectorAll('.wo-wlt-form').forEach(f => f.classList.remove('visible'));
        const opts = document.getElementById('wo-wlt-options');
        if (opts)
            opts.style.display = '';
    }
    async function showMultisigPanel() {
        wltView('wo-wlt-multisig');
        await loadMultisigList();
    }
    async function loadMultisigList() {
        const listEl = document.getElementById('wo-multisig-list');
        if (!listEl)
            return;
        if (!_panelOnline)
            await checkPanel();
        if (!_panelOnline) {
            listEl.innerHTML = '<div class="wo-wlt-empty" style="color:var(--muted);font-size:.8125rem;padding:24px 0;text-align:center">Server offline</div>';
            return;
        }
        listEl.innerHTML = '<div class="wo-wlt-empty">Loading...</div>';
        try {
            const res = await bgFetch(API + '/api/multisig/list');
            const data = JSON.parse(res.body);
            const vaults = (data.multisigs || []);
            if (!vaults.length) {
                listEl.innerHTML = '<div class="wo-wlt-empty" style="color:var(--muted);font-size:.8125rem;padding:24px 0;text-align:center">No multisig vaults yet.<br>Create or import one below.</div>';
                return;
            }
            listEl.innerHTML = vaults.map(function (v) {
                const short = v.vault ? v.vault.slice(0, 6) + '…' + v.vault.slice(-4) : '—';
                return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">' +
                    '<div style="font-weight:600;font-size:.875rem;margin-bottom:4px">' + esc(v.name || 'Vault') + '</div>' +
                    '<div style="font-size:.75rem;color:var(--muted);margin-bottom:2px">Vault: ' + short + '</div>' +
                    '<div style="font-size:.75rem;color:var(--muted);margin-bottom:8px">Threshold: ' + (v.threshold || '?') + '/' + (v.members || []).length + '</div>' +
                    '<div style="display:flex;gap:6px">' +
                    '<button class="wo-btn wo-btn-primary wo-btn-sm" style="font-size:.7rem;padding:4px 10px;flex:1" data-vault-open="' + esc(v.vault || '') + '">Open Vault</button>' +
                    '<button class="wo-btn wo-btn-sm" style="font-size:.7rem;padding:4px 8px" data-vault-copy="' + esc(v.vault || '') + '">Copy Addr</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            listEl.addEventListener('click', function onListClick(e) {
                const openBtn = e.target.closest('[data-vault-open]');
                if (openBtn) {
                    openVaultDetail(openBtn.dataset.vaultOpen);
                    return;
                }
                const copyBtn = e.target.closest('[data-vault-copy]');
                if (copyBtn) {
                    woMultisigCopyVault(copyBtn.dataset.vaultCopy);
                }
            }, { once: true });
        }
        catch (e) {
            listEl.innerHTML = '<div class="wo-wlt-empty" style="color:var(--red);font-size:.8125rem">Error: ' + esc(e.message) + '</div>';
        }
    }
    function woMultisigCopyVault(addr) {
        if (!addr)
            return;
        navigator.clipboard.writeText(addr).then(function () {
            const toast = document.createElement('div');
            toast.textContent = 'Address copied!';
            toast.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:.75rem;padding:6px 14px;border-radius:20px;z-index:9999;pointer-events:none;opacity:1;transition:opacity .4s';
            document.body.appendChild(toast);
            setTimeout(function () { toast.style.opacity = '0'; setTimeout(function () { toast.remove(); }, 400); }, 1600);
        });
    }
    let _currentVaultPda = null;
    function openVaultDetail(pda) {
        _currentVaultPda = pda;
        wltView('wo-wlt-vault-detail');
        var proposeForm = document.getElementById('wo-vault-propose-form');
        var actionBtns = document.getElementById('wo-vault-action-btns');
        if (proposeForm)
            proposeForm.classList.remove('active');
        if (actionBtns)
            actionBtns.style.display = 'flex';
        loadVaultDetail();
    }
    async function loadVaultDetail() {
        if (!_currentVaultPda)
            return;
        var infoCard = document.getElementById('wo-vault-info-card');
        var membersCard = document.getElementById('wo-vault-members-card');
        var proposalsEl = document.getElementById('wo-vault-proposals');
        var navTitle = document.getElementById('wo-vault-nav-title');
        if (!_panelOnline)
            await checkPanel();
        if (!_panelOnline) {
            if (infoCard)
                infoCard.innerHTML = '<div class="wo-wlt-empty">Server offline</div>';
            return;
        }
        if (infoCard)
            infoCard.innerHTML = '<div class="wo-wlt-empty">Loading…</div>';
        if (membersCard)
            membersCard.innerHTML = '';
        if (proposalsEl)
            proposalsEl.innerHTML = '<div class="wo-wlt-empty">Loading…</div>';
        try {
            var infoRes = await bgFetch(API + '/api/multisig/' + encodeURIComponent(_currentVaultPda) + '/info');
            var info = JSON.parse(infoRes.body);
            if (info.error)
                throw new Error(info.error);
            if (navTitle)
                navTitle.textContent = info.name || 'Vault';
            var vaultAddr = info.vault || _currentVaultPda;
            var configAddr = _currentVaultPda;
            var solscanConfig = 'https://solscan.io/account/' + configAddr;
            var solscanVault = 'https://solscan.io/account/' + vaultAddr;
            if (infoCard) {
                infoCard.innerHTML =
                    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px">' +
                        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
                        '<div style="font-size:1.1rem;font-weight:700">' + esc(info.name || 'Vault') + '</div>' +
                        '<span style="font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7c3aed;background:rgba(139,92,246,.13);border:1px solid rgba(139,92,246,.22);padding:2px 7px;border-radius:6px">MULTISIG</span>' +
                        '<span style="font-size:.72rem;font-weight:600;color:var(--muted)">' + (info.threshold || '?') + '/' + (info.memberCount || info.members && info.members.length || '?') + ' signatures required</span>' +
                        '</div>' +
                        (info.balance !== undefined || info.vaultBalanceSol !== undefined
                            ? '<div style="font-size:1.4rem;font-weight:800;color:var(--primary)">' + (Number(info.balance || info.vaultBalanceSol || 0)).toFixed(4) + ' <span style="font-size:.875rem;font-weight:500;color:var(--muted)">SOL</span></div>'
                            : '') +
                        '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 11px">' +
                        '<div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:3px">Vault address (deposit here)</div>' +
                        '<div style="font-size:.69rem;font-family:monospace;color:var(--text);word-break:break-all;margin-bottom:6px">' + esc(vaultAddr) + '</div>' +
                        '<div style="display:flex;gap:6px">' +
                        '<button class="wo-btn wo-btn-sm" style="font-size:.68rem;padding:3px 9px" id="wo-vault-copy-btn">Copy</button>' +
                        '<a href="' + solscanVault + '" target="_blank" style="font-size:.68rem;padding:3px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface3,var(--surface2));color:var(--muted);text-decoration:none;display:inline-flex;align-items:center">Solscan ↗</a>' +
                        '</div>' +
                        '</div>' +
                        '<div style="border:1px solid rgba(139,92,246,.2);border-radius:8px;padding:9px 11px;background:rgba(139,92,246,.04)">' +
                        '<div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#7c3aed;margin-bottom:3px">Multisig config (on-chain)</div>' +
                        '<div style="font-size:.69rem;font-family:monospace;color:var(--text);word-break:break-all;margin-bottom:6px">' + esc(configAddr) + '</div>' +
                        '<a href="' + solscanConfig + '" target="_blank" style="font-size:.68rem;padding:3px 9px;border-radius:7px;border:1px solid rgba(139,92,246,.25);background:rgba(139,92,246,.1);color:#7c3aed;text-decoration:none;display:inline-flex;align-items:center">View on Solscan ↗</a>' +
                        '</div>' +
                        '</div>';
                var copyBtn = document.getElementById('wo-vault-copy-btn');
                if (copyBtn)
                    copyBtn.addEventListener('click', function () { woMultisigCopyVault(vaultAddr); });
            }
            if (membersCard && info.members && info.members.length) {
                membersCard.innerHTML =
                    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px">' +
                        '<div style="font-size:.75rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Founders / Members (' + info.members.length + ') · ' + info.threshold + ' required to sign</div>' +
                        info.members.map(function (m, idx) {
                            return '<div style="display:flex;align-items:center;gap:7px;font-size:.72rem;padding:5px 0;border-bottom:1px solid var(--border)">' +
                                '<span style="width:18px;height:18px;border-radius:50%;background:rgba(139,92,246,.15);color:#7c3aed;font-size:.62rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' + (idx + 1) + '</span>' +
                                '<span style="font-family:monospace;color:var(--text);word-break:break-all">' + esc(m) + '</span>' +
                                '<a href="https://solscan.io/account/' + esc(m) + '" target="_blank" style="color:var(--muted);text-decoration:none;flex-shrink:0;font-size:.65rem">↗</a>' +
                                '</div>';
                        }).join('') +
                        '</div>';
            }
        }
        catch (e) {
            if (infoCard)
                infoCard.innerHTML = '<div class="wo-wlt-empty" style="color:var(--red)">Error loading vault: ' + esc(e.message) + '</div>';
        }
        try {
            var propRes = await bgFetch(API + '/api/multisig/' + encodeURIComponent(_currentVaultPda) + '/proposals');
            var propData = JSON.parse(propRes.body);
            var proposals = propData.proposals || [];
            if (!proposals.length) {
                if (proposalsEl)
                    proposalsEl.innerHTML = '<div class="wo-wlt-empty" style="color:var(--muted);font-size:.8125rem;text-align:center;padding:12px 0">No proposals yet</div>';
            }
            else {
                if (proposalsEl) {
                    proposalsEl.innerHTML = proposals.map(function (p, i) {
                        var stateColor = p.status === 'Approved' ? 'var(--green)' : p.status === 'Rejected' ? 'var(--red)' : p.status === 'Executed' ? 'var(--muted)' : 'var(--primary)';
                        return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:6px">' +
                            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
                            '<span style="font-weight:600;font-size:.8rem">Proposal #' + (p.index !== undefined ? p.index : i) + '</span>' +
                            '<span style="font-size:.7rem;color:' + stateColor + ';font-weight:600">' + esc(p.status || 'Active') + '</span>' +
                            '</div>' +
                            (p.description ? '<div style="font-size:.75rem;color:var(--muted);margin-bottom:6px">' + esc(p.description) + '</div>' : '') +
                            '<div style="font-size:.7rem;color:var(--muted);margin-bottom:6px">Approved: ' + (p.approvedCount || 0) + ' / ' + (p.threshold || '?') + '</div>' +
                            (p.status !== 'Executed' && p.status !== 'Rejected' ?
                                '<div style="display:flex;gap:6px">' +
                                    '<button class="wo-btn wo-btn-sm" style="font-size:.68rem;padding:3px 8px;background:rgba(34,197,94,.12);color:#22c55e;border-color:rgba(34,197,94,.25)" data-prop-approve="' + (p.index !== undefined ? p.index : i) + '">Approve</button>' +
                                    '<button class="wo-btn wo-btn-sm" style="font-size:.68rem;padding:3px 8px;background:rgba(239,68,68,.08);color:var(--red);border-color:rgba(239,68,68,.2)" data-prop-reject="' + (p.index !== undefined ? p.index : i) + '">Reject</button>' +
                                    (p.status === 'Approved' ? '<button class="wo-btn wo-btn-primary wo-btn-sm" style="font-size:.68rem;padding:3px 8px" data-prop-execute="' + (p.index !== undefined ? p.index : i) + '">Execute</button>' : '') +
                                    '</div>'
                                : '') +
                            '</div>';
                    }).join('');
                    proposalsEl.addEventListener('click', function onPropClick(e) {
                        var aBtn = e.target.closest('[data-prop-approve]');
                        if (aBtn) {
                            vaultProposalAction('approve', parseInt(aBtn.dataset.propApprove));
                            return;
                        }
                        var rBtn = e.target.closest('[data-prop-reject]');
                        if (rBtn) {
                            vaultProposalAction('reject', parseInt(rBtn.dataset.propReject));
                            return;
                        }
                        var eBtn = e.target.closest('[data-prop-execute]');
                        if (eBtn) {
                            vaultProposalAction('execute', parseInt(eBtn.dataset.propExecute));
                        }
                    }, { once: true });
                }
            }
        }
        catch (e) {
            if (proposalsEl)
                proposalsEl.innerHTML = '<div class="wo-wlt-empty" style="color:var(--red);font-size:.8rem">Error loading proposals: ' + esc(e.message) + '</div>';
        }
    }
    async function vaultProposalAction(action, txIndex) {
        if (!_currentVaultPda)
            return;
        var proposalsEl = document.getElementById('wo-vault-proposals');
        if (proposalsEl)
            proposalsEl.innerHTML = '<div class="wo-wlt-empty">Processing…</div>';
        try {
            var res = await bgFetch(API + '/api/multisig/' + encodeURIComponent(_currentVaultPda) + '/' + action + '/' + txIndex, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
            });
            var data = JSON.parse(res.body);
            if (data.error)
                throw new Error(data.error);
            await loadVaultDetail();
        }
        catch (e) {
            if (proposalsEl)
                proposalsEl.innerHTML = '<div class="wo-wlt-empty" style="color:var(--red)">Error: ' + esc(e.message) + '</div>';
            setTimeout(loadVaultDetail, 2000);
        }
    }
    async function vaultProposeTransferConfirm() {
        if (!_currentVaultPda)
            return;
        if (!_panelOnline)
            await checkPanel();
        if (!_panelOnline) {
            var _s = document.getElementById('wo-vp-status');
            if (_s)
                _s.innerHTML = '<span class="wo-wlt-status-err">Server offline</span>';
            return;
        }
        var toEl = document.getElementById('wo-vp-to');
        var amtEl = document.getElementById('wo-vp-amount');
        var memoEl = document.getElementById('wo-vp-memo');
        var statusEl = document.getElementById('wo-vp-status');
        var confirmBtn = document.getElementById('wo-vp-confirm');
        var to = (toEl && toEl.value.trim()) || '';
        var amount = parseFloat((amtEl && amtEl.value) || '0');
        if (!to) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Recipient address required</span>';
            return;
        }
        if (!amount || amount <= 0) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Amount must be greater than 0</span>';
            return;
        }
        if (statusEl)
            statusEl.innerHTML = 'Submitting proposal…';
        if (confirmBtn)
            confirmBtn.disabled = true;
        try {
            var res = await bgFetch(API + '/api/multisig/' + encodeURIComponent(_currentVaultPda) + '/propose-transfer', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, amountSol: amount, memo: (memoEl && memoEl.value.trim()) || '' })
            });
            var data = JSON.parse(res.body);
            if (data.error)
                throw new Error(data.error);
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-ok">✓ Proposal submitted!</span>';
            setTimeout(function () {
                var proposeForm = document.getElementById('wo-vault-propose-form');
                var actionBtns = document.getElementById('wo-vault-action-btns');
                if (proposeForm)
                    proposeForm.classList.remove('active');
                if (actionBtns)
                    actionBtns.style.display = 'flex';
                loadVaultDetail();
            }, 1000);
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">' + esc(e.message) + '</span>';
            if (confirmBtn)
                confirmBtn.disabled = false;
        }
    }
    function woMultisigShowForm(formId) {
        const btns = document.getElementById('wo-multisig-action-btns');
        const form = document.getElementById(formId);
        if (btns)
            btns.style.display = 'none';
        if (form)
            form.classList.add('active');
    }
    function woMultisigHideForm(formId) {
        const btns = document.getElementById('wo-multisig-action-btns');
        const form = document.getElementById(formId);
        if (form) {
            form.classList.remove('active');
        }
        if (btns)
            btns.style.display = 'flex';
    }
    function woMultisigCreate() {
        const nameEl = document.getElementById('wo-mc-name');
        const membersEl = document.getElementById('wo-mc-members');
        const threshEl = document.getElementById('wo-mc-threshold');
        const statusEl = document.getElementById('wo-mc-status');
        if (nameEl)
            nameEl.value = '';
        if (membersEl)
            membersEl.value = '';
        if (threshEl)
            threshEl.value = '1';
        if (statusEl)
            statusEl.innerHTML = '';
        _mcWarningConfirmed = false;
        woMultisigShowForm('wo-multisig-create-form');
        if (nameEl)
            nameEl.focus();
    }
    var _mcWarningConfirmed = false;
    async function woMultisigCreateConfirm() {
        const nameEl = document.getElementById('wo-mc-name');
        const membersEl = document.getElementById('wo-mc-members');
        const threshEl = document.getElementById('wo-mc-threshold');
        const statusEl = document.getElementById('wo-mc-status');
        if (!_panelOnline)
            await checkPanel();
        if (!_panelOnline) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Server offline</span>';
            return;
        }
        const name = (nameEl && nameEl.value.trim()) || '';
        if (!name) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Vault name is required</span>';
            if (nameEl)
                nameEl.focus();
            return;
        }
        const membersRaw = (membersEl && membersEl.value) || '';
        const members = membersRaw.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        const threshold = parseInt((threshEl && threshEl.value) || '1') || 1;
        const confirmBtn = document.getElementById('wo-mc-confirm');
        if (!_mcWarningConfirmed && members.length > 0) {
            if (statusEl)
                statusEl.innerHTML = '<span style="color:var(--muted);font-size:11px">Checking members…</span>';
            try {
                var checkRes = await bgFetch(API + '/api/multisig/check-members', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ members })
                });
                var checkData = JSON.parse(checkRes.body);
                var msgs = [];
                if (checkData.feePayer) {
                    msgs.push('💰 <b>Fee payer:</b> ' + esc(checkData.feePayer.slice(0, 6)) + '…' + esc(checkData.feePayer.slice(-4)) + ' (active wallet — needs ~0.03 SOL)');
                }
                if (checkData.allLocal && checkData.totalMembers > 1) {
                    msgs.push('⚠️ <b>All member keys are in this wallet.</b> One device controls the entire vault — no real multi-party security.');
                    msgs.push('<span style="font-size:11px;color:var(--muted)">For true multisig, use external wallets (Phantom, Ledger, etc.).</span>');
                    msgs.push('<span style="font-size:11px;color:#f59e0b">Transactions will auto-approve since all keys are local.</span>');
                }
                else if (checkData.local.length > 0 && checkData.external.length > 0) {
                    msgs.push('🔑 <b>Local keys:</b> ' + checkData.local.length + ' | <b>External:</b> ' + checkData.external.length);
                    msgs.push('<span style="font-size:11px;color:var(--muted)">External members will need to approve on <a href="https://app.squads.so" target="_blank" style="color:var(--primary2)">app.squads.so</a></span>');
                }
                if (msgs.length) {
                    if (statusEl)
                        statusEl.innerHTML = '<div style="text-align:left;line-height:1.6;font-size:12px;padding:6px 0">' + msgs.join('<br>') + '</div>';
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Confirm & Create';
                    }
                    _mcWarningConfirmed = true;
                    return;
                }
            }
            catch (e) { }
        }
        if (statusEl)
            statusEl.innerHTML = '<span style="color:var(--muted);font-size:11px">Creating vault on-chain…</span>';
        if (confirmBtn)
            confirmBtn.disabled = true;
        try {
            const res = await bgFetch(API + '/api/multisig/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, members, threshold, confirmed: _mcWarningConfirmed })
            }, 30000);
            const data = JSON.parse(res.body);
            if (data.warning) {
                if (statusEl)
                    statusEl.innerHTML = '<div style="text-align:left;font-size:12px;color:#f59e0b;padding:4px 0">⚠️ ' + esc(data.message) + '</div>';
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Confirm & Create';
                }
                _mcWarningConfirmed = true;
                return;
            }
            if (data.vault) {
                var autoLabel = data.autoApprove ? ' (auto-approve enabled)' : '';
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Created! ${data.vault.slice(0, 8)}…${data.vault.slice(-6)}${autoLabel}</span>`;
                _mcWarningConfirmed = false;
                setTimeout(async function () {
                    woMultisigHideForm('wo-multisig-create-form');
                    await loadMultisigList();
                }, 1200);
            }
            else {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error || 'Unknown error')}</span>`;
                if (confirmBtn)
                    confirmBtn.disabled = false;
            }
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(e.message)}</span>`;
            if (confirmBtn)
                confirmBtn.disabled = false;
        }
    }
    function woMultisigImport() {
        const pdaEl = document.getElementById('wo-mi-pda');
        const nameEl = document.getElementById('wo-mi-name');
        const statusEl = document.getElementById('wo-mi-status');
        if (pdaEl)
            pdaEl.value = '';
        if (nameEl)
            nameEl.value = '';
        if (statusEl)
            statusEl.innerHTML = '';
        woMultisigShowForm('wo-multisig-import-form');
        if (pdaEl)
            pdaEl.focus();
    }
    async function woMultisigImportConfirm() {
        const pdaEl = document.getElementById('wo-mi-pda');
        const nameEl = document.getElementById('wo-mi-name');
        const statusEl = document.getElementById('wo-mi-status');
        if (!_panelOnline)
            await checkPanel();
        if (!_panelOnline) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Server offline</span>';
            return;
        }
        const pda = (pdaEl && pdaEl.value.trim()) || '';
        if (!pda) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Multisig address is required</span>';
            if (pdaEl)
                pdaEl.focus();
            return;
        }
        const name = (nameEl && nameEl.value.trim()) || 'Imported Vault';
        if (statusEl)
            statusEl.innerHTML = 'Importing vault…';
        const confirmBtn = document.getElementById('wo-mi-confirm');
        if (confirmBtn)
            confirmBtn.disabled = true;
        try {
            const res = await bgFetch(API + '/api/multisig/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ multisigPda: pda, name })
            });
            const data = JSON.parse(res.body);
            if (data.multisigPda) {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Imported!</span>`;
                setTimeout(async function () {
                    woMultisigHideForm('wo-multisig-import-form');
                    await loadMultisigList();
                }, 900);
            }
            else {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error || 'Unknown error')}</span>`;
                if (confirmBtn)
                    confirmBtn.disabled = false;
            }
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(e.message)}</span>`;
            if (confirmBtn)
                confirmBtn.disabled = false;
        }
    }
    async function importWalletKey() {
        if (!requirePanel('Import Wallet'))
            return;
        const pk = (document.getElementById('wo-wlt-pk-input') || {}).value || '';
        const name = (document.getElementById('wo-wlt-pk-name') || {}).value || '';
        const statusEl = document.getElementById('wo-import-status');
        if (!pk.trim()) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Private key is required</span>';
            return;
        }
        if (statusEl)
            statusEl.innerHTML = 'Importing...';
        try {
            const res = await bgFetch(API + '/api/wallet/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ privateKey: pk.trim(), name: name.trim() || 'Imported Wallet' })
            });
            const data = JSON.parse(res.body);
            if (data.address) {
                if (WLT._lastPin)
                    keystoreSave(data.address, pk.trim(), WLT._lastPin).catch(() => { });
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Imported: ${data.address.slice(0, 6)}...${data.address.slice(-4)}</span>`;
                setTimeout(() => loadWalletData(), 800);
            }
            else {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error || 'Import failed')}</span>`;
            }
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(e.message)}</span>`;
        }
    }
    async function recoverFromSeed() {
        if (!requirePanel('Recover Wallet'))
            return;
        const mnemonic = (document.getElementById('wo-wlt-seed-input') || {}).value || '';
        const name = (document.getElementById('wo-wlt-seed-name') || {}).value || '';
        const statusEl = document.getElementById('wo-seed-status');
        if (!mnemonic.trim()) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Seed phrase is required</span>';
            return;
        }
        const words = mnemonic.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
            if (statusEl)
                statusEl.innerHTML = '<span class="wo-wlt-status-err">Must be 12 or 24 words</span>';
            return;
        }
        if (statusEl)
            statusEl.innerHTML = 'Recovering...';
        try {
            const res = await bgFetch(API + '/api/wallet/recover-seed', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mnemonic: words.join(' '), name: name.trim() || 'Recovered Wallet' })
            });
            const data = JSON.parse(res.body);
            if (data.address) {
                if (WLT._lastPin) {
                    try {
                        const exp = await bgFetch(API + '/api/wallet/export', { method: 'GET', headers: {} });
                        const expData = JSON.parse(exp.body);
                        if (expData.privateKey)
                            keystoreSave(data.address, expData.privateKey, WLT._lastPin).catch(() => { });
                    }
                    catch { }
                }
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Recovered: ${data.address.slice(0, 6)}...${data.address.slice(-4)}</span>`;
                setTimeout(() => loadWalletData(), 800);
            }
            else {
                if (statusEl)
                    statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(data.error || 'Recovery failed')}</span>`;
            }
        }
        catch (e) {
            if (statusEl)
                statusEl.innerHTML = `<span class="wo-wlt-status-err">${esc(e.message)}</span>`;
        }
    }
    function bindWalletEvents() {
        document.querySelectorAll('.wo-tab').forEach(t => {
            t.addEventListener('click', () => {
                if (t.dataset.tab === 'wallet')
                    wltInit();
            });
        });
        const forgotBtn = document.getElementById('wo-pin-forgot');
        if (forgotBtn)
            forgotBtn.addEventListener('click', () => {
                if (confirm('Reset PIN?\nThis will not affect your wallet on the server.')) {
                    chrome.storage.local.remove(['wo_pin_hash'], () => {
                        WLT.unlocked = false;
                        WLT.pinInput = '';
                        WLT.setPinFirst = '';
                        wltInit();
                    });
                }
            });
        const walletTab = document.querySelector('.wo-tab-content[data-tab="wallet"]');
        if (walletTab) {
            walletTab.addEventListener('click', (e) => {
                const back = e.target.closest('.wo-wlt-back');
                if (back) {
                    const target = back.dataset.back;
                    if (target === 'home') {
                        setWalletHomeTab('tokens', false);
                        renderWalletHome();
                    }
                    else if (target === 'settings') {
                        renderSettings();
                        wltView('wo-wlt-settings');
                    }
                    else if (target === 'send-picker') {
                        renderSendPicker();
                        wltView('wo-wlt-send-picker');
                    }
                }
                const action = e.target.closest('.wo-wlt-action');
                if (action) {
                    const view = action.dataset.view;
                    if (view === 'deposit') {
                        renderDepositView();
                        wltView('wo-wlt-deposit');
                    }
                    else if (view === 'send') {
                        renderSendPicker();
                        wltView('wo-wlt-send-picker');
                    }
                    else if (view === 'history') {
                        renderFullHistory();
                        wltView('wo-wlt-history');
                    }
                    else if (view === 'wlt-settings') {
                        renderSettings();
                        wltView('wo-wlt-settings');
                    }
                }
                const cat = e.target.closest('.wo-sett-cat');
                if (cat) {
                    const c = cat.dataset.settCat;
                    if (c === 'wallets') {
                        renderWalletList();
                        wltView('wo-wlt-sett-wallets');
                    }
                    else if (c === 'networks') {
                        renderNetworks();
                        renderSolanaRpc();
                        wltView('wo-wlt-sett-networks');
                    }
                    else if (c === 'security') {
                        const sel = document.getElementById('wo-autolock-select');
                        if (sel)
                            sel.value = String(WLT.autoLockMins);
                        wltView('wo-wlt-sett-security');
                    }
                    else if (c === 'connected-sites') {
                        renderConnectedSites();
                        wltView('wo-wlt-sett-connected-sites');
                    }
                    else if (c === 'services') {
                        loadHoudiniKeysUI();
                        wltView('wo-wlt-sett-services');
                    }
                }
            });
        }
        const copyDeposit = document.getElementById('wo-deposit-copy');
        if (copyDeposit)
            copyDeposit.addEventListener('click', () => {
                const addr = WLT.data && WLT.data.address;
                if (!addr)
                    return;
                navigator.clipboard.writeText(addr).then(() => {
                    copyDeposit.textContent = 'Copied!';
                    setTimeout(() => copyDeposit.textContent = 'Copy', 2000);
                });
            });
        const copyAddr = document.getElementById('wo-wlt-addr-copy');
        if (copyAddr)
            copyAddr.addEventListener('click', () => {
                const addr = WLT.data && WLT.data.address;
                if (!addr)
                    return;
                navigator.clipboard.writeText(addr).then(() => {
                    copyAddr.title = 'Copied!';
                    setTimeout(() => copyAddr.title = 'Copy address', 2000);
                });
            });
        const connSiteEl = document.getElementById('wo-wlt-connected-site');
        if (connSiteEl)
            connSiteEl.addEventListener('click', () => {
                renderConnectedSites();
                wltView('wo-wlt-sett-connected-sites');
            });
        const connListEl = document.getElementById('wo-conn-sites-list');
        if (connListEl)
            connListEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.wo-conn-site-disconnect');
                if (btn && btn.dataset.origin)
                    disconnectSite(btn.dataset.origin);
            });
        const disconnAllBtn = document.getElementById('wo-disconnect-all-btn');
        if (disconnAllBtn)
            disconnAllBtn.addEventListener('click', () => {
                disconnectSite('*');
            });
        document.querySelectorAll('.wo-swap-slip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.wo-swap-slip-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                SWAP.slippage = parseFloat(btn.dataset.slip);
                const customEl = document.getElementById('wo-swap-slip-custom');
                if (customEl)
                    customEl.value = '';
                fetchSwapQuote();
            });
        });
        const slipCustom = document.getElementById('wo-swap-slip-custom');
        if (slipCustom)
            slipCustom.addEventListener('change', () => {
                const v = parseFloat(slipCustom.value);
                if (v > 0 && v <= 50) {
                    document.querySelectorAll('.wo-swap-slip-btn').forEach(b => b.classList.remove('active'));
                    SWAP.slippage = v;
                    fetchSwapQuote();
                }
            });
        let _swapQuoteTimer = null;
        const swapFromAmt = document.getElementById('wo-swap-from-amt');
        if (swapFromAmt)
            swapFromAmt.addEventListener('input', () => {
                if (_swapQuoteTimer)
                    clearTimeout(_swapQuoteTimer);
                _swapQuoteTimer = setTimeout(fetchSwapQuote, 500);
            });
        const swapFlip = document.getElementById('wo-swap-flip');
        if (swapFlip)
            swapFlip.addEventListener('click', () => {
                const tmpMint = SWAP.fromMint;
                const tmpSym = SWAP.fromSymbol;
                SWAP.fromMint = SWAP.toMint;
                SWAP.fromSymbol = SWAP.toSymbol;
                SWAP.toMint = tmpMint;
                SWAP.toSymbol = tmpSym;
                const fromBtn = document.querySelector('#wo-swap-from-token span');
                const toBtn = document.querySelector('#wo-swap-to-token span');
                if (fromBtn)
                    fromBtn.textContent = SWAP.fromSymbol;
                if (toBtn)
                    toBtn.textContent = SWAP.toSymbol;
                const fromAmt = document.getElementById('wo-swap-from-amt');
                const toAmt = document.getElementById('wo-swap-to-amt');
                if (fromAmt && toAmt) {
                    fromAmt.value = toAmt.value;
                    toAmt.value = '';
                }
                updateSwapBalances();
                fetchSwapQuote();
            });
        const SOL_FEE_RESERVE = 0.01;
        const swapMax = document.getElementById('wo-swap-max');
        if (swapMax)
            swapMax.addEventListener('click', async () => {
                const fromAmt = document.getElementById('wo-swap-from-amt');
                if (!fromAmt)
                    return;
                let max = 0;
                if (SWAP.fromMint === 'So11111111111111111111111111111111111111112') {
                    const sol = WLT.data?.balance || 0;
                    max = Math.max(0, sol - SOL_FEE_RESERVE);
                }
                else {
                    try {
                        const res = await walletFetch('/api/wallet/tokens');
                        if (res && !res.error) {
                            const t = (res.tokens || []).find(tk => tk.mint === SWAP.fromMint);
                            if (t)
                                max = t.amount || 0;
                        }
                    }
                    catch { }
                    const sol = WLT.data?.balance || 0;
                    if (sol < SOL_FEE_RESERVE) {
                        const statusEl = document.getElementById('wo-swap-status');
                        if (statusEl) {
                            statusEl.textContent = 'Warning: low SOL for fees (' + sol.toFixed(4) + ')';
                            statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                        }
                    }
                }
                fromAmt.value = max > 0 ? max.toString() : '0';
                if (_swapQuoteTimer)
                    clearTimeout(_swapQuoteTimer);
                _swapQuoteTimer = setTimeout(fetchSwapQuote, 300);
            });
        const swapConfirm = document.getElementById('wo-swap-confirm');
        if (swapConfirm)
            swapConfirm.addEventListener('click', async () => {
                const statusEl = document.getElementById('wo-swap-status');
                const amt = parseFloat(document.getElementById('wo-swap-from-amt')?.value);
                if (!amt || amt <= 0) {
                    if (statusEl) {
                        statusEl.textContent = 'Enter an amount';
                        statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                    }
                    return;
                }
                const toVal = document.getElementById('wo-swap-to-amt')?.value || '—';
                document.getElementById('wo-approve-from-amt').textContent = amt;
                document.getElementById('wo-approve-from-sym').textContent = SWAP.fromSymbol;
                document.getElementById('wo-approve-to-amt').textContent = toVal;
                document.getElementById('wo-approve-to-sym').textContent = SWAP.toSymbol;
                document.getElementById('wo-approve-agg').textContent = 'Best Price';
                document.getElementById('wo-approve-slip').textContent = SWAP.slippage + '%';
                const rateEl = document.getElementById('wo-swap-rate');
                document.getElementById('wo-approve-rate').textContent = rateEl ? rateEl.textContent : '—';
                const impactEl = document.getElementById('wo-swap-impact');
                document.getElementById('wo-approve-impact').textContent = impactEl ? impactEl.textContent : '< 0.01%';
                document.getElementById('wo-swap-approve-modal').classList.add('visible');
            });
        document.getElementById('wo-swap-approve-close')?.addEventListener('click', () => document.getElementById('wo-swap-approve-modal').classList.remove('visible'));
        document.getElementById('wo-swap-approve-reject')?.addEventListener('click', () => document.getElementById('wo-swap-approve-modal').classList.remove('visible'));
        document.getElementById('wo-swap-approve-confirm')?.addEventListener('click', async () => {
            const modal = document.getElementById('wo-swap-approve-modal');
            modal.classList.remove('visible');
            const statusEl = document.getElementById('wo-swap-status');
            const amt = parseFloat(document.getElementById('wo-swap-from-amt')?.value);
            const toVal = document.getElementById('wo-swap-to-amt')?.value || '—';
            if (statusEl) {
                statusEl.textContent = 'Preparing swap...';
                statusEl.className = 'wo-wlt-form-status';
            }
            showSwapProgressOverlay();
            try {
                const addr = WLT.data?.address;
                const res = await walletFetch('/api/wallet/swap', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fromMint: SWAP.fromMint, toMint: SWAP.toMint, amount: amt, slippage: SWAP.slippage }),
                    timeout: 60000,
                });
                hideSwapProgressOverlay();
                if (res?.signature) {
                    if (statusEl) {
                        statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Swapped! <a href="https://solscan.io/tx/${esc(res.signature)}" target="_blank">View</a></span>`;
                        statusEl.className = 'wo-wlt-form-status';
                    }
                    showSwapSuccessFx({
                        signature: res.signature,
                        fromAmount: amt,
                        fromSymbol: SWAP.fromSymbol,
                        toAmount: toVal,
                        toSymbol: SWAP.toSymbol,
                    });
                    setTimeout(() => { loadWalletData(); updateSwapBalances(); }, 2000);
                }
                else {
                    if (statusEl) {
                        statusEl.textContent = res?.error || 'Swap failed';
                        statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                    }
                }
            }
            catch (e) {
                hideSwapProgressOverlay();
                if (statusEl) {
                    statusEl.textContent = e.message;
                    statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                }
            }
        });
        const swapFromToken = document.getElementById('wo-swap-from-token');
        if (swapFromToken)
            swapFromToken.addEventListener('click', () => openSwapTokenPicker('from'));
        const swapToToken = document.getElementById('wo-swap-to-token');
        if (swapToToken)
            swapToToken.addEventListener('click', () => openSwapTokenPicker('to'));
        const bridgeGoSettings = document.getElementById('wo-bridge-go-settings');
        if (bridgeGoSettings)
            bridgeGoSettings.addEventListener('click', () => {
                setWalletHomeTab('settings');
            });
        document.getElementById('wo-bridge-evm-enable')?.addEventListener('click', () => {
            WLT.networks = WLT.networks || {};
            WLT.networks['evm'] = true;
            chrome.storage.local.set({ wo_networks: WLT.networks });
            updateBridgeVisibility();
            const evmToggle = document.getElementById('wo-evm-toggle');
            if (evmToggle)
                evmToggle.classList.add('on');
        });
        document.getElementById('wo-bridge-from-chain')?.addEventListener('click', () => openBridgeChainPicker('from'));
        document.getElementById('wo-bridge-to-chain')?.addEventListener('click', () => openBridgeChainPicker('to'));
        document.getElementById('wo-bridge-from-token')?.addEventListener('click', () => openBridgeTokenPicker('from'));
        document.getElementById('wo-bridge-to-token')?.addEventListener('click', () => openBridgeTokenPicker('to'));
        document.getElementById('wo-bridge-from-amt')?.addEventListener('input', () => scheduleBridgeQuote());
        const bridgeFlip = document.getElementById('wo-bridge-flip');
        if (bridgeFlip)
            bridgeFlip.addEventListener('click', () => {
                const tmp = BRIDGE.fromChain;
                BRIDGE.fromChain = BRIDGE.toChain;
                BRIDGE.toChain = tmp;
                const tmpT = BRIDGE.fromToken;
                BRIDGE.fromToken = BRIDGE.toToken;
                BRIDGE.toToken = tmpT;
                const fc = document.querySelector('#wo-bridge-from-chain span');
                const tc = document.querySelector('#wo-bridge-to-chain span');
                const chains = BRIDGE.chains.length ? BRIDGE.chains : [];
                const srcCh = chains.find(c => c.key === BRIDGE.fromChain);
                const dstCh = chains.find(c => c.key === BRIDGE.toChain);
                if (fc)
                    fc.textContent = srcCh?.name || BRIDGE.fromChain.charAt(0).toUpperCase() + BRIDGE.fromChain.slice(1);
                if (tc)
                    tc.textContent = dstCh?.name || BRIDGE.toChain.charAt(0).toUpperCase() + BRIDGE.toChain.slice(1);
                const ft = document.querySelector('#wo-bridge-from-token span');
                const tt = document.querySelector('#wo-bridge-to-token span');
                if (ft)
                    ft.textContent = BRIDGE.fromToken;
                if (tt)
                    tt.textContent = BRIDGE.toToken;
                updateBridgeBalance();
                scheduleBridgeQuote();
            });
        const bridgeConfirm = document.getElementById('wo-bridge-confirm');
        if (bridgeConfirm)
            bridgeConfirm.addEventListener('click', async () => {
                if (!requirePanel('Bridge'))
                    return;
                const statusEl = document.getElementById('wo-bridge-status');
                const amt = parseFloat(document.getElementById('wo-bridge-from-amt')?.value);
                if (!amt || amt <= 0) {
                    if (statusEl) {
                        statusEl.textContent = 'Enter an amount';
                        statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                    }
                    return;
                }
                if (!BRIDGE.lastQuote) {
                    if (statusEl) {
                        statusEl.textContent = 'No route selected';
                        statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                    }
                    return;
                }
                let toAddress = '';
                if (BRIDGE.fromChain === 'solana' && BRIDGE.toChain !== 'solana') {
                    toAddress = prompt('Enter destination EVM address (0x...):');
                    if (!toAddress || !toAddress.startsWith('0x') || toAddress.length < 42) {
                        if (statusEl) {
                            statusEl.textContent = 'Invalid EVM address';
                            statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                        }
                        return;
                    }
                }
                else if (BRIDGE.fromChain !== 'solana' && BRIDGE.toChain === 'solana') {
                    toAddress = prompt('Enter your EVM wallet address (0x...) that holds the tokens:');
                    if (!toAddress || !toAddress.startsWith('0x') || toAddress.length < 42) {
                        if (statusEl) {
                            statusEl.textContent = 'Invalid EVM address';
                            statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                        }
                        return;
                    }
                }
                else if (BRIDGE.fromChain !== 'solana' && BRIDGE.toChain !== 'solana') {
                    toAddress = prompt('Enter destination address (0x...):');
                    if (!toAddress || !toAddress.startsWith('0x') || toAddress.length < 42) {
                        if (statusEl) {
                            statusEl.textContent = 'Invalid address';
                            statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                        }
                        return;
                    }
                }
                const selectedAgg = BRIDGE.lastQuote?.aggregator || 'deBridge';
                if (statusEl) {
                    statusEl.textContent = 'Preparing bridge via ' + selectedAgg + '...';
                    statusEl.className = 'wo-wlt-form-status';
                }
                bridgeConfirm.disabled = true;
                try {
                    const res = await walletFetch('/api/wallet/bridge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fromChain: BRIDGE.fromChain, toChain: BRIDGE.toChain, fromToken: BRIDGE.fromToken, toToken: BRIDGE.toToken, amount: amt, toAddress }),
                        timeout: 60000,
                    });
                    if (res?.requiresEvmSign) {
                        if (typeof window.ethereum === 'undefined') {
                            if (statusEl) {
                                statusEl.textContent = 'No EVM wallet found. Install MetaMask or Rabby to bridge from EVM chains.';
                                statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                            }
                            bridgeConfirm.disabled = false;
                            return;
                        }
                        try {
                            const chainHex = '0x' + Number(res.chainId).toString(16);
                            try {
                                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] });
                            }
                            catch { }
                            const txHash = await window.ethereum.request({
                                method: 'eth_sendTransaction',
                                params: [{ ...res.tx, from: toAddress }],
                            });
                            if (statusEl) {
                                statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Bridge initiated! TX: ${txHash.slice(0, 10)}…</span>`;
                                statusEl.className = 'wo-wlt-form-status';
                            }
                        }
                        catch (evmErr) {
                            if (statusEl) {
                                statusEl.textContent = 'EVM wallet error: ' + (evmErr.message || evmErr);
                                statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                            }
                        }
                    }
                    else if (res?.txHash) {
                        if (statusEl) {
                            statusEl.innerHTML = `<span class="wo-wlt-status-ok">✓ Bridge initiated! TX: ${res.txHash.slice(0, 8)}…</span>`;
                            statusEl.className = 'wo-wlt-form-status';
                        }
                        setTimeout(() => loadWalletData(), 3000);
                    }
                    else {
                        if (statusEl) {
                            statusEl.textContent = res?.error || 'Bridge failed';
                            statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                        }
                    }
                }
                catch (e) {
                    if (statusEl) {
                        statusEl.textContent = e.message;
                        statusEl.className = 'wo-wlt-form-status wo-wlt-status-err';
                    }
                }
                bridgeConfirm.disabled = false;
            });
        document.getElementById('wo-connect-approve-close')?.addEventListener('click', () => rejectConnect());
        document.getElementById('wo-connect-reject')?.addEventListener('click', () => rejectConnect());
        document.getElementById('wo-connect-approve')?.addEventListener('click', () => approveConnect());
        document.getElementById('wo-connect-ai-scan-btn')?.addEventListener('click', () => {
            const modal = document.getElementById('wo-connect-approve-modal');
            const pending = modal?._pending;
            if (!pending?.tabId)
                return;
            if (modal._aiScanRunning)
                return;
            modal._aiScanRunning = true;
            const aiBtn = document.getElementById('wo-connect-ai-scan-btn');
            const aiLoading = document.getElementById('wo-connect-ai-scan-loading');
            if (aiBtn)
                aiBtn.style.display = 'none';
            if (aiLoading)
                aiLoading.style.display = '';
            chrome.tabs.sendMessage(pending.tabId, { type: 'wo-collect-page-data' }).catch(() => {
                modal._aiScanRunning = false;
                if (aiBtn)
                    aiBtn.style.display = '';
                if (aiLoading)
                    aiLoading.style.display = 'none';
            });
        });
        document.getElementById('wo-connect-alt-wallets')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.wo-alt-wallet-btn');
            if (!btn)
                return;
            const walletName = btn.dataset.wallet;
            const modal = document.getElementById('wo-connect-approve-modal');
            const pending = modal._pending;
            modal.classList.remove('visible');
            if (pending)
                chrome.runtime.sendMessage({ type: 'wo-wallet-connect-result', tabId: pending.tabId, reqId: pending.reqId, approved: false });
            modal._pending = null;
            if (pending?.tabId)
                chrome.runtime.sendMessage({ type: 'wo-use-original-wallet', tabId: pending.tabId, walletName }).catch(() => { });
        });
        function rejectConnect() {
            const modal = document.getElementById('wo-connect-approve-modal');
            const pending = modal._pending;
            modal.classList.remove('visible');
            if (pending)
                chrome.runtime.sendMessage({ type: 'wo-wallet-connect-result', tabId: pending.tabId, reqId: pending.reqId, approved: false });
            modal._pending = null;
        }
        function approveConnect() {
            const modal = document.getElementById('wo-connect-approve-modal');
            const pending = modal._pending;
            modal.classList.remove('visible');
            if (pending)
                chrome.runtime.sendMessage({ type: 'wo-wallet-connect-result', tabId: pending.tabId, reqId: pending.reqId, approved: true, address: WLT.data?.address || '' });
            modal._pending = null;
            refreshConnectedSite();
        }
        document.getElementById('wo-tx-approve-close')?.addEventListener('click', () => rejectTx());
        document.getElementById('wo-tx-approve-reject')?.addEventListener('click', () => rejectTx());
        document.getElementById('wo-tx-approve-confirm')?.addEventListener('click', async () => {
            approveTx();
        });
        document.getElementById('wo-tx-ai-scan')?.addEventListener('click', async () => {
            const modal = document.getElementById('wo-tx-approve-modal');
            const aiSection = document.getElementById('wo-tx-ai-section');
            const aiVerdict = document.getElementById('wo-tx-ai-verdict');
            const aiBody = document.getElementById('wo-tx-ai-body');
            const aiBtn = document.getElementById('wo-tx-ai-scan');
            const simLoading = document.getElementById('wo-tx-sim-loading');
            const simLoadingText = document.getElementById('wo-tx-sim-loading-text');
            if (aiBtn)
                aiBtn.disabled = true;
            if (simLoading) {
                simLoading.style.display = '';
            }
            if (simLoadingText)
                simLoadingText.textContent = 'AI is analyzing transaction…';
            try {
                const res = await walletFetch('/api/wallet/ai-scan-dapp-tx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transaction: modal._transaction,
                        origin: document.getElementById('wo-tx-site-url')?.textContent || '',
                        simulationResult: modal._simResult || null,
                    }),
                    timeout: 30000,
                });
                if (simLoading)
                    simLoading.style.display = 'none';
                if (res && !res.error) {
                    if (aiSection)
                        aiSection.style.display = '';
                    const v = res.verdict || 'unknown';
                    if (aiVerdict) {
                        aiVerdict.textContent = v.toUpperCase();
                        aiVerdict.className = 'wo-safety-ai-verdict ' + v;
                    }
                    let html = '';
                    if (res.txPurpose)
                        html += '<div style="margin-bottom:4px;font-weight:600;font-size:11px">Purpose: ' + esc(res.txPurpose) + '</div>';
                    if (res.summary)
                        html += '<div style="margin-bottom:6px">' + esc(res.summary) + '</div>';
                    if (res.risks && res.risks.length) {
                        html += res.risks.map(function (r) { return '<div style="font-size:10px;color:var(--red)">• ' + esc(r) + '</div>'; }).join('');
                    }
                    if (res.recommendation)
                        html += '<div style="font-size:10px;color:var(--text2);margin-top:4px">💡 ' + esc(res.recommendation) + '</div>';
                    if (res.confidence)
                        html += '<div style="font-size:9px;color:var(--muted);margin-top:4px">Confidence: ' + res.confidence + '%</div>';
                    if (aiBody)
                        aiBody.innerHTML = html || '<div style="color:var(--muted)">No details</div>';
                    if (v === 'dangerous') {
                        const shield = document.getElementById('wo-tx-shield');
                        const approveBtn = document.getElementById('wo-tx-approve-confirm');
                        if (shield)
                            shield.textContent = '🚨';
                        if (approveBtn)
                            approveBtn.className = 'wo-btn wo-btn-sm wo-btn-full risk-high';
                    }
                }
                else {
                    if (aiSection)
                        aiSection.style.display = '';
                    if (aiBody)
                        aiBody.innerHTML = '<div style="color:var(--red)">' + esc(res?.error || 'AI scan failed') + '</div>';
                }
            }
            catch (e) {
                if (simLoading)
                    simLoading.style.display = 'none';
                if (aiSection)
                    aiSection.style.display = '';
                if (aiBody)
                    aiBody.innerHTML = '<div style="color:var(--red)">Error: ' + esc(e.message) + '</div>';
            }
        });
        function rejectTx() {
            const modal = document.getElementById('wo-tx-approve-modal');
            const pending = modal._pending;
            modal.classList.remove('visible');
            if (pending)
                chrome.runtime.sendMessage({ type: 'wo-wallet-sign-result', tabId: pending.tabId, reqId: pending.reqId, approved: false });
            modal._pending = null;
        }
        function approveTx() {
            const modal = document.getElementById('wo-tx-approve-modal');
            const pending = modal._pending;
            modal.classList.remove('visible');
            if (pending)
                chrome.runtime.sendMessage({ type: 'wo-wallet-sign-result', tabId: pending.tabId, reqId: pending.reqId, approved: true });
            modal._pending = null;
        }
        const sendConfirm = document.getElementById('wo-send-confirm');
        if (sendConfirm)
            sendConfirm.addEventListener('click', async () => {
                sendSol();
            });
        const sendMax = document.getElementById('wo-send-max');
        if (sendMax)
            sendMax.addEventListener('click', () => {
                const amtEl = document.getElementById('wo-send-amt');
                if (!amtEl)
                    return;
                const bal = _lastBal !== null ? _lastBal : (WLT.data ? WLT.data.balance || 0 : 0);
                const maxLamports = Math.max(0, Math.floor(bal * 1e9) - 15000);
                amtEl.value = (maxLamports / 1e9).toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
            });
        const sendTokenConfirm = document.getElementById('wo-send-token-confirm');
        if (sendTokenConfirm)
            sendTokenConfirm.addEventListener('click', async () => {
                sendToken();
            });
        const sendTokenMax = document.getElementById('wo-send-token-max');
        if (sendTokenMax)
            sendTokenMax.addEventListener('click', () => {
                const amtEl = document.getElementById('wo-send-token-amt');
                if (!amtEl || !_sendTokenMeta)
                    return;
                amtEl.value = String(_sendTokenMeta.balance);
            });
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.wo-token-sell-btn');
            if (!btn)
                return;
            const item = btn.closest('.wo-token-item');
            if (!item || item.dataset.type === 'sol')
                return;
            quickSellToken(item.dataset.mint, item.dataset.symbol, parseFloat(item.dataset.balance) || 0, parseInt(item.dataset.decimals) || 6);
        });
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.wo-token-send-btn');
            if (!btn)
                return;
            const item = btn.closest('.wo-token-item');
            if (!item)
                return;
            const type = item.dataset.type;
            if (type === 'sol') {
                const avail = document.getElementById('wo-send-avail');
                if (avail && WLT.data)
                    avail.textContent = `Available: ${(WLT.data.balance || 0).toFixed(4)} SOL`;
                wltView('wo-wlt-send');
            }
            else {
                openSendToken(item.dataset.mint, item.dataset.decimals, item.dataset.symbol, item.dataset.balance, 'token');
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('.wo-token-send-btn') || e.target.closest('.wo-token-sell-btn'))
                return;
            const item = e.target.closest('.wo-token-item');
            if (!item || item.classList.contains('wo-token-item-skeleton'))
                return;
            const mint = item.dataset.mint;
            if (!mint)
                return;
            openWalletTokenDetail(mint);
        });
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.wo-nft-send-btn');
            if (!btn)
                return;
            const card = btn.closest('.wo-nft-card');
            if (!card)
                return;
            const nameEl = card.querySelector('.wo-nft-name');
            openSendToken(card.dataset.mint, 0, nameEl ? nameEl.textContent : 'NFT', 1, 'nft');
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('.wo-nft-send-btn'))
                return;
            const card = e.target.closest('.wo-nft-card');
            if (!card)
                return;
            const mint = card.dataset.mint;
            if (!mint)
                return;
            openWalletNftDetail(mint);
        });
        document.addEventListener('click', (e) => {
            const item = e.target.closest('.wo-picker-item');
            if (!item)
                return;
            const type = item.dataset.pickType;
            if (type === 'sol') {
                const avail = document.getElementById('wo-send-avail');
                if (avail && WLT.data)
                    avail.textContent = `Available: ${(WLT.data.balance || 0).toFixed(4)} SOL`;
                wltView('wo-wlt-send');
            }
            else if (type === 'token') {
                openSendToken(item.dataset.mint, item.dataset.decimals, item.dataset.symbol, item.dataset.balance, 'token');
            }
            else if (type === 'nft') {
                const nameEl = item.querySelector('.wo-token-name');
                const name = nameEl ? nameEl.textContent.replace(/\s*NFT\s*$/, '').trim() : 'NFT';
                openSendToken(item.dataset.mint, 0, name, 1, 'nft');
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-guardian-setup-btn'))
                openGuardianModal();
        });
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('wo-guardian-modal');
            if (!modal)
                return;
            if (e.target.closest('#wo-guardian-modal-close') || e.target === modal)
                modal.classList.remove('visible');
        });
        const guardianCheck = document.getElementById('wo-guardian-enabled');
        if (guardianCheck)
            guardianCheck.addEventListener('change', () => {
                const fields = document.getElementById('wo-guardian-fields');
                if (fields)
                    fields.style.display = guardianCheck.checked ? '' : 'none';
            });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-guardian-save'))
                saveGuardian();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-guardian-remove'))
                removeGuardian();
        });
        const histRefresh = document.getElementById('wo-hist-refresh');
        if (histRefresh)
            histRefresh.addEventListener('click', async () => {
                histRefresh.style.opacity = '.4';
                await loadWalletData();
                renderFullHistory();
                histRefresh.style.opacity = '';
            });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-wlt-lock-btn'))
                wltLock();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-wlt-add-btn'))
                showSetupView();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-change-pin-btn'))
                startChangePinFlow();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-add-net-btn'))
                openCustomNetModal();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-cn-save'))
                saveCustomNet();
        });
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('wo-custom-net-modal');
            if (!modal)
                return;
            if (e.target.closest('#wo-cn-cancel') || e.target === modal) {
                modal.classList.remove('visible');
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-houdini-save'))
                saveHoudiniKeys();
        });
        document.addEventListener('click', (e) => {
            const eyeBtn = e.target.closest('.wo-sett-field-eye');
            if (!eyeBtn)
                return;
            const row = eyeBtn.closest('.wo-sett-field-row');
            if (!row)
                return;
            const input = row.querySelector('.wo-sett-field-input');
            if (input)
                input.type = input.type === 'password' ? 'text' : 'password';
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-houdini-info-btn')) {
                const popup = document.getElementById('wo-houdini-popup');
                if (popup)
                    popup.style.display = 'flex';
            }
        });
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('wo-houdini-popup');
            if (!popup)
                return;
            if (e.target.closest('#wo-houdini-popup-close') || e.target === popup) {
                popup.style.display = 'none';
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-sol-rpc-btn'))
                openSolRpcModal();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-rpc-save'))
                saveSolRpc();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-rpc-check'))
                checkSolRpc();
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wo-bal-refresh'))
                forceRefreshBalance();
        });
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('wo-sol-rpc-modal');
            if (!modal)
                return;
            if (e.target.closest('#wo-rpc-cancel') || e.target === modal) {
                modal.classList.remove('visible');
                if (!WLT._rpcPrompted) {
                    WLT._rpcPrompted = true;
                    chrome.storage.local.set({ wo_rpc_prompted: true });
                }
            }
        });
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.wo-rpc-preset');
            if (!btn)
                return;
            const inp = document.getElementById('wo-sol-rpc-input');
            if (inp)
                inp.value = btn.dataset.rpc;
        });
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('wo-key-modal');
            if (!modal)
                return;
            if (e.target.closest('#wo-key-modal-close') || e.target.closest('#wo-key-modal-ok') || e.target === modal) {
                modal.classList.remove('visible');
            }
        });
        document.addEventListener('change', (e) => {
            if (e.target.id === 'wo-autolock-select') {
                WLT.autoLockMins = parseInt(e.target.value, 10);
                chrome.storage.local.set({ wo_autolock: WLT.autoLockMins });
                startAutoLock();
            }
        });
        document.getElementById('wo-safety-toggle')?.addEventListener('click', () => {
            _txSafetyAutoCheck = !_txSafetyAutoCheck;
            chrome.storage.local.set({ wo_safety_autocheck: _txSafetyAutoCheck });
            const el = document.getElementById('wo-safety-toggle');
            if (el)
                el.classList.toggle('on', _txSafetyAutoCheck);
        });
        document.addEventListener('click', async (e) => {
            if (!e.target.closest('#wo-wlt-export-btn'))
                return;
            if (!_panelOnline)
                await checkPanel();
            if (!_panelOnline) {
                showKeyModal({ title: 'Export Failed', privateKey: 'Server offline', warnText: 'Cannot export while server is offline.' });
                return;
            }
            const ok = await requirePin();
            if (!ok)
                return;
            try {
                const res = await bgFetch(API + '/api/wallet/export', { method: 'GET', headers: {} });
                const data = JSON.parse(res.body);
                if (data.privateKey) {
                    showKeyModal({ title: 'Private Key', privateKey: data.privateKey, warnText: 'Keep this safe — anyone with this key controls your wallet.' });
                }
            }
            catch (e2) {
                showKeyModal({ title: 'Export Failed', privateKey: e2.message, warnText: 'Could not export the private key.' });
            }
        });
        const genSeedBtn = document.getElementById('wo-wlt-gen-seed-btn');
        if (genSeedBtn)
            genSeedBtn.addEventListener('click', () => generateWallet());
        const genVanityBtn = document.getElementById('wo-wlt-gen-vanity-btn');
        if (genVanityBtn)
            genVanityBtn.addEventListener('click', () => generateWallet('Wo'));
        const genBurnBtn = document.getElementById('wo-wlt-gen-burn-btn');
        if (genBurnBtn)
            genBurnBtn.addEventListener('click', () => generateBurnWallet());
        const psendBtn = document.getElementById('wo-wlt-private-send-btn');
        if (psendBtn)
            psendBtn.addEventListener('click', () => {
                const availEl = document.getElementById('wo-psend-avail');
                if (availEl)
                    availEl.textContent = 'Available: ' + (WLT.data?.balance ?? 0).toFixed(4) + ' SOL';
                wltView('wo-wlt-private-send');
            });
        const psendMax = document.getElementById('wo-psend-max');
        if (psendMax)
            psendMax.addEventListener('click', () => {
                const amtEl = document.getElementById('wo-psend-amt');
                if (amtEl) {
                    const bal = WLT.data?.balance ?? 0;
                    const max = Math.max(0, bal - 0.005);
                    amtEl.value = max > 0 ? max.toFixed(6) : '';
                    psendFetchQuote();
                }
            });
        const psendAmtInput = document.getElementById('wo-psend-amt');
        if (psendAmtInput)
            psendAmtInput.addEventListener('input', psendFetchQuote);
        const psendConfirm = document.getElementById('wo-psend-confirm');
        if (psendConfirm)
            psendConfirm.addEventListener('click', async () => {
                privateSend();
            });
        const importBtn = document.getElementById('wo-wlt-import-btn');
        if (importBtn)
            importBtn.addEventListener('click', showImportForm);
        const importCancel = document.getElementById('wo-wlt-import-cancel');
        if (importCancel)
            importCancel.addEventListener('click', hideSetupForms);
        const importConfirm = document.getElementById('wo-wlt-import-confirm');
        if (importConfirm)
            importConfirm.addEventListener('click', importWalletKey);
        const seedBtn = document.getElementById('wo-wlt-seed-btn');
        if (seedBtn)
            seedBtn.addEventListener('click', showSeedForm);
        const seedCancel = document.getElementById('wo-wlt-seed-cancel');
        if (seedCancel)
            seedCancel.addEventListener('click', hideSetupForms);
        const seedConfirm = document.getElementById('wo-wlt-seed-confirm');
        if (seedConfirm)
            seedConfirm.addEventListener('click', recoverFromSeed);
        const multisigBtn = document.getElementById('wo-wlt-multisig-btn');
        if (multisigBtn)
            multisigBtn.addEventListener('click', showMultisigPanel);
        const multisigBack = document.getElementById('wo-multisig-back');
        if (multisigBack)
            multisigBack.addEventListener('click', function () {
                const configured = WLT.data && WLT.data.configured;
                if (configured)
                    wltView('wo-wlt-home');
                else
                    wltView('wo-wlt-setup');
            });
        const multisigRefresh = document.getElementById('wo-multisig-refresh');
        if (multisigRefresh)
            multisigRefresh.addEventListener('click', loadMultisigList);
        const multisigCreateBtn = document.getElementById('wo-multisig-create-btn');
        if (multisigCreateBtn)
            multisigCreateBtn.addEventListener('click', woMultisigCreate);
        const multisigImportBtn = document.getElementById('wo-multisig-import-btn');
        if (multisigImportBtn)
            multisigImportBtn.addEventListener('click', woMultisigImport);
        const mcCancel = document.getElementById('wo-mc-cancel');
        if (mcCancel)
            mcCancel.addEventListener('click', function () { woMultisigHideForm('wo-multisig-create-form'); });
        const mcConfirm = document.getElementById('wo-mc-confirm');
        if (mcConfirm)
            mcConfirm.addEventListener('click', woMultisigCreateConfirm);
        const miCancel = document.getElementById('wo-mi-cancel');
        if (miCancel)
            miCancel.addEventListener('click', function () { woMultisigHideForm('wo-multisig-import-form'); });
        const miConfirm = document.getElementById('wo-mi-confirm');
        if (miConfirm)
            miConfirm.addEventListener('click', woMultisigImportConfirm);
        const vaultBack = document.getElementById('wo-vault-back');
        if (vaultBack)
            vaultBack.addEventListener('click', function () { wltView('wo-wlt-multisig'); });
        const vaultRefresh = document.getElementById('wo-vault-refresh');
        if (vaultRefresh)
            vaultRefresh.addEventListener('click', loadVaultDetail);
        const vaultProposeBtn = document.getElementById('wo-vault-propose-btn');
        if (vaultProposeBtn)
            vaultProposeBtn.addEventListener('click', function () {
                var form = document.getElementById('wo-vault-propose-form');
                var btns = document.getElementById('wo-vault-action-btns');
                var toEl = document.getElementById('wo-vp-to');
                var amtEl = document.getElementById('wo-vp-amount');
                var memoEl = document.getElementById('wo-vp-memo');
                var statusEl = document.getElementById('wo-vp-status');
                if (toEl)
                    toEl.value = '';
                if (amtEl)
                    amtEl.value = '';
                if (memoEl)
                    memoEl.value = '';
                if (statusEl)
                    statusEl.innerHTML = '';
                if (btns)
                    btns.style.display = 'none';
                if (form) {
                    form.classList.add('active');
                    if (toEl)
                        toEl.focus();
                }
            });
        const vaultUseBtn = document.getElementById('wo-vault-use-wallet-btn');
        if (vaultUseBtn)
            vaultUseBtn.addEventListener('click', async function () {
                if (!_currentVaultPda)
                    return;
                vaultUseBtn.disabled = true;
                vaultUseBtn.textContent = 'Activating\u2026';
                try {
                    const res = await bgFetch(API + '/api/vault-mode/activate', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ multisigPda: _currentVaultPda })
                    });
                    const data = JSON.parse(res.body);
                    if (data.error)
                        throw new Error(data.error);
                    vaultUseBtn.textContent = '\u2713 Active!';
                    await loadWalletData();
                    setTimeout(function () { wltView('wo-wlt-home'); renderWalletHome(); }, 800);
                }
                catch (err) {
                    vaultUseBtn.textContent = 'Use as Main Wallet';
                    vaultUseBtn.disabled = false;
                    alert('Failed: ' + (err.message || 'Unknown error'));
                }
            });
        const vpCancel = document.getElementById('wo-vp-cancel');
        if (vpCancel)
            vpCancel.addEventListener('click', function () {
                var form = document.getElementById('wo-vault-propose-form');
                var btns = document.getElementById('wo-vault-action-btns');
                if (form)
                    form.classList.remove('active');
                if (btns)
                    btns.style.display = 'flex';
            });
        const vpConfirm = document.getElementById('wo-vp-confirm');
        if (vpConfirm)
            vpConfirm.addEventListener('click', vaultProposeTransferConfirm);
        renderNumpad();
    }
    async function initAuth() {
        await _apiReady;
        const stored = await new Promise(r => chrome.storage.local.get(['wo_auth_token'], res => r(res.wo_auth_token)));
        if (stored) {
            authToken = stored;
            try {
                const r = await fetch(API + '/api/auth/status', {
                    headers: { 'Authorization': 'Bearer ' + authToken },
                    signal: AbortSignal.timeout(3000)
                });
                const d = await r.json();
                if (d.authenticated)
                    return;
            }
            catch { }
        }
        try {
            const r = await fetch(API + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'Extension', provider: 'extension' }),
                signal: AbortSignal.timeout(3000)
            });
            const d = await r.json();
            if (d.token) {
                authToken = d.token;
                chrome.storage.local.set({ wo_auth_token: d.token });
            }
        }
        catch { }
    }
    const networkSettingsReady = loadNetworkSettings();
    function _bootApp() {
        _loadChats();
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && currentMint)
                fetchLiveData(currentMint);
        });
        initAuth().then(async () => {
            await networkSettingsReady;
            _panelOnline = true;
            connectWS();
            requestCurrentMint();
            if (authToken && WLT.solRpc && WLT.solRpc !== 'https://api.mainnet-beta.solana.com') {
                syncRpcToServer(WLT.solRpc);
            }
            syncGuardianToServer();
            WLT._authReady = true;
            if (WLT._pendingInit) {
                WLT._pendingInit = false;
                wltInit();
            }
        }).catch(() => {
            WLT._authReady = true;
            if (WLT._pendingInit) {
                WLT._pendingInit = false;
                wltInit();
            }
            checkPanel();
        });
        startPanelDetect();
        setTimeout(() => { if (!_panelOnline)
            _updateSetupOverlay(); }, 2000);
    }
    (async function consentGate() {
        try {
            const r = await chrome.storage.local.get('wo_privacy_consent');
            if (r.wo_privacy_consent) {
                _bootApp();
                return;
            }
        }
        catch {
            _bootApp();
            return;
        }
        const overlay = document.getElementById('wo-consent-overlay');
        if (!overlay) {
            _bootApp();
            return;
        }
        overlay.style.cssText = 'display:flex !important;position:fixed !important;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#ffffff;align-items:center;justify-content:center;padding:20px 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;overflow-y:auto';
        var agreeBtn = document.getElementById('wo-consent-agree');
        var declineBtn = document.getElementById('wo-consent-decline');
        if (agreeBtn)
            agreeBtn.addEventListener('click', function () {
                chrome.storage.local.set({ wo_privacy_consent: Date.now() });
                overlay.style.display = 'none';
                _bootApp();
            });
        if (declineBtn)
            declineBtn.addEventListener('click', function () {
                var card = overlay.firstElementChild;
                if (card)
                    card.innerHTML =
                        '<div style="text-align:center;padding:48px 24px">' +
                            '<p style="font-size:13px;color:#5a6575;margin:0 0 20px;line-height:1.6">You declined the data disclosure.<br>WhiteOwl features are disabled until you consent.</p>' +
                            '<button id="wo-consent-retry" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border:none;border-radius:12px;padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(139,92,246,0.25);font-family:inherit">Review &amp; Accept</button></div>';
                var retry = document.getElementById('wo-consent-retry');
                if (retry)
                    retry.addEventListener('click', function () { location.reload(); });
            });
    })();
    bindEvents();
    bindWalletEvents();
    (function initQuoteReply() {
        var quoteBtn = document.createElement('div');
        quoteBtn.className = 'wo-quote-btn';
        quoteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Quote';
        quoteBtn.style.display = 'none';
        document.body.appendChild(quoteBtn);
        var pendingText = '';
        window._quotedText = '';
        window.clearQuotePreview = function () {
            var preview = document.getElementById('wo-quote-preview');
            if (preview)
                preview.style.display = 'none';
            window._quotedText = '';
        };
        var quoteCloseBtn = document.getElementById('wo-quote-close-btn');
        if (quoteCloseBtn)
            quoteCloseBtn.addEventListener('click', window.clearQuotePreview);
        function hideQuote() { quoteBtn.style.display = 'none'; pendingText = ''; }
        document.addEventListener('mouseup', function (e) {
            setTimeout(function () {
                var sel = window.getSelection();
                var text = (sel && sel.toString() || '').trim();
                if (!text || text.length < 2) {
                    hideQuote();
                    return;
                }
                var node = sel.anchorNode;
                var msgEl = null;
                while (node && node !== document) {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('wo-msg')) {
                        if (node.classList.contains('ai') || node.classList.contains('assistant')) {
                            msgEl = node;
                        }
                        break;
                    }
                    node = node.parentNode;
                }
                if (!msgEl) {
                    hideQuote();
                    return;
                }
                pendingText = text;
                var range = sel.getRangeAt(0);
                var rect = range.getBoundingClientRect();
                quoteBtn.style.left = Math.max(4, Math.min(rect.left + rect.width / 2 - 40, window.innerWidth - 100)) + 'px';
                quoteBtn.style.top = (rect.top - 36) + 'px';
                quoteBtn.style.display = 'flex';
            }, 10);
        });
        quoteBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
        });
        quoteBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!pendingText)
                return;
            var preview = document.getElementById('wo-quote-preview');
            var previewText = preview ? preview.querySelector('.wo-quote-text') : null;
            if (preview && previewText) {
                var truncated = pendingText.length > 150 ? pendingText.slice(0, 147) + '...' : pendingText;
                previewText.textContent = truncated;
                preview.style.display = 'block';
            }
            window._quotedText = pendingText;
            var inp = document.getElementById('wo-input');
            if (inp)
                inp.focus();
            window.getSelection().removeAllRanges();
            hideQuote();
        });
        document.addEventListener('mousedown', function (e) {
            if (e.target !== quoteBtn && !quoteBtn.contains(e.target))
                hideQuote();
        });
        var msgsEl = document.getElementById('wo-messages');
        if (msgsEl)
            msgsEl.addEventListener('scroll', hideQuote);
    })();
})();
