/* =============================================================
   🍽️ MÓDULO: MENU INTELLIGENCE MASTER v6.1 (FULL EDITION)
   ============================================================= */
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

export async function render(container, sb, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // --- 1. INICIALIZACIÓN Y SEGURIDAD ---
    if (!Array.isArray(db.platos)) db.platos = [];
    if (!Array.isArray(db.ventas_menu)) db.ventas_menu = [];
    if (!Array.isArray(db.cierres)) db.cierres = [];

    // MIGRACIÓN DE DATOS ANTIGUOS
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

    // --- 2. CEREBRO MATEMÁTICO (IA + AUDITORÍA) ---
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

        // Ventas e Ingresos Reales
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
            const mediaPop = (100 / db.platos.length) * 0.7; 
            const mediaMargen = sumMargenPonderado / totalQty; 

            analisis.forEach(p => {
                const mix = (p.qty / totalQty) * 100;
                const esPop = mix >= mediaPop;
                const esRent = p.margenUnitario >= mediaMargen;

                if (esPop && esRent) result.stars.push(p);
                else if (esPop && !esRent) result.horses.push(p);
                else if (!esPop && esRent) result.puzzles.push(p);
                else result.dogs.push(p);

                // AI Coach Tips
                if (esPop && !esRent && p.qty > 5) result.tips.push(`🐴 <b>${p.name}</b> vende mucho pero deja poco margen. Súbelo un poco.`);
                if (!esPop && !esRent && p.qty === 0) result.tips.push(`🧟 <b>${p.name}</b> es un plato zombi. Quítalo.`);
            });
        }
        return result;
    };

    // --- 3. RENDERIZADO PRINCIPAL ---
    const draw = () => {
        const data = calcularMatriz();
        const diff = data.totalTeorico - data.totalCajaReal;
        let auditColor = 'slate', auditMsg = "Sin cierres registrados";

        if (data.totalCajaReal > 0) {
            const pct = (Math.abs(diff) / data.totalCajaReal) * 100;
            if (pct < 1) { auditColor = 'emerald'; auditMsg = "Cuadre Perfecto"; }
            else if (pct < 5) { auditColor = 'amber'; auditMsg = `Desviación aceptable (${fmt(diff)})`; }
            else { auditColor = 'rose'; auditMsg = `⚠️ Revisar descuadre: ${fmt(diff)}`; }
        }

        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-black text-slate-800">Menu Intelligence</h2>
                        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">v6.1 - Master de Rentabilidad</p>
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
                        <div><p class="text-[8px] uppercase">Venta Platos</p><p class="text-sm font-black">${fmt(data.totalTeorico)}</p></div>
                        <div><p class="text-[8px] uppercase">Caja Real</p><p class="text-sm font-black">${fmt(data.totalCajaReal)}</p></div>
                    </div>
                </div>
            </header>

            <div class="flex flex-wrap gap-2 overflow-x-auto no-scrollbar pb-2">
                <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black cursor-pointer shadow-lg flex items-center gap-2 whitespace-nowrap">
                    <span>🔄</span> SUBIR EXCEL / TPV <input type="file" id="universalInput" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
                <button id="btnPaste" class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg flex items-center gap-2 whitespace-nowrap">
                    <span>📋</span> PEGAR TABLA
                </button>
                <button id="btnAddPlato" class="bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-[10px] font-black shadow-sm">+ PLATO</button>
            </div>

            ${data.tips.length > 0 ? `
            <div class="bg-amber-50 p-5 rounded-[2rem] border border-amber-100 shadow-sm">
                <h3 class="text-[10px] font-black text-amber-600 uppercase mb-2 flex items-center gap-2"><span>🤖</span> AI Menu Coach</h3>
                <ul class="space-y-1.5">
                    ${data.tips.slice(0, 3).map(t => `<li class="text-[10px] text-amber-800 flex gap-2"><span>👉</span> <span>${t}</span></li>`).join('')}
                </ul>
            </div>` : ''}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderQuad('⭐ Estrellas', 'Alta Venta / Alto Margen', 'emerald', data.stars)}
                ${renderQuad('🐴 Caballos', 'Alta Venta / Bajo Margen', 'amber', data.horses)}
                ${renderQuad('❓ Puzzles', 'Baja Venta / Alto Margen', 'indigo', data.puzzles)}
                ${renderQuad('🐶 Perros', 'Baja Venta / Bajo Margen', 'rose', data.dogs)}
            </div>
        </div>
        <div id="modalPlato" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"></div>
        `;

        // Listeners
        container.querySelector("#filterType").onchange = (e) => {
            filterMode = e.target.value;
            const now = new Date();
            if(filterMode === 'day') filterValue = now.toISOString().split('T')[0];
            if(filterMode === 'month') filterValue = now.toISOString().slice(0, 7);
            if(filterMode === 'year') filterValue = now.getFullYear().toString();
            draw();
        };
        container.querySelector("#filterInput").onchange = (e) => { filterValue = e.target.value; draw(); };
        container.querySelector("#btnAddPlato").onclick = () => window.editarPlato();
        container.querySelector("#universalInput").onchange = handleImportFile;
        container.querySelector("#btnPaste").onclick = handlePaste;
    };

    const renderQuad = (title, subtitle, color, list) => `
        <div class="bg-white p-5 rounded-[2.5rem] border-2 border-${color}-100 shadow-sm h-72 flex flex-col group hover:shadow-md transition">
            <h3 class="text-sm font-black text-${color}-600 uppercase leading-none">${title}</h3>
            <p class="text-[9px] text-slate-400 mb-3">${subtitle}</p>
            <div class="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
                ${list.map(p => `
                    <div onclick="window.editarPlato('${p.id}')" class="flex justify-between items-center p-2.5 bg-${color}-50/30 rounded-xl cursor-pointer hover:bg-${color}-50 border border-transparent hover:border-${color}-100">
                        <div>
                            <span class="text-xs font-bold text-slate-700 block truncate w-32">${p.name}</span>
                            <span class="text-[9px] text-slate-400 font-black">${p.qty} uds</span>
                        </div>
                        <span class="text-[10px] font-black text-${color}-600">+${fmt(p.margenUnitario)}</span>
                    </div>
                `).join('') || '<span class="text-[9px] text-slate-300 italic p-4 text-center block">Vacío</span>'}
            </div>
        </div>`;

    // --- PROCESADORES DE DATOS ---
    const processSalesData = async (rows, source) => {
        const dateInput = prompt(`Fecha de referencia (${source}):`, new Date().toISOString().split('T')[0]);
        if(!dateInput) return;

        let colName = -1, colQty = -1;
        for(let i=0; i<Math.min(rows.length, 15); i++){
            const r = rows[i].map(c => String(c).toLowerCase());
            if(colName === -1) colName = r.findIndex(c => c.match(/articulo|nombre|producto|item|descrip/));
            if(colQty === -1) colQty = r.findIndex(c => c.match(/cantidad|unidades|vendidos|qty|uds/));
        }

        if(colName === -1 || colQty === -1) return alert("⚠️ No encontré columnas 'Artículo' y 'Cantidad'.");

        let count = 0;
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
                if(existing) existing.qty += sold; 
                else db.ventas_menu.push({ date: dateInput, id: plato.id, qty: sold });
                count++;
            }
        });
        await saveFn(`✅ Importadas ${count} ventas.`); draw();
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
        try {
            const text = await navigator.clipboard.readText();
            if(text) processSalesData(text.split('\n').map(l => l.split('\t')), "Copiado");
        } catch(e) { alert("Permite el portapapeles."); }
    };

    // --- CRUD ---
    window.editarPlato = (id = null) => {
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', category: 'General' };
        const modal = container.querySelector("#modalPlato");
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-xs animate-slide-up relative">
                <h3 class="font-black text-slate-800 text-lg mb-4">${id?'Editar':'Nuevo'} Plato</h3>
                <div class="space-y-3">
                    <input id="p-name" value="${p.name}" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none" placeholder="Nombre">
                    <div class="grid grid-cols-2 gap-2">
                        <input id="p-price" type="number" value="${p.price}" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-black text-indigo-600 border-0 outline-none" placeholder="PVP">
                        <input id="p-cost" type="number" value="${p.cost}" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-black text-rose-500 border-0 outline-none" placeholder="Coste">
                    </div>
                    <select id="p-cat" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-0 outline-none">
                        ${['Entrantes','Principal','Postre','Bebidas','General'].map(c => `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                    <button id="btnSaveP" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl">GUARDAR</button>
                    <button onclick="document.getElementById('modalPlato').classList.add('hidden')" class="w-full text-xs font-bold text-slate-400 mt-2">Cerrar</button>
                </div>
            </div>`;

        modal.querySelector("#btnSaveP").onclick = async () => {
            p.name = modal.querySelector("#p-name").value;
            p.price = parse(modal.querySelector("#p-price").value);
            p.cost = parse(modal.querySelector("#p-cost").value);
            p.category = modal.querySelector("#p-cat").value;
            if(!id) db.platos.push(p);
            await saveFn("Plato guardado"); modal.classList.add("hidden"); draw();
        };
    };

    draw();
}
