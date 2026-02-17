/* =============================================================
   🏦 MÓDULO: TESORERÍA PRO (Banca March + Excel Inteligente)
   ============================================================= */

// Librería para leer Excel
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZAR DATOS
    if(!db.banco) db.banco = [];
    if(!db.facturas) db.facturas = []; // Ingresos (Cierres Z)
    if(!db.albaranes) db.albaranes = []; // Gastos (Proveedores)

    // --- CÁLCULOS FINANCIEROS (KPIS) ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Saldo Teórico (Suma de todo lo importado)
    const saldoTeorico = db.banco.reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    // Comisiones del Mes (Detectadas por palabras clave)
    const comisionesMes = db.banco.filter(b => {
        const d = new Date(b.date);
        const desc = (b.desc || '').toLowerCase();
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && 
               (desc.includes('comision') || desc.includes('mantenimiento') || desc.includes('intereses') || desc.includes('liquid.propia'));
    }).reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    // Ingresos TPV del Mes
    const tpvMes = db.banco.filter(b => {
        const d = new Date(b.date);
        const desc = (b.desc || '').toLowerCase();
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && 
               (parseFloat(b.amount) > 0) &&
               (desc.includes('tpv') || desc.includes('tarjeta') || desc.includes('redsys') || desc.includes('bizum'));
    }).reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    // Pagos Pendientes (Albaranes de este mes no pagados)
    const pagosPendientes = db.albaranes.filter(a => {
        const d = new Date(a.date);
        return !a.paid && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);

    const capacidadReal = saldoTeorico - pagosPendientes;

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Tesorería & Banco</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control Banca March</p>
                </div>
                <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 shadow-lg">
                    <span>📥</span> SUBIR EXCEL
                    <input type="file" id="bankCsv" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Saldo Banco</p>
                    <p class="text-lg font-black text-slate-800">${saldoTeorico.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>
                <div class="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                    <p class="text-[9px] font-black text-rose-400 uppercase">Pagos Previstos</p>
                    <p class="text-lg font-black text-rose-600">-${pagosPendientes.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>
                <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p class="text-[9px] font-black text-emerald-500 uppercase">Capacidad Real</p>
                    <p class="text-lg font-black text-emerald-700">${capacidadReal.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>
                <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p class="text-[9px] font-black text-indigo-400 uppercase">Entradas TPV</p>
                    <p class="text-lg font-black text-indigo-600">${tpvMes.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>
            </div>

            ${comisionesMes < 0 ? `
            <div class="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 flex justify-between items-center">
                <span class="text-[10px] font-bold text-amber-600">⚠️ Comisiones bancarias este mes</span>
                <span class="text-xs font-black text-amber-700">${comisionesMes.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</span>
            </div>` : ''}
        </header>

        <div id="work-area" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="space-y-4">
                <div class="flex justify-between items-end px-2">
                    <h3 class="text-xs font-black text-slate-400 uppercase">Movimientos Pendientes</h3>
                    <button id="btnClearBank" class="text-[9px] text-rose-400 font-bold hover:underline">Limpiar conciliados</button>
                </div>
                <div id="list-bank" class="space-y-3 h-[500px] overflow-y-auto custom-scrollbar pb-10">
                    <div class="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                        <span class="text-4xl">🏦</span>
                        <p class="text-xs">Sube tu Excel para empezar</p>
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

    // --- VARIABLES ---
    const listBank = container.querySelector("#list-bank");
    const matchPanel = container.querySelector("#match-panel");
    let selectedBankId = null;

    // --- 1. IMPORTAR EXCEL (LÓGICA BANCA MARCH) ---
    container.querySelector("#bankCsv").onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        // Feedback visual
        listBank.innerHTML = `<div class="flex h-full items-center justify-center text-indigo-500 font-bold animate-pulse">Analizando Banca March...</div>`;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Convertimos a matriz para inspeccionar fila por fila
                const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false});

                let headerIdx = -1;
                let colFecha = -1, colDesc1 = -1, colDesc2 = -1, colImporte = -1;

                // 1. BUSCAR LA CABECERA REAL (Saltando las líneas iniciales)
                for(let i=0; i < rows.length; i++) {
                    const rowStr = rows[i].join(' ').toLowerCase();
                    // Buscamos palabras clave de la cabecera de Banca March
                    if(rowStr.includes('f. operación') && rowStr.includes('importe')) {
                        headerIdx = i;
                        // Mapeamos índices de columnas dinámicamente
                        rows[i].forEach((cell, idx) => {
                            const txt = String(cell).toLowerCase();
                            if(txt.includes('f. operación')) colFecha = idx;
                            if(txt === 'concepto') colDesc1 = idx;
                            if(txt.includes('ordenante')) colDesc2 = idx; // Columna extra importante
                            if(txt.includes('importe')) colImporte = idx;
                        });
                        break;
                    }
                }

                if (headerIdx === -1) throw new Error("No encuentro la tabla de movimientos en este Excel.");

                let imported = 0;
                
                // 2. PROCESAR FILAS (Desde la siguiente a la cabecera)
                for(let i = headerIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    // Si no hay fecha o importe, saltamos
                    if(!row[colFecha] || !row[colImporte]) continue;

                    // Parsear FECHA (DD/MM/YY -> YYYY-MM-DD)
                    let dateClean = row[colFecha]; 
                    if(dateClean.includes('/')) {
                        const parts = dateClean.split('/'); // [12, 02, 26]
                        if(parts[2].length === 2) parts[2] = '20' + parts[2]; // 2026
                        dateClean = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }

                    // Parsear DESCRIPCIÓN (Fusionar Concepto + Ordenante)
                    let fullDesc = (row[colDesc1] || '') + ' ' + (row[colDesc2] || '');
                    fullDesc = fullDesc.trim().replace(/\s+/g, ' '); // Limpiar espacios extra

                    // Parsear IMPORTE (Formato español 1.200,50 €)
                    let amountStr = String(row[colImporte]).replace('€','').trim();
                    // Quitamos puntos de miles y cambiamos coma decimal por punto
                    if(amountStr.includes(',') && amountStr.includes('.')) {
                        amountStr = amountStr.replace('.','').replace(',','.'); 
                    } else if (amountStr.includes(',')) {
                        amountStr = amountStr.replace(',','.');
                    }
                    const amount = parseFloat(amountStr);

                    if(!isNaN(amount)) {
                        // Evitar duplicados si ya existe en la DB
                        const exists = db.banco.some(b => b.date === dateClean && b.desc === fullDesc && Math.abs(b.amount - amount) < 0.01);
                        if(!exists) {
                            db.banco.push({
                                id: 'bm-' + Date.now() + Math.random(),
                                date: dateClean,
                                desc: fullDesc || "Movimiento sin nombre",
                                amount: amount,
                                status: 'pending' // Estado inicial: Pendiente de conciliar
                            });
                            imported++;
                        }
                    }
                }

                await saveFn(`Importados ${imported} movimientos ✅`);
                render(container, supabase, db, opts); // Recargar pantalla

            } catch (err) {
                console.error(err);
                alert("Error al leer Excel: " + err.message);
                render(container, supabase, db, opts);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = ''; // Limpiar input para poder subir el mismo archivo si hace falta
    };

    // --- 2. RENDER LISTA BANCO ---
    const renderBankList = () => {
        const pending = db.banco.filter(b => b.status === 'pending').sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if(pending.length === 0 && db.banco.length > 0) {
            listBank.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-emerald-500 gap-2"><span class="text-4xl">🎉</span><p class="font-bold">Todo Conciliado</p></div>`;
            return;
        } else if (pending.length === 0) return;

        listBank.innerHTML = pending.map(b => `
            <div onclick="window.selectBankItem('${b.id}')" 
                 class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-300 transition group relative ${selectedBankId===b.id ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''}">
                <div class="flex justify-between items-center">
                    <div class="w-3/4">
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

    // --- 3. MATCHING (BUSCADOR DE COINCIDENCIAS) ---
    window.selectBankItem = (id) => {
        selectedBankId = id;
        renderBankList();
        
        const item = db.banco.find(b => b.id === id);
        if(!item) return;

        let html = `<div class="animate-fade-in w-full h-full flex flex-col">`;
        
        // Tarjeta del Movimiento
        html += `
            <div class="bg-white p-4 rounded-2xl border border-indigo-100 mb-6 shadow-sm">
                <p class="text-[9px] font-black text-indigo-400 uppercase">Movimiento Seleccionado</p>
                <p class="font-bold text-slate-800 text-sm mt-1 mb-1">${item.desc}</p>
                <p class="font-black text-2xl ${item.amount>0?'text-emerald-600':'text-slate-800'}">${item.amount.toFixed(2)}€</p>
                <p class="text-[10px] text-slate-400 mt-2">Fecha: ${item.date}</p>
            </div>
        `;

        let matches = [];
        const tolerance = 0.05; // 5 céntimos de margen

        if(item.amount > 0) {
            // Si es ingreso (+) -> Buscamos en Ventas (Cierres/Facturas)
            db.facturas.filter(f => !f.reconciled).forEach(f => {
                const diff = Math.abs(parseFloat(f.total) - item.amount);
                if(diff <= tolerance) matches.push({ type: 'Venta/Cierre', data: f, score: 100 });
                else if(diff < 5) matches.push({ type: 'Venta/Cierre', data: f, score: 50 });
            });
        } else {
            // Si es gasto (-) -> Buscamos en Albaranes
            const target = Math.abs(item.amount);
            db.albaranes.filter(a => !a.reconciled).forEach(a => {
                const diff = Math.abs(parseFloat(a.total) - target);
                // 1. Por importe exacto
                if(diff <= tolerance) matches.push({ type: 'Albarán', data: a, score: 100 });
                // 2. Por texto similar
                else if (item.desc.toLowerCase().includes((a.prov||'').toLowerCase()) && diff < 20) {
                    matches.push({ type: 'Albarán', data: a, score: 80 });
                }
            });
        }

        matches.sort((a,b) => b.score - a.score);

        if(matches.length > 0) {
            html += `<p class="text-[10px] font-black text-slate-400 uppercase mb-3 px-2">Sugerencias encontradas</p>`;
            html += `<div class="space-y-2 overflow-y-auto custom-scrollbar flex-1 pb-4">`;
            html += matches.map(m => `
                <div class="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center hover:border-emerald-400 transition cursor-pointer" 
                     onclick="window.confirmMatch('${item.id}', '${m.data.id}', '${m.type}')">
                    <div>
                        <span class="bg-slate-100 text-[8px] font-bold px-2 py-0.5 rounded text-slate-500 uppercase">${m.type}</span>
                        <p class="font-bold text-xs text-slate-700 mt-1">${m.data.prov || m.data.cliente || 'Registro'}</p>
                        <p class="text-[9px] text-slate-400">${m.data.date} · ${parseFloat(m.data.total).toFixed(2)}€</p>
                    </div>
                    <button class="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md">🔗</button>
                </div>
            `).join('');
            html += `</div>`;
        } else {
            html += `
                <div class="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <span class="text-3xl mb-2">🤷‍♂️</span>
                    <p class="text-xs font-bold">Sin coincidencias claras</p>
                </div>
            `;
        }

        // OPCIÓN: CREAR GASTO AUTOMÁTICO (Si es un gasto y no hay match)
        if(item.amount < 0 && matches.length === 0) {
            html += `
                <div class="mt-4 pt-4 border-t border-slate-200">
                    <button onclick="window.createExpenseFromBank('${item.id}')" class="w-full bg-indigo-600 text-white py-3 rounded-xl text-xs font-black shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                        <span>⚡</span> CREAR ALBARÁN AUTOMÁTICO
                    </button>
                    <p class="text-[9px] text-center text-slate-400 mt-2">Crea el gasto en la App y lo marca como pagado</p>
                </div>
            `;
        }

        html += `</div>`;
        matchPanel.innerHTML = html;
    };

    // --- 4. ACCIONES (CONCILIAR Y CREAR) ---
    window.confirmMatch = async (bankId, erpId, type) => {
        const bItem = db.banco.find(b => b.id === bankId);
        if(bItem) bItem.status = 'matched';

        if(type === 'Albarán' || type === 'Gasto') {
            const alb = db.albaranes.find(a => a.id === erpId);
            if(alb) { alb.reconciled = true; alb.paid = true; }
        } else {
            const fra = db.facturas.find(f => f.id === erpId);
            if(fra) { fra.reconciled = true; fra.paid = true; }
        }

        await saveFn("Conciliado ✅");
        selectedBankId = null;
        render(container, supabase, db, opts);
    };

    window.createExpenseFromBank = async (bankId) => {
        const item = db.banco.find(b => b.id === bankId);
        if(!item) return;

        const concepto = prompt("Concepto para el nuevo gasto:", item.desc) || item.desc;
        const importe = Math.abs(item.amount);

        // Crear Albarán Automático (IVA 0 por defecto al venir de banco)
        db.albaranes.push({
            id: 'auto-' + Date.now(),
            date: item.date,
            prov: concepto,
            num: "BANCO",
            total: importe,
            base: importe,
            taxes: 0,
            items: [{ q: 1, n: concepto, t: importe, rate: 0 }],
            paid: true,
            reconciled: true,
            notes: "Generado auto desde Tesorería"
        });

        item.status = 'matched';
        await saveFn("Gasto creado y conciliado ⚡");
        selectedBankId = null;
        render(container, supabase, db, opts);
    };

    container.querySelector("#btnClearBank").onclick = async () => {
        if(confirm("¿Ocultar los movimientos ya conciliados de la lista?")) {
            renderBankList();
            alert("Lista actualizada.");
        }
    };

    renderBankList();
}
