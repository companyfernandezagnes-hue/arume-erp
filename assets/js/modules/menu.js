/* =============================================================
   🍽️ MÓDULO: MENU ENGINEERING (menu.js)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZACIÓN SEGURA DE DATOS
    if (!db.platos) db.platos = []; 
    if (!Array.isArray(db.platos)) db.platos = []; // Doble check de seguridad

    // --- CÁLCULOS OMNES ---
    const calcularMatriz = () => {
        if (db.platos.length === 0) return { stars:[], horses:[], puzzles:[], dogs:[] };

        // Totales
        const totalVentas = db.platos.reduce((acc, p) => acc + (parseFloat(p.price||0) * parseFloat(p.sold||0)), 0);
        const totalUnidades = db.platos.reduce((acc, p) => acc + parseFloat(p.sold||0), 0);
        const totalCoste = db.platos.reduce((acc, p) => acc + (parseFloat(p.cost||0) * parseFloat(p.sold||0)), 0);
        
        // Evitar división por cero
        if (totalUnidades === 0) return { stars:[], horses:[], puzzles:[], dogs:[] };

        // Medias (Varas de medir)
        const margenMedio = (totalVentas - totalCoste) / totalUnidades;
        const mixIdeal = (100 / db.platos.length) * 0.7; 

        const clasificacion = { stars:[], horses:[], puzzles:[], dogs:[] };

        db.platos.forEach(p => {
            const margen = parseFloat(p.price||0) - parseFloat(p.cost||0);
            const popularidad = (parseFloat(p.sold||0) / totalUnidades) * 100;
            
            const esRentable = margen >= margenMedio;
            const esPopular = popularidad >= mixIdeal;

            p.stats = { margen, popularidad };

            if (esRentable && esPopular) { p.stats.tipo = '⭐ Estrella'; clasificacion.stars.push(p); }
            else if (!esRentable && esPopular) { p.stats.tipo = '🐴 Caballo'; clasificacion.horses.push(p); }
            else if (esRentable && !esPopular) { p.stats.tipo = '❓ Puzzle'; clasificacion.puzzles.push(p); }
            else { p.stats.tipo = '🐶 Perro'; clasificacion.dogs.push(p); }
        });

        return clasificacion;
    };

    const data = calcularMatriz();

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-20">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Menu Engineering</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Rentabilidad de la Carta</p>
            </div>
            <button id="btnAddPlato" class="mt-4 md:mt-0 bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:bg-slate-800 transition">
                + NUEVO PLATO
            </button>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div class="bg-white p-5 rounded-[2.5rem] border-2 border-yellow-100 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10 text-6xl">⭐</div>
                <h3 class="text-sm font-black text-yellow-600 uppercase mb-3">Estrellas</h3>
                <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    ${renderList(data.stars, 'yellow')}
                </div>
            </div>

            <div class="bg-white p-5 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10 text-6xl">❓</div>
                <h3 class="text-sm font-black text-indigo-600 uppercase mb-3">Puzzles</h3>
                <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    ${renderList(data.puzzles, 'indigo')}
                </div>
            </div>

            <div class="bg-white p-5 rounded-[2.5rem] border-2 border-emerald-100 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10 text-6xl">🐴</div>
                <h3 class="text-sm font-black text-emerald-600 uppercase mb-3">Caballos</h3>
                <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    ${renderList(data.horses, 'emerald')}
                </div>
            </div>

            <div class="bg-white p-5 rounded-[2.5rem] border-2 border-rose-100 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10 text-6xl">🐶</div>
                <h3 class="text-sm font-black text-rose-600 uppercase mb-3">Perros</h3>
                <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    ${renderList(data.dogs, 'rose')}
                </div>
            </div>

        </div>
    </div>

    <div id="modalPlato" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"></div>
    `;

    function renderList(list, color) {
        if (!list || list.length === 0) return `<p class="text-[10px] text-slate-300">Ningún plato aquí</p>`;
        return list.map(p => `
            <div onclick="window.editarPlato('${p.id}')" class="flex justify-between items-center p-2 bg-${color}-50 rounded-xl cursor-pointer hover:bg-${color}-100 transition">
                <span class="text-xs font-bold text-slate-700">${p.name}</span>
                <span class="text-[10px] font-black text-${color}-600">${parseFloat(p.stats?.margen||0).toFixed(2)}€ Mg.</span>
            </div>
        `).join('');
    }

    // --- EDICIÓN ---
    window.editarPlato = (id = null) => {
        container.scrollTop = 0; window.scrollTo(0,0);
        const p = id ? db.platos.find(x => x.id === id) : { id: Date.now().toString(), name: '', price: '', cost: '', sold: '' };
        
        const modal = container.querySelector("#modalPlato");
        modal.classList.remove("hidden");
        
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <button onclick="document.getElementById('modalPlato').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-2xl">✕</button>
                <h3 class="text-xl font-black text-slate-800 mb-6">${id ? 'Editar Plato' : 'Nuevo Plato'}</h3>
                
                <div class="space-y-3">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Nombre del Plato</label>
                        <input id="p-name" value="${p.name}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none border border-slate-100">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">PVP (€)</label>
                            <input id="p-price" type="number" value="${p.price}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none border border-slate-100">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Coste MP (€)</label>
                            <input id="p-cost" type="number" value="${p.cost}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none border border-slate-100">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Uds Vendidas</label>
                        <input id="p-sold" type="number" value="${p.sold}" class="w-full p-3 bg-indigo-50 text-indigo-900 rounded-xl font-black text-lg outline-none border border-indigo-100">
                    </div>

                    <button id="btnSavePlato" class="w-full bg-slate-900 text-white py-3 rounded-2xl font-black shadow-lg mt-4">GUARDAR</button>
                    ${id ? `<button id="btnDelPlato" class="w-full text-rose-400 text-xs font-bold mt-2">Eliminar</button>` : ''}
                </div>
            </div>
        `;

        modal.querySelector("#btnSavePlato").onclick = async () => {
            const nuevo = {
                id: p.id,
                name: modal.querySelector("#p-name").value,
                price: parseFloat(modal.querySelector("#p-price").value) || 0,
                cost: parseFloat(modal.querySelector("#p-cost").value) || 0,
                sold: parseFloat(modal.querySelector("#p-sold").value) || 0
            };
            
            if(!nuevo.name) return alert("Falta nombre");

            if(id) {
                const idx = db.platos.findIndex(x => x.id === id);
                db.platos[idx] = nuevo;
            } else {
                db.platos.push(nuevo);
            }
            
            await saveFn("Carta actualizada");
            modal.classList.add("hidden");
            render(container, supabase, db, opts);
        };

        if(id) {
            modal.querySelector("#btnDelPlato").onclick = async () => {
                if(!confirm("¿Borrar plato?")) return;
                db.platos = db.platos.filter(x => x.id !== id);
                await saveFn("Plato borrado");
                modal.classList.add("hidden");
                render(container, supabase, db, opts);
            };
        }
    };

    container.querySelector("#btnAddPlato").onclick = () => window.editarPlato();
}
