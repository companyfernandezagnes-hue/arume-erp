/* =============================================================
   🚚 MÓDULO: ALBARANES MAESTRO PRO (VERSIÓN BLINDADA & LIMPIA)
   ============================================================= */

import Tesseract from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    if (!Array.isArray(db.albaranes)) db.albaranes = [];
    const listaSocios = db.listaSocios || ['Jeronimo','Pedro','Pau','Agnes'];
    let filtroOwner = 'Todos'; 

    const runOCR = async (file) => {
        const worker = await Tesseract.createWorker('spa');
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        return text;
    };

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Escáner Multi-IVA</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Digitalización & Auditoría</p>
            </div>
            <div class="flex gap-2 items-center flex-wrap justify-center">
                <label class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-indigo-700 transition cursor-pointer shadow-lg flex items-center gap-2">
                    <span>📷</span> ESCANEAR TICKET
                    <input type="file" id="ocrInput" class="hidden" accept="image/*" capture="environment">
                </label>
                <button id="btnExport" class="bg-slate-800 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-md transition">⬇️ CSV</button>
            </div>
        </header>

        <div class="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
            <span class="text-[10px] font-black text-slate-400 uppercase">Total Soportado</span>
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
                    <input id="searchBox" type="text" placeholder="Buscar proveedor..." class="bg-transparent text-sm font-bold outline-none w-full text-slate-600">
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
    <div id="modalDetalle" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4"></div>
    `;

    const inText = container.querySelector("#inText");
    const livePreview = container.querySelector("#livePreview");
    const liveTotal = container.querySelector("#liveTotal");
    const taxSummary = container.querySelector("#taxSummary");
    const inProv = container.querySelector("#inProv");
    const inDate = container.querySelector("#inDate");
    const ocrOverlay = container.querySelector("#ocrLoadingOverlay");

    // Lógica OCR
    container.querySelector("#ocrInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        ocrOverlay.classList.remove("hidden");
        try {
            const text = await runOCR(file);
            const prices = [...text.matchAll(/(\d+[.,]\d{2})/g)].map(m => parseFloat(m[1].replace(',','.')));
            const total = prices.length > 0 ? Math.max(...prices) : 0;
            if(total > 0) {
                inText.value = `Compra Escaneada ${total.toFixed(2)}`;
                inText.dispatchEvent(new Event('input'));
            }
        } catch (err) { console.error(err); }
        finally { ocrOverlay.classList.add("hidden"); e.target.value = ''; }
    };

    const analizarTexto = (texto) => {
        return texto.split('\n').filter(l => l.trim()).map(line => {
            let clean = line.trim();
            let rate = 10;
            const taxMatch = clean.match(/\s(4|10|21)%?$/);
            if (taxMatch) {
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
                const taxLine = totalLine - baseLine;
                return { q: qty, n: rest || "Varios", p: priceVal, rate, t: totalLine, base: baseLine, tax: taxLine };
            }
            return null;
        }).filter(Boolean);
    };

    inText.addEventListener('input', () => {
        const items = analizarTexto(inText.value);
        const taxes = { 4: {b:0, i:0}, 10: {b:0, i:0}, 21: {b:0, i:0} };
        let grandTotal = 0;
        
        items.forEach(it => {
            if(!taxes[it.rate]) taxes[it.rate] = {b:0, i:0};
            taxes[it.rate].b += it.base;
            taxes[it.rate].i += it.tax;
            grandTotal += it.t;
        });

        livePreview.innerHTML = items.map(it => `
            <div class="flex justify-between items-center text-[10px] py-1 border-b border-slate-200 last:border-0">
                <span><b>${it.q}x</b> ${it.n} <small class="text-indigo-400 font-bold">(${it.rate}%)</small></span>
                <span class="font-black text-slate-900">${it.t.toFixed(2)}€</span>
            </div>
        `).join('') || '<p class="text-[10px] text-slate-300 text-center italic py-2">Escribe líneas...</p>';

        taxSummary.innerHTML = Object.keys(taxes).map(r => {
            if(taxes[r].b === 0) return '';
            return `
                <div class="flex justify-between text-[10px] text-slate-400">
                    <span class="font-bold">IVA ${r}%</span>
                    <span>Base: ${taxes[r].b.toFixed(2)}€</span>
                    <span class="text-emerald-400 font-black">+${taxes[r].i.toFixed(2)}€</span>
                </div>`;
        }).join('');
        
        liveTotal.innerText = grandTotal.toFixed(2) + "€";
    });

    container.querySelector("#btnProcesar").onclick = async () => {
        const items = analizarTexto(inText.value);
        const total = parseFloat(liveTotal.innerText);
        if(total <= 0) return alert("Introduce datos");

        const nuevo = {
            id: Date.now().toString(),
            prov: container.querySelector("#inProv").value || "Varios",
            num: container.querySelector("#inRef").value || "S/N",
            date: container.querySelector("#inDate").value,
            socio: container.querySelector("#inSocio").value,
            items: items,
            total: total,
            // Calculamos el total de impuestos sumando todas las líneas
            taxes: items.reduce((acc, it) => acc + it.tax, 0),
            // Calculamos la base total
            base: items.reduce((acc, it) => acc + it.base, 0),
            invoiced: false,
            paid: container.querySelector("#inPaid").checked,
            notes: container.querySelector("#inNotes").value
        };

        db.albaranes.push(nuevo);
        await saveFn("Gasto guardado ✅");
        inText.value = ""; inProv.value = ""; inText.dispatchEvent(new Event('input'));
        pintarLista();
    };

    window.editarAlbaran = (id) => {
        const a = db.albaranes.find(x => x.id === id);
        if(!a) return;
        const modal = container.querySelector("#modalDetalle");
        modal.classList.remove("hidden");

        // Calculamos visualización segura
        const baseMostrar = a.base ? a.base : (a.total / 1.10);
        const ivaMostrar = a.taxes ? a.taxes : (a.total - baseMostrar);

        let productosHTML = '';
        if (Array.isArray(a.items) && a.items.length > 0) {
            productosHTML = `
                <div class="mt-4 border-t border-slate-100 pt-4">
                    <p class="text-[10px] font-black text-indigo-500 uppercase mb-2">Desglose Detallado:</p>
                    <div class="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar bg-slate-50 p-2 rounded-2xl">
                        ${a.items.map(it => `
                            <div class="flex justify-between items-center text-[11px] py-1 border-b border-white last:border-0">
                                <span><b class="text-slate-600">${it.q}x</b> ${it.n}</span>
                                <div class="flex gap-2">
                                    <span class="text-[9px] text-slate-400 mt-0.5">${it.rate}% IVA</span>
                                    <span class="font-black text-slate-900">${(it.t || 0).toFixed(2)}€</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            productosHTML = `<p class="text-[10px] text-slate-400 italic mt-4 text-center">Sin desglose de productos</p>`;
        }

        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <button onclick="document.getElementById('modalDetalle').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-2xl">✕</button>
                <h3 class="text-2xl font-black text-slate-800 mb-6">Detalle Albarán</h3>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <input id="ed-prov" type="text" value="${a.prov}" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-100">
                    <input id="ed-date" type="date" value="${a.date}" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-100">
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <p class="text-[9px] font-bold text-slate-400 uppercase">Base</p>
                        <p class="text-lg font-black text-slate-700">${parseFloat(baseMostrar).toFixed(2)}€</p>
                    </div>
                    <div class="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                        <p class="text-[9px] font-bold text-emerald-600 uppercase">IVA</p>
                        <p class="text-lg font-black text-emerald-600">+${parseFloat(ivaMostrar).toFixed(2)}€</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <input id="ed-total" type="number" value="${a.total}" class="p-3 bg-slate-900 text-white rounded-xl font-black text-lg">
                    <select id="ed-socio" class="p-3 bg-slate-50 rounded-xl font-bold border border-slate-100">
                        <option value="Arume" ${a.socio==='Arume'?'selected':''}>Arume</option>
                        ${listaSocios.map(s => `<option value="${s}" ${a.socio===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                </div>

                ${productosHTML}

                <div class="flex items-center gap-3 mt-6 mb-6">
                    <input type="checkbox" id="ed-paid" ${a.paid ? 'checked' : ''} class="w-5 h-5 accent-emerald-500">
                    <label class="text-sm font-bold text-slate-700">Gasto Pagado</label>
                </div>

                <button id="btnSaveEd" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition">GUARDAR CAMBIOS</button>
                <button onclick="window.borrarAlbaran('${a.id}')" class="w-full text-rose-500 text-[10px] font-black mt-4 uppercase tracking-widest">Eliminar Registro</button>
            </div>
        `;

        modal.querySelector("#btnSaveEd").onclick = async () => {
            a.prov = modal.querySelector("#ed-prov").value;
            a.date = modal.querySelector("#ed-date").value;
            const nuevoTotal = parseFloat(modal.querySelector("#ed-total").value);
            
            // Si el total cambia manualmente, recalculamos proporcionalmente (asumiendo 10% por defecto para no romper)
            if (nuevoTotal !== a.total) {
                a.total = nuevoTotal;
                a.base = nuevoTotal / 1.10;
                a.taxes = nuevoTotal - a.base;
            }
            
            a.socio = modal.querySelector("#ed-socio").value;
            a.paid = modal.querySelector("#ed-paid").checked;
            await saveFn("Albarán actualizado ✅");
            modal.classList.add("hidden");
            pintarLista();
        };
    };

    const pintarLista = () => {
        const term = container.querySelector("#searchBox").value.toLowerCase();
        const totalGlobal = db.albaranes.reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);
        container.querySelector("#total-global-kpi").innerText = totalGlobal.toLocaleString('es-ES', {minimumFractionDigits:2}) + "€";
        
        const filtered = db.albaranes.filter(a => {
            const esSocio = a.socio && a.socio !== 'Arume';
            if (filtroOwner === 'Arume' && esSocio) return false;
            if (filtroOwner === 'Socios' && !esSocio) return false;
            return (a.prov||'').toLowerCase().includes(term);
        }).sort((a,b) => new Date(b.date) - new Date(a.date));

        container.querySelector("#listaAlbaranes").innerHTML = filtered.map(a => `
            <div onclick="window.editarAlbaran('${a.id}')" class="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm hover:bg-slate-50 transition cursor-pointer">
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
    };

    window.borrarAlbaran = async (id) => {
        if(!confirm("¿Borrar definitivamente?")) return;
        db.albaranes = db.albaranes.filter(x => x.id !== id);
        await saveFn("Borrado");
        container.querySelector("#modalDetalle").classList.add("hidden");
        pintarLista();
    };

    container.querySelectorAll(".filter-btn").forEach(btn => {
        btn.onclick = () => {
            filtroOwner = btn.dataset.filter;
            container.querySelectorAll(".filter-btn").forEach(b => { b.classList.remove('bg-slate-900','text-white'); b.classList.add('bg-slate-100','text-slate-400'); });
            btn.classList.add('bg-slate-900','text-white');
            pintarLista();
        };
    });

    // Importar CSV
    container.querySelector("#csvInput").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const rows = evt.target.result.split('\n').slice(1);
            let count = 0;
            rows.forEach(row => {
                const c = row.split(';');
                if(c.length >= 4) {
                    const total = parseFloat(c[3]) || 0;
                    db.albaranes.push({ 
                        id: Date.now()+Math.random(), 
                        date: c[0], prov: c[1], num: c[2], 
                        total: total, base: total/1.10, taxes: total - (total/1.10),
                        items: [], invoiced: false, paid: true 
                    });
                    count++;
                }
            });
            await saveFn(`Importados ${count}`);
            pintarLista();
        };
        reader.readAsText(file);
    };

    // Exportar CSV
    container.querySelector("#btnExport").onclick = () => {
        const csv = "Fecha;Proveedor;Ref;Total;Base;IVA\n" + db.albaranes.map(a => `${a.date};${a.prov};${a.num};${a.total};${(a.base||0).toFixed(2)};${(a.taxes||0).toFixed(2)}`).join('\n');
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'Albaranes_Arume.csv';
        link.click();
    };

    container.querySelector("#searchBox").oninput = pintarLista;
    pintarLista();
}
