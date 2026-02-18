/* =============================================================
   🍽️ MÓDULO: MENU INTELLIGENCE PRO v6.0 (Auditoría de Cuadre)
   ============================================================= */
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

export async function render(container, sb, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // --- 1. INICIALIZACIÓN Y SEGURIDAD ---
    if (!Array.isArray(db.platos)) db.platos = [];
    if (!Array.isArray(db.ventas_menu)) db.ventas_menu = [];
    if (!Array.isArray(db.cierres)) db.cierres = [];

    // AUTO-MIGRACIÓN
    db.platos.forEach(p => {
        if(p.sold > 0) {
            const hasHistory = db.ventas_menu.some(v => v.id === p.id);
            if(!hasHistory) {
                db.ventas_menu.push({
                    date: new Date().toISOString().split('T')[0],
                    id: p.id,
                    qty: parseFloat(p.sold)
                });
            }
            p.sold = 0; 
        }
    });

    let filterMode = 'month'; 
    let filterValue = new Date().toISOString().slice(0, 7);

    const parse = (v) => window.Num ? window.Num.parse(v) : (parseFloat(v)||0);
    const fmt = (v) => window.Num ? window.Num.fmt(v) : (v||0).toFixed(2)+'€';
    const normalize = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // --- 2. CEREBRO MATEMÁTICO ---
    const calcularMatriz = () => {
        const result = { stars:[], horses:[], puzzles:[], dogs:[], tips:[], totalTeorico:0, totalCajaReal: 0 };
        if (db.platos.length === 0) return result;

        const checkDate = (dateStr) => {
            if(!dateStr) return false;
            if(filterMode === 'day') return dateStr === filterValue;
            if(filterMode === 'month') return dateStr.startsWith(filterValue);
            if(filterMode === 'year') return dateStr.startsWith(filterValue);
            return false;
        };

        const ventasFiltradas = db.ventas_menu.filter(v => checkDate(v.date));
        result.totalCajaReal = db.cierres.filter(c => checkDate(c.date)).reduce((acc, c) => acc + parse(c.totalVenta), 0);

        const ventasPorPlato = {};
        ventasFiltradas.forEach(v => { ventasPorPlato[v.id] = (ventasPorPlato[v.id] || 0) + parse(v.qty); });

        let totalQty = 0;
        let sumMargenPonderado = 0;
        
        const analisis = db.platos.map(p => {
            const precio = parse(p.price);
            const coste = parse(p.cost) || (precio * 0.30); 
            const margenUnitario = precio - coste;
            const qty = ventasPorPlato[p.id] || 0;
            totalQty += qty;
            sumMargenPonderado += (margenUnitario * qty);
            result.totalTeorico += (precio * qty);
            return { ...p, qty, margenUnitario };
        });

        if (totalQty > 0) {
            const mediaPop = (100 / (db.platos.length || 1)) * 0.7; 
            const mediaMargen = sumMargenPonderado / totalQty; 

            analisis.forEach(p => {
                const mix = (p.qty / totalQty) * 100;
                const esPop = mix >= mediaPop;
                const esRent = p.margenUnitario >= mediaMargen;
                if (esPop && esRent) result.stars.push(p);
                else if (esPop && !esRent) result.horses.push(p);
                else if (!esPop && esRent) result.puzzles.push(p);
                else result.dogs.push(p);
            });
        }
        return result;
    };

    // --- 3. RENDERIZADO UI ---
    const draw = () => {
        const data = calcularMatriz();
        const diff = data.totalTeorico - data.totalCajaReal;
        const diffAbs = Math.abs(diff);
        let auditStatus = 'neutral';
        let auditMsg = "Sin cierres de caja en este periodo";

        if (data.totalCajaReal > 0) {
            const pct = (diffAbs / data.totalCajaReal) * 100;
            if (pct < 1) { auditStatus = 'ok'; auditMsg = "Cuadre Perfecto"; }
            else if (pct < 5) { auditStatus = 'warn'; auditMsg = `Desviación: ${fmt(diff)}`; }
            else { auditStatus = 'danger'; auditMsg = `⚠️ Descuadre serio: ${fmt(diff)}`; }
        }

        const auditColor = { ok: 'emerald', warn: 'amber', danger: 'rose', neutral: 'slate' }[auditStatus];

        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-black text-slate-800">Menu Intelligence</h2>
                        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Matriz & Auditoría</p>
                    </div>
                    <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                        <select id="filterType" class="bg-white text-xs font-bold py-2 px-3 rounded-xl border-0 outline-none shadow-sm cursor-pointer">
                            <option value="day" ${filterMode==='day'?'selected':''}>Día</option>
                            <option value="month" ${filterMode==='month'?'selected':''}>Mes</option>
                            <option value="year" ${filterMode==='year'?'selected':''}>Año</option>
                        </select>
                        <input type="${filterMode==='year'?'number':(filterMode==='month'?'month':'date')}" 
                               id="filterInput" value="${filterValue}" 
                               class="flex-1 bg-transparent font-black text-slate-700 text-sm outline-none text-center">
                    </div>
                </div>
                <div class="bg-${auditColor}-50 border border-${auditColor}-200 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <p class="text-[10px] font-bold text-${auditColor}-700 uppercase">🔎 Auditoría de Cuadre</p>
                        <p class="text-xs font-bold text-${auditColor}-900 mt-1">${auditMsg}</p>
                    </div>
                    <div class="text-right flex gap-4">
                        <div><p class="text-[8px] uppercase">Platos</p><p class="text-sm font-black">${fmt(data.totalTeorico)}</p></div>
                        <div><p class="text-[8px] uppercase">Caja</p><p class="text-sm font-black">${fmt(data.totalCajaReal)}</p></div>
                    </div>
                </div>
            </header>

            <div class="flex flex-wrap gap-2">
                <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black cursor-pointer shadow-lg flex items-center gap-2">
                    <span>🔄</span> SUBIR EXCEL <input type="file" id="universalInput" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
                <button id="btnPaste" class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg">📋 PEGAR TABLA</button>
                <button id="btnAddPlato" class="bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-[10px] font-black">+ PLATO</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderQuad('⭐ Estrellas', 'emerald', data.stars)}
                ${renderQuad('🐴 Caballos', 'amber', data.horses)}
                ${renderQuad('❓ Puzzles', 'indigo', data.puzzles)}
                ${renderQuad('🐶 Perros', 'rose', data.dogs)}
            </div>
        </div>
        <div id="modalPlato" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"></div>
        `;

        container.querySelector("#filterType").onchange = (e) => {
            filterMode = e.target.value;
            const now = new Date();
            if(filterMode === 'day') filterValue = now.toISOString().split('T')[0];
            if(filterMode === 'month') filterValue = now.toISOString().slice(0, 7);
            if(filterMode === 'year') filterValue = now.getFullYear().toString();
            draw();
        };
        container.querySelector("#filterInput").onchange = (e) => { filterValue = e.target.value; draw(); };
        container.querySelector("#btnAddPlato").onclick = () => abrirModalEdicion();
        container.querySelector("#universalInput").onchange = handleImportFile;
        container.querySelector("#btnPaste").onclick = handlePaste;
    };

    const renderQuad = (title, color, list) => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-${color}-100 shadow-sm h-64 flex flex-col">
            <h3 class="text-sm font-black text-${color}-600 uppercase mb-3">${title} (${list.length})</h3>
            <div class="space-y-1 overflow-y-auto flex-1 pr-1">
                ${list.map(p => `
                    <div onclick="window.editarPlato('${p.id}')" class="flex justify-between items-center p-2 bg-${color}-50/30 rounded-xl cursor-pointer hover:bg-${color}-50">
                        <span class="text-xs font-bold text-slate-700 truncate w-32">${p.name}</span>
                        <span class="text-[10px] font-black text-${color}-600">${p.qty} uds</span>
                    </div>
                `).join('') || '<span class="text-[9px] text-slate-300 italic">Vacio</span>'}
            </div>
        </div>`;

    const processSalesData = async (rows, sourceName) => {
        const dateInput = prompt(`¿Fecha de estas ventas? (YYYY-MM-DD):`, new Date().toISOString().split('T')[0]);
        if(!dateInput) return;
        let colName = -1, colQty = -1;
        for(let i=0; i<Math.min(rows.length, 10); i++){
            const row = rows[i].map(c => String(c).toLowerCase());
            if(colName === -1) colName = row.findIndex(c => c.match(/articulo|nombre|producto|item|descrip/));
            if(colQty === -1) colQty = row.findIndex(c => c.match(/cantidad|unidades|vendidos|qty|uds/));
        }
        if(colName === -1 || colQty === -1) return alert("No detecto columnas 'Articulo' y 'Cantidad'");

        rows.slice(1).forEach(row => {
            const name = String(row[colName] || '').trim();
            const sold = parse(row[colQty]);
            if(name && sold > 0) {
                let plato = db.platos.find(p => normalize(p.name) === normalize(name));
                if(!plato) {
                    plato = { id: 'p-'+Date.now()+Math.random(), name: name, category: 'General', price: 0, cost: 0 };
                    db.platos.push(plato);
                }
                const existing = db.ventas_menu.find(v => v.date === dateInput && v.id === plato.id);
                if(existing) existing.qty += sold; else db.ventas_menu.push({ date: dateInput, id: plato.id, qty: sold });
            }
        });
        await saveFn("Ventas importadas"); draw();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'});
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
            processSalesData(rows, "Excel");
        };
        reader.readAsArrayBuffer(file);
    };

    const handlePaste = async () => {
        const text = await navigator.clipboard.readText();
        if(text) processSalesData(text.split('\n').map(l => l.split('\t')), "Pegado");
    };

    window.editarPlato = (id = null) => {
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', category: 'Principal' };
        const modal = container.querySelector("#modalPlato");
        modal.classList.remove("hidden");
        modal.innerHTML = `<div class="bg-white p-8 rounded-[2rem] shadow-2xl w-80">
            <h3 class="font-black mb-4">Editar Plato</h3>
            <input id="p-name" value="${p.name}" class="w-full p-2 mb-2 border rounded" placeholder="Nombre">
            <input id="p-price" type="number" value="${p.price}" class="w-full p-2 mb-4 border rounded" placeholder="Precio">
            <button id="btnSaveP" class="w-full bg-slate-900 text-white py-2 rounded-xl font-bold">GUARDAR</button>
            <button onclick="this.closest('.fixed').classList.add('hidden')" class="w-full text-xs text-slate-400 mt-2">Cerrar</button>
        </div>`;
        modal.querySelector("#btnSaveP").onclick = async () => {
            p.name = modal.querySelector("#p-name").value;
            p.price = parse(modal.querySelector("#p-price").value);
            if(!id) db.platos.push(p);
            await saveFn("Plato guardado"); modal.classList.add("hidden"); draw();
        };
    };

    draw();
}
