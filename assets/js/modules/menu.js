/* =============================================================
   🍽️ MÓDULO: MENU INTELLIGENCE (Omnes + Engineering + Pulse)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZACIÓN
    if (!Array.isArray(db.platos)) db.platos = []; 
    // Categorías por defecto para estimación de costes (Si no hay coste real)
    const costEstimate = { 'Bebidas': 0.25, 'Entrantes': 0.30, 'Principal': 0.35, 'Postre': 0.25, 'General': 0.33 };

    // --- LÓGICA OMNES & ENGINEERING ---
    const analizarCarta = () => {
        const result = { 
            stars:[], horses:[], puzzles:[], dogs:[], 
            omnes: {}, 
            tips: [] 
        };

        if (db.platos.length === 0) return result;

        // A. Agrupar por Familias para OMNES
        const porFamilia = {};
        let totalPopularidad = 0;
        let totalMargen = 0;

        db.platos.forEach(p => {
            const cat = p.category || 'General';
            if(!porFamilia[cat]) porFamilia[cat] = [];
            porFamilia[cat].push(p);

            // Calcular Margen (Si no hay coste, estimamos por categoría)
            const costeReal = parseFloat(p.cost) || (parseFloat(p.price) * (costEstimate[cat] || 0.33));
            p.margen = parseFloat(p.price) - costeReal;
            
            // Popularidad (Suma de unidades vendidas + "Pulsos" manuales)
            p.score = (parseFloat(p.sold) || 0) + (p.pulseScore || 0);
            
            totalPopularidad += p.score;
            totalMargen += p.margen;
        });

        // B. Calcular Medias Globales (Para la Matriz)
        const mediaPop = totalPopularidad / db.platos.length;
        const mediaMargen = totalMargen / db.platos.length;

        // C. Clasificación Matriz y Omnes
        Object.keys(porFamilia).forEach(fam => {
            const items = porFamilia[fam].sort((a,b) => parseFloat(a.price) - parseFloat(b.price));
            
            if (items.length > 2) {
                const min = parseFloat(items[0].price);
                const max = parseFloat(items[items.length-1].price);
                
                // 1. Dispersión (Ideal entre 2.5 y 3.0)
                const dispersion = min > 0 ? max / min : 0;
                let statusDisp = 'OK';
                if(dispersion > 3) { statusDisp = 'ALTA'; result.tips.push(`⚠️ En <b>${fam}</b> la diferencia de precios es demasiada (x${dispersion.toFixed(1)}). Elimina platos muy baratos o sube el precio mínimo.`); }
                if(dispersion < 2) { statusDisp = 'BAJA'; result.tips.push(`💡 En <b>${fam}</b> los precios son muy parecidos. Introduce un plato "Ancla" (caro) para destacar.`); }

                // 2. Bandas de Precio (Gama Baja, Media, Alta)
                const range = max - min;
                const tercio = range / 3;
                let low=0, mid=0, high=0;
                items.forEach(i => {
                    const p = parseFloat(i.price);
                    if (p < min + tercio) low++;
                    else if (p < min + (tercio*2)) mid++;
                    else high++;
                });
                
                // Omnes dice: La gama media debe ser la más numerosa (sum of low + high)
                let statusBand = 'OK';
                if (mid < (low + high)) {
                    statusBand = 'Descompensada';
                    result.tips.push(`⚖️ En <b>${fam}</b> tienes poca oferta en la gama media de precios. Intenta centrar la oferta.`);
                }

                result.omnes[fam] = { dispersion, statusDisp, statusBand, count: items.length };
            }
        });

        // D. Llenar Cuadrantes
        db.platos.forEach(p => {
            const esPop = p.score >= (mediaPop * 0.7); // 70% de la media es la regla clásica
            const esRent = p.margen >= mediaMargen;

            if (esPop && esRent) result.stars.push(p);
            else if (esPop && !esRent) result.horses.push(p);
            else if (!esPop && esRent) result.puzzles.push(p);
            else result.dogs.push(p);
        });

        return result;
    };

    const data = analizarCarta();

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-20">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Menu Intelligence</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Ingeniería & Psicología</p>
            </div>
            <div class="flex gap-2 mt-4 md:mt-0">
                <button id="btnPulse" class="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-indigo-700 transition flex items-center gap-2">
                    <span>🔥</span> PULSO DIARIO
                </button>
                <button id="btnAddPlato" class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-slate-800 transition">
                    + PLATO
                </button>
            </div>
        </header>

        ${data.tips.length > 0 ? `
        <div class="bg-amber-50 p-5 rounded-[2rem] border border-amber-100">
            <h3 class="text-xs font-black text-amber-600 uppercase mb-2">🤖 Menu Coach (Sugerencias)</h3>
            <ul class="space-y-1">
                ${data.tips.slice(0, 3).map(t => `<li class="text-[11px] text-amber-800 flex gap-2"><span>👉</span> <span>${t}</span></li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="flex gap-4 border-b border-slate-200 pb-2">
            <button class="text-xs font-black text-slate-800 border-b-2 border-slate-800 pb-1">Matriz Engineering</button>
            <button class="text-xs font-bold text-slate-400 pb-1" onclick="alert('Funcionalidad visual en esta demo. Los cálculos Omnes ya están en las Sugerencias de arriba 👆')">Análisis Omnes</button>
        </div>

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
        <div class="bg-white p-5 rounded-[2.5rem] border-2 border-${color}-100 shadow-sm relative overflow-hidden h-64 flex flex-col">
            <div class="absolute top-0 right-0 p-4 opacity-10 text-4xl">●</div>
            <h3 class="text-sm font-black text-${color}-600 uppercase leading-none">${title}</h3>
            <p class="text-[9px] text-slate-400 mb-3">${subtitle}</p>
            <div class="space-y-1 overflow-y-auto custom-scrollbar flex-1">
                ${list.map(p => `
                    <div onclick="window.editarPlato('${p.id}')" class="flex justify-between items-center p-2 bg-${color}-50/50 rounded-xl cursor-pointer hover:bg-${color}-100 transition">
                        <span class="text-xs font-bold text-slate-700 truncate w-32">${p.name}</span>
                        <span class="text-[9px] font-black text-${color}-600">${p.margen.toFixed(1)}€</span>
                    </div>
                `).join('') || '<span class="text-[9px] text-slate-300 italic">Vacío</span>'}
            </div>
        </div>`;
    }

    // --- MODAL PULSO (La magia rápida) ---
    container.querySelector("#btnPulse").onclick = () => {
        const modal = container.querySelector("#modalPulse");
        modal.classList.remove("hidden");
        
        // Mostrar platos aleatorios o top para preguntar
        const candidatos = db.platos.sort(() => 0.5 - Math.random()).slice(0, 5); // 5 aleatorios para testear
        
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <h3 class="text-xl font-black text-indigo-900 mb-2">🔥 Pulso del Servicio</h3>
                <p class="text-xs text-slate-500 mb-6">¿Qué se ha vendido mucho hoy? (Toca para marcar)</p>
                
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

                <button id="btnSavePulse" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700">GUARDAR PULSO</button>
                <button onclick="document.getElementById('modalPulse').classList.add('hidden')" class="w-full text-slate-400 text-xs font-bold mt-4">Saltar</button>
            </div>
        `;

        // Lógica de selección visual
        modal.querySelectorAll('.pulse-item').forEach(item => {
            item.onclick = () => {
                item.classList.toggle('bg-indigo-100');
                item.classList.toggle('border-indigo-300');
                item.querySelector('.check-circle').innerText = item.classList.contains('bg-indigo-100') ? '🔥' : '';
            };
        });

        modal.querySelector("#btnSavePulse").onclick = async () => {
            // Recoger seleccionados
            const selectedIds = [];
            modal.querySelectorAll('.pulse-item.bg-indigo-100').forEach(el => selectedIds.push(el.dataset.id));
            
            const manualId = modal.querySelector("#pulse-manual").value;
            if(manualId) selectedIds.push(manualId);

            if(selectedIds.length > 0) {
                // Sumar puntuación "soft" (p.ej. 5 puntos por salir en el pulso)
                selectedIds.forEach(id => {
                    const p = db.platos.find(x => x.id === id);
                    if(p) {
                        p.pulseScore = (p.pulseScore || 0) + 5; // Cada pulso vale por 5 ventas (aprox)
                        // p.sold = (p.sold || 0) + 1; // Opcional: sumar a ventas reales si quieres
                    }
                });
                await saveFn("Tendencias registradas 🔥");
            }
            modal.classList.add("hidden");
            render(container, supabase, db, opts);
        };
    };

    // --- EDICIÓN PLATO (Mejorada con Categorías) ---
    window.editarPlato = (id = null) => {
        container.scrollTop = 0; window.scrollTo(0,0);
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', sold: '', category: 'Principal' };
        
        const modal = container.querySelector("#modalPlato");
        modal.classList.remove("hidden");
        
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <button onclick="document.getElementById('modalPlato').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-2xl">✕</button>
                <h3 class="text-xl font-black text-slate-800 mb-6">${id ? 'Editar' : 'Crear'} Plato</h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Nombre</label>
                        <input id="p-name" value="${p.name}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                    </div>
                    
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Familia (Omnes)</label>
                        <select id="p-cat" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs border border-slate-100">
                            <option value="Entrantes" ${p.category==='Entrantes'?'selected':''}>Entrantes</option>
                            <option value="Principal" ${p.category==='Principal'?'selected':''}>Principal (Carnes/Pesc)</option>
                            <option value="Postre" ${p.category==='Postre'?'selected':''}>Postres</option>
                            <option value="Bebidas" ${p.category==='Bebidas'?'selected':''}>Bebidas</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">PVP (€)</label>
                            <input id="p-price" type="number" value="${p.price}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Coste (€)</label>
                            <input id="p-cost" type="number" value="${p.cost}" placeholder="Opcional" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-100">
                        </div>
                    </div>

                    <button id="btnSavePlato" class="w-full bg-slate-900 text-white py-3 rounded-2xl font-black shadow-lg mt-2">GUARDAR</button>
                    ${id ? `<button id="btnDelPlato" class="w-full text-rose-400 text-xs font-bold mt-2">Eliminar</button>` : ''}
                </div>
            </div>
        `;

        modal.querySelector("#btnSavePlato").onclick = async () => {
            const nuevo = {
                id: p.id,
                name: modal.querySelector("#p-name").value,
                category: modal.querySelector("#p-cat").value,
                price: parseFloat(modal.querySelector("#p-price").value) || 0,
                cost: parseFloat(modal.querySelector("#p-cost").value) || 0,
                sold: parseFloat(p.sold) || 0, // Mantenemos ventas históricas
                pulseScore: parseFloat(p.pulseScore) || 0 // Mantenemos puntuación de pulso
            };
            
            if(!nuevo.name) return alert("Falta nombre");

            if(id) {
                const idx = db.platos.findIndex(x => x.id === id);
                db.platos[idx] = nuevo;
            } else {
                db.platos.push(nuevo);
            }
            
            await saveFn("Guardado");
            modal.classList.add("hidden");
            render(container, supabase, db, opts);
        };

        if(id) {
            modal.querySelector("#btnDelPlato").onclick = async () => {
                if(confirm("¿Borrar?")) {
                    db.platos = db.platos.filter(x => x.id !== id);
                    await saveFn("Borrado");
                    modal.classList.add("hidden");
                    render(container, supabase, db, opts);
                }
            };
        }
    };

    container.querySelector("#btnAddPlato").onclick = () => window.editarPlato();
}
