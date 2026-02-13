/* =============================================================
   🏦 MÓDULO: TESORERÍA PRO (Conciliación Inteligente)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    if(!db.banco) db.banco = []; // Movimientos importados

    // Calcular Saldo Teórico (Suma de todos los movimientos importados)
    const saldoTeorico = db.banco.reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Conciliación Bancaria</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Saldo Importado: <span class="${saldoTeorico>=0?'text-emerald-500':'text-rose-500'}">${saldoTeorico.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</span></p>
            </div>
            <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 shadow-lg mt-4 md:mt-0">
                <span>📥</span> SUBIR EXTRACTO
                <input type="file" id="bankCsv" class="hidden" accept=".csv">
            </label>
        </header>

        <div id="work-area" class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            
            <div class="space-y-4">
                <h3 class="text-xs font-black text-slate-400 uppercase ml-2 flex justify-between items-center">
                    <span>Movimientos Banco</span>
                    <span class="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-500" id="pending-count">0 pendientes</span>
                </h3>
                <div id="list-bank" class="space-y-3 h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    <p class="text-center text-slate-300 text-xs py-10 italic">Sube un CSV de tu banco para empezar...</p>
                </div>
            </div>

            <div class="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 relative h-[60vh] flex flex-col shadow-inner">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                
                <h3 class="text-xs font-black text-indigo-500 uppercase mb-4 flex items-center gap-2">
                    🤖 Sugerencias Inteligentes
                </h3>
                
                <div id="match-panel" class="flex-1 flex flex-col justify-center items-center text-center">
                    <span class="text-4xl animate-bounce">👈</span>
                    <p class="text-sm font-bold text-slate-400 mt-2">Selecciona un movimiento de la izquierda</p>
                </div>
            </div>

        </div>
    </div>
    `;

    // LÓGICA
    const listBank = container.querySelector("#list-bank");
    const matchPanel = container.querySelector("#match-panel");
    const pendingCount = container.querySelector("#pending-count");
    let selectedBankItem = null;

    // 1. IMPORTAR CSV BANCO
    container.querySelector("#bankCsv").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const rows = evt.target.result.split('\n').slice(1);
            let count = 0;
            // No borramos lo anterior, AÑADIMOS (para no perder el historial conciliado)
            // Pero evitamos duplicados por ID (si el banco exporta IDs) o por fecha+desc+importe
            
            rows.forEach(row => {
                if(!row.trim()) return;
                const cols = row.split(';'); 
                if(cols.length >= 3) {
                    const desc = cols[1].trim();
                    const amount = parseFloat(cols[2].replace(',','.'));
                    const date = cols[0];
                    
                    // Comprobación simple de duplicados
                    const exists = db.banco.some(b => b.date === date && b.desc === desc && Math.abs(b.amount - amount) < 0.01);
                    
                    if(!exists) {
                        db.banco.push({
                            id: Date.now() + Math.random(),
                            date: date,
                            desc: desc,
                            amount: amount,
                            status: 'pending'
                        });
                        count++;
                    }
                }
            });
            await saveFn(`Importados ${count} movimientos nuevos`);
            renderBankList();
        };
        reader.readAsText(file);
    };

    // 2. RENDERIZAR LISTA BANCO
    const renderBankList = () => {
        const pend = db.banco.filter(b => b.status === 'pending').sort((a,b) => new Date(b.date) - new Date(a.date)); // Más recientes primero
        pendingCount.innerText = `${pend.length} pendientes`;

        if(pend.length === 0) {
            listBank.innerHTML = `<div class="bg-emerald-50 p-6 rounded-3xl text-center text-emerald-600 font-bold border border-emerald-100 flex flex-col items-center gap-2"><span class="text-2xl">🎉</span><span>¡Todo conciliado!</span></div>`;
            return;
        }

        listBank.innerHTML = pend.map(b => `
            <div onclick="window.selectBankItem('${b.id}')" class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-300 transition group relative ${selectedBankItem===b.id ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''}">
                <div class="flex justify-between items-center">
                    <div class="w-2/3">
                        <p class="font-bold text-slate-700 text-xs truncate group-hover:text-indigo-700" title="${b.desc}">${b.desc}</p>
                        <p class="text-[9px] text-slate-400 font-mono mt-1">${b.date}</p>
                    </div>
                    <span class="font-black text-sm ${b.amount < 0 ? 'text-slate-800' : 'text-emerald-500'}">${b.amount.toFixed(2)}€</span>
                </div>
            </div>
        `).join('');
    };

    // 3. SELECCIONAR Y BUSCAR MATCH (MEJORADO)
    window.selectBankItem = (id) => {
        selectedBankItem = id;
        renderBankList();
        const item = db.banco.find(b => b.id === id);
        if(!item) return;
        
        // BUSCADOR INTELIGENTE
        const candidates = [];
        
        // Función de similitud de texto (básica)
        const isSimilar = (a, b) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());

        if(item.amount < 0) { // GASTO -> Buscar en Albaranes
            const target = Math.abs(item.amount);
            (db.albaranes||[]).forEach(a => {
                if(a.reconciled) return;
                const diff = Math.abs(parseFloat(a.total) - target);
                
                // Prioridad 1: Importe exacto
                if(diff < 0.05) candidates.push({type:'Alb', data: a, score: 100});
                // Prioridad 2: Nombre parecido (aunque importe varíe un poco)
                else if (isSimilar(a.prov, item.desc) && diff < 5) candidates.push({type:'Alb', data: a, score: 50});
            });
        } else { // INGRESO -> Buscar en Facturas
            const target = item.amount;
            (db.facturas||[]).forEach(f => {
                if(f.reconciled) return;
                const diff = Math.abs(parseFloat(f.total) - target);
                if(diff < 0.05) candidates.push({type:'Fra', data: f, score: 100});
            });
        }

        // Ordenar por mejor coincidencia
        candidates.sort((a,b) => b.score - a.score);

        // PINTAR PANEL DERECHO
        let html = `<div class="text-left animate-fade-in w-full">`;
        html += `<div class="bg-white p-4 rounded-2xl border border-indigo-100 mb-4 shadow-sm">
                    <p class="text-[9px] font-black text-indigo-400 uppercase">Movimiento Seleccionado</p>
                    <p class="font-bold text-slate-800 text-sm mt-1">${item.desc}</p>
                    <p class="font-black text-xl text-slate-900 mt-1">${item.amount.toFixed(2)}€</p>
                 </div>`;

        if(candidates.length > 0) {
            html += `<p class="text-[10px] font-black text-slate-400 uppercase mb-3">Coincidencias encontradas</p>`;
            html += candidates.map(c => `
                <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-2 flex justify-between items-center hover:border-emerald-300 transition">
                    <div>
                        <span class="text-[8px] bg-slate-100 px-2 py-0.5 rounded font-bold uppercase text-slate-500">${c.type}</span>
                        <p class="font-bold text-slate-800 text-xs mt-1 truncate w-40">${c.data.prov || c.data.cliente || 'Doc'}</p>
                        <p class="text-[9px] text-slate-400">${c.data.date} · ${parseFloat(c.data.total).toFixed(2)}€</p>
                    </div>
                    <button onclick="window.doMatch('${item.id}', '${c.data.id}', '${c.type}')" class="bg-emerald-500 text-white px-3 py-2 rounded-xl text-[10px] font-black shadow-md hover:bg-emerald-600 transition flex flex-col items-center">
                        MATCH <span>🔗</span>
                    </button>
                </div>
            `).join('');
        } else {
            html += `<div class="text-center py-6">
                        <p class="text-xs font-bold text-slate-400">No encuentro nada parecido en el ERP.</p>
                        <p class="text-[10px] text-slate-300 mt-1">¿Es un gasto sin factura?</p>
                     </div>`;
        }

        // BOTÓN CREACIÓN RÁPIDA (PARA GASTOS SIN FACTURA)
        if(item.amount < 0) {
            html += `<div class="mt-6 border-t border-slate-100 pt-4">
                        <p class="text-[9px] font-black text-slate-400 uppercase mb-2">Acciones Rápidas</p>
                        <button onclick="window.quickExpense('${item.id}')" class="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition border border-indigo-100 flex items-center justify-center gap-2">
                            <span>⚡</span> Crear Gasto Rápido (${Math.abs(item.amount)}€)
                        </button>
                     </div>`;
        }

        html += `</div>`;
        matchPanel.innerHTML = html;
    };

    // 4. EJECUTAR MATCH
    window.doMatch = async (bankId, erpId, type) => {
        // Banco
        const bIdx = db.banco.findIndex(x => x.id == bankId); // == por si acaso tipos
        if(bIdx >= 0) db.banco[bIdx].status = 'matched';

        // ERP
        if(type === 'Alb') {
            const a = db.albaranes.find(x => x.id == erpId);
            if(a) a.reconciled = true;
        } else {
            const f = db.facturas.find(x => x.id == erpId);
            if(f) {
                f.reconciled = true;
                f.paid = true;
            }
        }

        await saveFn("Conciliado con éxito ✅");
        matchPanel.innerHTML = `<div class="flex-1 flex flex-col justify-center items-center"><span class="text-4xl animate-bounce">✨</span><p class="font-bold text-emerald-500 mt-2">¡Hecho!</p></div>`;
        renderBankList();
    };

    // 5. CREACIÓN RÁPIDA (GENERA ALBARÁN AUTOMÁTICO)
    window.quickExpense = async (bankId) => {
        const item = db.banco.find(b => b.id == bankId);
        if(!item) return;

        const provName = prompt("Nombre del Proveedor / Concepto:", item.desc);
        if(!provName) return;

        const total = Math.abs(item.amount);
        // Asumimos IVA 0 o 21? Mejor 0 para comisiones, o preguntar.
        // Simplificamos: IVA incluido (21% por defecto para servicios) o 0.
        // Haremos 0% para ir seguros (comisiones, seguros).
        
        const nuevoAlbaran = {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0], // Fecha hoy o la del banco? Mejor la del banco si es parseable
            prov: provName,
            num: "AUTO-BANK",
            socio: "Arume",
            total: total,
            taxes: 0, // Asumimos exento
            items: [{q:1, n: item.desc, p: total, rate: 0, t: total, base: total, tax: 0}],
            invoiced: false,
            reconciled: true, // Nace conciliado
            notes: "Generado desde Banco"
        };

        db.albaranes.push(nuevoAlbaran);
        
        // Marcar banco
        const bIdx = db.banco.findIndex(x => x.id == bankId);
        if(bIdx >= 0) db.banco[bIdx].status = 'matched';

        await saveFn("Gasto creado y conciliado ⚡");
        renderBankList();
        matchPanel.innerHTML = `<div class="flex-1 flex flex-col justify-center items-center"><span class="text-4xl">⚡</span><p class="font-bold text-indigo-500 mt-2">Gasto Creado</p></div>`;
    };

    renderBankList();
}
