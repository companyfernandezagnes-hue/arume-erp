/* =============================================================
   🤝 MÓDULO: PROVEEDORES PRO (Agenda & Datos Bancarios)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. Asegurar estructura de datos
    if (!Array.isArray(db.proveedores)) db.proveedores = [];

    // 2. UI PRINCIPAL
    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Agenda Proveedores</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Contactos y Datos Bancarios</p>
            </div>
            <div class="flex gap-2 mt-4 md:mt-0">
                <div class="relative group">
                    <span class="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    <input id="searchProv" type="text" placeholder="Buscar empresa..." class="pl-8 pr-4 py-2 bg-slate-50 rounded-2xl text-xs font-bold border-0 outline-none focus:ring-2 focus:ring-indigo-500 transition w-full md:w-64">
                </div>
                <button id="btnNuevo" class="bg-slate-900 text-white px-5 py-2 rounded-2xl text-[10px] font-black shadow-lg hover:bg-slate-800 transition transform active:scale-95">
                    + NUEVO
                </button>
            </div>
        </header>

        <div class="grid grid-cols-2 gap-4">
            <div class="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-lg">
                <p class="text-[10px] font-bold opacity-70 uppercase">Total Fichas</p>
                <p class="text-3xl font-black">${db.proveedores.length}</p>
            </div>
            <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Sin IBAN (No remesables)</p>
                <p class="text-3xl font-black text-rose-500">${db.proveedores.filter(p => !p.iban).length}</p>
            </div>
        </div>

        <div id="gridProveedores" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20"></div>
    </div>

    <div id="modalProv" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4"></div>
    `;

    const grid = container.querySelector("#gridProveedores");
    const searchInput = container.querySelector("#searchProv");

    // --- 3. RENDERIZADO DE LA LISTA ---
    const pintar = () => {
        const term = searchInput.value.toLowerCase();
        const filtered = db.proveedores.filter(p => 
            (p.n || '').toLowerCase().includes(term) || 
            (p.fam || '').toLowerCase().includes(term)
        ).sort((a,b) => a.n.localeCompare(b.n));

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-10 opacity-50 italic">No se encontraron proveedores</div>`;
            return;
        }

        grid.innerHTML = filtered.map(p => `
            <div onclick="window.editarProv('${p.id}')" class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer relative group">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-black text-slate-800 text-lg leading-tight">${p.n}</h3>
                        <span class="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase mt-1 inline-block">${p.fam || 'General'}</span>
                    </div>
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${p.iban ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}">
                        ${p.iban ? '€' : '!'}
                    </div>
                </div>
                
                <div class="space-y-2 mt-4">
                    <div class="flex items-center gap-2">
                        <span class="text-slate-300 text-xs">📞</span>
                        <a href="tel:${p.tel}" onclick="event.stopPropagation()" class="text-xs font-bold text-slate-600 hover:text-indigo-600">${p.tel || 'Sin teléfono'}</a>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-slate-300 text-xs">✉️</span>
                        <a href="mailto:${p.mail}" onclick="event.stopPropagation()" class="text-xs font-bold text-slate-600 hover:text-indigo-600 truncate">${p.mail || 'Sin email'}</a>
                    </div>
                </div>

                ${!p.cif ? '<p class="absolute bottom-4 right-4 text-[8px] text-rose-400 font-bold uppercase">Falta CIF</p>' : ''}
            </div>
        `).join('');
    };

    searchInput.addEventListener('input', pintar);
    container.querySelector("#btnNuevo").onclick = () => window.editarProv();

    // --- 4. EDICIÓN / CREACIÓN ---
    window.editarProv = (id = null) => {
        const p = id ? db.proveedores.find(x => x.id === id) : { 
            id: Date.now().toString(), n: '', fam: '', tel: '', mail: '', cif: '', iban: '', bic: '' 
        };

        const modal = container.querySelector("#modalProv");
        modal.classList.remove("hidden");

        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative overflow-y-auto max-h-[90vh]">
                <button onclick="document.getElementById('modalProv').classList.add('hidden')" class="absolute top-6 right-6 text-slate-300 text-2xl">✕</button>
                
                <h3 class="text-xl font-black text-slate-800 mb-6">${id ? 'Editar Ficha' : 'Alta Proveedor'}</h3>

                <div class="space-y-5">
                    <div class="space-y-3">
                        <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Datos Generales</p>
                        <input id="p-n" type="text" value="${p.n}" placeholder="Nombre Comercial (ej. Makro)" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none border border-transparent focus:border-indigo-500">
                        <div class="grid grid-cols-2 gap-3">
                            <input id="p-fam" type="text" value="${p.fam}" placeholder="Familia (Vinos...)" class="p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none">
                            <input id="p-cif" type="text" value="${p.cif||''}" placeholder="CIF / NIF" class="p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none uppercase">
                        </div>
                    </div>

                    <div class="space-y-3">
                        <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Agenda</p>
                        <div class="flex gap-2">
                            <span class="p-3 bg-slate-100 rounded-xl">📞</span>
                            <input id="p-tel" type="tel" value="${p.tel}" placeholder="Teléfono" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none">
                        </div>
                        <div class="flex gap-2">
                            <span class="p-3 bg-slate-100 rounded-xl">✉️</span>
                            <input id="p-mail" type="email" value="${p.mail}" placeholder="Email pedidos" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none">
                        </div>
                    </div>

                    <div class="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div class="flex justify-between items-center">
                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Domiciliación SEPA</p>
                            <span class="text-lg">🏦</span>
                        </div>
                        <input id="p-iban" type="text" value="${p.iban||''}" placeholder="IBAN (ES...)" class="w-full p-3 bg-white rounded-xl font-mono text-xs font-bold outline-none uppercase border border-slate-200 focus:border-indigo-500">
                        <input id="p-bic" type="text" value="${p.bic||''}" placeholder="BIC / SWIFT" class="w-full p-3 bg-white rounded-xl font-mono text-xs font-bold outline-none uppercase border border-slate-200">
                    </div>

                    <button id="btnSaveProv" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-600 transition">GUARDAR FICHA</button>
                    
                    ${id ? `<button id="btnDelProv" class="w-full text-rose-400 text-xs font-bold mt-2 hover:text-rose-600">Eliminar contacto</button>` : ''}
                </div>
            </div>
        `;

        modal.querySelector("#btnSaveProv").onclick = async () => {
            const nuevo = {
                id: p.id,
                n: modal.querySelector("#p-n").value,
                fam: modal.querySelector("#p-fam").value,
                cif: modal.querySelector("#p-cif").value,
                tel: modal.querySelector("#p-tel").value,
                mail: modal.querySelector("#p-mail").value,
                iban: modal.querySelector("#p-iban").value,
                bic: modal.querySelector("#p-bic").value
            };

            if(!nuevo.n) return alert("El nombre es obligatorio");

            if(id) {
                const idx = db.proveedores.findIndex(x => x.id === id);
                db.proveedores[idx] = nuevo;
            } else {
                db.proveedores.push(nuevo);
            }

            await saveFn("Proveedor guardado");
            modal.classList.add("hidden");
            pintar();
        };

        if(id) {
            modal.querySelector("#btnDelProv").onclick = async () => {
                if(!confirm("¿Borrar este proveedor?")) return;
                db.proveedores = db.proveedores.filter(x => x.id !== id);
                await saveFn("Proveedor eliminado");
                modal.classList.add("hidden");
                pintar();
            };
        }
    };

    // Inicializar
    pintar();
}
