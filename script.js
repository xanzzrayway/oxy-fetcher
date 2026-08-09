let fetchedRawHtml = '';
        let toastTimeout = null;

        const form = document.getElementById('fetchForm');
        const targetUrlInput = document.getElementById('targetUrl');
        const btnSubmit = document.getElementById('btnSubmit');
        const btnIcon = document.getElementById('btnIcon');
        const btnText = document.getElementById('btnText');
        const outputSection = document.getElementById('outputSection');
        const welcomePlaceholder = document.getElementById('welcomePlaceholder');
        const codeBlock = document.getElementById('codeBlock');
        const previewIframe = document.getElementById('previewIframe');
        const charCount = document.getElementById('charCount');
        const searchInput = document.getElementById('searchInput');
        const adblockWarning = document.getElementById('adblockWarning');
        const bundleAssetsCheckbox = document.getElementById('bundleAssets');
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
            line.className = 'flex items-start gap-2 py-0.5';
            line.innerHTML = `
                <span class="text-slate-600 shrink-0">${time}</span>
                <i class="${style.icon} ${style.color} shrink-0 mt-0.5"></i>
                <span class="${style.color} break-all">${escapeHtml(message)}</span>
            `;
            logOutput.appendChild(line);
            logOutput.scrollTop = logOutput.scrollHeight;

            logCountBadge.textContent = logCount;
            logCountBadge.classList.remove('hidden');

            // Auto-expand panel saat proses baru mulai jalan
            if (logBody.classList.contains('hidden')) {
                toggleLogPanel(true);
            }
        }

        function clearLog() {
            logCount = 0;
            logOutput.innerHTML = '<p class="text-slate-600 italic">Belum ada proses. Log akan muncul di sini saat kamu klik "Ambil HTML".</p>';
            logCountBadge.classList.add('hidden');
        }

        function toggleLogPanel(forceOpen) {
            const shouldOpen = forceOpen === true ? true : logBody.classList.contains('hidden');
            if (shouldOpen) {
                logBody.classList.remove('hidden');
                logChevron.classList.add('rotate-180');
            } else {
                logBody.classList.add('hidden');
                logChevron.classList.remove('rotate-180');
            }
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

        // Bundle semua <link rel="stylesheet"> dan <script src> jadi inline, biar file hasil download lengkap berdiri sendiri
        async function bundleAssets(html, baseUrl, onProgress) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'));
            addLog('info', `Ditemukan ${links.length} file CSS eksternal untuk di-bundle.`);
            let cssOk = 0, cssFail = 0;
            for (const link of links) {
                const href = link.getAttribute('href');
                if (!href || href.startsWith('data:')) continue;
                try {
                    const absUrl = new URL(href, baseUrl).href;
                    onProgress && onProgress(`CSS: ${absUrl}`);
                    addLog('step', `Bundling CSS: ${absUrl}`);
                    const cssText = await fetchViaProxy(absUrl);
                    const styleEl = doc.createElement('style');
                    styleEl.setAttribute('data-bundled-from', absUrl);
                    styleEl.textContent = cssText;
                    link.replaceWith(styleEl);
                    cssOk++;
                    addLog('success', `CSS berhasil di-inline: ${absUrl}`);
                } catch (e) {
                    // biarkan tag <link> aslinya kalau gagal diambil
                    cssFail++;
                    addLog('warn', `CSS gagal diambil, tag asli dipertahankan: ${href}`);
                }
            }
            addLog('info', `Bundle CSS selesai: ${cssOk} berhasil, ${cssFail} gagal.`);

            const scripts = Array.from(doc.querySelectorAll('script[src]'));
            addLog('info', `Ditemukan ${scripts.length} file JS eksternal untuk di-bundle.`);
            let jsOk = 0, jsFail = 0;
            for (const script of scripts) {
                const src = script.getAttribute('src');
                if (!src || src.startsWith('data:')) continue;
                try {
                    const absUrl = new URL(src, baseUrl).href;
                    onProgress && onProgress(`JS: ${absUrl}`);
                    addLog('step', `Bundling JS: ${absUrl}`);
                    const jsText = await fetchViaProxy(absUrl);
                    const newScript = doc.createElement('script');
                    for (const attr of Array.from(script.attributes)) {
                        if (attr.name !== 'src') newScript.setAttribute(attr.name, attr.value);
                    }
                    newScript.setAttribute('data-bundled-from', absUrl);
                    newScript.textContent = jsText;
                    script.replaceWith(newScript);
                    jsOk++;
                    addLog('success', `JS berhasil di-inline: ${absUrl}`);
                } catch (e) {
                    // biarkan tag <script src> aslinya kalau gagal diambil
                    jsFail++;
                    addLog('warn', `JS gagal diambil, tag asli dipertahankan: ${src}`);
                }
            }
            addLog('info', `Bundle JS selesai: ${jsOk} berhasil, ${jsFail} gagal.`);

            return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            let url = targetUrlInput.value.trim();

            if (!url) return;

            clearLog();
            addLog('step', `=== Proses dimulai untuk: ${url} ===`);
            addLog('info', `Mode bundle CSS/JS: ${bundleAssetsCheckbox.checked ? 'AKTIF' : 'nonaktif'}`);

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
                    });
                }

                welcomePlaceholder.classList.add('hidden');
                outputSection.classList.remove('hidden');

                renderCode(fetchedRawHtml);
                updateIframe(fetchedRawHtml, url);

                const sizeInKB = (fetchedRawHtml.length / 1024).toFixed(2);
                charCount.textContent = `Ukuran: ${fetchedRawHtml.length.toLocaleString()} karakter (${sizeInKB} KB)`;

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
                btnIcon.className = 'fa-solid fa-spinner animate-spin';
                btnText.textContent = 'Memproses...';
            } else {
                btnSubmit.disabled = false;
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

        function renderCode(htmlContent) {
            codeBlock.innerHTML = escapeHtml(htmlContent);
            if (window.Prism && Prism.highlightElement) {
                Prism.highlightElement(codeBlock);
            }
        }

        function updateIframe(htmlContent, baseUrl) {
            try {
                const iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
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

        function switchTab(tab) {
            const tabCodeBtn = document.getElementById('tabCodeBtn');
            const tabPreviewBtn = document.getElementById('tabPreviewBtn');
            const tabCode = document.getElementById('tabCode');
            const tabPreview = document.getElementById('tabPreview');
            const searchContainer = document.getElementById('searchContainer');

            if (tab === 'code') {
                tabCodeBtn.className = 'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all bg-indigo-600 text-white';
                tabPreviewBtn.className = 'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all text-slate-400 hover:text-slate-200';
                tabCode.classList.remove('hidden');
                tabPreview.classList.add('hidden');
                searchContainer.classList.remove('sm:hidden');
            } else {
                tabPreviewBtn.className = 'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all bg-indigo-600 text-white';
                tabCodeBtn.className = 'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all text-slate-400 hover:text-slate-200';
                tabCode.classList.add('hidden');
                tabPreview.classList.remove('hidden');
                searchContainer.classList.add('sm:hidden');
            }
        }

        function copyToClipboard() {
            if (!fetchedRawHtml) return;
            navigator.clipboard.writeText(fetchedRawHtml).then(() => {
                showToast('Disalin!', 'Kode HTML disalin.', 'bg-indigo-600', 'fa-regular fa-clipboard');
            });
        }

        function downloadHtml() {
            if (!fetchedRawHtml) return;
            const blob = new Blob([fetchedRawHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'source.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (!query) {
                renderCode(fetchedRawHtml);
                return;
            }

            const escaped = escapeHtml(fetchedRawHtml);
            try {
                const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
                codeBlock.innerHTML = escaped.replace(regex, `<mark class="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">$1</mark>`);
            } catch (err) {
                renderCode(fetchedRawHtml);
            }
        });
