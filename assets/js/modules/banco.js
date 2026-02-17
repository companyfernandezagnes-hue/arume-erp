/* =============================================================
   🏦 MÓDULO: TESORERÍA ULTRA (Automatización + Banca March)
   ============================================================= */

import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZAR DATOS
    if(!db.banco) db.banco = [];
    if(!db.facturas) db.facturas = []; 
    if(!db.albaranes) db.albaranes = [];
    if(!db.config) db.config = {};
    if(db.config.saldoInicial === undefined) db.config.saldoInicial = 0;

    // --- CÁLCULOS EN TIEMPO REAL ---
    const reCalc = () => {
        const sumaMovimientos = db.banco.reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);
        const saldoReal = (parseFloat(db.config.saldoInicial) || 0) + sumaMovimientos;
        
        // Progreso de Conciliación
        const totalItems = db.banco.length;
        const matchedItems = db.banco.filter(b => b.status === 'matched').length;
        const percent = totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0;

        return { saldoReal, percent, totalItems, matchedItems };
    };

    let kpis = reCalc();

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
            <div class="flex justify-between items-start relative z-10">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Tesorería</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <span>Banca March</span>
                        <span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">v3.0 Auto</span>
                    </p>
                </div>
                
                <div class="text-right">
                    <p class="text-[9px] font-black text-slate-400 uppercase mb-1">Saldo Real en Banco</p>
                    <div class="flex items-center justify-end gap-2 group cursor-pointer" id="btnEditSaldo">
                        <span class="text-3xl font-black text-slate-800 tracking-tight">${kpis.saldoReal.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</span>
                        <span class="opacity-0 group-hover:opacity-100 text-slate-400 text-xs">✏️</span>
                    </div>
                </div>
            </div>

            <div class="mt-6">
                <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    <span>Progreso de Conciliación</span>
                    <span id="lblProgress">${kpis.matchedItems} / ${kpis.totalItems} Movimientos</span>
                </div>
                <div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div id="barProgress" class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style="width: ${kpis.percent}%"></div>
                </div>
            </div>

            <div class="mt-6 flex flex-wrap gap-2">
                <label class="bg-slate-900 text-white px-5 py-3 rounded-xl text-[10px] font-black hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 shadow-lg">
                    <span>📂</span> IMPORTAR EXCEL
                    <input type="file" id="bankCsv" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
                
                <button id="btnMagic" class="bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-5 py-3 rounded-xl text-[10px] font-black hover:shadow-lg hover:scale-105 transition flex items-center gap-2">
                    <span>🪄</span> AUTO-CONCILIAR
                </button>

                <button id="btnExport" class="bg-slate-100 text-slate-600 px-5 py-3 rounded-xl text-[10px] font-black hover:bg-slate-200 transition">
                    ⬇️ CSV
                </button>
            </div>
        </header>

        <div id="work-area" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div class="lg:col-span-5 space-y-4">
                <div class="bg-white p-2 rounded-2xl border border-slate-100 flex items-center gap-2 shadow-sm sticky top-0 z-10">
                    <span class="pl-2 text-slate-400">🔍</span>
                    <input id="searchBank" type="text" placeholder="Buscar importe o concepto..." class="w-full bg-transparent text-xs font-bold outline-none text-slate-600 h-8">
                </div>

                <div class="flex justify-between items-end px-2">
                    <h3 class="text-xs font-black text-slate-400 uppercase">Pendientes</h3>
                    <button id="btnNuke" class="text-[9px] text-rose-400 font-bold hover:text-rose-600 transition">🗑️ Vaciar Lista</button>
                </div>
                
                <div id="list-bank" class="space-y-2 h-[600px] overflow-y-auto custom-scrollbar pb-20 pr-1">
                    </div>
            </div>

            <div class="lg:col-span-7">
                <div class="bg-white p-8 rounded-[2.5rem] border border-slate-100 relative h-[600px] flex flex-col shadow-xl overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    
                    <h3 class="text-sm font-black text-indigo-900 uppercase mb-6 flex items-center gap-2">
                        <span>🧠</span> Arume Brain
                    </h3>
                    
                    <div id="match-panel" class="flex-1 flex flex-col relative">
                        <div class="absolute inset-0 flex flex-col items-center justify-center text-center opacity-30 pointer-events-none">
                            <span class="text-6xl mb-4 grayscale">👈</span>
                            <p class="text-sm font-bold text-slate-800">Selecciona un movimiento<br>para analizarlo</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
    `;

    const listBank = container.querySelector("#list-bank");
    const matchPanel = container.querySelector("#match-panel");
    let selectedBankId = null;

    // --- 1. LÓGICA DE IMPORTACIÓN (BANCA MARCH) ---
    container.querySelector("#bankCsv").onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        listBank.innerHTML = `<div class="flex h-full items-center justify-center text-indigo-500 font-bold animate-pulse">Analizando Excel...</div>`;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false});

                let headerIdx = -1, colFecha = -1, colDesc1 = -1, colDesc2 = -1, colImporte = -1;

                // Buscar cabecera real
                for(let i=0; i < rows.length; i++) {
                    const rowStr = rows[i].join(' ').toLowerCase();
                    if(rowStr.includes('f. operación') && rowStr.includes('importe')) {
                        headerIdx = i;
                        rows[i].forEach((cell, idx) => {
                            const txt = String(cell).toLowerCase();
                            if(txt.includes('f. operación')) colFecha = idx;
                            if(txt === 'concepto') colDesc1 = idx;
                            if(txt.includes('ordenante')) colDesc2 = idx; 
                            if(txt.includes('importe')) colImporte = idx;
                        });
                        break;
                    }
                }

                if (headerIdx === -1) throw new Error("Formato no reconocido. Asegúrate que es el Excel de Banca March.");

                let imported = 0;
                for(let i = headerIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if(!row[colFecha] || !row[colImporte]) continue;

                    // Fecha
                    let dateClean = row[colFecha]; 
                    if(dateClean.includes('/')) {
                        const parts = dateClean.split('/'); 
                        if(parts[2].length === 2) parts[2] = '20' + parts[2]; 
                        dateClean = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }

                    // Desc
                    let fullDesc = (row[colDesc1] || '') + ' ' + (row[colDesc2] || '');
                    fullDesc = fullDesc.trim().replace(/\s+/g, ' '); 

                    // Importe
                    let amountStr = String(row[colImporte]).replace('€','').trim();
                    let cleanNum = amountStr.replace(/[^0-9.,-]/g, '');
                    if (cleanNum.indexOf(',') > cleanNum.indexOf('.')) cleanNum = cleanNum.replace(/\./g, '').replace(',', '.');
                    else if (cleanNum.indexOf('.') > cleanNum.indexOf(',')) cleanNum = cleanNum.replace(/,/g, '');
                    else if (cleanNum.includes(',')) cleanNum = cleanNum.replace(',', '.');
                    
                    const amount = parseFloat(cleanNum);

                    if(!isNaN(amount)) {
                        const exists = db.banco.some(b => b.date === dateClean && b.desc === fullDesc && Math.abs(b.amount - amount) < 0.01);
                        if(!exists) {
                            db.banco.push({ id: 'bm-'+Date.now()+Math.random(), date: dateClean, desc: fullDesc, amount: amount, status: 'pending' });
                            imported++;
                        }
                    }
                }
                await saveFn(`Importados ${imported} registros`);
                updateUI();
            } catch (err) { alert("Error: " + err.message); updateUI(); }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // --- 2. RENDERIZADO INTELIGENTE ---
    const updateUI = () => {
        kpis = reCalc();
        
        // Actualizar KPIs Header
        container.querySelector("#lblProgress").innerText = `${kpis.matchedItems} / ${kpis.totalItems} Conciliados`;
        container.querySelector("#barProgress").style.width = `${kpis.percent}%`;
        const elSaldo = container.querySelector("#btnEditSaldo span");
        if(elSaldo) elSaldo.innerText = kpis.saldoReal.toLocaleString('es-ES', {style:'currency', currency:'EUR'});

        renderBankList();
    };

    const renderBankList = () => {
        const term = (container.querySelector("#searchBank").value || "").toLowerCase();
        
        const pending = db.banco
            .filter(b => b.status === 'pending')
            .filter(b => b.desc.toLowerCase().includes(term) || b.amount.toString().includes(term))
            .sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if(pending.length === 0) {
            listBank.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-300 gap-2 opacity-50"><span class="text-4xl">✨</span><p class="text-xs font-bold">Todo limpio</p></div>`;
            return;
        }

        listBank.innerHTML = pending.map(b => `
            <div onclick="window.selectBankItem('${b.id}')" 
                 class="group relative bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md cursor-pointer hover:border-indigo-400 transition ${selectedBankId===b.id ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''}">
                <div class="flex justify-between items-start gap-2">
                    <div class="min-w-0">
                        <p class="font-bold text-slate-700 text-[11px] truncate leading-tight">${b.desc}</p>
                        <p class="text-[9px] text-slate-400 font-mono mt-1">${b.date}</p>
                    </div>
                    <span class="font-black text-xs whitespace-nowrap ${b.amount < 0 ? 'text-slate-800' : 'text-emerald-500'}">
                        ${b.amount > 0 ? '+' : ''}${b.amount.toFixed(2)}€
                    </span>
                </div>
                <button onclick="window.deleteBankItem('${b.id}', event)" class="absolute -top-1 -right-1 bg-white text-rose-400 hover:text-white hover:bg-rose-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition">✕</button>
            </div>
        `).join('');
    };

    // --- 3. CEREBRO DE CONCILIACIÓN ---
    window.selectBankItem = (id) => {
        selectedBankId = id;
        renderBankList(); // Para marcar el seleccionado
        
        const item = db.banco.find(b => b.id === id);
        if(!item) return;

        let html = `<div class="animate-fade-in w-full h-full flex flex-col bg-white rounded-3xl p-6 relative z-10">`;
        
        // Tarjeta Principal
        html += `
            <div class="border-b border-slate-100 pb-4 mb-4">
                <span class="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider">${item.amount > 0 ? 'INGRESO' : 'GASTO'}</span>
                <h3 class="font-black text-slate-800 text-lg mt-2 leading-tight">${item.desc}</h3>
                <div class="flex justify-between items-end mt-2">
                    <p class="text-3xl font-black ${item.amount>0?'text-emerald-500':'text-slate-900'}">${item.amount.toFixed(2)}€</p>
                    <p class="text-xs font-bold text-slate-400">${item.date}</p>
                </div>
            </div>
        `;

        // Búsqueda de Coincidencias
        let matches = [];
        const tolerance = 0.05;

        if(item.amount > 0) {
            db.facturas.filter(f => !f.reconciled).forEach(f => {
                const diff = Math.abs(parseFloat(f.total) - item.amount);
                if(diff <= tolerance) matches.push({ type: 'Cierre Caja', data: f, text: `Z del ${f.date}`, score: 100 });
                else if(diff < 5) matches.push({ type: 'Cierre Caja', data: f, text: `Z del ${f.date}`, score: 50 });
            });
        } else {
            const target = Math.abs(item.amount);
            db.albaranes.filter(a => !a.reconciled).forEach(a => {
                const diff = Math.abs(parseFloat(a.total) - target);
                // 1. Match Exacto Importe
                if(diff <= tolerance) matches.push({ type: 'Albarán', data: a, text: a.prov, score: 100 });
                // 2. Match Texto
                else if (item.desc.toLowerCase().includes((a.prov||'').toLowerCase()) && diff < 20) {
                    matches.push({ type: 'Albarán', data: a, text: a.prov, score: 80 });
                }
            });
        }
        matches.sort((a,b) => b.score - a.score);

        if(matches.length > 0) {
            html += `<p class="text-[10px] font-bold text-indigo-500 uppercase mb-2">💡 Sugerencia encontrada</p>`;
            html += `<div class="space-y-2 mb-6">`;
            html += matches.map(m => `
                <div class="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition" 
                     onclick="window.confirmMatch('${item.id}', '${m.data.id}', '${m.type}')">
                    <div>
                        <span class="text-[8px] font-bold uppercase text-indigo-400">${m.type}</span>
                        <p class="font-bold text-sm text-indigo-900">${m.text}</p>
                        <p class="text-[10px] text-indigo-600">${parseFloat(m.data.total).toFixed(2)}€</p>
                    </div>
                    <button class="bg-indigo-600 text-white w-8 h-8 rounded-full shadow-lg font-bold">✓</button>
                </div>
            `).join('');
            html += `</div>`;
        }

        // ACCIONES RÁPIDAS (CREACIÓN)
        if(item.amount < 0) {
            html += `
                <div class="mt-auto">
                    <p class="text-[9px] font-bold text-slate-400 uppercase mb-2">Crear Gasto Rápido</p>
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <button onclick="window.createQuickExpense('${item.id}', 'Comisión Banco', 'impuestos')" class="bg-slate-50 border border-slate-200 text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100 hover:border-slate-300">🏦 Comisión</button>
                        <button onclick="window.createQuickExpense('${item.id}', 'Alquiler', 'local')" class="bg-slate-50 border border-slate-200 text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100 hover:border-slate-300">🏢 Alquiler</button>
                        <button onclick="window.createQuickExpense('${item.id}', 'Luz/Agua', 'suministros')" class="bg-slate-50 border border-slate-200 text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100 hover:border-slate-300">💡 Suministros</button>
                        <button onclick="window.createQuickExpense('${item.id}', 'Gestoría', 'impuestos')" class="bg-slate-50 border border-slate-200 text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100 hover:border-slate-300">⚖️ Gestoría</button>
                    </div>
                    <button onclick="window.createCustomExpense('${item.id}')" class="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black shadow-lg hover:bg-slate-700 transition">
                        ✏️ CREAR CONCEPTO MANUAL
                    </button>
                </div>
            `;
        }

        html += `</div>`;
        matchPanel.innerHTML = html;
    };

    // --- 4. ACCIONES Y MAGIA ---
    
    // Conciliar
    window.confirmMatch = async (bankId, erpId, type) => {
        const bItem = db.banco.find(b => b.id === bankId);
        if(bItem) bItem.status = 'matched';

        const targetDb = type.includes('Venta') ? db.facturas : db.albaranes;
        const item = targetDb.find(i => i.id === erpId);
        if(item) { item.reconciled = true; item.paid = true; }

        await saveFn("Conciliado ✅");
        selectedBankId = null;
        matchPanel.innerHTML = '';
        updateUI();
    };

    // Crear Gasto (Manual o Rápido)
    const createExpense = async (bankId, concepto, categoria = 'varios') => {
        const item = db.banco.find(b => b.id === bankId);
        if(!item) return;
        const importe = Math.abs(item.amount);

        db.albaranes.push({
            id: 'auto-' + Date.now(),
            date: item.date,
            prov: concepto,
            num: "BANCO",
            total: importe,
            base: importe, // Asumimos sin IVA por defecto (ajustable luego)
            taxes: 0,
            items: [{ q: 1, n: concepto, t: importe, rate: 0 }],
            paid: true,
            reconciled: true,
            notes: "Auto-generado desde Tesorería"
        });

        item.status = 'matched';
        await saveFn("Gasto creado ✅");
        selectedBankId = null;
        matchPanel.innerHTML = '';
        updateUI();
    };

    window.createQuickExpense = (id, name) => createExpense(id, name);
    window.createCustomExpense = (id) => {
        const item = db.banco.find(b => b.id === id);
        const name = prompt("Nombre del gasto:", item.desc);
        if(name) createExpense(id, name);
    };

    // 🪄 LA VARITA MÁGICA (Auto-Conciliación)
    container.querySelector("#btnMagic").onclick = async () => {
        let count = 0;
        const keywords = ['comision', 'mantenimiento', 'intereses', 'liquid.propia', 'recibo', 'transferencia'];
        
        db.banco.filter(b => b.status === 'pending').forEach(b => {
            const desc = b.desc.toLowerCase();
            
            // 1. Auto-Gasto por Comisiones (Importes pequeños < 50€ con palabras clave)
            if (b.amount < 0 && Math.abs(b.amount) < 50 && keywords.some(k => desc.includes(k))) {
                createExpense(b.id, b.desc, 'impuestos');
                count++;
            }
            // 2. Auto-Ingreso TPV (Si coincide fecha y hay un Cierre Z sin conciliar por ese importe aproximado)
            // (Lógica simplificada para evitar falsos positivos)
        });

        if(count > 0) {
            await saveFn(`✨ Magia: ${count} movimientos conciliados`);
            updateUI();
        } else {
            alert("No he encontrado movimientos obvios para auto-conciliar.");
        }
    };

    // Funciones Auxiliares
    container.querySelector("#btnNuke").onclick = async () => {
        if(confirm("¿Seguro que quieres borrar todos los pendientes?")) {
            db.banco = db.banco.filter(b => b.status === 'matched');
            await saveFn("Lista limpia 🧹");
            updateUI();
        }
    };

    window.deleteBankItem = async (id, e) => {
        e.stopPropagation();
        if(confirm("¿Borrar?")) {
            db.banco = db.banco.filter(b => b.id !== id);
            await saveFn("Borrado");
            selectedBankId = null;
            matchPanel.innerHTML = '';
            updateUI();
        }
    };

    container.querySelector("#btnEditSaldo").onclick = async () => {
        const nuevo = prompt("Saldo Inicial de la cuenta:", db.config.saldoInicial);
        if(nuevo) {
            db.config.saldoInicial = parseFloat(nuevo.replace(',','.')) || 0;
            await saveFn("Saldo actualizado");
            updateUI();
        }
    };

    container.querySelector("#btnExport").onclick = () => {
        const csv = "Fecha;Concepto;Importe;Estado\n" + db.banco.map(b => `${b.date};${b.desc};${b.amount};${b.status}`).join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        a.download = 'Tesoreria.csv';
        a.click();
    };

    container.querySelector("#searchBank").addEventListener('input', renderBankList);

    // Inicializar
    updateUI();
}
