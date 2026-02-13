/* =============================================================
   🏦 MÓDULO: TESORERÍA (Conciliación Bancaria)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    if(!db.banco) db.banco = []; // Movimientos importados

    container.innerHTML = `
    <div class="animate-fade-in space-y-6">
        
        <header class="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div>
                <h2 class="text-xl font-black text-slate-800">Conciliación Bancaria</h2>
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Match Banco vs ERP</p>
            </div>
            <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 shadow-lg">
                <span>🏦</span> SUBIR EXTRACTO
                <input type="file" id="bankCsv" class="hidden" accept=".csv">
            </label>
        </header>

        <div id="work-area" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="space-y-4">
                <h3 class="text-xs font-black text-slate-400 uppercase ml-2">Movimientos Banco (Pendientes)</h3>
                <div id="list-bank" class="space-y-3 pb-20">
                    <p class="text-center text-slate-300 text-xs py-10 italic">Sube un CSV de tu banco para empezar...</p>
                </div>
            </div>

            <div class="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 relative min-h-[50vh]">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <h3 class="text-xs font-black text-indigo-500 uppercase mb-4">Sugerencias Arume</h3>
                
                <div id="match-panel" class="text-center pt-20">
                    <span class="text-4xl">👈</span>
                    <p class="text-sm font-bold text-slate-400 mt-2">Selecciona un movimiento del banco</p>
                </div>
            </div>

        </div>
    </div>
    `;

    // LÓGICA
    const listBank = container.querySelector("#list-bank");
    const matchPanel = container.querySelector("#match-panel");
    let selectedBankItem = null;

    // 1. IMPORTAR CSV BANCO
    container.querySelector("#bankCsv").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const rows = evt.target.result.split('\n').slice(1);
            let count = 0;
            // Limpiamos banco anterior para demo (en prod podrías acumular)
            db.banco = []; 
            
            rows.forEach(row => {
                if(!row.trim()) return;
                const cols = row.split(';'); // Asumimos separador ;
                // Formato simple esperado: Fecha; Concepto; Importe
                if(cols.length >= 3) {
                    db.banco.push({
                        id: Date.now() + Math.random(),
                        date: cols[0],
                        desc: cols[1],
                        amount: parseFloat(cols[2].replace(',','.')),
                        status: 'pending'
                    });
                    count++;
                }
            });
            await saveFn(`Extracto bancario cargado (${count} movimientos)`);
            renderBankList();
        };
        reader.readAsText(file);
    };

    // 2. RENDERIZAR LISTA BANCO
    const renderBankList = () => {
        const pend = db.banco.filter(b => b.status === 'pending');
        if(pend.length === 0) {
            listBank.innerHTML = `<div class="bg-emerald-50 p-6 rounded-3xl text-center text-emerald-600 font-bold border border-emerald-100">¡Todo conciliado! 🎉</div>`;
            return;
        }

        listBank.innerHTML = pend.map(b => `
            <div onclick="window.selectBankItem('${b.id}')" class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-300 transition group ${selectedBankItem===b.id ? 'ring-2 ring-indigo-500' : ''}">
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-bold text-slate-700 text-sm group-hover:text-indigo-700">${b.desc}</p>
                        <p class="text-[10px] text-slate-400 font-mono">${b.date}</p>
                    </div>
                    <span class="font-black ${b.amount < 0 ? 'text-slate-800' : 'text-emerald-500'}">${b.amount.toFixed(2)}€</span>
                </div>
            </div>
        `).join('');
    };

    // 3. SELECCIONAR Y BUSCAR MATCH
    window.selectBankItem = (id) => {
        selectedBankItem = id;
        renderBankList(); // Para actualizar el borde azul
        const item = db.banco.find(b => b.id === id);
        
        // BUSCAR CANDIDATOS EN FACTURAS Y ALBARANES
        // Lógica simple: Coincidencia exacta de importe (+/- 0.05€)
        const candidates = [];
        
        // Si es negativo (Gasto) -> Buscar en Albaranes
        if(item.amount < 0) {
            const target = Math.abs(item.amount);
            db.albaranes.forEach(a => {
                const diff = Math.abs(parseFloat(a.total) - target);
                if(diff < 0.05 && !a.reconciled) candidates.push({type:'Alb', data: a});
            });
        } 
        // Si es positivo (Ingreso) -> Buscar en Facturas
        else {
            const target = item.amount;
            db.facturas.forEach(f => {
                const diff = Math.abs(parseFloat(f.total) - target);
                if(diff < 0.05 && !f.reconciled) candidates.push({type:'Fra', data: f});
            });
        }

        // PINTAR SUGERENCIAS
        if(candidates.length > 0) {
            matchPanel.innerHTML = `
                <div class="text-left animate-fade-in">
                    <p class="text-[10px] font-black text-slate-400 uppercase mb-4">Sugerencias encontradas por importe</p>
                    ${candidates.map(c => `
                        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-2 flex justify-between items-center">
                            <div>
                                <span class="text-[9px] bg-slate-100 px-2 py-1 rounded font-bold uppercase">${c.type === 'Alb' ? 'Gasto' : 'Ingreso'}</span>
                                <p class="font-bold text-slate-800 mt-1">${c.data.prov || c.data.cliente || 'Desconocido'}</p>
                                <p class="text-[10px] text-slate-400">${c.data.date} · Ref: ${c.data.num || c.data.numero}</p>
                            </div>
                            <button onclick="window.doMatch('${item.id}', '${c.data.id}', '${c.type}')" class="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-emerald-600 transition">
                                CONCILIAR ✅
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            matchPanel.innerHTML = `
                <div class="text-center pt-10">
                    <span class="text-4xl opacity-50">🤷‍♂️</span>
                    <p class="font-bold text-slate-600 mt-4">No encuentro coincidencia exacta</p>
                    <p class="text-xs text-slate-400 mt-1">Importe: ${Math.abs(item.amount)}€</p>
                    <button class="mt-6 border border-slate-300 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white transition">Crear Gasto Manualmente</button>
                </div>
            `;
        }
    };

    // 4. EJECUTAR CONCILIACIÓN
    window.doMatch = async (bankId, erpId, type) => {
        // Marcar banco
        const bIdx = db.banco.findIndex(x => x.id === bankId);
        if(bIdx >= 0) db.banco[bIdx].status = 'matched';

        // Marcar ERP
        if(type === 'Alb') {
            const a = db.albaranes.find(x => x.id === erpId);
            if(a) a.reconciled = true;
        } else {
            const f = db.facturas.find(x => x.id === erpId);
            if(f) f.reconciled = true;
            if(f) f.paid = true; // Si está en el banco, está pagada
        }

        await saveFn("Movimiento conciliado 🔗");
        matchPanel.innerHTML = `<div class="text-center pt-20"><span class="text-4xl">✨</span><p class="font-bold text-emerald-500 mt-2">¡Conciliado!</p></div>`;
        renderBankList();
    };

    renderBankList();
}
