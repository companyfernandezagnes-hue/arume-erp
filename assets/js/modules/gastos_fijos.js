/* =============================================================
   🏢 MÓDULO: GASTOS FIJOS (Control de Pagos Mensual)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    if (!Array.isArray(db.gastos_fijos)) db.gastos_fijos = [];
    
    // Inicializar estado de pagos del mes actual si no existe
    const currentKey = `pagos_${new Date().getFullYear()}_${new Date().getMonth()}`;
    if (!db.control_pagos) db.control_pagos = {};
    if (!db.control_pagos[currentKey]) db.control_pagos[currentKey] = []; // Array de IDs pagados este mes

    const totalMensual = db.gastos_fijos.reduce((t, g) => {
        let m = parseFloat(g.amount) || 0;
        if(g.freq === 'anual') m /= 12;
        if(g.freq === 'trimestral') m /= 3;
        return t + m;
    }, 0);

    // INTERFAZ
    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Gastos Recurrentes</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control de Pagos ${new Date().toLocaleDateString('es-ES', {month:'long'})}</p>
            </div>
            <div class="text-right mt-4 md:mt-0">
                <p class="text-[9px] font-black text-slate-400 uppercase">Mochila Mensual</p>
                <p class="text-2xl font-black text-slate-800">${totalMensual.toLocaleString('es-ES')}€</p>
            </div>
        </header>

        <button id="btnNuevo" class="w-full py-4 rounded-[2rem] bg-indigo-50 text-indigo-600 font-black text-xs hover:bg-indigo-100 transition border border-indigo-100 border-dashed">
            + AÑADIR NUEVO GASTO FIJO
        </button>

        <div id="listaGastos" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20"></div>
    </div>

    <div id="modalGasto" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4"></div>
    `;

    // RENDER LISTA
    const pintar = () => {
        const lista = container.querySelector("#listaGastos");
        const pagados = db.control_pagos[currentKey];

        lista.innerHTML = db.gastos_fijos.map(g => {
            const isPaid = pagados.includes(g.id);
            
            return `
            <div class="bg-white p-5 rounded-[2rem] border ${isPaid ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'} shadow-sm relative group transition-all">
                
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${getIcon(g.cat)}</span>
                        <div>
                            <h4 class="font-black text-slate-800 leading-none cursor-pointer hover:text-indigo-600" onclick="window.editarGasto('${g.id}')">${g.name}</h4>
                            <span class="text-[9px] text-slate-400 font-bold uppercase">${g.freq}</span>
                        </div>
                    </div>
                    <div onclick="window.togglePago('${g.id}')" class="cursor-pointer">
                        ${isPaid 
                            ? `<span class="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg shadow-emerald-200">PAGADO</span>` 
                            : `<span class="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black hover:bg-slate-200 transition">PENDIENTE</span>`
                        }
                    </div>
                </div>

                <div class="flex justify-between items-end mt-4">
                    <div>
                        <p class="text-[9px] text-slate-400 font-bold uppercase">Importe</p>
                        <p class="text-xl font-black text-slate-800">${parseFloat(g.amount).toLocaleString()}€</p>
                    </div>
                    ${!isPaid ? `
                        <button onclick="window.togglePago('${g.id}')" class="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition">
                            Marcar Pagado
                        </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');
    };

    // LOGICA PAGOS
    window.togglePago = async (id) => {
        const pagados = db.control_pagos[currentKey];
        const idx = pagados.indexOf(id);
        const gasto = db.gastos_fijos.find(x => x.id === id);

        if (idx === -1) {
            // Marcar como pagado
            pagados.push(id);
            
            // Opcional: Crear movimiento en Banco automáticamente
            if(confirm(`¿Quieres registrar la salida de ${gasto.amount}€ en el Banco automáticamente?`)) {
                if(!db.banco) db.banco = [];
                db.banco.push({
                    id: Date.now(),
                    date: new Date().toLocaleDateString('es-ES'),
                    desc: `Pago: ${gasto.name}`,
                    amount: -Math.abs(parseFloat(gasto.amount)),
                    status: 'reconciled' // Ya nace conciliado porque lo creamos nosotros
                });
            }
            await saveFn("Pago registrado ✅");
        } else {
            // Desmarcar
            pagados.splice(idx, 1);
            await saveFn("Pago desmarcado");
        }
        pintar();
    };

    // EDICIÓN (Simplificada para no alargar)
    window.editarGasto = (id = null) => {
        const g = id ? db.gastos_fijos.find(x => x.id === id) : { id: Date.now().toString(), name: '', amount: '', freq: 'mensual', cat: 'varios' };
        const modal = container.querySelector("#modalGasto");
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
                <h3 class="text-xl font-black text-slate-800 mb-4">${id?'Editar':'Nuevo'} Gasto</h3>
                <input id="g-name" value="${g.name}" placeholder="Nombre" class="w-full p-3 mb-2 bg-slate-50 rounded-xl font-bold border-0">
                <input id="g-amount" type="number" value="${g.amount}" placeholder="Importe" class="w-full p-3 mb-2 bg-slate-50 rounded-xl font-bold border-0">
                <select id="g-freq" class="w-full p-3 mb-4 bg-slate-50 rounded-xl font-bold border-0"><option value="mensual">Mensual</option><option value="anual">Anual</option></select>
                <button id="btnSave" class="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Guardar</button>
                <button onclick="document.getElementById('modalGasto').classList.add('hidden')" class="w-full mt-2 text-slate-400 text-xs font-bold">Cancelar</button>
                ${id ? `<button onclick="window.borrarGasto('${g.id}')" class="w-full mt-4 text-rose-500 text-xs font-bold">Eliminar</button>` : ''}
            </div>
        `;
        modal.querySelector("#btnSave").onclick = async () => {
            const nuevo = { ...g, name: document.getElementById('g-name').value, amount: document.getElementById('g-amount').value, freq: document.getElementById('g-freq').value };
            if(id) db.gastos_fijos[db.gastos_fijos.findIndex(x=>x.id===id)] = nuevo;
            else db.gastos_fijos.push(nuevo);
            await saveFn("Guardado");
            modal.classList.add("hidden");
            pintar();
        };
    };

    window.borrarGasto = async (id) => {
        if(confirm("¿Borrar?")) {
            db.gastos_fijos = db.gastos_fijos.filter(x => x.id !== id);
            await saveFn("Borrado");
            document.getElementById('modalGasto').classList.add('hidden');
            pintar();
        }
    };

    container.querySelector("#btnNuevo").onclick = () => window.editarGasto();
    function getIcon(c) { return '🏢'; } // Simplificado
    pintar();
}
