/* =============================================================
   🍽️ MÓDULO: MENU INTELLIGENCE PRO v6.0 (Auditoría de Cuadre)
   ============================================================= */
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

export async function render(container, sb, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // --- 1. INICIALIZACIÓN Y SEGURIDAD ---
    if (!Array.isArray(db.platos)) db.platos = [];
    if (!Array.isArray(db.ventas_menu)) db.ventas_menu = [];
    if (!Array.isArray(db.cierres)) db.cierres = []; // Necesario para la auditoría

    // AUTO-MIGRACIÓN: Recuperar datos antiguos
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

    // Estado Local
    let filterMode = 'month'; 
    let filterValue = new Date().toISOString().slice(0, 7);

    // Helpers
    const parse = (v) => window.Num ? window.Num.parse(v) : (parseFloat(v)||0);
    const fmt = (v) => window.Num ? window.Num.fmt(v) : (v||0).toFixed(2)+'€';
    const normalize = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // --- 2. CEREBRO MATEMÁTICO (BCG + OMNES + AUDITORÍA) ---
    const calcularMatriz = () => {
        const result = { stars:[], horses:[], puzzles:[], dogs:[], tips:[], totalTeorico:0, totalCajaReal: 0 };
        if (db.platos.length === 0) return result;

        // A. Filtrado Temporal (Aplicado a Ventas de Platos Y a Cierres de Caja)
        const checkDate = (dateStr) => {
            if(!dateStr) return false;
            if(filterMode === 'day') return dateStr === filterValue;
            if(filterMode === 'month') return dateStr.startsWith(filterValue);
            if(filterMode === 'year') return dateStr.startsWith(filterValue);
            return false;
        };

        const ventasFiltradas = db.ventas_menu.filter(v => checkDate(v.date));
        
        // B. Calcular Caja REAL (Lo que dice el dinero)
        // Sumamos los cierres Z que coincidan con la fecha seleccionada
        result.totalCajaReal = db.cierres
            .filter(c => checkDate(c.date))
            .reduce((acc, c) => acc + parse(c.totalVenta), 0);

        // C. Agregación de Platos (Lo que dice el TPV)
        const ventasPorPlato = {};
        ventasFiltradas.forEach(v => {
            ventasPorPlato[v.id] = (ventasPorPlato[v.id] || 0) + parse(v.qty);
        });

        // D. Análisis Financiero
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

        // E. Lógica BCG y Coach
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

                // Coach IA
                if (esPop && !esRent && p.qty > 10) result.tips.push(`🐴 <b>${p.name}</b> ("Caballo"): Vende mucho, poco margen. Sube +${(mediaMargen - p.margenUnitario).toFixed(2)}€.`);
                if (!esPop && !esRent && p.qty === 0) result.tips.push(`🧟 <b>${p.name}</b> ("Zombi"): 0 ventas.`);
                if (!esPop && esRent && p.qty > 0) result.tips.push(`💎 <b>${p.name}</b> ("Joya"): Rentable, vende poco. ¡Recomiéndalo!`);
            });
        }

        // F. Omnes
        const familias = {};
        db.platos.forEach(p => {
            if(!familias[p.category]) familias[p.category] = [];
            familias[p.category].push(parse(p.price));
        });
        Object.keys(familias).forEach(cat => {
            const precios = familias[cat].sort((a,b) => a-b);
            if (precios.length > 2) {
                const min = precios[0];
                const max = precios[precios.length-1];
                const amplitud = min > 0 ? max/min : 0;
                if (amplitud > 3) result.tips.push(`⚠️ <b>${cat}</b>: Dispersión precio x${amplitud.toFixed(1)}.`);
            }
        });

        return result;
    };

    // --- 3. RENDERIZADO UI ---
    const draw = () => {
        const data = calcularMatriz();
        
        // Cálculo de Cuadre
        const diff = data.totalTeorico - data.totalCajaReal;
        const diffAbs = Math.abs(diff);
        let auditStatus = 'neutral'; // neutral, ok, warn, danger
        let auditMsg = "Sin datos suficientes";

        if (data.totalCajaReal > 0) {
            const pct = (diffAbs / data.totalCajaReal) * 100;
            if (pct < 1) { auditStatus = 'ok'; auditMsg = "Cuadre Perfecto (Desviación < 1%)"; }
            else if (pct < 5) { auditStatus = 'warn'; auditMsg = `Desviación aceptable (${fmt(diff)})`; }
            else { auditStatus = 'danger'; auditMsg = `⚠️ REVISAR: Descuadre de ${fmt(diff)}`; }
        } else if (data.totalTeorico > 0) {
            auditStatus = 'danger'; auditMsg = "⚠️ Tienes ventas de platos pero FALTA EL CIERRE DE CAJA.";
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
                        <p class="text-[10px] font-bold text-${auditColor}-700 uppercase flex items-center gap-2">
                            <span>🔎</span> AUDITORÍA DE CUADRE
                        </p>
                        <p class="text-xs font-bold text-${auditColor}-900 mt-1">${auditMsg}</p>
                    </div>
                    <div class="text-right flex gap-6">
                        <div>
                            <p class="text-[8px] text-${auditColor}-600 uppercase">Suma Platos</p>
                            <p class="text-sm font-black text-${auditColor}-800">${fmt(data.totalTeorico)}</p>
                        </div>
                        <div>
                            <p class="text-[8px] text-${auditColor}-600 uppercase">Caja Real</p>
                            <p class="text-sm font-black text-${auditColor}-800">${fmt(data.totalCajaReal)}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div class="flex flex-wrap gap-2">
                <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition cursor-pointer shadow-lg flex items-center gap-2 whitespace-nowrap">
                    <span>🔄</span> SUBIR EXCEL / CSV
                    <input type="file" id="universalInput" class="hidden" accept=".csv, .xlsx, .xls, .txt">
                </label>
                <button id="btnPaste" class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-indigo-700 transition flex items-center gap-2 whitespace-nowrap">
                    <span>📋</span> PEGAR TABLA
                </button>
                <button id="btnPulse" class="bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-50 transition whitespace-nowrap">
                    🔥 PULSO
                </button>
                <button id="btnAddPlato" class="bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-50 transition whitespace-nowrap">
                    + PLATO
                </button>
            </div>

            ${data.tips.length > 0 ? `
            <div class="bg-amber-50 p-5 rounded-[2rem] border border-amber-100 shadow-sm relative overflow-hidden">
                <div class="absolute -right-4 -top-4 text-6xl opacity-10">💡</div>
                <h3 class="text-[10px] font-black text-amber-600 uppercase mb-2 flex items-center gap-2">
                    <span>🤖</span> AI Menu Coach
                </h3>
                <ul class="space-y-2">
                    ${data.tips.slice(0, 4).map(t => `<li class="text-[10px] text-amber-900 flex gap-2 items-start leading-tight"><span>👉</span> <span>${t}</span></li>`).join('')}
                </ul>
            </div>
            ` : ''}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderQuad('⭐ Estrellas', 'Alta Venta / Alto Margen', 'yellow', data.stars)}
                ${renderQuad('🐴 Caballos', 'Alta Venta / Bajo Margen', 'emerald', data.horses)}
                ${renderQuad('❓ Puzzles', 'Baja Venta / Alto Margen', 'indigo', data.puzzles)}
                ${renderQuad('🐶 Perros', 'Baja Venta / Bajo Margen', 'rose', data.dogs)}
            </div>
        </div>

        <div id="modalPlato" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"></div>
        <div id="modalPulse" class="hidden fixed inset-0 bg-indigo-900/95 backdrop-blur-md z-[9999] flex justify-center items-center p-4"></div>
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
        container.querySelector("#btnPulse").onclick = abrirModalPulse;
        container.querySelector("#btnAddPlato").onclick = () => abrirModalEdicion();
        container.querySelector("#universalInput").onchange = handleImportFile;
        container.querySelector("#btnPaste").onclick = handlePaste;
    };

    const renderQuad = (title, subtitle, color, list) => `
        <div class="bg-white p-5 rounded-[2.5rem] border-2 border-${color}-100 shadow-sm relative overflow-hidden h-64 flex flex-col group hover:shadow-md transition">
            <div class="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition">●</div>
            <div class="relative z-10 flex justify-between items-start mb-3">
                <div>
                    <h3 class="text-sm font-black text-${color}-600 uppercase leading-none">${title}</h3>
                    <p class="text-[9px] text-slate-400">${subtitle}</p>
                </div>
                <span class="bg-${color}-50 text-${color}-700 text-[9px] font-black px-2 py-1 rounded-lg">${list.length}</span>
            </div>
            <div class="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
                ${list.map(p => `
                    <div onclick="window.editarPlato('${p.id}')" class="flex justify-between items-center p-2 bg-${color}-50/30 rounded-xl cursor-pointer hover:bg-${color}-50 transition border border-transparent hover:border-${color}-100">
                        <div>
                            <span class="text-xs font-bold text-slate-700 block truncate w-32">${p.name}</span>
                            <span class="text-[8px] text-slate-400">${p.qty} uds</span>
                        </div>
                        <div class="text-right">
                            <span class="text-[9px] font-black text-${color}-600 block">+${fmt(p.margenUnitario)}</span>
                            <span class="text-[8px] text-slate-300">mg/ud</span>
                        </div>
                    </div>
                `).join('') || '<span class="text-[9px] text-slate-300 italic p-2">Sin platos</span>'}
            </div>
        </div>`;

    // --- PROCESADOR UNIVERSAL ---
    const processSalesData = async (rows, sourceName) => {
        const dateInput = prompt(`📅 ¿Fecha de estas ventas? (YYYY-MM-DD):`, new Date().toISOString().split('T')[0]);
        if(!dateInput) return;

        let colName = -1, colQty = -1;
        for(let i=0; i<Math.min(rows.length, 20); i++) {
            const row = rows[i].map(c => String(c).toLowerCase());
            if(colName === -1) colName = row.findIndex(c => c.match(/articulo|nombre|producto|item|descrip|concepto/));
            if(colQty === -1) colQty = row.findIndex(c => c.match(/cantidad|unidades|vendidos|qty|uds/));
        }

        if(colName === -1 || colQty === -1) {
            alert("⚠️ No pude entender el archivo. Busca columnas como 'Artículo' y 'Cantidad'.");
            return;
        }

        let count = 0;
        const newSales = [];
        const startRow = rows.findIndex(r => r[colName] && String(r[colName]).toLowerCase().match(/articulo|nombre|producto/)) + 1 || 1;

        for(let i=startRow; i<rows.length; i++) {
            const row = rows[i];
            if(!row[colName]) continue;

            const name = String(row[colName]).trim();
            const sold = parse(row[colQty]); 

            if(name && sold > 0) {
                let plato = db.platos.find(p => normalize(p.name) === normalize(name));
                if(!plato) {
                    plato = { id: Date.now() + Math.random().toString(), name: name, category: 'General', price: 0, cost: 0 };
                    db.platos.push(plato);
                }
                
                const existingSale = db.ventas_menu.find(v => v.date === dateInput && v.id === plato.id);
                if(existingSale) { existingSale.qty += sold; } 
                else { newSales.push({ date: dateInput, id: plato.id, qty: sold }); }
                count++;
            }
        }

        if(newSales.length > 0 || count > 0) {
            db.ventas_menu.push(...newSales);
            await saveFn(`✅ Procesadas ${count} ventas.`);
            draw();
        } else {
            alert("No encontré ventas válidas.");
        }
    };

    const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type:'array'});
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false});
                await processSalesData(rows, "Archivo");
            } catch (err) { alert("Error leyendo archivo."); } finally { e.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if(!text) return alert("Portapapeles vacío");
            const rows = text.split('\n').map(line => line.split('\t'));
            await processSalesData(rows, "Portapapeles");
        } catch (err) { alert("No pude leer el portapapeles."); }
    };

    const abrirModalPulse = () => {
        const modal = container.querySelector("#modalPulse");
        modal.classList.remove("hidden");
        const populares = db.platos
            .map(p => ({...p, total: db.ventas_menu.filter(v=>v.id===p.id).reduce((a,b)=>a+parse(b.qty),0)}))
            .sort((a,b)=>b.total-a.total)
            .slice(0, 10);

        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <h3 class="text-xl font-black text-indigo-900 mb-1">🔥 Pulso Rápido</h3>
                <p class="text-xs text-slate-500 mb-4">Registro manual rápido</p>
                <div class="space-y-2 mb-6 max-h-80 overflow-y-auto custom-scrollbar px-1">
                    ${populares.map(p => `
                        <div class="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
                            <span class="font-bold text-slate-700 text-xs w-32 truncate">${p.name}</span>
                            <div class="flex items-center gap-2">
                                <button class="w-6 h-6 bg-slate-100 rounded text-slate-500 font-bold" onclick="this.nextElementSibling.value = Math.max(0, parseInt(this.nextElementSibling.value||0)-1)">-</button>
                                <input type="number" class="pulse-qty w-10 p-1 bg-white border border-indigo-100 rounded-lg text-center font-black text-indigo-600 text-sm outline-none" placeholder="0" data-id="${p.id}">
                                <button class="w-6 h-6 bg-indigo-100 rounded text-indigo-600 font-bold" onclick="this.previousElementSibling.value = parseInt(this.previousElementSibling.value||0)+1">+</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button id="btnSavePulse" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:scale-[1.02] transition">GUARDAR</button>
                <button onclick="document.getElementById('modalPulse').classList.add('hidden')" class="w-full text-slate-400 text-xs font-bold mt-4">Cancelar</button>
            </div>
        `;

        modal.querySelector("#btnSavePulse").onclick = async () => {
            const today = new Date().toISOString().split('T')[0];
            const inputs = modal.querySelectorAll('.pulse-qty');
            const newSales = [];
            inputs.forEach(inp => {
                const val = parse(inp.value);
                if(val > 0) newSales.push({ date: today, id: inp.dataset.id, qty: val });
            });
            if(newSales.length > 0) {
                db.ventas_menu.push(...newSales);
                await saveFn(`🔥 Registrados ${newSales.length} platos.`);
            }
            modal.classList.add("hidden");
            draw();
        };
    };

    window.editarPlato = (id = null) => {
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', category: 'Principal' };
        const modal = container.querySelector("#modalPlato");
        modal.classList.remove("hidden");
        
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <button onclick="document.getElementById('modalPlato').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-xl">✕</button>
                <h3 class="text-xl font-black text-slate-800 mb-4">${id?'Editar':'Nuevo'} Plato</h3>
                <div class="space-y-4">
                    <div><label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Nombre</label><input id="p-name" value="${p.name}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border-0 outline-none focus:ring-2 focus:ring-indigo-200"></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="text-[9px] font-bold text-slate-400 uppercase ml-2">PVP (€)</label><input id="p-price" type="number" value="${p.price||''}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-lg border-0 outline-none text-indigo-600"></div>
                        <div><label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Coste (€)</label><input id="p-cost" type="number" value="${p.cost||''}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-lg border-0 outline-none text-rose-500"></div>
                    </div>
                    <div><label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Familia</label><select id="p-cat" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs border-0 outline-none">${['Entrantes','Principal','Postre','Bebidas','Otros'].map(c => `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
                    <button id="btnSaveP" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-slate-800 transition">GUARDAR</button>
                    ${id ? `<button id="btnDelP" class="w-full text-rose-400 font-bold text-xs mt-2 hover:text-rose-600">Eliminar Plato</button>` : ''}
                </div>
            </div>
        `;

        modal.querySelector("#btnSaveP").onclick = async () => {
            const nuevo = { ...p, name: modal.querySelector("#p-name").value, category: modal.querySelector("#p-cat").value, price: parse(modal.querySelector("#p-price").value), cost: parse(modal.querySelector("#p-cost").value) };
            if(!nuevo.name) return alert("Ponle nombre al plato");
            if(id) { const idx = db.platos.findIndex(x => x.id === id); if(idx >= 0) db.platos[idx] = nuevo; } else db.platos.push(nuevo);
            await saveFn("Plato guardado"); modal.classList.add("hidden"); draw();
        };

        if(id) modal.querySelector("#btnDelP").onclick = async () => {
            if(confirm("¿Seguro que quieres borrar este plato? Se perderá su histórico.")) {
                db.platos = db.platos.filter(x => x.id !== id);
                await saveFn("Plato eliminado"); modal.classList.add("hidden"); draw();
            }
        };
    };

    window.editarPlato = abrirModalEdicion;
    draw();
}
