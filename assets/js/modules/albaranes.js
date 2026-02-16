/* =============================================================
   🚚 MÓDULO: ALBARANES MAESTRO PRO (Fusión Total: IA + Socios + Auditoría)
   ============================================================= */

// IMPORTACIÓN CORREGIDA PARA TESSERACT.JS v5
import Tesseract from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. PREPARACIÓN DE DATOS
    if (!Array.isArray(db.albaranes)) db.albaranes = [];
    const listaSocios = db.listaSocios || ['Jeronimo','Pedro','Pau','Agnes'];
    let filtroOwner = 'Todos'; 

    // Worker OCR (Singleton corregido para v5)
    let ocrWorker = null;
    const getWorker = async () => {
        if (ocrWorker) return ocrWorker;
        // En v5 createWorker es una función del objeto Tesseract
        ocrWorker = await Tesseract.createWorker('spa');
        return ocrWorker;
    };

    // 2. INTERFAZ COMPLETA (Recuperando tu diseño original al 100%)
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div class="mb-4 md:mb-0">
                <h2 class="text-xl font-black text-slate-800">Escáner Multi-IVA</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Digitalización & Gestión de Socios</p>
            </div>
            
            <div class="flex gap-2 items-center flex-wrap justify-center">
                <label class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-indigo-700 transition cursor-pointer shadow-lg flex items-center gap-2">
                    <span>📷</span> ESCANEAR TICKET
                    <input type="file" id="ocrInput" class="hidden" accept="image/*" capture="environment">
                </label>

                <button id="btnExport" class="bg-slate-800 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-md">⬇️ CSV</button>
                
                <label class="bg-indigo-50 text-indigo-600 px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-indigo-100 transition cursor-pointer border border-indigo-100 flex items-center gap-2">
                    <span>📂</span> IMPORTAR
                    <input type="file" id="csvInput" class="hidden" accept=".csv">
                </label>
            </div>
        </header>

        <div class="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
            <span class="text-[10px] font-black text-slate-400 uppercase">Total Soportado (Histórico)</span>
            <span class="text-xl font-black text-slate-800" id="total-global-kpi">0.00€</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-1 space-y-4">
                <div class="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>

                    <div id="ocrLoadingOverlay" class="hidden absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center text-center p-4">
                        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p class="text-xs font-black text-indigo-600 animate-pulse">ANALIZANDO TICKET...</p>
                    </div>

                    <h3 class="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">⚡ Entrada Rápida</h3>

                    <div class="space-y-3 mb-4">
                        <input id="inProv" type="text" placeholder="Proveedor" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none focus:ring-2 focus:ring-indigo-500 transition">
                        <div class="flex gap-2">
                            <input id="inDate" type="date" value="${new Date().toISOString().split('T')[0]}" class="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none">
                            <input id="inRef" type="text" placeholder="Ref" class="w-1/3 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none">
                        </div>
                        <select id="inSocio" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-0 outline-none">
                            <option value="Arume">Gasto: Restaurante (Arume)</option>
                            ${listaSocios.map(s => `<option value="${s}">Gasto: ${s}</option>`).join('')}
                        </select>
                        <input id="inNotes" type="text" placeholder="📝 Notas..." class="w-full p-3 bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-amber-100 outline-none">
                    </div>

                    <textarea id="inText" placeholder="Ej: 2 Tomates 15.00" class="w-full h-40 bg-slate-50 rounded-2xl p-4 text-xs font-mono border-0 outline-none resize-none mb-3 shadow-inner focus:bg-white transition"></textarea>

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

                    <button id="btnProcesar" class="w-full mt-4 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition">GUARDAR ALBARÁN</button>
                </div>
            </div>

            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white p-2 rounded-full shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center px-4 gap-2">
                    <input id="searchBox" type="text" placeholder="Buscar..." class="bg-transparent text-sm font-bold outline-none w-full text-slate-600">
                    <div class="flex gap-1">
                        <button data-filter="Todos" class="filter-btn px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-900 text-white">Todos</button>
                        <button data-filter="Arume" class="filter-btn px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400">Rest.</button>
                        <button data-filter="Socios" class="filter-btn px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400">Socios</button>
                    </div>
                </div>
                <div id="listaAlbaranes" class="space-y-3 pb-20"></div>
            </div>
        </div>
    </div>
    <div id="modalDetalle" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4"></div>
    `;

    const inText = container.querySelector("#inText");
    const livePreview = container.querySelector("#livePreview");
    const liveTotal = container.querySelector("#liveTotal");
    const taxSummary = container.querySelector("#taxSummary");
    const inProv = container.querySelector("#inProv");
    const inDate = container.querySelector("#inDate");
    const ocrOverlay = container.querySelector("#ocrLoadingOverlay");

    /* =============================================================
       🧠 LÓGICA DE PARSEO Y IA
       ============================================================= */
    const analizarTexto = (texto) => {
        return texto.split('\n').filter(l => l.trim()).map(line => {
            let clean = line.trim();
            let rate = 10;
            const taxMatch = clean.match(/\s(\d{1,2})%?$/);
            if(taxMatch && [0,4,10,21].includes(parseInt(taxMatch[1]))) {
                rate = parseInt(taxMatch[1]);
                clean = clean.substring(0, taxMatch.index).trim();
            }
            const priceMatch = clean.match(/(\d+[\.,]?\d*)\s*€?$/);
            if (priceMatch) {
                const priceVal = parseFloat(priceMatch[1].replace(',', '.'));
                let rest = clean.substring(0, priceMatch.index).trim();
                let qty = 1;
                const qtyMatch = rest.match(/^(\d+[\.,]?\d*)\s+/);
                if (qtyMatch) {
                    qty = parseFloat(qtyMatch[1].replace(',', '.'));
                    rest = rest.substring(qtyMatch[0].length).trim();
                }
                const totalLine = qty * priceVal;
                const baseLine = totalLine / (1 + rate/100);
                return { q: qty, n: rest || "Varios", p: priceVal, rate, t: totalLine, base: baseLine, tax: totalLine - baseLine };
            }
            return null;
        }).filter(Boolean);
    };

    inText.addEventListener('input', () => {
        const items = analizarTexto(inText.value);
        let grandTotal = 0;
        const taxes = { 10: {b:0, i:0}, 21: {b:0, i:0}, 4: {b:0, i:0}, 0: {b:0, i:0} };
        
        items.forEach(it => {
            taxes[it.rate].b += it.base;
            taxes[it.rate].i += it.tax;
            grandTotal += it.t;
        });

        livePreview.innerHTML = items.map(it => `<div class="flex justify-between text-[10px] py-1 border-b border-slate-100"><span><b>${it.q}x</b> ${it.n} <small>(${it.rate}%)</small></span><span class="font-black">${it.t.toFixed(2)}€</span></div>`).join('') || '<p class="text-[10px] text-slate-300 text-center italic py-2">Escribe líneas...</p>';
        taxSummary.innerHTML = Object.keys(taxes).map(r => taxes[r].b > 0 ? `<div class="flex justify-between text-[10px] text-slate-400"><span>IVA ${r}%</span><span>${taxes[r].b.toFixed(2)}€ + ${taxes[r].i.toFixed(2)}€</span></div>` : '').join('');
        liveTotal.innerText = grandTotal.toFixed(2) + "€";
    });

    container.querySelector("#ocrInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        ocrOverlay.classList.remove("hidden");
        try {
            const worker = await getWorker();
            const { data: { text } } = await worker.recognize(file);
            const prices = [...text.matchAll(/(\d+[.,]\d{2})/g)].map(m => parseFloat(m[1].replace(',','.')));
            const total = prices.length > 0 ? Math.max(...prices) : 0;
            if(total > 0) {
                inText.value = `Compra Escaneada ${total.toFixed(2)}`;
                inText.dispatchEvent(new Event('input'));
            }
            container.querySelector("#inNotes").value = "Escaneado OCR";
        } catch (err) { alert("Error OCR"); }
        finally { ocrOverlay.classList.add("hidden"); e.target.value = ''; }
    };

    /* =============================================================
       💾 ACCIONES (GUARDAR, FILTRAR, AUDITAR)
       ============================================================= */
    container.querySelector("#btnProcesar").onclick = async () => {
        const items = analizarTexto(inText.value);
        const total = parseFloat(liveTotal.innerText);
        if(total <= 0) return alert("Introduce datos");

        const nuevo = {
            id: Date.now().toString(),
            prov: inProv.value || "Varios",
            num: container.querySelector("#inRef").value || "S/N",
            date: inDate.value,
            socio: container.querySelector("#inSocio").value,
            items, total,
            taxes: items.reduce((a,b) => a + b.tax, 0),
            notes: container.querySelector("#inNotes").value,
            paid: container.querySelector("#inPaid").checked,
            invoiced: false
        };

        db.albaranes.push(nuevo);
        await saveFn("Gasto guardado ✅");
        inText.value = ""; inProv.value = ""; container.querySelector("#inNotes").value = "";
        inText.dispatchEvent(new Event('input'));
        pintarLista();
    };

    const pintarLista = () => {
        const term = container.querySelector("#searchBox").value.toLowerCase();
        const filtered = db.albaranes.filter(a => {
            const esSocio = a.socio && a.socio !== 'Arume';
            if (filtroOwner === 'Arume' && esSocio) return false;
            if (filtroOwner === 'Socios' && !esSocio) return false;
            return (a.prov||'').toLowerCase().includes(term);
        }).sort((a,b) => new Date(b.date) - new Date(a.date));

        container.querySelector("#listaAlbaranes").innerHTML = filtered.map(a => `
            <div onclick="window.editarAlbaran('${a.id}')" class="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm hover:bg-slate-50 cursor-pointer">
                <div>
                    <div class="flex items-center gap-2">
                        <h4 class="font-black text-slate-800">${a.prov}</h4>
                        <span class="text-[8px] font-bold px-2 py-0.5 rounded ${a.socio === 'Arume' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-600'} uppercase">${a.socio || 'Arume'}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 mt-1">${a.date} · ${a.num}</p>
                </div>
                <div class="text-right">
                    <p class="font-black text-slate-900 text-lg">${parseFloat(a.total).toFixed(2)}€</p>
                    <span class="text-[8px] font-bold ${a.paid ? 'text-emerald-500' : 'text-rose-500'} uppercase">${a.paid ? 'Pagado' : 'Pendiente'}</span>
                </div>
            </div>
        `).join('') || '<p class="text-center text-slate-300 py-10">Sin resultados</p>';
        
        const totalGlobal = db.albaranes.reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);
        container.querySelector("#total-global-kpi").innerText = totalGlobal.toLocaleString('es-ES', {minimumFractionDigits:2}) + "€";
    };

    window.editarAlbaran = (id) => {
        const a = db.albaranes.find(x => x.id === id);
        if(!a) return;
        const modal = container.querySelector("#modalDetalle");
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <button onclick="document.getElementById('modalDetalle').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-2xl">✕</button>
                <h3 class="text-2xl font-black text-slate-800 mb-6">Detalle Albarán</h3>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <input id="ed-prov" type="text" value="${a.prov}" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-200">
                    <input id="ed-date" type="date" value="${a.date}" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-200">
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <input id="ed-total" type="number" value="${a.total}" class="p-3 bg-slate-900 text-white rounded-xl font-black">
                    <select id="ed-socio" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-200">
                        <option value="Arume" ${a.socio==='Arume'?'selected':''}>Arume</option>
                        ${listaSocios.map(s => `<option value="${s}" ${a.socio===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="flex items-center gap-3 mb-6">
                    <input type="checkbox" id="ed-paid" ${a.paid ? 'checked' : ''} class="w-5 h-5 accent-emerald-500">
                    <label class="text-sm font-bold">Marcar como pagado</label>
                </div>
                <button id="btnSaveEd" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">GUARDAR CAMBIOS</button>
                <button onclick="borrarAlbaran('${a.id}')" class="w-full text-rose-500 text-[10px] font-black mt-4 uppercase">Eliminar Registro</button>
            </div>
        `;
        modal.querySelector("#btnSaveEd").onclick = async () => {
            a.prov = modal.querySelector("#ed-prov").value;
            a.date = modal.querySelector("#ed-date").value;
            a.total = parseFloat(modal.querySelector("#ed-total").value);
            a.socio = modal.querySelector("#ed-socio").value;
            a.paid = modal.querySelector("#ed-paid").checked;
            await saveFn("Actualizado");
            modal.classList.add("hidden");
            pintarLista();
        };
    };

    window.borrarAlbaran = async (id) => {
        if(!confirm("¿Eliminar?")) return;
        db.albaranes = db.albaranes.filter(x => x.id !== id);
        await saveFn("Borrado");
        container.querySelector("#modalDetalle").classList.add("hidden");
        pintarLista();
    };

    function getTaxColor(r) { return r == 21 ? "text-rose-500" : (r == 10 ? "text-indigo-500" : "text-slate-400"); }

    container.querySelectorAll(".filter-btn").forEach(btn => {
        btn.onclick = () => {
            filtroOwner = btn.dataset.filter;
            container.querySelectorAll(".filter-btn").forEach(b => {
                b.classList.replace('bg-slate-900','bg-slate-100');
                b.classList.replace('text-white','text-slate-400');
            });
            btn.classList.replace('bg-slate-100','bg-slate-900');
            btn.classList.replace('text-slate-400','text-white');
            pintarLista();
        };
    });

    container.querySelector("#searchBox").oninput = pintarLista;
    pintarLista();
}
