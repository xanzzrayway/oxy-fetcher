let fetchedRawHtml = '';
        let toastTimeout = null;

        const form = document.getElementById('fetchForm');
        const targetUrlInput = document.getElementById('targetUrl');
        const btnSubmit = document.getElementById('btnSubmit');
        const btnIcon = document.getElementById('btnIcon');
        const btnText = document.getElementById('btnText');
        const outputSection = document.getElementById('outputSection');
        const welcomePlaceholder = document.getElementById('welcomePlaceholder');
        const adblockWarning = document.getElementById('adblockWarning');
        const bundleAssetsCheckbox = document.getElementById('bundleAssets');
        const bundleLabel = document.getElementById('bundleLabel');
        bundleAssetsCheckbox.addEventListener('change', () => {
            bundleLabel.classList.toggle('text-indigo-400', bundleAssetsCheckbox.checked);
            bundleLabel.classList.toggle('text-slate-200', !bundleAssetsCheckbox.checked);
            syncSubOptionState();
        });

        // Toggle turunan — cuma relevan kalau "Bundle CSS & JS" nyala
        const optFullJsCheckbox = document.getElementById('optFullJs');
        const optNextjsCheckbox = document.getElementById('optNextjs');
        const optDecryptJsCheckbox = document.getElementById('optDecryptJs');
        const optDecryptAllCheckbox = document.getElementById('optDecryptAll');
        const optUnminifyCheckbox = document.getElementById('optUnminify');

        const SUB_OPTIONS = [
            { checkbox: optFullJsCheckbox, label: document.getElementById('optFullJsLabel'), row: optFullJsCheckbox.closest('.opt-row') },
            { checkbox: optNextjsCheckbox, label: document.getElementById('optNextjsLabel'), row: optNextjsCheckbox.closest('.opt-row') },
            { checkbox: optDecryptJsCheckbox, label: document.getElementById('optDecryptJsLabel'), row: optDecryptJsCheckbox.closest('.opt-row') },
            { checkbox: optDecryptAllCheckbox, label: document.getElementById('optDecryptAllLabel'), row: optDecryptAllCheckbox.closest('.opt-row') },
            { checkbox: optUnminifyCheckbox, label: document.getElementById('optUnminifyLabel'), row: optUnminifyCheckbox.closest('.opt-row') }
        ];

        SUB_OPTIONS.forEach(opt => {
            opt.checkbox.addEventListener('change', () => {
                opt.label.classList.toggle('text-indigo-400', opt.checkbox.checked);
                opt.label.classList.toggle('text-slate-200', !opt.checkbox.checked);
            });
        });

        function syncSubOptionState() {
            const enabled = bundleAssetsCheckbox.checked;
            SUB_OPTIONS.forEach(opt => {
                opt.checkbox.disabled = !enabled;
                if (opt.row) opt.row.classList.toggle('opacity-40', !enabled);
                if (opt.row) opt.row.classList.toggle('pointer-events-none', !enabled);
            });
        }
        syncSubOptionState();
        const logOutput = document.getElementById('logOutput');
        const logBody = document.getElementById('logBody');
        const logChevron = document.getElementById('logChevron');
        const logCountBadge = document.getElementById('logCountBadge');

        // ===== Process Log =====
        let logCount = 0;
        const LOG_STYLES = {
            info:    { icon: 'fa-solid fa-circle-info',        color: 'text-sky-400' },
            success: { icon: 'fa-solid fa-circle-check',       color: 'text-emerald-400' },
            warn:    { icon: 'fa-solid fa-triangle-exclamation',color: 'text-amber-400' },
            error:   { icon: 'fa-solid fa-circle-xmark',       color: 'text-rose-400' },
            step:    { icon: 'fa-solid fa-angle-right',        color: 'text-indigo-400' }
        };

        function addLog(type, message) {
            const style = LOG_STYLES[type] || LOG_STYLES.info;
            const time = new Date().toLocaleTimeString('id-ID', { hour12: false });

            if (logCount === 0) {
                logOutput.innerHTML = '';
            }
            logCount++;

            const line = document.createElement('div');
            line.className = 'log-line flex items-start gap-2 py-0.5';
            line.innerHTML = `
                <span class="text-slate-600 shrink-0">${time}</span>
                <i class="${style.icon} ${style.color} shrink-0 mt-0.5"></i>
                <span class="${style.color} break-all">${escapeHtml(message)}</span>
            `;
            logOutput.appendChild(line);
            logOutput.scrollTop = logOutput.scrollHeight;

            logCountBadge.textContent = logCount;
            logCountBadge.classList.remove('hidden');
            logCountBadge.classList.remove('bump');
            void logCountBadge.offsetWidth; // restart animasi bump
            logCountBadge.classList.add('bump');

            // Auto-expand panel saat proses baru mulai jalan
            if (!logBody.classList.contains('log-open')) {
                toggleLogPanel(true);
            }
        }

        function clearLog() {
            logCount = 0;
            logOutput.innerHTML = '<p class="text-slate-600 italic">Belum ada proses. Log akan muncul di sini saat kamu klik "Ambil HTML".</p>';
            logCountBadge.classList.add('hidden');
        }

        function toggleLogPanel(forceOpen) {
            const shouldOpen = forceOpen === true ? true : !logBody.classList.contains('log-open');
            logBody.classList.toggle('log-open', shouldOpen);
            logChevron.classList.toggle('rotate-180', shouldOpen);
        }

        // Deteksi AdBlocker saat halaman dimuat
        function checkAdBlocker() {
            const adTest = document.getElementById('ad-banner-test');
            setTimeout(() => {
                if (!adTest || adTest.offsetHeight === 0 || window.getComputedStyle(adTest).display === 'none') {
                    adblockWarning.classList.remove('hidden');
                }
            }, 300);
        }

        // Jalankan tes adblocker
        window.addEventListener('load', checkAdBlocker);

        // Ambil resource apapun (HTML/CSS/JS) via Multiple Proxy Fallback, wajib coba semua sebelum menyerah
        const OWN_PROXY_BASE = 'https://oxy-proxy-delta.vercel.app'; // proxy sendiri di Vercel

        async function fetchViaProxy(rawUrl, minLength = 1) {
            const encoded = encodeURIComponent(rawUrl);

            const providers = [];

            // Proxy sendiri (Vercel) dicoba paling duluan kalau sudah diisi
            if (OWN_PROXY_BASE) {
                providers.push({
                    name: 'Proxy Sendiri (Vercel)',
                    fn: async () => {
                        const res = await fetch(`${OWN_PROXY_BASE}/api/proxy?url=${encoded}`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const txt = await res.text();
                        if (!txt || txt.trim().length < minLength) throw new Error('respons kosong/terlalu pendek');
                        return txt;
                    }
                });
            }

            providers.push(
                {
                    name: 'AllOrigins (raw)',
                    fn: async () => {
                        const res = await fetch(`https://api.allorigins.win/raw?url=${encoded}`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const txt = await res.text();
                        if (!txt || txt.trim().length < minLength) throw new Error('respons kosong/terlalu pendek');
                        return txt;
                    }
                },
                {
                    name: 'CodeTabs',
                    fn: async () => {
                        const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encoded}`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const txt = await res.text();
                        if (!txt || txt.trim().length < minLength) throw new Error('respons kosong/terlalu pendek');
                        return txt;
                    }
                },
                {
                    name: 'CorsProxy.io',
                    fn: async () => {
                        const res = await fetch(`https://corsproxy.io/?url=${encoded}`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const txt = await res.text();
                        if (!txt || txt.trim().length < minLength) throw new Error('respons kosong/terlalu pendek');
                        return txt;
                    }
                },
                {
                    name: 'AllOrigins (get/json)',
                    fn: async () => {
                        const res = await fetch(`https://api.allorigins.win/get?url=${encoded}`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const data = await res.json();
                        if (!data || !data.contents || data.contents.trim().length < minLength) throw new Error('respons kosong/terlalu pendek');
                        return data.contents;
                    }
                },
                {
                    name: 'ThingProxy',
                    fn: async () => {
                        const res = await fetch(`https://thingproxy.freeboard.io/fetch/${rawUrl}`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const txt = await res.text();
                        if (!txt || txt.trim().length < minLength) throw new Error('respons kosong/terlalu pendek');
                        return txt;
                    }
                }
            );

            let lastErr = null;
            for (const provider of providers) {
                addLog('step', `Mencoba provider: ${provider.name} → ${rawUrl}`);
                try {
                    const content = await provider.fn();
                    if (content) {
                        addLog('success', `Berhasil via ${provider.name} (${content.length.toLocaleString()} karakter)`);
                        return content;
                    }
                } catch (e) {
                    lastErr = e;
                    addLog('warn', `Gagal via ${provider.name}: ${e.message || 'error tidak diketahui'}`);
                }
            }

            addLog('error', `Semua provider gagal untuk: ${rawUrl}`);
            throw lastErr || new Error(`Gagal mengambil: ${rawUrl}`);
        }

        // Fetch HTML utama halaman target
        async function fetchHtml(targetUrl) {
            let cleanUrl = targetUrl.trim();
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = 'https://' + cleanUrl;
            }

            addLog('info', `Mulai fetch HTML utama: ${cleanUrl}`);
            try {
                const html = await fetchViaProxy(cleanUrl, 20);
                addLog('info', `Fetch HTML utama selesai.`);
                return html;
            } catch (e) {
                addLog('error', `Fetch HTML utama gagal total: ${e.message || 'error'}`);
                throw new Error("Gagal mengambil HTML. Matikan Ad-Blocker atau periksa jaringan.");
            }
        }

        // Bundle SEMUA CSS/JS jadi inline — termasuk chunk turunan khas Next.js
        // (modulepreload, preload as=script, dan referensi chunk yang nempel di
        // dalam JS/inline script lain). Rekursif, anti-duplikat, gak pernah throw
        // ke pemanggil (tiap asset gagal cuma di-skip + dicatat di log).
        const CHUNK_REF_PATTERNS = [
            /["'](\/_next\/static\/[^"'\\]+?\.(?:js|css))["']/g,
            /["'](https?:\/\/[^"'\\]+?\/_next\/static\/[^"'\\]+?\.(?:js|css))["']/g,
            /["']((?:\.{1,2}\/)?static\/chunks\/[^"'\\]+?\.js)["']/g
        ];

        function extractChunkRefs(text, base) {
            const found = new Set();
            if (!text) return found;
            for (const re of CHUNK_REF_PATTERNS) {
                re.lastIndex = 0;
                let m;
                while ((m = re.exec(text)) !== null) {
                    try { found.add(new URL(m[1], base).href); } catch (e) {}
                }
            }
            return found;
        }

        // Bongkar 1 layer eval-packer klasik: eval(function(p,a,c,k,e,d){...}(payload,radix,count,keywords,0,{}))
        // Caranya aman: buang "eval(" pembungkus luar, terus jalanin sisanya (yang isinya cuma
        // logika decode string, bukan payload asli) via new Function buat DAPETIN hasil decode-nya
        // sebagai string — bukan buat NGEJALANIN payload itu sebagai kode.
        function unpackEvalPacker(code) {
            if (!code) return null;
            const markerRe = /eval\(function\(p,a,c,k,e,(?:d|r)\)\{/;
            const m = markerRe.exec(code);
            if (!m) return null;
            const idx = m.index;
            const afterEval = idx + 'eval('.length;
            let depth = 1, i = afterEval;
            while (i < code.length && depth > 0) {
                if (code[i] === '(') depth++;
                else if (code[i] === ')') depth--;
                i++;
            }
            if (depth !== 0) return null;
            const exprEnd = i - 1;
            const inner = code.slice(afterEval, exprEnd);
            try {
                const decoded = new Function('return (' + inner + ');')();
                if (typeof decoded !== 'string' || !decoded.trim()) return null;
                return code.slice(0, idx) + decoded + code.slice(exprEnd + 1);
            } catch (e) {
                return null;
            }
        }

        // Loop bongkar sampai gak ada lagi lapisan packer (maks 5x biar gak infinite)
        function deobfuscateCode(text, label) {
            if (!text) return text;
            let result = text;
            let passes = 0;
            while (passes < 5) {
                const next = unpackEvalPacker(result);
                if (next === null) break;
                result = next;
                passes++;
            }
            if (passes > 0) {
                addLog('success', `Auto-decrypt: bongkar ${passes} layer eval-packer${label ? ' — ' + label : ''}.`);
            }
            return result;
        }

        // Rapihin JS yang di-minify pakai js-beautify (kalau library-nya sukses ke-load dari CDN)
        function unminifyCode(text, label) {
            if (!text) return text;
            try {
                if (typeof js_beautify === 'function') {
                    const pretty = js_beautify(text, { indent_size: 2, space_in_empty_paren: true });
                    if (pretty && pretty.length) {
                        addLog('success', `Auto-unminify berhasil${label ? ' — ' + label : ''}.`);
                        return pretty;
                    }
                }
            } catch (e) {
                addLog('warn', `Auto-unminify gagal, pakai versi asli${label ? ' — ' + label : ''}.`);
            }
            return text;
        }

        async function bundleAssets(html, baseUrl, onProgress, options) {
            options = options || {};
            const doFullJs = options.fullJs !== false;      // default nyala kalau bundle aktif
            const doNextjs = options.nextjs !== false;       // default nyala
            const doDecryptJs = !!options.decryptJs;
            const doDecryptAll = !!options.decryptAll;
            const doUnminify = !!options.unminify;

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Base tag wajib ada di hasil bundle, biar path relatif yang masih
            // nyisa (import() dinamis, url() di CSS, fetch relatif) tetap nyambung
            // ke domain asal walau file-nya dibuka lepas dari proxy.
            if (!doc.querySelector('base')) {
                const baseEl = doc.createElement('base');
                baseEl.setAttribute('href', baseUrl);
                if (doc.head) doc.head.insertBefore(baseEl, doc.head.firstChild);
            }

            const visitedJs = new Set();
            const visitedCss = new Set();
            const MAX_ASSETS = 120; // pagar biar gak infinite loop di app raksasa
            let jsOk = 0, jsFail = 0, cssOk = 0, cssFail = 0, chunkExtra = 0;

            function processJsText(jsText, absUrl) {
                let out = jsText;
                if (doDecryptJs || doDecryptAll) out = deobfuscateCode(out, absUrl);
                if (doUnminify) out = unminifyCode(out, absUrl);
                return out;
            }
            function processCssText(cssText, absUrl) {
                let out = cssText;
                if (doDecryptAll) out = deobfuscateCode(out, absUrl); // jaga-jaga kalau CSS-nya juga dibungkus packer
                return out;
            }

            async function inlineCss(absUrl, linkNode) {
                if (visitedCss.has(absUrl) || (visitedJs.size + visitedCss.size) >= MAX_ASSETS) return null;
                visitedCss.add(absUrl);
                onProgress && onProgress(`CSS: ${absUrl}`);
                addLog('step', `Bundling CSS: ${absUrl}`);
                try {
                    let cssText = await fetchViaProxy(absUrl);
                    cssText = processCssText(cssText, absUrl);
                    const styleEl = doc.createElement('style');
                    styleEl.setAttribute('data-bundled-from', absUrl);
                    styleEl.textContent = cssText;
                    if (linkNode && linkNode.parentNode) linkNode.replaceWith(styleEl);
                    else if (doc.head) doc.head.appendChild(styleEl);
                    cssOk++;
                    addLog('success', `CSS berhasil di-inline: ${absUrl}`);
                    return styleEl;
                } catch (e) {
                    cssFail++;
                    addLog('warn', `CSS gagal diambil, dilewati: ${absUrl}`);
                    return null;
                }
            }

            async function inlineJs(absUrl, srcNode, isModule) {
                if (visitedJs.has(absUrl) || (visitedJs.size + visitedCss.size) >= MAX_ASSETS) return null;
                visitedJs.add(absUrl);
                onProgress && onProgress(`JS: ${absUrl}`);
                addLog('step', `Bundling JS: ${absUrl}`);
                try {
                    let jsText = await fetchViaProxy(absUrl);
                    const rawJsText = jsText; // dipakai buat nyari chunk turunan (sebelum di-unminify/decrypt biar pattern-nya utuh)
                    jsText = processJsText(jsText, absUrl);
                    const newScript = doc.createElement('script');
                    if (srcNode) {
                        for (const attr of Array.from(srcNode.attributes)) {
                            if (attr.name !== 'src') newScript.setAttribute(attr.name, attr.value);
                        }
                    } else if (isModule) {
                        newScript.setAttribute('type', 'module');
                    }
                    newScript.setAttribute('data-bundled-from', absUrl);
                    newScript.textContent = jsText;
                    if (srcNode && srcNode.parentNode) srcNode.replaceWith(newScript);
                    else if (doc.body) doc.body.appendChild(newScript);
                    jsOk++;
                    addLog('success', `JS berhasil di-inline: ${absUrl}`);

                    // Sisir isi JS ini buat cari chunk turunan (khas code-splitting Next.js) —
                    // cuma jalan kalau "Ambil JS Lengkap" nyala
                    if (doFullJs) {
                        for (const nestedUrl of extractChunkRefs(rawJsText, absUrl)) {
                            if (visitedJs.has(nestedUrl) || visitedCss.has(nestedUrl)) continue;
                            chunkExtra++;
                            if (nestedUrl.endsWith('.css')) await inlineCss(nestedUrl, null);
                            else await inlineJs(nestedUrl, null, false);
                        }
                    }
                    return newScript;
                } catch (e) {
                    jsFail++;
                    addLog('warn', `JS gagal diambil, dilewati: ${absUrl}`);
                    return null;
                }
            }

            // 1) <link rel="stylesheet">
            const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'));
            addLog('info', `Ditemukan ${links.length} file CSS eksternal untuk di-bundle.`);
            for (const link of links) {
                const href = link.getAttribute('href');
                if (!href || href.startsWith('data:')) continue;
                try { await inlineCss(new URL(href, baseUrl).href, link); } catch (e) {}
            }

            // 2) <script src> biasa (termasuk type="module" / nomodule punya Next.js)
            const scripts = Array.from(doc.querySelectorAll('script[src]'));
            addLog('info', `Ditemukan ${scripts.length} file JS eksternal untuk di-bundle.`);
            for (const script of scripts) {
                const src = script.getAttribute('src');
                if (!src || src.startsWith('data:')) continue;
                try {
                    const isModule = script.getAttribute('type') === 'module';
                    await inlineJs(new URL(src, baseUrl).href, script, isModule);
                } catch (e) {}
            }

            // 3) & 4) khusus Next.js — cuma jalan kalau toggle "Bundle Next.js" nyala
            if (doNextjs) {
                // 3) <link rel="modulepreload"> & rel="preload" as="script" — chunk yang
                // cuma di-preload (bukan dieksekusi langsung lewat <script src>), pola
                // umum di app Next.js buat page-chunk & vendor-chunk.
                const preloads = Array.from(doc.querySelectorAll(
                    'link[rel="modulepreload"][href], link[rel="preload"][as="script"][href]'
                ));
                addLog('info', `Ditemukan ${preloads.length} chunk JS ter-preload (khas Next.js).`);
                for (const link of preloads) {
                    const href = link.getAttribute('href');
                    if (!href || href.startsWith('data:')) continue;
                    try {
                        const absUrl = new URL(href, baseUrl).href;
                        const isModule = link.getAttribute('rel') === 'modulepreload';
                        const inlined = await inlineJs(absUrl, null, isModule);
                        if (inlined) link.remove(); // udah ke-inline, hint preload gak perlu lagi
                    } catch (e) {}
                }

                // 4) Sisir <script> inline (tanpa src) — biasanya berisi RSC payload
                // (self.__next_f.push(...)) yang nyimpen path chunk tambahan
                const inlineScripts = Array.from(doc.querySelectorAll('script:not([src])'));
                for (const s of inlineScripts) {
                    for (const nestedUrl of extractChunkRefs(s.textContent, baseUrl)) {
                        if (visitedJs.has(nestedUrl) || visitedCss.has(nestedUrl)) continue;
                        chunkExtra++;
                        if (nestedUrl.endsWith('.css')) await inlineCss(nestedUrl, null);
                        else await inlineJs(nestedUrl, null, false);
                    }
                }
            }

            addLog('info', `Bundle selesai: ${jsOk} JS ok / ${jsFail} gagal, ${cssOk} CSS ok / ${cssFail} gagal, +${chunkExtra} chunk turunan ke-deteksi.`);
            if ((visitedJs.size + visitedCss.size) >= MAX_ASSETS) {
                addLog('warn', `Batas ${MAX_ASSETS} asset tercapai — sebagian chunk turunan mungkin gak ke-bundle biar gak infinite loop.`);
            }

            return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
        }

        // ===== Riwayat Fetcher (persist ke localStorage) =====
        const HISTORY_KEY = 'oxyFetcherHistory_v1';
        const MAX_HISTORY_ITEMS = 12;
        const historyList = document.getElementById('historyList');
        let historyItems = [];
        let openPreviewId = null; // item yg preview-nya lagi kebuka

        function loadHistoryFromStorage() {
            try {
                const raw = localStorage.getItem(HISTORY_KEY);
                historyItems = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(historyItems)) historyItems = [];
            } catch (e) {
                historyItems = [];
            }
        }

        function persistHistory() {
            let list = historyItems;
            while (true) {
                try {
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
                    historyItems = list;
                    return;
                } catch (e) {
                    // Kepenuhan (quota exceeded) -> buang entri paling lama, coba lagi
                    if (list.length <= 1) {
                        historyItems = list;
                        addLog('warn', 'Penyimpanan lokal penuh, riwayat lama tidak bisa disimpan semua.');
                        return;
                    }
                    list = list.slice(0, list.length - 1);
                }
            }
        }

        function uid() {
            return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        }

        function timeAgoLabel(ts) {
            const d = new Date(ts);
            return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        }

        function addHistoryEntry(entry) {
            historyItems.unshift(entry);
            if (historyItems.length > MAX_HISTORY_ITEMS) {
                historyItems = historyItems.slice(0, MAX_HISTORY_ITEMS);
            }
            persistHistory();
            renderHistoryList();
        }

        function deleteHistoryEntry(id) {
            historyItems = historyItems.filter(it => it.id !== id);
            persistHistory();
            if (openPreviewId === id) openPreviewId = null;
            renderHistoryList();
            showToast('Dihapus', 'Item riwayat dihapus.', 'bg-slate-700', 'fa-solid fa-trash-can');
        }

        function clearHistory() {
            if (historyItems.length === 0) return;
            if (!confirm('Hapus semua riwayat fetch? Tindakan ini gak bisa dibatalkan.')) return;
            historyItems = [];
            openPreviewId = null;
            try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
            renderHistoryList();
            showToast('Riwayat Dibersihkan', 'Semua riwayat fetch dihapus.', 'bg-slate-700', 'fa-solid fa-broom');
        }

        function getHistoryItem(id) {
            return historyItems.find(it => it.id === id) || null;
        }

        function renderHistoryList() {
            if (historyItems.length === 0) {
                outputSection.classList.add('hidden');
                welcomePlaceholder.classList.remove('hidden');
                historyList.innerHTML = '';
                return;
            }

            const wasHidden = outputSection.classList.contains('hidden');
            welcomePlaceholder.classList.add('hidden');
            outputSection.classList.remove('hidden');
            if (wasHidden) {
                outputSection.classList.remove('section-in');
                void outputSection.offsetWidth; // restart animasi reveal
                outputSection.classList.add('section-in');
            }

            historyList.innerHTML = historyItems.map(item => {
                const isPreviewOpen = openPreviewId === item.id;
                return `
                <div class="history-card bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden" data-id="${item.id}">
                    <div class="flex items-center justify-between p-3 gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                                <i class="fa-solid fa-file-code"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-slate-200 truncate">${escapeHtml(item.fileName)}</p>
                                <p class="text-xs text-slate-500 truncate">Ukuran: ${item.size.toLocaleString()} karakter (${item.sizeKB} KB) &middot; ${timeAgoLabel(item.savedAt)}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <button
                                onclick="downloadHistoryItem('${item.id}')"
                                title="Download"
                                class="action-btn w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                            >
                                <i class="fa-solid fa-download"></i>
                            </button>
                            <button
                                onclick="toggleFileMenu(this, '${item.id}')"
                                title="Opsi lain"
                                class="action-btn w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                            >
                                <i class="fa-solid fa-caret-down transition-transform ${isPreviewOpen ? '' : ''}"></i>
                            </button>
                        </div>
                    </div>
                    <div class="history-preview-area border-t border-slate-800" style="${isPreviewOpen ? '' : 'display:none;'}">
                        <div class="relative bg-white h-[420px]">
                            <iframe sandbox="allow-scripts allow-same-origin" class="w-full h-full border-none bg-white" ${isPreviewOpen ? `data-src-id="${item.id}"` : ''}></iframe>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // Isi iframe yang lagi kebuka (dibuat setelah innerHTML biar iframe fresh)
            if (openPreviewId) {
                const item = getHistoryItem(openPreviewId);
                const iframe = historyList.querySelector(`iframe[data-src-id="${openPreviewId}"]`);
                if (item && iframe) fillPreviewIframe(iframe, item.html, item.url);
            }
        }

        function fillPreviewIframe(iframe, htmlContent, baseUrl) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                let parsedHtml = htmlContent;
                if (!htmlContent.includes('<base')) {
                    const baseTag = `<base href="${baseUrl}">`;
                    parsedHtml = htmlContent.includes('<head>')
                        ? htmlContent.replace('<head>', `<head>${baseTag}`)
                        : baseTag + htmlContent;
                }
                iframeDoc.write(parsedHtml);
                iframeDoc.close();
            } catch (e) {}
        }

        function downloadHistoryItem(id) {
            const item = getHistoryItem(id);
            if (!item) return;
            const blob = new Blob([item.html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.fileName || 'source.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            let url = targetUrlInput.value.trim();

            if (!url) return;

            const bundleOptions = {
                fullJs: bundleAssetsCheckbox.checked && optFullJsCheckbox.checked,
                nextjs: bundleAssetsCheckbox.checked && optNextjsCheckbox.checked,
                decryptJs: bundleAssetsCheckbox.checked && optDecryptJsCheckbox.checked,
                decryptAll: bundleAssetsCheckbox.checked && optDecryptAllCheckbox.checked,
                unminify: bundleAssetsCheckbox.checked && optUnminifyCheckbox.checked
            };

            clearLog();
            addLog('step', `=== Proses dimulai untuk: ${url} ===`);
            addLog('info', `Mode bundle CSS/JS: ${bundleAssetsCheckbox.checked ? 'AKTIF' : 'nonaktif'}`);
            if (bundleAssetsCheckbox.checked) {
                addLog('info', `Opsi tambahan → JS Lengkap: ${bundleOptions.fullJs ? 'ON' : 'off'}, Next.js: ${bundleOptions.nextjs ? 'ON' : 'off'}, Decrypt JS: ${bundleOptions.decryptJs ? 'ON' : 'off'}, Decrypt Semua: ${bundleOptions.decryptAll ? 'ON' : 'off'}, Unminify: ${bundleOptions.unminify ? 'ON' : 'off'}`);
            }

            setLoading(true);

            try {
                let cleanUrl = url;
                if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                    cleanUrl = 'https://' + cleanUrl;
                }

                fetchedRawHtml = await fetchHtml(url);

                if (bundleAssetsCheckbox.checked) {
                    btnText.textContent = 'Bundling CSS/JS...';
                    addLog('step', 'Mulai proses bundling CSS & JS...');
                    fetchedRawHtml = await bundleAssets(fetchedRawHtml, cleanUrl, (info) => {
                        btnText.textContent = `Bundling: ${info.slice(0, 24)}...`;
                    }, bundleOptions);
                }

                let hostName = url;
                try { hostName = new URL(cleanUrl).hostname; } catch (e) {}

                const sizeInKB = (fetchedRawHtml.length / 1024).toFixed(2);

                addHistoryEntry({
                    id: uid(),
                    fileName: `${hostName}.html`,
                    url: cleanUrl,
                    size: fetchedRawHtml.length,
                    sizeKB: sizeInKB,
                    html: fetchedRawHtml,
                    savedAt: Date.now()
                });

                addLog('success', `=== Selesai. Total ukuran: ${fetchedRawHtml.length.toLocaleString()} karakter (${sizeInKB} KB) ===`);
                showToast('Sukses!', `Berhasil mengambil HTML (${sizeInKB} KB)${bundleAssetsCheckbox.checked ? ' — CSS/JS ter-bundle' : ''}`, 'bg-emerald-600', 'fa-solid fa-check');
            } catch (err) {
                addLog('error', `=== Proses gagal: ${err.message || 'Terjadi masalah.'} ===`);
                showToast('Gagal Fetch', err.message || 'Terjadi masalah.', 'bg-rose-600', 'fa-solid fa-circle-exclamation');
            } finally {
                setLoading(false);
            }
        });

        function setLoading(isLoading) {
            if (isLoading) {
                btnSubmit.disabled = true;
                btnSubmit.classList.add('is-scanning');
                btnIcon.className = 'fa-solid fa-spinner fa-spin-smooth';
                btnText.textContent = 'Memproses...';
            } else {
                btnSubmit.disabled = false;
                btnSubmit.classList.remove('is-scanning');
                btnIcon.className = 'fa-solid fa-cloud-arrow-down';
                btnText.textContent = 'Ambil HTML';
            }
        }

        function escapeHtml(text) {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        let activeMenuId = null;

        function positionFileMenu(btnEl) {
            const menu = document.getElementById('fileMenu');
            const btnRect = btnEl.getBoundingClientRect();
            const gap = 8;
            let bottom = window.innerHeight - btnRect.top + gap;
            let right = window.innerWidth - btnRect.right;

            menu.style.top = 'auto';
            menu.style.bottom = bottom + 'px';
            menu.style.left = 'auto';
            menu.style.right = right + 'px';

            const menuHeightEstimate = menu.offsetHeight || 120;
            if (btnRect.top - menuHeightEstimate - gap < 8) {
                menu.style.top = (btnRect.bottom + gap) + 'px';
                menu.style.bottom = 'auto';
            }
        }

        function toggleFileMenu(btnEl, itemId, forceClose) {
            const menu = document.getElementById('fileMenu');
            const shouldOpen = forceClose === true ? false : (menu.classList.contains('hidden') || activeMenuId !== itemId);

            if (shouldOpen && btnEl) {
                if (menu.parentElement !== document.body) {
                    document.body.appendChild(menu);
                }
                activeMenuId = itemId;
                const item = getHistoryItem(itemId);
                const isPreviewOpen = openPreviewId === itemId;
                document.getElementById('previewMenuIcon').className = isPreviewOpen ? 'fa-solid fa-eye-slash text-slate-500 w-3.5' : 'fa-solid fa-eye text-slate-500 w-3.5';
                document.getElementById('previewMenuLabel').textContent = isPreviewOpen ? 'Tutup Preview' : 'Preview';
                menu.classList.remove('hidden');
                positionFileMenu(btnEl);
            } else {
                menu.classList.add('hidden');
                activeMenuId = null;
            }
        }

        window.addEventListener('resize', () => {
            const menu = document.getElementById('fileMenu');
            if (!menu.classList.contains('hidden')) toggleFileMenu(null, null, true);
        });
        window.addEventListener('scroll', () => {
            const menu = document.getElementById('fileMenu');
            if (!menu.classList.contains('hidden')) toggleFileMenu(null, null, true);
        }, true);

        function menuAction(action) {
            const itemId = activeMenuId;
            toggleFileMenu(null, null, true);
            if (!itemId) return;

            if (action === 'preview') {
                openPreviewId = (openPreviewId === itemId) ? null : itemId;
                renderHistoryList();
                if (openPreviewId === itemId) {
                    const card = historyList.querySelector(`.history-card[data-id="${itemId}"]`);
                    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else if (action === 'copy') {
                copyHistoryItem(itemId);
            } else if (action === 'delete') {
                if (confirm('Hapus item riwayat ini?')) deleteHistoryEntry(itemId);
            }
        }

        // Tutup dropdown kalau klik di luar
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('fileMenu');
            if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !e.target.closest('[onclick^="toggleFileMenu"]')) {
                toggleFileMenu(null, null, true);
            }
        });

        function pulseButton(btn) {
            if (!btn) return;
            btn.classList.remove('success-pop');
            void btn.offsetWidth;
            btn.classList.add('success-pop');
        }

        function copyHistoryItem(id) {
            const item = getHistoryItem(id);
            if (!item) return;
            navigator.clipboard.writeText(item.html).then(() => {
                showToast('Disalin!', 'Kode HTML disalin.', 'bg-indigo-600', 'fa-regular fa-clipboard');
            });
        }


        function showToast(title, desc, colorClass, iconClass) {
            const toast = document.getElementById('toast');
            const toastIcon = document.getElementById('toastIcon');
            const toastTitle = document.getElementById('toastTitle');
            const toastDesc = document.getElementById('toastDesc');

            toastIcon.className = `w-8 h-8 rounded-lg flex items-center justify-center text-white ${colorClass}`;
            toastIcon.innerHTML = `<i class="${iconClass}"></i>`;
            toastTitle.textContent = title;
            toastDesc.textContent = desc;

            toast.classList.remove('translate-y-20', 'opacity-0');
            toast.classList.add('toast-show');

            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.remove('toast-show');
                toast.classList.add('toast-hide');
                setTimeout(() => {
                    toast.classList.add('translate-y-20', 'opacity-0');
                    toast.classList.remove('toast-hide');
                }, 300);
            }, 3000);
        }

        // ===== Init: muat riwayat yang udah tersimpan sebelumnya =====
        loadHistoryFromStorage();
        renderHistoryList();