/* =============================================================
   📊 DASHBOARD TOTAL: MENSUAL Y TRIMESTRAL (PC & MOBILE)
   ============================================================= */

export async function render(container, supabase, db) {
    // 1. ESTADO DE FILTROS (Por defecto mes actual)
    const hoy = new Date();
    let mesSeleccionado = hoy.getMonth(); // 0-11
    let añoSeleccionado = hoy.getFullYear();
    let modoTrimestre = false;

    const renderContenido = () => {
        const diario = db.diario || [];
        const albaranes = db.albaranes || [];
        const fijos = db.gastos_fijos || [];

        // --- FILTRADO DE DATOS ---
        const filtrar = (data) => {
            return data.filter(item => {
                const d = new Date(item.date || item.fecha);
                if (d.getFullYear() !== añoSeleccionado) return false;
                if (modoTrimestre) {
                    const trimestreActual = Math.floor(mesSeleccionado / 3);
                    const trimestreItem = Math.floor(d.getMonth() / 3);
                    return trimestreActual === trimestreItem;
                }
                return d.getMonth() === mesSeleccionado;
            });
        };

        const ventasPeriodo = filtrar(diario);
        const comprasPeriodo = filtrar(albaranes);

        // --- CÁLCULOS ---
        const totalVentas = ventasPeriodo.reduce((t, v) => t + (parseFloat(v.total) || 0), 0);
        const totalCompras = comprasPeriodo.reduce((t, c) => t + (parseFloat(c.total) || 0), 0);
        
        // Fijos (Prorrateo inteligente según el periodo)
        const totalFijosMensual = fijos.reduce((t, g) => {
            const imp = parseFloat(g.amount || 0);
            return t + (g.freq === 'anual' ? imp / 12 : g.freq === 'trimestral' ? imp / 3 : imp);
        }, 0);
        
        const fijosPeriodo = modoTrimestre ? totalFijosMensual * 3 : totalFijosMensual;
        const personalEst = totalVentas * 0.35; 
        const beneficio = totalVentas - totalCompras - fijosPeriodo - personalEst;

        // IVA para el Gestor
        const ivaSoportado = comprasPeriodo.reduce((t, c) => t + (parseFloat(c.taxes || 0)), 0);
        const ivaRepercutido = totalVentas * (10 / 110);

        // --- INTERFAZ ---
        container.innerHTML = `
            <div class="animate-fade-in p-4 space-y-6 max-w-7xl mx-auto">
                
                <div class="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap gap-4 justify-between items-center">
                    <div class="flex gap-2">
                        <button id="btnModoMes" class="px-4 py-2 rounded-xl text-[10px] font-black ${!modoTrimestre ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}">MES</button>
                        <button id="btnModoTri" class="px-4 py-2 rounded-xl text-[10px] font-black ${modoTrimestre ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}">TRIMESTRE</button>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <select id="selectMes" class="bg-transparent font-black text-slate-800 outline-none">
                            ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => 
                                `<option value="${i}" ${mesSeleccionado === i ? 'selected' : ''}>${m}</option>`
                            ).join('')}
                        </select>
                        <span class="font-black text-slate-200">/</span>
                        <input id="selectAño" type="number" value="${añoSeleccionado}" class="w-16 bg-transparent font-black text-slate-800 outline-none">
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl border-b-4 border-emerald-500">
                        <p class="text-[10px] font-bold text-slate-400 uppercase">Beneficio Neto (Est.)</p>
                        <p class="text-3xl font-black ${beneficio > 0 ? 'text-emerald-400' : 'text-rose-400'}">${beneficio.toLocaleString()}€</p>
                    </div>
                    <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <p class="text-[10px] font-bold text-slate-400 uppercase">Ventas Brutas</p>
                        <p class="text-3xl font-black text-slate-800">${totalVentas.toLocaleString()}€</p>
                    </div>
                    <div class="bg-indigo-600 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                        <p class="text-[10px] font-bold text-indigo-200 uppercase">IVA a Liquidar (Mod. 303)</p>
                        <p class="text-3xl font-black">${(ivaRepercutido - ivaSoportado).toFixed(2)}€</p>
                        <span class="absolute -right-2 -bottom-2 text-6xl opacity-10">📑</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 h-[350px]">
                         <canvas id="chartPeriodo"></canvas>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
                            <p class="text-[9px] font-black text-emerald-600 uppercase">Margen Bruto</p>
                            <p class="text-2xl font-black text-emerald-700">${totalVentas > 0 ? (((totalVentas-totalCompras)/totalVentas)*100).toFixed(1) : 0}%</p>
                        </div>
                        <div class="bg-rose-50 p-6 rounded-[2rem] border border-rose-100">
                            <p class="text-[9px] font-black text-rose-600 uppercase">Food Cost</p>
                            <p class="text-2xl font-black text-rose-700">${totalVentas > 0 ? ((totalCompras/totalVentas)*100).toFixed(1) : 0}%</p>
                        </div>
                        <div class="col-span-2 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                             <p class="text-[9px] font-black text-slate-400 uppercase">Ticket Medio Periodo</p>
                             <p class="text-2xl font-black text-slate-800">${(totalVentas / (ventasPeriodo.reduce((t,v)=>t+(parseInt(v.pax||0)),0) || 1)).toFixed(2)}€</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // --- EVENTOS DEL SELECTOR ---
        container.querySelector("#btnModoMes").onclick = () => { modoTrimestre = false; renderContenido(); };
        container.querySelector("#btnModoTri").onclick = () => { modoTrimestre = true; renderContenido(); };
        container.querySelector("#selectMes").onchange = (e) => { mesSeleccionado = parseInt(e.target.value); renderContenido(); };
        container.querySelector("#selectAño").onchange = (e) => { añoSeleccionado = parseInt(e.target.value); renderContenido(); };

        // --- GRÁFICA ---
        setTimeout(() => {
            const ctx = document.getElementById('chartPeriodo');
            if(!ctx) return;
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Compras', 'Fijos', 'Personal', 'Beneficio'],
                    datasets: [{
                        data: [totalCompras, fijosPeriodo, personalEst, Math.max(0, beneficio)],
                        backgroundColor: ['#f43f5e', '#facc15', '#10b981', '#6366f1'],
                        borderWidth: 0
                    }]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }, 100);
    };

    renderContenido();
}
