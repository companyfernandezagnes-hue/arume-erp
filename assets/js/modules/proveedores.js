/* =============================================================
   🤝 MÓDULO: PROVEEDORES 360º (Ranking + Agenda + Datos Fiscales)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});

    // 1. CÁLCULO DE DATOS (FUSIÓN: AGENDA + GASTO)
    const stats = {};

    // A. Cargar Agenda Guardada (Datos estáticos)
    if (!db.proveedores) db.proveedores = [];
    
    db.proveedores.forEach(p => {
        const key = (p.n || "").trim().toLowerCase();
        stats[key] = { 
            id: p.id, 
            n: p.n, 
            tel: p.tel || '', 
            mail: p.mail || '',
            fam: p.fam || 'General', 
            nif: p.nif || '', 
            iban: p.iban || '',
            bic: p.bic || '',
            total: 0, 
            orders: 0,
            isSaved: true 
        };
    });

    // B. Sumar Gasto Real (Desde Albaranes)
    if (!db.albaranes) db.albaranes = [];
    
    // Función auxiliar para saber si el albarán entra en el trimestre/año seleccionado
    // (Asumimos que usas la función global isInPeriod de app.js, si no, lo cuenta todo)
    const checkPeriod = window.isInPeriod ? window.isInPeriod : () => true;

    db.albaranes.forEach(a => { 
        if (checkPeriod(a.date)) {
            const key = (a.prov || "Varios").trim().toLowerCase();
            
            // Si el proveedor existe en albaranes pero no en agenda, lo creamos "al vuelo"
            if (!stats[key]) {
                stats[key] = { 
                    id: null, // Sin ID = No guardado en agenda
                    n: a.prov, 
                    tel: '', mail: '', fam: 'General', nif: '', iban: '',
                    total: 0, orders: 0, isSaved: false 
                };
            }
            stats[key].total += (a.total || 0);
            stats[key].orders += 1;
        }
    });

    // C. Convertir a Array y Ordenar por Gasto (El Ranking)
    let ranking = Object.values(stats).sort((a,b) => b.total - a.total);
    const totalCompras = ranking.reduce((acc, p) => acc + p.total, 0);

    // 2. RENDERIZADO UI
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Ranking Proveedores</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Volumen de Compra: ${Num.fmt(totalCompras)}€</p>
            </div>
            <div class="flex gap-2 w-full md:w-auto">
                <input id="searchProv" type="text" placeholder="🔍 Buscar..." class="bg-slate-50 border-0 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:w-48">
                <button class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg hover:bg-slate-800 transition" onclick="window.editarProv()">
                    + NUEVO
                </button>
            </div>
        </header>

        ${totalCompras > 0 ? `
        <div class="grid grid-cols-3 gap-2 md:gap-4 mb-2">
            ${ranking.slice(0,3).map((p, i) => {
                const colors = ['bg-yellow-50 border-yellow-200 text-yellow-700', 'bg-slate-50 border-slate-200 text-slate-700', 'bg-orange-50 border-orange-200 text-orange-700'];
                const emojis = ['👑', '🥈', '🥉'];
                if(p.total === 0) return ''; 
                return `
                <div class="p-3 rounded-2xl border ${colors[i]} text-center shadow-sm flex flex-col justify-center items-center relative overflow-hidden" onclick="window.editarProv('${p.id || ''}')">
                    <div class="text-2xl mb-1 filter drop-shadow-sm">${emojis[i]}</div>
                    <h3 class="font-black text-[10px] uppercase truncate w-full mb-1">${p.n}</h3>
                    <p class="font-mono font-bold text-xs">${Num.fmt(p.total)}€</p>
                </div>`;
            }).join('')}
        </div>
        ` : ''}

        <div id="gridProveedores" class="space-y-2"></div>
    </div>

    <div id="modalProv" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4 opacity-0 transition-opacity duration-300"></div>
    `;

    // 3. FUNCIÓN DE PINTADO DE LISTA (CON BUSCADOR)
    const pintarLista = () => {
        const term = container.querySelector("#searchProv").value.toLowerCase();
        const lista = container.querySelector("#gridProveedores");
        
        const filtered = ranking.filter(p => p.n.toLowerCase().includes(term) || p.fam.toLowerCase().includes(term));

        if (filtered.length === 0) {
            lista.innerHTML = `<div class="text-center py-10 opacity-50 italic text-sm">No se encontraron proveedores.</div>`;
            return;
        }

        lista.innerHTML = filtered.map((p, i) => {
            // Badges visuales
            const hasIBAN = p.iban && p.iban.length > 5;
            const badgeIBAN = hasIBAN 
                ? '<span class="text-[8px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-bold">SEPA OK</span>' 
                : '<span class="text-[8px] text-rose-400 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 font-bold">FALTA IBAN</span>';
            
            const badgeSaved = p.isSaved 
                ? '' 
                : '<span class="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">SIN FICHA</span>';

            return `
            <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-300 transition cursor-pointer shadow-sm relative overflow-hidden" onclick="window.editarProv('${p.id || ''}', '${p.n.replace(/'/g, "\\'")}')">
                
                <div class="flex items-center gap-3 relative z-10">
                    <div class="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100">
                        ${i + 1}
                    </div>
                    <div>
                        <div class="font-black text-slate-800 text-sm flex items-center gap-2">
                            ${p.n} ${badgeSaved}
                        </div>
                        <div class="flex gap-2 mt-1 items-center">
                            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider">${p.fam}</span>
                            ${badgeIBAN}
                        </div>
                    </div>
                </div>

                <div class="text-right relative z-10">
                    <div class="font-black text-slate-700 text-sm">${Num.fmt(p.total)}€</div>
                    <div class="text-[9px] text-slate-400 font-bold">${p.orders} pedidos</div>
                </div>

                <div class="absolute right-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    ${p.tel ? `<a href="tel:${p.tel}" onclick="event.stopPropagation()" class="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition">📞</a>` : ''}
                    ${p.mail ? `<a href="mailto:${p.mail}" onclick="event.stopPropagation()" class="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition">✉️</a>` : ''}
                </div>
            </div>`;
        }).join('');
    };

    container.querySelector("#searchProv").addEventListener('input', pintarLista);
    pintarLista(); // Pintado inicial

    // 4. LÓGICA DE EDICIÓN (MODAL COMPLETO)
    window.editarProv = (id = null, tempName = '') => {
        // Si tiene ID, buscamos en DB. Si no, miramos si venía de albaranes (tempName) o es nuevo total.
        let p = { id: generateID(), n: tempName, fam: 'General', tel: '', mail: '', cif: '', iban: '', bic: '' };
        
        if (id) {
            const found = db.proveedores.find(x => x.id === id);
            if (found) p = found;
        }

        const modal = container.querySelector("#modalProv");
        modal.classList.remove("hidden");
        requestAnimationFrame(() => modal.classList.remove("opacity-0"));

        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative overflow-y-auto max-h-[90vh]">
                <button onclick="cerrarModalProv()" class="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-2xl transition">✕</button>
                
                <h3 class="text-xl font-black text-slate-800 mb-1">${id ? 'Editar Proveedor' : 'Alta Proveedor'}</h3>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Datos Fiscales y Contacto</p>

                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Nombre Fiscal / Comercial</label>
                        <input id="p-n" type="text" value="${p.n}" placeholder="Ej. Makro" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none border border-transparent focus:border-indigo-500 transition">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Familia</label>
                            <input id="p-fam" type="text" value="${p.fam}" list="fam-list" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none">
                            <datalist id="fam-list">
                                <option value="General"><option value="Carne"><option value="Pescado"><option value="Verdura"><option value="Bebida"><option value="Alcohol"><option value="Limpieza">
                            </datalist>
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">NIF / CIF</label>
                            <input id="p-cif" type="text" value="${p.cif || ''}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none uppercase placeholder-slate-300" placeholder="B-12345678">
                        </div>
                    </div>

                    <div class="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-3">
                        <p class="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Agenda de Contacto</p>
                        <div class="flex gap-2 items-center">
                            <span class="text-lg opacity-50">📞</span>
                            <input id="p-tel" type="tel" value="${p.tel}" placeholder="Teléfono Pedidos" class="w-full p-2 bg-slate-50 rounded-lg font-bold text-sm outline-none">
                        </div>
                        <div class="flex gap-2 items-center">
                            <span class="text-lg opacity-50">✉️</span>
                            <input id="p-mail" type="email" value="${p.mail}" placeholder="Email Facturación" class="w-full p-2 bg-slate-50 rounded-lg font-bold text-sm outline-none">
                        </div>
                    </div>

                    <div class="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 space-y-3">
                        <div class="flex justify-between items-center">
                            <p class="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Datos Bancarios (Remesas)</p>
                            <span class="text-lg">🏦</span>
                        </div>
                        <input id="p-iban" type="text" value="${p.iban || ''}" placeholder="IBAN (ES00 0000...)" class="w-full p-3 bg-white rounded-xl font-mono text-xs font-bold outline-none uppercase border border-indigo-100 text-indigo-900">
                        <input id="p-bic" type="text" value="${p.bic || ''}" placeholder="BIC / SWIFT" class="w-full p-3 bg-white rounded-xl font-mono text-xs font-bold outline-none uppercase border border-indigo-100 text-indigo-900">
                    </div>

                    <button id="btnSaveProv" class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-600 transition transform hover:scale-[1.02]">GUARDAR FICHA</button>
                    
                    ${id ? `<button id="btnDelProv" class="w-full text-rose-400 text-[10px] font-bold mt-2 hover:text-rose-600 uppercase tracking-widest">Eliminar proveedor</button>` : ''}
                </div>
            </div>
        `;

        window.cerrarModalProv = () => {
            modal.classList.add("opacity-0");
            setTimeout(() => modal.classList.add("hidden"), 300);
        };

        // LÓGICA GUARDAR
        modal.querySelector("#btnSaveProv").onclick = async () => {
            const nuevo = {
                id: p.id,
                n: modal.querySelector("#p-n").value,
                fam: modal.querySelector("#p-fam").value,
                cif: modal.querySelector("#p-cif").value.toUpperCase(),
                tel: modal.querySelector("#p-tel").value,
                mail: modal.querySelector("#p-mail").value,
                iban: modal.querySelector("#p-iban").value.toUpperCase().replace(/\s/g, ''),
                bic: modal.querySelector("#p-bic").value.toUpperCase()
            };

            if(!nuevo.n) return alert("El nombre es obligatorio");

            // Buscar si ya existe para actualizar o añadir
            const idx = db.proveedores.findIndex(x => x.id === p.id);
            if (idx >= 0) db.proveedores[idx] = nuevo;
            else db.proveedores.push(nuevo);

            await saveFn("Proveedor guardado ✅");
            window.cerrarModalProv();
            render(container, supabase, db, opts); // Recargar todo para actualizar ranking
        };

        // LÓGICA BORRAR
        if(id) {
            modal.querySelector("#btnDelProv").onclick = async () => {
                if(!confirm("¿Borrar ficha de proveedor? (Los albaranes antiguos se mantendrán, pero perderás el contacto)")) return;
                db.proveedores = db.proveedores.filter(x => x.id !== id);
                await saveFn("Ficha eliminada 🗑️");
                window.cerrarModalProv();
                render(container, supabase, db, opts);
            };
        }
    };
}
