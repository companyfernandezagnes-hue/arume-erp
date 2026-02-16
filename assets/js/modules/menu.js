/* =============================================================
   🍽️ MÓDULO: MENU INTELLIGENCE (Time Machine Edition)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZACIÓN
    if (!Array.isArray(db.platos)) db.platos = [];
    if (!Array.isArray(db.ventas_menu)) db.ventas_menu = []; // Histórico: { date, id, qty }

    // Migración de datos antiguos (si existen ventas en el plato pero no en el histórico)
    db.platos.forEach(p => {
        if(p.sold > 0) {
            const hasHistory = db.ventas_menu.some(v => v.id === p.id);
            if(!hasHistory) {
                // Asumimos que lo vendido hasta ahora es de "hoy" o del mes actual para no perderlo
                db.ventas_menu.push({
                    date: new Date().toISOString().split('T')[0],
                    id: p.id,
                    qty: parseFloat(p.sold)
                });
            }
            p.sold = 0; // Reseteamos el contador plano para usar siempre el histórico
        }
    });

    // Estado del Filtro de Tiempo
    let filterMode = 'month'; // 'day', 'month', 'year'
    let filterValue = new Date().toISOString().slice(0, 7); // YYYY-MM por defecto

    // Costes estimados
    const costEstimate = { 'Bebidas': 0.25, 'Entrantes': 0.30, 'Principal': 0.35, 'Postre': 0.25, 'General': 0.33 };

    // --- CÁLCULOS ---
    const calcularMatriz = () => {
        const result = { stars:[], horses:[], puzzles:[], dogs:[], omnes:{}, tips:[], totalTeorico:0 };
        if (db.platos.length === 0) return result;

        // 1. Filtrar ventas por fecha seleccionada
        const ventasFiltradas = db.ventas_menu.filter(v => {
            if(!v.date) return false;
            if(filterMode === 'day') return v.date === filterValue;
            if(filterMode === 'month') return v.date.startsWith(filterValue);
            if(filterMode === 'year') return v.date.startsWith(filterValue); // filterValue = '2024'
            return true;
        });

        // 2. Agrupar ventas por plato
        const ventasPorPlato = {};
        ventasFiltradas.forEach(v => {
            ventasPorPlato[v.id] = (ventasPorPlato[v.id] || 0) + parseFloat(v.qty);
        });

        // 3. Totales Globales
        const porFamilia = {};
        let totalPopularidad = 0;
        let totalMargen = 0;
        let totalVentasDinero = 0;

        db.platos.forEach(p => {
            const price = parseFloat(p.price) || 0;
            const sold = ventasPorPlato[p.id] || 0; // Usamos el dato filtrado
            const cat = p.category || 'General';

            const costeReal = parseFloat(p.cost) || (price * (costEstimate[cat] || 0.33));
            
            p.margen = price - costeReal;
            p.score = sold; 
            
            totalPopularidad += p.score;
            totalMargen += p.margen;
            totalVentasDinero += (price * sold);

            if(!porFamilia[cat]) porFamilia[cat] = [];
            porFamilia[cat].push(p);
        });

        const mediaPop = totalPopularidad / (db.platos.length || 1);
        const mediaMargen = totalMargen / (db.platos.length || 1);

        // 4. Clasificación
        result.totalTeorico = totalVentasDinero;

        db.platos.forEach(p => {
            const esPop = p.score >= (mediaPop * 0.7);
            const esRent = p.margen >= mediaMargen;

            // Clonamos para no ensuciar la DB con datos visuales temporales
            const visualP = { ...p, sold: p.score }; 

            if (esPop && esRent) result.stars.push(visualP);
            else if (esPop && !esRent) result.horses.push(visualP);
            else if (!esPop && esRent) result.puzzles.push(visualP);
            else result.dogs.push(visualP);
        });

        // 5. Omnes
        Object.keys(porFamilia).forEach(fam => {
            const items = porFamilia[fam].sort((a,b) => parseFloat(a.price) - parseFloat(b.price));
            if (items.length > 2) {
                const min = parseFloat(items[0].price);
                const max = parseFloat(items[items.length-1].price);
                const dispersion = min > 0 ? max / min : 0;
                
                if(dispersion > 3) result.tips.push(`⚠️ <b>${fam}</b>: Dispersión alta (x${dispersion.toFixed(1)}).`);
                if(dispersion < 1.5) result.tips.push(`💡 <b>${fam}</b>: Precios planos. Añade opciones premium.`);
            }
        });

        return result;
    };

    // --- RENDER ---
    const draw = () => {
        const data = calcularMatriz();
        
        container.innerHTML = `
        <div class="animate-fade-in space-y-6 pb-20">
            
            <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-black text-slate-800">Menu Intelligence</h2>
                        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Análisis Temporal</p>
                    </div>
                    <div class="text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase">Venta Periodo</p>
                        <p class="text-lg font-black text-indigo-600">${data.totalTeorico.toLocaleString('es-ES',{maximumFractionDigits:0})}€</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <select id="filterType" class="bg-white text-xs font-bold py-2 px-3 rounded-xl border-0 outline-none shadow-sm">
                        <option value="day" ${filterMode==='day'?'selected':''}>Día</option>
                        <option value="month" ${filterMode==='month'?'selected':''}>Mes</option>
                        <option value="year" ${filterMode==='year'?'selected':''}>Año</option>
                    </select>
                    
                    <input type="${filterMode==='year'?'number':(filterMode==='month'?'month':'date')}" 
                           id="filterInput" 
                           value="${filterValue}" 
                           class="flex-1 bg-transparent font-black text-slate-700 text-sm outline-none text-center"
                           ${filterMode==='year'?`min="2020" max="2030"`:''}
                    >
                </div>
            </header>

            <div class="flex gap-2 overflow-x-auto pb-2">
                <label class="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-2xl text-[10px] font-black hover:bg-emerald-100 transition cursor-pointer border border-emerald-100 flex items-center gap-2 whitespace-nowrap">
                    <span>📂</span> IMPORTAR VENTAS (CSV)
                    <input type="file" id="csvMenuInput" class="hidden" accept=".csv">
                </label>
                <button id="btnPulse" class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-indigo-700 transition flex items-center gap-2 whitespace-nowrap">
                    <span>🔥</span> PULSO HOY
                </button>
                <button id="btnAddPlato" class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-slate-800 transition whitespace-nowrap">
                    + PLATO
                </button>
            </div>

            ${data.tips.length > 0 ? `
            <div class="bg-amber-50 p-4 rounded-[2rem] border border-amber-100 shadow-sm">
                <h3 class="text-[10px] font-black text-amber-600 uppercase mb-1">🤖 Menu Coach (${filterValue})</h3>
                <ul class="space-y-1">
                    ${data.tips.slice(0, 3).map(t => `<li class="text-[10px] text-amber-800 flex gap-2"><span>👉</span> <span>${t}</span></li>`).join('')}
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
        <div id="modalPulse" class="hidden fixed inset-0 bg-indigo-900/90 backdrop-blur-md z-[9999] flex justify-center items-center p-4"></div>
        `;

        // Eventos del Filtro
        container.querySelector("#filterType").onchange = (e) => {
            filterMode = e.target.value;
            // Ajustar formato del valor por defecto al cambiar tipo
            const now = new Date();
            if(filterMode === 'day') filterValue = now.toISOString().split('T')[0];
            if(filterMode === 'month') filterValue = now.toISOString().slice(0, 7);
            if(filterMode === 'year') filterValue = now.getFullYear().toString();
            draw();
        };
        container.querySelector("#filterInput").onchange = (e) => {
            filterValue = e.target.value;
            draw();
        };

        // Eventos Botones
        container.querySelector("#btnPulse").onclick = abrirModalPulse;
        container.querySelector("#btnAddPlato").onclick = () => abrirModalEdicion();
        container.querySelector("#csvMenuInput").onchange = handleImport;
    };

    function renderQuad(title, subtitle, color, list) {
        return `
        <div class="bg-white p-5 rounded-[2.5rem] border-2 border-${color}-100 shadow-sm relative overflow-hidden h-64 flex flex-col group hover:shadow-md transition">
            <div class="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition">●</div>
            <h3 class="text-sm font-black text-${color}-600 uppercase leading-none">${title}</h3>
            <p class="text-[9px] text-slate-400 mb-3">${subtitle}</p>
            <div class="space-y-1 overflow-y-auto custom-scrollbar flex-1">
                ${list.map(p => `
                    <div onclick="window.editarPlato('${p.id}')" class="flex justify-between items-center p-2 bg-${color}-50/50 rounded-xl cursor-pointer hover:bg-${color}-100 transition">
                        <div>
                            <span class="text-xs font-bold text-slate-700 block truncate w-28 md:w-40">${p.name}</span>
                            <span class="text-[8px] text-slate-400">${p.sold} uds</span>
                        </div>
                        <span class="text-[9px] font-black text-${color}-600">${p.margen.toFixed(1)}€</span>
                    </div>
                `).join('') || '<span class="text-[9px] text-slate-300 italic">Vacío</span>'}
            </div>
        </div>`;
    }

    // --- IMPORTACIÓN CSV MEJORADA (CON FECHA) ---
    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Preguntar fecha de importación
        const dateInput = prompt("¿A qué fecha asignamos estas ventas? (YYYY-MM-DD)", new Date().toISOString().split('T')[0]);
        if(!dateInput) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target.result;
            const rows = text.split('\n').slice(1);
            let count = 0;
            const newSales = [];

            // 1. Procesar Filas
            rows.forEach(row => {
                if(!row.trim()) return;
                const cols = row.includes(';') ? row.split(';') : row.split(',');
                // Formato: Nombre; Categoria; PVP; Coste; Vendidos
                if(cols.length >= 3) {
                    const name = cols[0].trim();
                    const sold = parseFloat(cols[4]?.replace(',','.')) || 0;
                    
                    // Buscar si el plato ya existe
                    let plato = db.platos.find(p => p.name.toLowerCase() === name.toLowerCase());
                    
                    // Si no existe, lo creamos
                    if(!plato) {
                        plato = {
                            id: Date.now() + Math.random().toString(),
                            name: name,
                            category: cols[1]?.trim() || 'General',
                            price: parseFloat(cols[2]?.replace(',','.')) || 0,
                            cost: parseFloat(cols[3]?.replace(',','.')) || 0,
                        };
                        db.platos.push(plato);
                    }

                    // Registrar venta en el histórico
                    if(sold > 0) {
                        newSales.push({ date: dateInput, id: plato.id, qty: sold });
                        count++;
                    }
                }
            });

            // 2. Guardar Ventas
            db.ventas_menu.push(...newSales);
            await saveFn(`Importadas ${count} líneas de venta para ${dateInput}`);
            draw();
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // --- PULSO (Guarda en histórico con fecha HOY) ---
    const abrirModalPulse = () => {
        const modal = container.querySelector("#modalPulse");
        modal.classList.remove("hidden");
        const candidatos = db.platos.sort(() => 0.5 - Math.random()).slice(0, 5); 
        
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <h3 class="text-xl font-black text-indigo-900 mb-2">🔥 Pulso de Hoy</h3>
                <p class="text-xs text-slate-500 mb-6">Selecciona lo más vendido</p>
                <div class="space-y-3 mb-6">
                    ${candidatos.map(p => `
                        <div class="pulse-item flex items-center justify-between p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition" data-id="${p.id}">
                            <span class="font-bold text-slate-700 text-sm">${p.name}</span>
                            <div class="w-6 h-6 rounded-full border-2 border-indigo-100 flex items-center justify-center check-circle"></div>
                        </div>
                    `).join('')}
                </div>
                <button id="btnSavePulse" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">GUARDAR</button>
                <button onclick="document.getElementById('modalPulse').classList.add('hidden')" class="w-full text-slate-400 text-xs font-bold mt-4">Cancelar</button>
            </div>
        `;

        modal.querySelectorAll('.pulse-item').forEach(item => {
            item.onclick = () => {
                item.classList.toggle('bg-indigo-100');
                item.querySelector('.check-circle').innerText = item.classList.contains('bg-indigo-100') ? '🔥' : '';
            };
        });

        modal.querySelector("#btnSavePulse").onclick = async () => {
            const today = new Date().toISOString().split('T')[0];
            const newSales = [];
            modal.querySelectorAll('.pulse-item.bg-indigo-100').forEach(el => {
                newSales.push({ date: today, id: el.dataset.id, qty: 5 }); // Pulso = 5 unidades aprox
            });

            if(newSales.length > 0) {
                db.ventas_menu.push(...newSales);
                await saveFn("Pulso registrado");
            }
            modal.classList.add("hidden");
            draw();
        };
    };

    // --- EDICIÓN PLATO ---
    const abrirModalEdicion = (id = null) => {
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', category: 'Principal' };
        const modal = container.querySelector("#modalPlato");
        modal.classList.remove("hidden");
        
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <h3 class="text-xl font-black text-slate-800 mb-4">${id?'Editar':'Nuevo'} Plato</h3>
                <input id="p-name" value="${p.name}" placeholder="Nombre" class="w-full p-3 mb-2 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                <select id="p-cat" class="w-full p-3 mb-2 bg-slate-50 rounded-xl font-bold text-xs border border-slate-100">
                    <option value="Entrantes" ${p.category==='Entrantes'?'selected':''}>Entrantes</option>
                    <option value="Principal" ${p.category==='Principal'?'selected':''}>Principal</option>
                    <option value="Postre" ${p.category==='Postre'?'selected':''}>Postre</option>
                    <option value="Bebidas" ${p.category==='Bebidas'?'selected':''}>Bebidas</option>
                </select>
                <div class="grid grid-cols-2 gap-2 mb-4">
                    <input id="p-price" type="number" value="${p.price||''}" placeholder="PVP" class="p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                    <input id="p-cost" type="number" value="${p.cost||''}" placeholder="Coste" class="p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                </div>
                <button id="btnSaveP" class="w-full bg-slate-900 text-white py-3 rounded-2xl font-black">Guardar</button>
                <button onclick="document.getElementById('modalPlato').classList.add('hidden')" class="w-full mt-2 text-slate-400 font-bold text-xs">Cancelar</button>
                ${id ? `<button id="btnDelP" class="w-full mt-2 text-rose-400 font-bold text-xs">Eliminar</button>` : ''}
            </div>
        `;
        modal.querySelector("#btnSaveP").onclick = async () => {
            const nuevo = { ...p,
                name: modal.querySelector("#p-name").value,
                category: modal.querySelector("#p-cat").value,
                price: parseFloat(modal.querySelector("#p-price").value)||0,
                cost: parseFloat(modal.querySelector("#p-cost").value)||0
            };
            if(!nuevo.name) return alert("Falta nombre");
            if(id) db.platos[db.platos.findIndex(x=>x.id===id)] = nuevo;
            else db.platos.push(nuevo);
            await saveFn("Guardado");
            modal.classList.add("hidden");
            draw();
        };
        if(id) modal.querySelector("#btnDelP").onclick = async () => {
            if(confirm("¿Borrar?")) {
                db.platos = db.platos.filter(x => x.id !== id);
                await saveFn("Borrado");
                modal.classList.add("hidden");
                draw();
            }
        };
    };

    // Exponer para onclick en HTML
    window.editarPlato = abrirModalEdicion;

    draw();
}
