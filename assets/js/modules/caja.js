/* =============================================================
   💰 MÓDULO: CAJA PRO (Edición, Filtros y Exportación Excel)
   ============================================================= */
export async function render(container, supabase, db) {
    if (!db.diario) db.diario = [];

    let mesVer = new Date().getMonth();
    let añoVer = new Date().getFullYear();
    let vistaTrimestral = false;

    const save = async () => {
        db.lastSync = Date.now();
        await supabase.from('arume_data').upsert({ id: 1, data: db });
    };

    const draw = () => {
        // --- FILTRADO INTELIGENTE ---
        const cierresFiltrados = db.diario.filter(c => {
            const d = new Date(c.date || c.fecha);
            if (d.getFullYear() !== añoVer) return false;
            if (vistaTrimestral) {
                const triActual = Math.floor(mesVer / 3);
                const triItem = Math.floor(d.getMonth() / 3);
                return triActual === triItem;
            }
            return d.getMonth() === mesVer;
        }).sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha));

        // --- CÁLCULOS RÁPIDOS ---
        const totalVentas = cierresFiltrados.reduce((t, c) => t + (parseFloat(c.total) || 0), 0);

        container.innerHTML = `
            <div class="animate-fade-in p-4 space-y-6 max-w-5xl mx-auto">
                <header class="bg-white p-6 rounded-[2.5rem] shadow-sm flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h2 class="text-xl font-black text-slate-800">Control de Caja</h2>
                        <div class="flex gap-2 mt-1">
                            <button id="togglePeriodo" class="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">
                                ${vistaTrimestral ? 'Viendo Trimestre' : 'Viendo Mes'}
                            </button>
                            <select id="selMes" class="text-[10px] font-black uppercase bg-transparent outline-none">
                                ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => `<option value="${i}" ${mesVer===i?'selected':''}>${m}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button id="btnExport" class="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl text-[10px] font-black border border-emerald-100">EXCEL/CSV</button>
                        <button onclick="window.abrirEditorCierre()" class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg">+ NUEVO</button>
                    </div>
                </header>

                <div class="bg-indigo-600 text-white p-6 rounded-[2.5rem] shadow-xl flex justify-between items-center">
                    <div>
                        <p class="text-[10px] font-bold opacity-60 uppercase tracking-widest">Ventas del Periodo</p>
                        <p class="text-3xl font-black">${totalVentas.toLocaleString('es-ES')}€</p>
                    </div>
                    <div class="text-right text-[10px] font-bold opacity-60 uppercase">
                        ${cierresFiltrados.length} Cierres
                    </div>
                </div>

                <div id="listaCierres" class="grid gap-3">
                    ${cierresFiltrados.map(c => `
                        <div onclick="window.abrirEditorCierre('${c.id}')" class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 transition">
                            <div>
                                <p class="font-black text-slate-800">${new Date(c.date).toLocaleDateString('es-ES', {day:'2-digit', month:'long'})}</p>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">TPV: ${(parseFloat(c.tpv||0)+parseFloat(c.madisa||0)).toFixed(2)}€ | Efec: ${parseFloat(c.cash||0).toFixed(2)}€</p>
                            </div>
                            <p class="font-black text-indigo-600 text-lg">${parseFloat(c.total).toFixed(2)}€</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div id="modalCaja" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[600] flex justify-center items-center p-4"></div>
        `;

        // Eventos
        container.querySelector("#selMes").onchange = (e) => { mesVer = parseInt(e.target.value); draw(); };
        container.querySelector("#togglePeriodo").onclick = () => { vistaTrimestral = !vistaTrimestral; draw(); };
        container.querySelector("#btnExport").onclick = () => exportarDatos(cierresFiltrados);
    };

    // --- EDITOR CON TODOS LOS CAMPOS ---
    window.abrirEditorCierre = (id = null) => {
        const modal = container.querySelector("#modalCaja");
        const c = id ? db.diario.find(x => x.id === id) : { 
            date: new Date().toISOString().split('T')[0], total: 0, cash: 0, expenses: 0, tpv: 0, madisa: 0, amex: 0, uber: 0, glovo: 0, app: 0 
        };

        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-black mb-6 text-slate-800">${id ? 'EDITAR CIERRE' : 'NUEVO CIERRE'}</h3>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <input type="date" id="c-date" value="${c.date}" class="p-4 bg-slate-50 rounded-2xl font-bold border-0">
                    <input type="text" id="c-user" value="${c.usuario || ''}" placeholder="Usuario" class="p-4 bg-slate-50 rounded-2xl font-bold border-0">
                </div>

                <div class="space-y-4">
                    <div class="bg-emerald-50 p-5 rounded-[2rem] border border-emerald-100">
                        <p class="text-[10px] font-black text-emerald-600 uppercase mb-3">Efectivo</p>
                        <div class="grid grid-cols-2 gap-3">
                            <input type="number" id="c-cash" value="${c.cash}" placeholder="Caja" class="p-3 rounded-xl border-0 font-bold text-center" oninput="recalc()">
                            <input type="number" id="c-expenses" value="${c.expenses}" placeholder="Gastos" class="p-3 rounded-xl border-0 font-bold text-center text-red-500" oninput="recalc()">
                        </div>
                    </div>

                    <div class="bg-indigo-50 p-5 rounded-[2rem] border border-indigo-100">
                        <p class="text-[10px] font-black text-indigo-600 uppercase mb-3">Tarjetas</p>
                        <div class="grid grid-cols-3 gap-2">
                            <input type="number" id="c-tpv" value="${c.tpv}" placeholder="TPV" class="p-2 rounded-xl border-0 font-bold text-center text-xs" oninput="recalc()">
                            <input type="number" id="c-madisa" value="${c.madisa}" placeholder="Madisa" class="p-2 rounded-xl border-0 font-bold text-center text-xs" oninput="recalc()">
                            <input type="number" id="c-amex" value="${c.amex}" placeholder="AMEX" class="p-2 rounded-xl border-0 font-bold text-center text-xs" oninput="recalc()">
                        </div>
                    </div>

                    <div class="bg-amber-50 p-5 rounded-[2rem] border border-amber-100">
                        <p class="text-[10px] font-black text-amber-600 uppercase mb-3">Delivery</p>
                        <div class="grid grid-cols-3 gap-2">
                            <input type="number" id="c-uber" value="${c.uber}" placeholder="Uber" class="p-2 rounded-xl border-0 font-bold text-center text-xs" oninput="recalc()">
                            <input type="number" id="c-glovo" value="${c.glovo}" placeholder="Glovo" class="p-2 rounded-xl border-0 font-bold text-center text-xs" oninput="recalc()">
                            <input type="number" id="c-app" value="${c.app}" placeholder="Otros" class="p-2 rounded-xl border-0 font-bold text-center text-xs" oninput="recalc()">
                        </div>
                    </div>
                </div>

                <div class="mt-6 flex justify-between items-center p-4">
                    <span class="font-black text-slate-400 uppercase">Total Bruto</span>
                    <span id="c-total-display" class="text-4xl font-black text-slate-900">${parseFloat(c.total).toFixed(2)}€</span>
                </div>

                <div class="grid grid-cols-2 gap-4 mt-6">
                    <button id="btnSaveCierre" class="bg-slate-900 text-white py-5 rounded-[2rem] font-black shadow-xl">GUARDAR</button>
                    <button onclick="document.getElementById('modalCaja').classList.add('hidden')" class="text-slate-400 font-bold">CANCELAR</button>
                </div>
                ${id ? `<button id="btnDelCierre" class="w-full mt-4 text-rose-500 font-bold text-xs">ELIMINAR CIERRE</button>` : ''}
            </div>
        `;

        window.recalc = () => {
            const ids = ['c-cash', 'c-tpv', 'c-madisa', 'c-amex', 'c-uber', 'c-glovo', 'c-app'];
            const sum = ids.reduce((a, b) => a + (parseFloat(document.getElementById(b).value) || 0), 0);
            const exp = parseFloat(document.getElementById('c-expenses').value) || 0;
            document.getElementById('c-total-display').innerText = (sum - exp).toFixed(2) + '€';
        };

        document.getElementById("btnSaveCierre").onclick = async () => {
            const total = parseFloat(document.getElementById('c-total-display').innerText);
            const nuevo = {
                id: id || Date.now().toString(),
                date: document.getElementById('c-date').value,
                usuario: document.getElementById('c-user').value,
                cash: parseFloat(document.getElementById('c-cash').value) || 0,
                expenses: parseFloat(document.getElementById('c-expenses').value) || 0,
                tpv: parseFloat(document.getElementById('c-tpv').value) || 0,
                madisa: parseFloat(document.getElementById('c-madisa').value) || 0,
                amex: parseFloat(document.getElementById('c-amex').value) || 0,
                uber: parseFloat(document.getElementById('c-uber').value) || 0,
                glovo: parseFloat(document.getElementById('c-glovo').value) || 0,
                app: parseFloat(document.getElementById('c-app').value) || 0,
                total: total
            };

            if (id) {
                const idx = db.diario.findIndex(x => x.id === id);
                db.diario[idx] = nuevo;
            } else {
                db.diario.push(nuevo);
            }

            await save();
            modal.classList.add("hidden");
            draw();
        };

        if (id) {
            document.getElementById("btnDelCierre").onclick = async () => {
                if (!confirm("¿Borrar permanentemente?")) return;
                db.diario = db.diario.filter(x => x.id !== id);
                await save();
                modal.classList.add("hidden");
                draw();
            };
        }
    };

    function exportarDatos(datos) {
        const headers = ["Fecha", "Usuario", "Efectivo", "Gastos", "TPV", "Madisa", "AMEX", "Uber", "Glovo", "App/Otros", "Total Diario"];
        const rows = datos.map(c => [
            c.date, c.usuario || 'Staff', c.cash, c.expenses, c.tpv, c.madisa, c.amex, c.uber, c.glovo, c.app, c.total
        ]);
        const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Caja_Arume_${new Date().getTime()}.csv`;
        link.click();
    }

    draw();
}
