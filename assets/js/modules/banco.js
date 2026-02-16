/* =============================================================
   🏦 MÓDULO: TESORERÍA & CONCILIACIÓN (El Banco en tu App)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZAR DATOS
    if(!db.banco) db.banco = []; // Aquí guardaremos lo que importes del banco
    if(!db.facturas) db.facturas = []; // Ingresos (Cierres Z)
    if(!db.albaranes) db.albaranes = []; // Gastos (Proveedores)

    // Calcular Saldo de los movimientos importados pendientes
    const saldoPendiente = db.banco
        .filter(b => b.status === 'pending')
        .reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-20">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4">
            <div>
                <h2 class="text-xl font-black text-slate-800">Tesorería & Banco</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Conciliación Inteligente</p>
            </div>
            
            <div class="flex gap-2 items-center">
                <div class="text-right hidden md:block mr-2">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Por conciliar</p>
                    <p class="text-lg font-black ${saldoPendiente>=0?'text-emerald-600':'text-rose-500'}">
                        ${saldoPendiente.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}
                    </p>
                </div>
                
                <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 shadow-lg">
                    <span>📥</span> SUBIR EXCEL/CSV BANCO
                    <input type="file" id="bankCsv" class="hidden" accept=".csv,.txt">
                </label>
            </div>
        </header>

        <div id="work-area" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="space-y-4">
                <div class="flex justify-between items-end px-2">
                    <h3 class="text-xs font-black text-slate-400 uppercase">Extracto Bancario</h3>
                    <button id="btnClearBank" class="text-[9px] text-rose-400 font-bold hover:underline">Limpiar conciliados</button>
                </div>
                
                <div id="list-bank" class="space-y-3 h-[500px] overflow-y-auto custom-scrollbar pb-10">
                    <div class="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                        <span class="text-4xl">🏦</span>
                        <p class="text-xs">Sube tu extracto para empezar</p>
                    </div>
                </div>
            </div>

            <div class="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 relative h-[500px] flex flex-col shadow-inner">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-50"></div>
                
                <h3 class="text-xs font-black text-indigo-500 uppercase mb-4 flex items-center gap-2">
                    <span>🤖</span> Arume Brain (Coincidencias)
                </h3>
                
                <div id="match-panel" class="flex-1 flex flex-col">
                    <div class="flex-1 flex flex-col justify-center items-center text-center opacity-50">
                        <span class="text-4xl animate-bounce mb-2">👈</span>
                        <p class="text-sm font-bold text-slate-400">Selecciona un movimiento<br>de la izquierda</p>
                    </div>
                </div>
            </div>

        </div>
    </div>
    `;

    // --- VARIABLES Y SELECTORES ---
    const listBank = container.querySelector("#list-bank");
    const matchPanel = container.querySelector("#match-panel");
    let selectedBankId = null;

    // --- 1. IMPORTAR CSV (Lógica de lectura) ---
    container.querySelector("#bankCsv").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target.result;
            // Intentar detectar separador (; o ,)
            const lines = text.split('\n');
            let imported = 0;

            lines.forEach((line, idx) => {
                if(idx === 0 || !line.trim()) return; // Saltar cabecera
                
                // Limpieza básica de CSV
                const cols = line.includes(';') ? line.split(';') : line.split(',');
                
                // FORMATO ESPERADO GENÉRICO: Fecha | Concepto | Importe
                // (Ajustar índices [0],[1],[2] según tu banco si falla)
                if(cols.length >= 3) {
                    const date = cols[0].trim(); 
                    const desc = cols[1].trim().replace(/"/g, '');
                    // Limpiar importe (quitar € y cambiar coma por punto)
                    let amountStr = cols[2] || cols[3] || "0"; 
                    if(cols.length > 3 && !cols[2].match(/[0-9]/)) amountStr = cols[3]; // A veces hay columnas extra
                    
                    const amount = parseFloat(amountStr.replace(/[^0-9,-]/g, '').replace(',','.'));

                    if(!isNaN(amount)) {
                        // Evitar duplicados exactos
                        const exists = db.banco.some(b => b.date === date && b.desc === desc && Math.abs(b.amount - amount) < 0.01);
                        if(!exists) {
                            db.banco.push({
                                id: 'bank-' + Date.now() + Math.random(),
                                date: date,
                                desc: desc,
                                amount: amount,
                                status: 'pending' // pending | matched
                            });
                            imported++;
                        }
                    }
                }
            });

            await saveFn(`Importados ${imported} movimientos 📥`);
            renderBankList();
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // --- 2. RENDERIZAR LISTA IZQUIERDA ---
    const renderBankList = () => {
        const pending = db.banco.filter(b => b.status === 'pending').sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if(pending.length === 0 && db.banco.length > 0) {
            listBank.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-emerald-500 gap-2"><span class="text-4xl">🎉</span><p class="font-bold">¡Todo Conciliado!</p></div>`;
            return;
        } else if (pending.length === 0) {
            return; // Mantiene el mensaje "Sube tu extracto"
        }

        listBank.innerHTML = pending.map(b => `
            <div onclick="window.selectBankItem('${b.id}')" 
                 class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-300 transition group relative ${selectedBankId===b.id ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''}">
                <div class="flex justify-between items-center">
                    <div class="w-2/3">
                        <p class="font-bold text-slate-700 text-xs truncate" title="${b.desc}">${b.desc}</p>
                        <p class="text-[9px] text-slate-400 font-mono mt-1">${b.date}</p>
                    </div>
                    <span class="font-black text-sm ${b.amount < 0 ? 'text-slate-800' : 'text-emerald-500'}">
                        ${b.amount > 0 ? '+' : ''}${b.amount.toFixed(2)}€
                    </span>
                </div>
                ${selectedBankId===b.id ? '<div class="absolute -right-2 top-1/2 -translate-y-1/2 text-2xl animate-pulse">👉</div>' : ''}
            </div>
        `).join('');
    };

    // --- 3. SELECCIONAR Y BUSCAR COINCIDENCIAS (CEREBRO) ---
    window.selectBankItem = (id) => {
        selectedBankId = id;
        renderBankList();
        
        const item = db.banco.find(b => b.id === id);
        if(!item) return;

        // BUSCADOR DE COINCIDENCIAS
        let html = `<div class="animate-fade-in w-full h-full flex flex-col">`;
        
        // Tarjeta del item seleccionado
        html += `
            <div class="bg-white p-4 rounded-2xl border border-indigo-100 mb-6 shadow-sm">
                <p class="text-[9px] font-black text-indigo-400 uppercase">Movimiento Banco Seleccionado</p>
                <p class="font-bold text-slate-800 text-sm mt-1 mb-1">${item.desc}</p>
                <p class="font-black text-2xl ${item.amount>0?'text-emerald-600':'text-slate-800'}">${item.amount.toFixed(2)}€</p>
                <p class="text-[10px] text-slate-400 mt-2">Fecha: ${item.date}</p>
            </div>
        `;

        // Buscar matches
        let matches = [];
        const tolerance = 0.05; // Margen de error de 5 céntimos

        if(item.amount > 0) {
            // INGRESOS -> Buscar en FACTURAS (Cierres Z o Facturas emitidas)
            db.facturas.filter(f => !f.reconciled).forEach(f => {
                const diff = Math.abs(parseFloat(f.total) - item.amount);
                if(diff <= tolerance) matches.push({ type: 'Factura/Z', data: f, score: 100 });
                else if (diff < 5) matches.push({ type: 'Factura/Z', data: f, score: 50 }); // Coincidencia cercana
            });
        } else {
            // GASTOS -> Buscar en ALBARANES (Gastos proveedores)
            const target = Math.abs(item.amount);
            db.albaranes.filter(a => !a.reconciled).forEach(a => {
                const diff = Math.abs(parseFloat(a.total) - target);
                // Coincidencia exacta importe
                if(diff <= tolerance) matches.push({ type: 'Gasto', data: a, score: 100 });
                // Coincidencia nombre proveedor (si el texto del banco contiene el nombre del proveedor)
                else if (item.desc.toLowerCase().includes((a.prov||'').toLowerCase()) && diff < 10) {
                    matches.push({ type: 'Gasto', data: a, score: 80 });
                }
            });
        }

        matches.sort((a,b) => b.score - a.score);

        if(matches.length > 0) {
            html += `<p class="text-[10px] font-black text-slate-400 uppercase mb-3 px-2">Posibles Coincidencias en ERP</p>`;
            html += `<div class="space-y-2 overflow-y-auto custom-scrollbar flex-1 pb-4">`;
            html += matches.map(m => `
                <div class="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center hover:border-emerald-400 transition cursor-pointer" 
                     onclick="window.confirmMatch('${item.id}', '${m.data.id}', '${m.type}')">
                    <div>
                        <span class="bg-slate-100 text-[8px] font-bold px-2 py-0.5 rounded text-slate-500 uppercase">${m.type}</span>
                        <p class="font-bold text-xs text-slate-700 mt-1">${m.data.cliente || m.data.prov || m.data.numero}</p>
                        <p class="text-[9px] text-slate-400">${m.data.date} · Total: ${parseFloat(m.data.total).toFixed(2)}€</p>
                    </div>
                    <button class="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md hover:scale-110 transition">🔗</button>
                </div>
            `).join('');
            html += `</div>`;
        } else {
            html += `
                <div class="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <span class="text-3xl mb-2">🤷‍♂️</span>
                    <p class="text-xs font-bold">No encuentro este movimiento.</p>
                    <p class="text-[10px]">¿Es una comisión o gasto sin factura?</p>
                </div>
            `;
        }

        // ACCIONES RÁPIDAS (CREAR GASTO)
        if(item.amount < 0 && matches.length === 0) {
            html += `
                <div class="mt-4 pt-4 border-t border-slate-200">
                    <button onclick="window.createExpenseFromBank('${item.id}')" class="w-full bg-indigo-600 text-white py-3 rounded-xl text-xs font-black shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                        <span>⚡</span> CREAR GASTO AUTOMÁTICO
                    </button>
                    <p class="text-[9px] text-center text-slate-400 mt-2">Se creará un albarán con el concepto del banco</p>
                </div>
            `;
        }

        html += `</div>`;
        matchPanel.innerHTML = html;
    };

    // --- 4. CONFIRMAR MATCH ---
    window.confirmMatch = async (bankId, erpId, type) => {
        // 1. Marcar Banco
        const bItem = db.banco.find(b => b.id === bankId);
        if(bItem) bItem.status = 'matched';

        // 2. Marcar ERP (Factura o Albarán)
        if(type === 'Gasto') {
            const alb = db.albaranes.find(a => a.id === erpId);
            if(alb) { alb.reconciled = true; alb.paid = true; }
        } else {
            const fra = db.facturas.find(f => f.id === erpId);
            if(fra) { fra.reconciled = true; fra.paid = true; }
        }

        await saveFn("Movimiento conciliado ✅");
        selectedBankId = null;
        renderBankList();
        matchPanel.innerHTML = `<div class="flex-1 flex flex-col justify-center items-center text-emerald-500 animate-pulse"><span class="text-4xl">✨</span><p class="font-bold mt-2">¡Conciliado!</p></div>`;
    };

    // --- 5. CREAR GASTO RÁPIDO (MAGIA) ---
    window.createExpenseFromBank = async (bankId) => {
        const item = db.banco.find(b => b.id === bankId);
        if(!item) return;

        const concepto = prompt("Confirma el concepto del gasto:", item.desc) || item.desc;
        const importe = Math.abs(item.amount);

        // Crear Albarán automáticamente
        db.albaranes.push({
            id: 'auto-' + Date.now(),
            date: item.date, // Usamos fecha del banco
            prov: concepto, // Usamos descripción como proveedor
            num: "BANCO",
            total: importe,
            base: importe, // Asumimos exento/incluido para simplificar
            tax: 0,
            paid: true,
            reconciled: true, // Nace ya conciliado
            notes: "Creado desde Extracto Bancario"
        });

        // Marcar banco como matched
        item.status = 'matched';

        await saveFn("Gasto creado y conciliado ⚡");
        selectedBankId = null;
        renderBankList();
        matchPanel.innerHTML = `<div class="flex-1 flex flex-col justify-center items-center text-indigo-500"><span class="text-4xl">⚡</span><p class="font-bold mt-2">Gasto Registrado</p></div>`;
    };

    // Botón Limpiar
    container.querySelector("#btnClearBank").onclick = async () => {
        if(confirm("¿Borrar del listado los movimientos ya conciliados (verde)?")) {
            // Solo dejamos los pending o los borramos del array visual?
            // Mejor: en DB se quedan, pero podemos filtrar o borrar los muy viejos.
            // Opción simple: Borrar matched
            db.banco = db.banco.filter(b => b.status === 'pending');
            await saveFn("Limpieza completada");
            renderBankList();
        }
    };

    // Render inicial
    renderBankList();
}
