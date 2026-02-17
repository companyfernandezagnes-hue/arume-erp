/* =============================================================
   🚚 MÓDULO: ALBARANES v10.0 (Sentinel: Control de Precios)
   ============================================================= */

import Tesseract from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

let ocrWorker = null;

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. INICIALIZACIÓN
    if (!Array.isArray(db.albaranes)) db.albaranes = [];
    if (!db.priceHistory) db.priceHistory = {}; // Histórico de precios
    
    const listaSocios = db.listaSocios || ['Jeronimo','Pedro','Pau','Agnes'];
    let filtroOwner = 'Todos';

    // Pre-carga OCR
    const initOCR = async () => {
        if (!ocrWorker) {
            try { ocrWorker = await Tesseract.createWorker('spa'); } 
            catch (e) { console.error("Error OCR:", e); }
        }
        return ocrWorker;
    };
    initOCR();

    const inbox = db.albaranes.filter(a => a.status === 'pending');

    // --- DETECTOR DE SUBIDA DE PRECIOS (NUEVO CEREBRO) ---
    const normalize = (s) => {
        return String(s || '').toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // sin tildes
            .replace(/kg|ud|uds|litro|botella|caja|x|-/g, '') // quitar unidades
            .replace(/\s+/g, ' ').trim();
    };

    const detectPriceIncrease = (name, newUnitPrice) => {
        const key = normalize(name);
        if(key.length < 3) return null; // Ignorar nombres muy cortos

        const history = db.priceHistory[key];
        if (!history || history.length < 1) return null;

        // Comparar con el último precio registrado
        const lastPrice = history[history.length - 1].unit;
        if (lastPrice <= 0) return null;

        const diff = newUnitPrice - lastPrice;
        const pct = (diff / lastPrice) * 100;

        // Solo avisar si sube más de un 5% (para evitar céntimos sueltos)
        if (pct >= 5) {
            return { increase: true, pct: pct.toFixed(1), previous: lastPrice, diff: diff.toFixed(2) };
        }
        return null;
    };

    // 2. PARSER INTELIGENTE v3.1 (Con Precio Unitario)
    const parseSmartLine = (line) => {
        let clean = line.replace(/[€$]/g, '').replace(/,/g, '.').trim();
        if (!clean || clean.length < 5) return null;

        let rate = 10;
        if (clean.match(/\b21\s?%/)) rate = 21;
        else if (clean.match(/\b4\s?%/)) rate = 4;
        
        const upper = clean.toUpperCase();
        if (upper.includes("ALCOHOL") || upper.includes("GINEBRA")) rate = 21;
        if (upper.includes("PAN ") || upper.includes("HUEVO")) rate = 4;

        const numbers = [...clean.matchAll(/(\d+\.\d{2})/g)].map(m => parseFloat(m[1]));
        if (numbers.length === 0) return null;

        const totalLine = numbers[numbers.length - 1];
        
        let qty = 1;
        const qtyMatch = clean.match(/^(\d+(\.\d{1,3})?)\s*(kg|uds|x|\*)/i);
        if (qtyMatch) qty = parseFloat(qtyMatch[1]);

        let name = clean
            .replace(totalLine.toString(), '')
            .replace(/\d+(\.\d{1,3})?\s*(kg|uds|x|\*)/i, '')
            .replace(/\b(4|10|21)\s?%/, '')
            .replace(/\.{2,}/g, '')
            .trim();

        if (name.length < 2) name = "Varios";

        const unitPrice = qty > 0 ? totalLine / qty : totalLine;
        const baseLine = totalLine / (1 + rate / 100);
        const taxLine = totalLine - baseLine;

        return { q: qty, n: name, t: totalLine, rate, base: baseLine, tax: taxLine, unit: unitPrice };
    };

    const analizarTexto = (texto) => texto.split('\n').map(parseSmartLine).filter(Boolean);

    // 3. INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Albaranes & Gastos</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Price Sentinel Active 🛡️</p>
            </div>
            <div class="flex gap-2 items-center flex-wrap justify-center">
                <label class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-indigo-700 transition cursor-pointer shadow-lg flex items-center gap-2">
                    <span>📷</span> SCAN (TURBO)
                    <input type="file" id="ocrInput" class="hidden" accept="image/*" capture="environment">
                </label>
                <button id="btnExport" class="bg-slate-800 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-md transition">⬇️ CSV</button>
            </div>
        </header>

        ${inbox.length > 0 ? `
        <div class="bg-indigo-50 p-4 rounded-[2rem] border border-indigo-100 relative overflow-hidden animate-pulse-slow">
            <div class="flex justify-between items-center relative z-10">
                <div class="flex items-center gap-3">
                    <span class="bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md">📧</span>
                    <div>
                        <h3 class="font-black text-indigo-900 text-sm">Bandeja de Entrada</h3>
                        <p class="text-[10px] text-indigo-600"><b>${inbox.length}</b> facturas pendientes</p>
                    </div>
                </div>
            </div>
            <div class="mt-4 space-y-2 relative z-10">
                ${inbox.map(item => `
                    <div onclick="window.editarAlbaran('${item.id}')" class="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center cursor-pointer hover:scale-[1.01] transition">
                        <div>
                            <p class="text-xs font-bold text-slate-700">${item.prov || 'Sin Proveedor'}</p>
                            <p class="text-[9px] text-slate-400">${item.date}</p>
                        </div>
                        <button class="text-[9px] bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg font-bold">REVISAR</button>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-1 space-y-4">
                <div class="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>
                    
                    <div id="ocrLoadingOverlay" class="hidden absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center text-center p-4 backdrop-blur-sm">
                        <div class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p class="text-xs font-black text-indigo-600 animate-pulse">ANALIZANDO...</p>
                    </div>

                    <h3 class="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">⚡ Nueva Compra</h3>

                    <div class="space-y-3 mb-4">
                        <input id="inProv" type="text" placeholder="Proveedor" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none focus:ring-2 focus:ring-indigo-500 transition">
                        <div class="flex gap-2">
                            <input id="inDate" type="date" value="${new Date().toISOString().split('T')[0]}" class="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none">
                            <input id="inRef" type="text" placeholder="Ref." class="w-1/3 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none">
                        </div>
                        <select id="inSocio" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-0 outline-none">
                            <option value="Arume">Gasto: Restaurante (Arume)</option>
                            ${listaSocios.map(s => `<option value="${s}">Gasto: ${s}</option>`).join('')}
                        </select>
                    </div>

                    <textarea id="inText" placeholder="Texto o Scan..." class="w-full h-40 bg-slate-50 rounded-2xl p-4 text-xs font-mono border-0 outline-none resize-none mb-3 shadow-inner focus:bg-white transition"></textarea>
                    
                    <div id="livePreview" class="mt-3 space-y-1 max-h-40 overflow-y-auto custom-scrollbar px-1 bg-slate-50/50 rounded-xl p-2 min-h-[50px]"></div>

                    <div class="mt-4 p-4 bg-slate-900 rounded-2xl shadow-lg space-y-2">
                        <div id="taxSummary" class="space-y-1"></div>
                        <div class="flex justify-between items-center pt-2 border-t border-slate-700 mt-2">
                            <span class="text-xs font-black text-white uppercase">TOTAL</span>
                            <span id="liveTotal" class="text-2xl font-black text-white">0.00€</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 mt-4 px-2">
                        <input type="checkbox" id="inPaid" class="w-4 h-4 accent-indigo-600 cursor-pointer">
                        <label for="inPaid" class="text-xs font-bold text-slate-600 cursor-pointer">Marcar como PAGADO</label>
                    </div>

                    <button id="btnProcesar" class="w-full mt-4 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition active:scale-95">GUARDAR ALBARÁN</button>
                </div>
            </div>

            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white p-2 rounded-full shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center px-4 gap-2">
                    <input id="searchBox" type="text" placeholder="Buscar..." class="bg-transparent text-sm font-bold outline-none w-full text-slate-600">
                    <div class="flex gap-1">
                        <button data-filter="Todos" class="filter-btn px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-slate-900 text-white shadow-md transition">Todos</button>
                        <button data-filter="Arume" class="filter-btn px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400 hover:bg-white transition">Rest.</button>
                        <button data-filter="Socios" class="filter-btn px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400 hover:bg-white transition">Socios</button>
                    </div>
                </div>
                <div id="listaAlbaranes" class="space-y-3 pb-20"></div>
            </div>
        </div>
    </div>
    
    <div id="modalDetalle" class="hidden fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[200] flex justify-center items-center p-2 md:p-6 transition-all"></div>
    `;

    // --- REFERENCIAS ---
    const inText = container.querySelector("#inText");
    const livePreview = container.querySelector("#livePreview");
    const liveTotal = container.querySelector("#liveTotal");
    const taxSummary = container.querySelector("#taxSummary");
    const inProv = container.querySelector("#inProv");
    const ocrOverlay = container.querySelector("#ocrLoadingOverlay");

    // 4. CÁLCULO + DETECCIÓN DE SUBIDAS
    const recalcular = () => {
        const items = analizarTexto(inText.value);
        const taxes = { 4: {b:0, i:0}, 10: {b:0, i:0}, 21: {b:0, i:0} };
        let grandTotal = 0;
        
        items.forEach(it => {
            if(!taxes[it.rate]) taxes[it.rate] = {b:0, i:0};
            taxes[it.rate].b += it.base;
            taxes[it.rate].i += it.tax;
            grandTotal += it.t;
        });

        livePreview.innerHTML = items.map(it => {
            const alert = detectPriceIncrease(it.n, it.unit);
            return `
            <div class="flex flex-col border-b border-slate-200 py-1 last:border-0">
                <div class="flex justify-between items-center text-[10px]">
                    <span class="truncate pr-2"><b>${it.q}x</b> ${it.n}</span>
                    <span class="font-black text-slate-900 whitespace-nowrap">${it.t.toFixed(2)}€</span>
                </div>
                ${alert ? `<p class="text-[9px] font-bold text-rose-500">▲ +${alert.pct}% vs ${alert.previous.toFixed(2)}€</p>` : ''}
            </div>
            `;
        }).join('') || '<p class="text-[10px] text-slate-300 text-center italic py-2">Sin líneas...</p>';

        taxSummary.innerHTML = Object.keys(taxes).map(r => {
            if(taxes[r].b < 0.01) return '';
            return `
                <div class="flex justify-between text-[10px] text-slate-400">
                    <span class="font-bold w-12">IVA ${r}%</span>
                    <span class="flex-1 text-right pr-4">Base: ${taxes[r].b.toFixed(2)}€</span>
                    <span class="text-emerald-400 font-black">+${taxes[r].i.toFixed(2)}€</span>
                </div>`;
        }).join('');
        
        liveTotal.innerText = grandTotal.toFixed(2) + "€";
    };

    inText.addEventListener('input', recalcular);

    // 5. OCR
    container.querySelector("#ocrInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        ocrOverlay.classList.remove("hidden");
        try {
            const worker = await initOCR();
            const { data: { text } } = await worker.recognize(file);
            
            const matches = [...text.matchAll(/(\d+[.,]\d{2})/g)].map(m => parseFloat(m[1].replace(',','.')));
            const maxVal = matches.length ? Math.max(...matches) : 0;

            if (maxVal > 0) {
                inText.value = `Gasto OCR ${maxVal.toFixed(2)}`; 
                inText.dispatchEvent(new Event('input'));
            }

            const conocidos = ["MAKRO", "MERCADONA", "REPSOL", "IBERDROLA", "AMAZON", "MAHOU", "ESTRELLA"];
            const upperText = text.toUpperCase();
            const detectado = conocidos.find(p => upperText.includes(p));
            if(detectado) inProv.value = detectado;

        } catch (err) { console.error(err); alert("Error lectura"); } 
        finally { ocrOverlay.classList.add("hidden"); e.target.value = ''; }
    };

    // 6. GUARDAR (Y APRENDER PRECIOS)
    container.querySelector("#btnProcesar").onclick = async () => {
        const items = analizarTexto(inText.value);
        let total = parseFloat(liveTotal.innerText);
        const prov = container.querySelector("#inProv").value;
        const date = container.querySelector("#inDate").value;

        if (total <= 0 || !prov) return alert("Faltan datos.");

        // Anti-Duplicados
        const duplicado = db.albaranes.some(a => a.prov === prov && a.date === date && Math.abs(a.total - total) < 0.1);
        if(duplicado && !confirm("⚠️ Posible duplicado. ¿Guardar igual?")) return;

        // GUARDAR HISTÓRICO DE PRECIOS
        items.forEach(it => {
            const key = normalize(it.n);
            if(key.length > 2) {
                if(!db.priceHistory[key]) db.priceHistory[key] = [];
                db.priceHistory[key].push({ date: date, unit: it.unit, total: it.t });
            }
        });

        db.albaranes.push({
            id: Date.now().toString(),
            prov, date,
            num: container.querySelector("#inRef").value || "S/N",
            socio: container.querySelector("#inSocio").value,
            items, total,
            taxes: items.reduce((acc, it) => acc + it.tax, 0),
            base: items.reduce((acc, it) => acc + it.base, 0),
            invoiced: false, paid: container.querySelector("#inPaid").checked,
            status: 'ok', attachment_url: null
        });

        await saveFn("Gasto guardado y precios actualizados 📈");
        inText.value = ""; inProv.value = ""; 
        inText.dispatchEvent(new Event('input'));
        pintarLista();
    };

    // 7. EDICIÓN
    window.editarAlbaran = (id) => {
        const a = db.albaranes.find(x => x.id === id);
        if(!a) return;
        const modal = container.querySelector("#modalDetalle");
        modal.classList.remove("hidden");

        const base = a.base || (a.total / 1.10);
        const iva = a.taxes || (a.total - base);
        const viewerHtml = a.attachment_url ? `
            <div class="h-64 bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative mb-4">
                <a href="${a.attachment_url}" target="_blank" class="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-[10px]">↗️</a>
                <img src="${a.attachment_url}" class="max-w-full max-h-full object-contain">
            </div>` : '';

        // Detectar subidas en el modal también
        const alertasPrecios = (a.items||[]).map(it => detectPriceIncrease(it.n, it.t/it.q)).filter(Boolean);

        modal.innerHTML = `
            <div class="bg-white w-full max-w-4xl rounded-[2.5rem] p-6 shadow-2xl animate-slide-up relative h-[90vh] overflow-hidden flex flex-col">
                <button onclick="document.getElementById('modalDetalle').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-2xl z-50">✕</button>
                <h3 class="text-xl font-black text-slate-800 mb-4 px-2">Detalle Gasto</h3>
                
                <div class="flex-1 overflow-y-auto p-2 space-y-4">
                    ${viewerHtml}
                    <div class="grid grid-cols-2 gap-4">
                        <input id="ed-prov" type="text" value="${a.prov}" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-100">
                        <input id="ed-date" type="date" value="${a.date}" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-100">
                    </div>
                    
                    ${alertasPrecios.length > 0 ? `
                    <div class="bg-rose-50 p-3 rounded-xl border border-rose-100">
                        <p class="text-[10px] font-black text-rose-500 uppercase mb-1">⚠️ Alerta Inflación</p>
                        ${alertasPrecios.map(al => `<p class="text-[9px] text-rose-700">Subida del ${al.pct}% (${al.diff}€)</p>`).join('')}
                    </div>` : ''}

                    <div class="grid grid-cols-2 gap-4 mt-2">
                        <div class="p-3 bg-slate-50 rounded-xl"><p class="text-[9px] text-slate-400">Base</p><p class="font-bold">${base.toFixed(2)}€</p></div>
                        <div class="p-3 bg-emerald-50 rounded-xl"><p class="text-[9px] text-emerald-500">IVA</p><p class="font-bold text-emerald-600">${iva.toFixed(2)}€</p></div>
                    </div>

                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase">Total (€)</label>
                        <input id="ed-total" type="number" step="0.01" value="${a.total}" class="w-full p-4 bg-slate-900 text-white rounded-xl font-black text-2xl">
                    </div>

                    <div class="flex items-center gap-3 py-2 bg-indigo-50 px-3 rounded-xl border border-indigo-100">
                        <input type="checkbox" id="ed-paid" ${a.paid ? 'checked' : ''} class="w-5 h-5 accent-indigo-600">
                        <label class="text-sm font-bold text-indigo-900">Pagado</label>
                    </div>

                    <button id="btnSaveEd" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition mt-4">GUARDAR CAMBIOS</button>
                    <button onclick="window.borrarAlbaran('${a.id}')" class="w-full text-rose-400 text-[10px] font-black mt-4 hover:text-rose-600">ELIMINAR</button>
                </div>
            </div>
        `;

        modal.querySelector("#btnSaveEd").onclick = async () => {
            a.prov = modal.querySelector("#ed-prov").value;
            a.date = modal.querySelector("#ed-date").value;
            const nuevoTotal = parseFloat(modal.querySelector("#ed-total").value);
            
            if (Math.abs(nuevoTotal - a.total) > 0.01) {
                a.total = nuevoTotal;
                a.base = nuevoTotal / 1.10; a.taxes = nuevoTotal - a.base;
            }
            a.paid = modal.querySelector("#ed-paid").checked;
            a.status = 'ok';
            await saveFn("Actualizado ✅");
            modal.classList.add("hidden");
            render(container, supabase, db, opts);
        };
    };

    const pintarLista = () => {
        const term = container.querySelector("#searchBox").value.toLowerCase();
        const filtered = db.albaranes.filter(a => {
            if (a.status === 'pending') return false; 
            const esSocio = a.socio && a.socio !== 'Arume';
            if (filtroOwner === 'Arume' && esSocio) return false;
            if (filtroOwner === 'Socios' && !esSocio) return false;
            return (a.prov||'').toLowerCase().includes(term);
        }).sort((a,b) => new Date(b.date) - new Date(a.date));

        container.querySelector("#listaAlbaranes").innerHTML = filtered.map(a => `
            <div onclick="window.editarAlbaran('${a.id}')" class="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm hover:bg-slate-50 transition cursor-pointer">
                <div>
                    <h4 class="font-black text-slate-800">${a.prov}</h4>
                    <p class="text-[10px] text-slate-400 mt-1">${a.date}</p>
                </div>
                <div class="text-right">
                    <p class="font-black text-slate-900 text-lg">${parseFloat(a.total).toFixed(2)}€</p>
                    <span class="text-[8px] font-bold ${a.paid ? 'text-emerald-500' : 'text-rose-500'} uppercase">${a.paid ? 'Pagado' : 'Pendiente'}</span>
                </div>
            </div>
        `).join('') || '<p class="text-center text-slate-300 py-10 text-xs">Sin registros.</p>';
        
        const totalGlobal = db.albaranes.reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);
        container.querySelector("#total-global-kpi").innerText = totalGlobal.toLocaleString('es-ES', {minimumFractionDigits:2}) + "€";
    };

    window.borrarAlbaran = async (id) => {
        if(!confirm("¿Eliminar?")) return;
        db.albaranes = db.albaranes.filter(x => x.id !== id);
        await saveFn("Borrado");
        container.querySelector("#modalDetalle").classList.add("hidden");
        render(container, supabase, db, opts);
    };

    container.querySelectorAll(".filter-btn").forEach(btn => {
        btn.onclick = () => {
            filtroOwner = btn.dataset.filter;
            container.querySelectorAll(".filter-btn").forEach(b => { 
                b.classList.remove('bg-slate-900','text-white'); b.classList.add('bg-slate-100','text-slate-400'); 
            });
            btn.classList.remove('bg-slate-100','text-slate-400'); btn.classList.add('bg-slate-900','text-white');
            pintarLista();
        };
    });

    container.querySelector("#btnExport").onclick = () => {
        const csv = "Fecha;Proveedor;Total;Base;IVA\n" + db.albaranes.map(a => `${a.date};${a.prov};${a.total};${(a.base||0).toFixed(2)};${(a.taxes||0).toFixed(2)}`).join('\n');
        const link = document.createElement('a'); link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'Albaranes.csv'; link.click();
    };

    container.querySelector("#searchBox").oninput = pintarLista;
    pintarLista();
}
