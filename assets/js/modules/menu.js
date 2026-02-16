/* =============================================================
   🍽️ MÓDULO: MENU INTELLIGENCE (Omnes + Engineering + CSV)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZACIÓN SEGURA
    if (!Array.isArray(db.platos)) db.platos = []; 
    // Estimación de coste si no se introduce manual (Regla del sector)
    const costEstimate = { 'Bebidas': 0.25, 'Entrantes': 0.30, 'Principal': 0.35, 'Postre': 0.25, 'General': 0.33 };

    // --- CÁLCULOS MATEMÁTICOS ---
    const calcularMatriz = () => {
        const defaultData = { stars:[], horses:[], puzzles:[], dogs:[], omnes:{}, tips:[], totalTeorico:0 };
        if (db.platos.length === 0) return defaultData;

        // A. Totales y Agrupación
        const porFamilia = {};
        let totalPopularidad = 0;
        let totalMargen = 0;
        let totalVentasDinero = 0;

        db.platos.forEach(p => {
            const price = parseFloat(p.price) || 0;
            const sold = parseFloat(p.sold) || 0;
            const pulse = parseFloat(p.pulseScore) || 0;
            const cat = p.category || 'General';

            // Si no hay coste real, lo estimamos
            const costeReal = parseFloat(p.cost) || (price * (costEstimate[cat] || 0.33));
            
            p.margen = price - costeReal;
            p.score = sold + pulse; // Popularidad = Ventas reales + Pulso manual
            
            totalPopularidad += p.score;
            totalMargen += p.margen;
            totalVentasDinero += (price * sold);

            if(!porFamilia[cat]) porFamilia[cat] = [];
            porFamilia[cat].push(p);
        });

        // B. Medias (Varas de medir)
        const mediaPop = totalPopularidad / (db.platos.length || 1);
        const mediaMargen = totalMargen / (db.platos.length || 1);

        // C. Clasificación Matriz
        const result = { stars:[], horses:[], puzzles:[], dogs:[], omnes:{}, tips:[], totalTeorico: totalVentasDinero };

        db.platos.forEach(p => {
            const esPop = p.score >= (mediaPop * 0.7);
            const esRent = p.margen >= mediaMargen;

            if (esPop && esRent) result.stars.push(p);
            else if (esPop && !esRent) result.horses.push(p);
            else if (!esPop && esRent) result.puzzles.push(p);
            else result.dogs.push(p);
        });

        // D. Análisis Omnes (Tips de Precios)
        Object.keys(porFamilia).forEach(fam => {
            const items = porFamilia[fam].sort((a,b) => parseFloat(a.price) - parseFloat(b.price));
            if (items.length > 2) {
                const min = parseFloat(items[0].price);
                const max = parseFloat(items[items.length-1].price);
                const dispersion = min > 0 ? max / min : 0;
                
                // Reglas de Omnes
                if(dispersion > 3) result.tips.push(`⚠️ <b>${fam}</b>: Mucha diferencia de precios (x${dispersion.toFixed(1)}). El más barato canibaliza al caro.`);
                if(dispersion < 1.5) result.tips.push(`💡 <b>${fam}</b>: Precios muy planos. Falta un plato "ancla" más caro.`);
            }
        });

        return result;
    };

    const data = calcularMatriz();

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-20">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Menu Intelligence</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Ingeniería & Psicología</p>
            </div>
            
            <div class="flex gap-2">
                <label class="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-2xl text-[10px] font-black hover:bg-emerald-100 transition cursor-pointer border border-emerald-100 flex items-center gap-2">
                    <span>📂</span> IMPORTAR CSV
                    <input type="file" id="csvMenuInput" class="hidden" accept=".csv">
                </label>
                <div class="text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 hidden md:block">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Venta Teórica</p>
                    <p class="text-lg font-black text-indigo-600">${data.totalTeorico.toLocaleString('es-ES',{maximumFractionDigits:0})}€</p>
                </div>
            </div>
        </header>

        <div class="flex gap-2 overflow-x-auto pb-2">
            <button id="btnPulse" class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-indigo-700 transition flex items-center gap-2 whitespace-nowrap">
                <span>🔥</span> PULSO DIARIO
            </button>
            <button id="btnAddPlato" class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-slate-800 transition whitespace-nowrap">
                + PLATO MANUAL
            </button>
            <button id="btnReset" class="bg-white border border-slate-200 text-slate-500 px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-rose-50 hover:text-rose-500 transition whitespace-nowrap">
                🔄 REINICIAR MES
            </button>
        </div>

        ${data.tips.length > 0 ? `
        <div class="bg-amber-50 p-4 rounded-[2rem] border border-amber-100 shadow-sm">
            <h3 class="text-[10px] font-black text-amber-600 uppercase mb-1">🤖 Menu Coach</h3>
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

    // --- IMPORTACIÓN CSV ---
    container.querySelector("#csvMenuInput").addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if(db.platos.length > 0) {
            if(!confirm("⚠️ AVISO: Al importar un archivo, se BORRARÁ la carta actual para evitar duplicados.\n\n¿Quieres continuar?")) {
                e.target.value = ''; return;
            }
            db.platos = [];
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target.result;
            const rows = text.split('\n').slice(1); 
            let count = 0;

            rows.forEach(row => {
                if(!row.trim()) return;
                const cols = row.includes(';') ? row.split(';') : row.split(',');
                // Formato: Nombre; Categoria; PVP; Coste; Vendidos
                if(cols.length >= 3) {
                    db.platos.push({
                        id: Date.now() + Math.random().toString(),
                        name: cols[0].trim(),
                        category: cols[1]?.trim() || 'General',
                        price: parseFloat(cols[2]?.replace(',','.')) || 0,
                        cost: parseFloat(cols[3]?.replace(',','.')) || 0,
                        sold: parseFloat(cols[4]?.replace(',','.')) || 0,
                        pulseScore: 0
                    });
                    count++;
                }
            });
            await saveFn(`Carta importada: ${count} platos 🍽️`);
            render(container, supabase, db, opts);
        };
        reader.readAsText(file);
    });

    // --- PULSO (Modal Rápido) ---
    container.querySelector("#btnPulse").onclick = () => {
        const modal = container.querySelector("#modalPulse");
        modal.classList.remove("hidden");
        const candidatos = db.platos.sort(() => 0.5 - Math.random()).slice(0, 5); 
        
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <h3 class="text-xl font-black text-indigo-900 mb-2">🔥 Pulso del Servicio</h3>
                <p class="text-xs text-slate-500 mb-6">¿Qué platos han triunfado hoy?</p>
                <div class="space-y-3 mb-6">
                    ${candidatos.map(p => `
                        <div class="pulse-item flex items-center justify-between p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition" data-id="${p.id}">
                            <span class="font-bold text-slate-700 text-sm">${p.name}</span>
                            <div class="w-6 h-6 rounded-full border-2 border-indigo-100 flex items-center justify-center check-circle"></div>
                        </div>
                    `).join('')}
                </div>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                    <label class="text-[9px] font-bold text-slate-400 uppercase">Otro plato destacado:</label>
                    <select id="pulse-manual" class="w-full bg-transparent font-bold text-sm outline-none mt-1">
                        <option value="">Seleccionar...</option>
                        ${db.platos.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <button id="btnSavePulse" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">GUARDAR</button>
                <button onclick="document.getElementById('modalPulse').classList.add('hidden')" class="w-full text-slate-400 text-xs font-bold mt-4">Cancelar</button>
            </div>
        `;

        modal.querySelectorAll('.pulse-item').forEach(item => {
            item.onclick = () => {
                item.classList.toggle('bg-indigo-100');
                item.classList.toggle('border-indigo-300');
                item.querySelector('.check-circle').innerText = item.classList.contains('bg-indigo-100') ? '🔥' : '';
            };
        });

        modal.querySelector("#btnSavePulse").onclick = async () => {
            const selectedIds = [];
            modal.querySelectorAll('.pulse-item.bg-indigo-100').forEach(el => selectedIds.push(el.dataset.id));
            const manId = modal.querySelector("#pulse-manual").value;
            if(manId) selectedIds.push(manId);

            if(selectedIds.length > 0) {
                selectedIds.forEach(id => {
                    const p = db.platos.find(x => x.id === id);
                    if(p) p.pulseScore = (p.pulseScore || 0) + 5; 
                });
                await saveFn("Pulso guardado");
            }
            modal.classList.add("hidden");
            render(container, supabase, db, opts);
        };
    };

    // --- EDICIÓN PLATO ---
    window.editarPlato = (id = null) => {
        container.scrollTop = 0; window.scrollTo(0,0);
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', sold: '', category: 'Principal' };
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
                    <input id="p-price" type="number" value="${p.price}" placeholder="PVP" class="p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                    <input id="p-cost" type="number" value="${p.cost}" placeholder="Coste" class="p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                </div>
                <input id="p-sold" type="number" value="${p.sold}" placeholder="Ventas" class="w-full p-3 mb-4 bg-indigo-50 text-indigo-900 rounded-xl font-black border border-indigo-100">
                <button id="btnSaveP" class="w-full bg-slate-900 text-white py-3 rounded-2xl font-black">Guardar</button>
                <button onclick="document.getElementById('modalPlato').classList.add('hidden')" class="w-full mt-2 text-slate-400 font-bold text-xs">Cancelar</button>
                ${id ? `<button onclick="borrarPlato('${p.id}')" class="w-full mt-2 text-rose-400 font-bold text-xs">Eliminar</button>` : ''}
            </div>
        `;
        modal.querySelector("#btnSaveP").onclick = async () => {
            const nuevo = {
                id: p.id,
                name: modal.querySelector("#p-name").value,
                category: modal.querySelector("#p-cat").value,
                price: parseFloat(modal.querySelector("#p-price").value)||0,
                cost: parseFloat(modal.querySelector("#p-cost").value)||0,
                sold: parseFloat(modal.querySelector("#p-sold").value)||0,
                pulseScore: p.pulseScore || 0
            };
            if(!nuevo.name) return alert("Falta nombre");
            if(id) db.platos[db.platos.findIndex(x=>x.id===id)] = nuevo;
            else db.platos.push(nuevo);
            await saveFn("Guardado");
            modal.classList.add("hidden");
            render(container, supabase, db, opts);
        };
    };

    window.borrarPlato = async (id) => {
        if(confirm("¿Borrar?")) {
            db.platos = db.platos.filter(x => x.id !== id);
            await saveFn("Borrado");
            document.getElementById('modalPlato').classList.add('hidden');
            render(container, supabase, db, opts);
        }
    };

    // Botones adicionales
    container.querySelector("#btnReset").onclick = async () => {
        if(confirm("¿Poner a CERO las ventas de todos los platos?")) {
            db.platos.forEach(p => { p.sold = 0; p.pulseScore = 0; });
            await saveFn("Ventas reiniciadas");
            render(container, supabase, db, opts);
        }
    };
    
    container.querySelector("#btnAddPlato").onclick = () => window.editarPlato();
}
