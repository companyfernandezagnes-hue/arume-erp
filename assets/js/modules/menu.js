/* =============================================================
   🍽️ MÓDULO: MENU INTELLIGENCE v8.0 (Sin Errores de Carga)
   ============================================================= */
// 🚫 NO HAY IMPORTS AQUÍ ARRIBA. USAMOS window.XLSX DEL INDEX.HTML

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

    // Helpers
    const parse = (v) => window.Num ? window.Num.parse(v) : (parseFloat(v)||0);
    const fmt = (v) => window.Num ? window.Num.fmt(v) : (v||0).toFixed(2)+'€';
    const normalize = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // --- 2. CEREBRO MATEMÁTICO ---
    const calcularMatriz = () => {
        const result = { stars:[], horses:[], puzzles:[], dogs:[], tips:[], totalTeorico:0, totalCajaReal: 0 };
        
        // Si no hay platos, devolvemos estructura vacía para no romper la UI
        if (db.platos.length === 0) return result;

        const checkDate = (dateStr) => {
            if(!dateStr) return false;
            if(filterMode === 'day') return dateStr === filterValue;
            if(filterMode === 'month') return dateStr.startsWith(filterValue);
            if(filterMode === 'year') return dateStr.startsWith(filterValue);
            return false;
        };

        // A. Caja Real
        const ventasFiltradas = db.ventas_menu.filter(v => checkDate(v.date));
        result.totalCajaReal = db.cierres
            .filter(c => checkDate(c.date))
            .reduce((acc, c) => acc + parse(c.totalVenta), 0);

        // B. Ventas Platos
        const ventasPorPlato = {};
        ventasFiltradas.forEach(v => {
            ventasPorPlato[v.id] = (ventasPorPlato[v.id] || 0) + parse(v.qty);
        });

        let totalQty = 0;
        let sumMargenPonderado = 0;
        
        // C. Análisis
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

        // D. Clasificación
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

                // Coach
                if (esPop && !esRent && p.qty > 5) result.tips.push(`🐴 <b>${p.name}</b>: Vende mucho, poco margen. Sube precio.`);
                if (!esPop && !esRent && p.qty === 0) result.tips.push(`🧟 <b>${p.name}</b>: 0 ventas. ¿Eliminar?`);
                if (!esPop && esRent && p.qty > 0) result.tips.push(`💎 <b>${p.name}</b>: Muy rentable. ¡Poténcialo!`);
            });
        }
        return result;
    };

    // --- 3. RENDER UI ---
    const draw = () => {
        const data = calcularMatriz();
        const diff = data.totalTeorico - data.totalCajaReal;
        
        let auditColor = 'slate', auditMsg = "Sin cierres de caja";
        if (data.totalCajaReal > 0) {
            const pct = (Math.abs(diff) / data.totalCajaReal) * 100;
            if (pct < 1) { auditColor = 'emerald'; auditMsg = "✅ Cuadre Perfecto"; }
            else if (pct < 5) { auditColor = 'amber'; auditMsg = `⚠️ Desviación: ${fmt(diff)}`; }
            else { auditColor = 'rose'; auditMsg = `🚨 DESCUADRE: ${fmt(diff)}`; }
        }

        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-24">
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-black text-slate-800">Menu Intelligence</h2>
                        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">v8.0 - Master Edition</p>
                    </div>
                    <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                        <select id="filterType" class="bg-white text-xs font-bold py-2 px-3 rounded-xl border-0 outline-none shadow-sm cursor-pointer">
                            <option value="day" ${filterMode==='day'?'selected':''}>Día</option>
                            <option value="month" ${filterMode==='month'?'selected':''}>Mes</option>
                            <option value="year" ${filterMode==='year'?'selected':''}>Año</option>
                        </select>
                        <input type="${filterMode==='year'?'number':(filterMode==='month'?'month':'date')}" id="filterInput" value="${filterValue}" class="flex-1 bg-transparent font-black text-slate-700 text-sm outline-none text-center">
                    </div>
                </div>
                <div class="bg-${auditColor}-50 border border-${auditColor}-200 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <p class="text-[10px] font-bold text-${auditColor}-700 uppercase">🔎 AUDITORÍA</p>
                        <p class="text-xs font-black text-${auditColor}-900 mt-1">${auditMsg}</p>
                    </div>
                    <div class="text-right flex gap-6">
                        <div><p class="text-[8px] uppercase font-bold text-slate-400">Platos</p><p class="text-sm font-black text-${auditColor}-800">${fmt(data.totalTeorico)}</p></div>
                        <div><p class="text-[8px] uppercase font-bold text-slate-400">Caja</p><p class="text-sm font-black text-${auditColor}-800">${fmt(data.totalCajaReal)}</p></div>
                    </div>
                </div>
            </header>

            <div class="flex flex-wrap gap-2 overflow-x-auto no-scrollbar pb-2">
                <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black cursor-pointer shadow-lg flex items-center gap-2 whitespace-nowrap">
                    <span>🔄</span> SUBIR EXCEL / TPV <input type="file" id="universalInput" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
                <button id="btnPaste" class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg flex items-center gap-2 whitespace-nowrap"><span>📋</span> PEGAR TABLA</button>
                <button id="btnPulse" class="bg-emerald-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg flex items-center gap-2">🔥 PULSO</button>
                <button id="btnAddPlato" class="bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-[10px] font-black shadow-sm">+ PLATO</button>
            </div>

            ${data.tips.length > 0 ? `<div class="bg-amber-50 p-5 rounded-[2rem] border border-amber-100 shadow-sm"><h3 class="text-[10px] font-black text-amber-600 uppercase mb-2 flex items-center gap-2"><span>🤖</span> AI Menu Coach</h3><ul class="space-y-1.5">${data.tips.slice(0, 3).map(t => `<li class="text-[10px] text-amber-800 flex gap-2"><span>👉</span> <span>${t}</span></li>`).join('')}</ul></div>` : ''}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderQuad('⭐ Estrellas', 'Alta Venta / Alto Margen', 'emerald', data.stars)}
                ${renderQuad('🐴 Caballos', 'Alta Venta / Bajo Margen', 'amber', data.horses)}
                ${renderQuad('❓ Puzzles', 'Baja Venta / Alto Margen', 'indigo', data.puzzles)}
                ${renderQuad('🐶 Perros', 'Baja Venta / Bajo Margen', 'rose', data.dogs)}
            </div>
        </div>
        
        <div id="modalPlato" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"></div>
        <div id="modalPulse" class="hidden fixed inset-0 bg-indigo-900/90 backdrop-blur-md z-[9999] flex justify-center items-center p-4"></div>
        `;

        // Listeners
        container.querySelector("#filterType").onchange = (e) => { filterMode = e.target.value; const now = new Date(); filterValue = filterMode==='day'?now.toISOString().split('T')[0]:(filterMode==='month'?now.toISOString().slice(0,7):now.getFullYear().toString()); draw(); };
        container.querySelector("#filterInput").onchange = (e) => { filterValue = e.target.value; draw(); };
        container.querySelector("#btnPulse").onclick = abrirModalPulse;
        container.querySelector("#btnAddPlato").onclick = () => window.editarPlato();
        container.querySelector("#universalInput").onchange = handleImportFile;
        container.querySelector("#btnPaste").onclick = handlePaste;
    };

    const renderQuad = (title, subtitle, color, list) => `
        <div class="bg-white p-5 rounded-[2.5rem] border-2 border-${color}-100 shadow-sm h-72 flex flex-col group hover:shadow-md transition">
            <div class="flex justify-between items-start mb-3">
                <div><h3 class="text-sm font-black text-${color}-600 uppercase leading-none">${title}</h3><p class="text-[9px] text-slate-400">${subtitle}</p></div>
                <span class="bg-${color}-50 text-${color}-700 text-[10px] font-black px-2 py-1 rounded-lg">${list.length}</span>
            </div>
            <div class="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
                ${list.map(p => `<div onclick="window.editarPlato('${p.id}')" class="flex justify-between items-center p-2.5 bg-${color}-50/30 rounded-xl cursor-pointer hover:bg-${color}-50 border border-transparent hover:border-${color}-100"><div><span class="text-xs font-bold text-slate-700 block truncate w-32">${p.name}</span><span class="text-[9px] text-slate-400 font-black">${p.qty} uds</span></div><span class="text-[10px] font-black text-${color}-600">+${fmt(p.margenUnitario)}</span></div>`).join('') || '<span class="text-[9px] text-slate-300 italic p-4 text-center block">Vacio</span>'}
            </div>
        </div>`;

    // --- 4. IMPORTADOR UNIVERSAL (Usando window.XLSX) ---
    const processSalesData = async (rows, source) => {
        const dateInput = prompt(`📅 ¿Fecha de estas ventas? (YYYY-MM-DD):`, new Date().toISOString().split('T')[0]);
        if(!dateInput) return;

        let colName = -1, colQty = -1;
        // Detective de Columnas
        for(let i=0; i<Math.min(rows.length, 20); i++){
            const r = rows[i].map(c => String(c).toLowerCase());
            if(colName === -1) colName = r.findIndex(c => c.match(/articulo|nombre|producto|item|descrip/));
            if(colQty === -1) colQty = r.findIndex(c => c.match(/cantidad|unidades|vendidos|qty|uds/));
        }

        if(colName === -1 || colQty === -1) return alert("⚠️ No encontré columnas 'Artículo' y 'Cantidad'");

        let count = 0;
        const startRow = rows.findIndex(r => r[colName] && String(r[colName]).toLowerCase().match(/articulo|nombre|producto/)) + 1 || 1;

        rows.slice(startRow).forEach(row => {
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
        await saveFn(`✅ Importadas ${count} líneas de venta.`); draw();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        
        // VERIFICACIÓN DE SEGURIDAD: ¿Está cargada la librería?
        if (!window.XLSX) return alert("⚠️ Error: Librería Excel no detectada. Revisa el index.html");

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const wb = window.XLSX.read(new Uint8Array(evt.target.result), {type:'array'});
                const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
                processSalesData(rows, "Excel");
            } catch (err) { alert("Error al leer el archivo Excel."); console.error(err); }
        };
        reader.readAsArrayBuffer(file);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if(text) processSalesData(text.split('\n').map(l => l.split('\t')), "Pegado");
        } catch(e) { alert("Permite el acceso al portapapeles."); }
    };

    // --- 5. PULSO & CRUD ---
    const abrirModalPulse = () => {
        const modal = container.querySelector("#modalPulse");
        modal.classList.remove("hidden");
        const populares = db.platos.map(p => ({...p, total: db.ventas_menu.filter(v=>v.id===p.id).reduce((a,b)=>a+parse(b.qty),0)})).sort((a,b)=>b.total-a.total).slice(0, 10);
        modal.innerHTML = `<div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative"><h3 class="text-xl font-black text-indigo-900 mb-2">🔥 Pulso Rápido</h3><div class="space-y-3 mb-6 max-h-80 overflow-y-auto custom-scrollbar px-1">${populares.map(p => `<div class="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition"><span class="font-bold text-slate-700 text-xs w-32 truncate">${p.name}</span><div class="flex items-center gap-2"><button class="w-6 h-6 bg-slate-100 rounded text-slate-500 font-bold" onclick="this.nextElementSibling.value = Math.max(0, parseInt(this.nextElementSibling.value||0)-1)">-</button><input type="number" class="pulse-qty w-10 p-1 bg-white border border-indigo-100 rounded-lg text-center font-black text-indigo-600 text-sm outline-none" placeholder="0" data-id="${p.id}"><button class="w-6 h-6 bg-indigo-100 rounded text-indigo-600 font-bold" onclick="this.previousElementSibling.value = parseInt(this.previousElementSibling.value||0)+1">+</button></div></div>`).join('')}</div><button id="btnSavePulse" class="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-lg">GUARDAR</button><button onclick="document.getElementById('modalPulse').classList.add('hidden')" class="w-full text-slate-400 text-xs font-bold mt-4">Cancelar</button></div>`;
        modal.querySelector("#btnSavePulse").onclick = async () => {
            const today = new Date().toISOString().split('T')[0];
            modal.querySelectorAll('.pulse-qty').forEach(inp => { const val = parse(inp.value); if(val > 0) db.ventas_menu.push({ date: today, id: inp.dataset.id, qty: val }); });
            await saveFn("Pulso guardado"); modal.classList.add("hidden"); draw();
        };
    };

    window.editarPlato = (id = null) => {
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', category: 'General' };
        const modal = container.querySelector("#modalPlato");
        modal.classList.remove("hidden");
        modal.innerHTML = `<div class="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-xs animate-slide-up relative"><h3 class="font-black text-slate-800 text-lg mb-4">${id?'Editar':'Nuevo'} Plato</h3><div class="space-y-3"><input id="p-name" value="${p.name}" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none" placeholder="Nombre"><div class="grid grid-cols-2 gap-2"><input id="p-price" type="number" value="${p.price}" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-black text-indigo-600 border-0 outline-none" placeholder="PVP"><input id="p-cost" type="number" value="${p.cost}" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-black text-rose-500 border-0 outline-none" placeholder="Coste"></div><select id="p-cat" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-0 outline-none">${['Entrantes','Principal','Postre','Bebidas','General'].map(c => `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`).join('')}</select><button id="btnSaveP" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl">GUARDAR</button><button onclick="document.getElementById('modalPlato').classList.add('hidden')" class="w-full text-xs font-bold text-slate-400 mt-2">Cerrar</button>${id ? `<button id="btnDelP" class="w-full text-rose-400 font-bold text-xs mt-2 hover:text-rose-600">Eliminar</button>` : ''}</div></div>`;
        modal.querySelector("#btnSaveP").onclick = async () => {
            p.name = modal.querySelector("#p-name").value; p.price = parse(modal.querySelector("#p-price").value); p.cost = parse(modal.querySelector("#p-cost").value); p.category = modal.querySelector("#p-cat").value;
            if(!id) db.platos.push(p); await saveFn("Plato guardado"); modal.classList.add("hidden"); draw();
        };
        if(id) modal.querySelector("#btnDelP").onclick = async () => { if(confirm("¿Borrar?")) { db.platos = db.platos.filter(x => x.id !== id); await saveFn("Borrado"); modal.classList.add("hidden"); draw(); } };
    };

    draw();
}
