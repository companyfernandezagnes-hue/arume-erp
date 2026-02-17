/* =============================================================
   🏦 MÓDULO: TESORERÍA PRO (Soporte EXCEL + Conciliación)
   ============================================================= */

// IMPORTAMOS LA LIBRERÍA PARA LEER EXCEL
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // 1. INICIALIZAR DATOS
    if(!db.banco) db.banco = [];
    if(!db.facturas) db.facturas = []; // Ingresos (Cierres Z)
    if(!db.albaranes) db.albaranes = []; // Gastos (Proveedores)

    // --- CÁLCULOS FINANCIEROS AVANZADOS ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // A. Saldo Teórico (Suma de todo lo importado)
    const saldoTeorico = db.banco.reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    // B. Comisiones del Mes
    const comisionesMes = db.banco
        .filter(b => {
            const d = new Date(b.date);
            const desc = (b.desc || '').toLowerCase();
            return d.getMonth() === currentMonth && 
                   d.getFullYear() === currentYear && 
                   (desc.includes('comision') || desc.includes('mantenimiento') || desc.includes('intereses'));
        })
        .reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    // C. Ingresos TPV del Mes
    const tpvMes = db.banco
        .filter(b => {
            const d = new Date(b.date);
            const desc = (b.desc || '').toLowerCase();
            return d.getMonth() === currentMonth && 
                   d.getFullYear() === currentYear && 
                   (parseFloat(b.amount) > 0) &&
                   (desc.includes('tpv') || desc.includes('tarjeta') || desc.includes('redsys') || desc.includes('bizum'));
        })
        .reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);

    // D. Previsión Fin de Mes
    const pagosPendientes = db.albaranes
        .filter(a => {
            const d = new Date(a.date);
            return !a.paid && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);

    // E. Capacidad Real
    const capacidadReal = saldoTeorico - pagosPendientes;


    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-black text-slate-800">Tesorería & Banco</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Soporte Excel (.xlsx)</p>
                </div>
                <label class="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 shadow-lg">
                    <span>📥</span> IMPORTAR EXCEL
                    <input type="file" id="bankCsv" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p class="text-[9px] font-black text-slate-400 uppercase">Saldo Banco (Teórico)</p>
                    <p class="text-lg font-black text-slate-800">${saldoTeorico.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>
                
                <div class="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                    <p class="text-[9px] font-black text-rose-400 uppercase">Pagos previstos (Mes)</p>
                    <p class="text-lg font-black text-rose-600">-${pagosPendientes.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>

                <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p class="text-[9px] font-black text-emerald-500 uppercase">Capacidad Real</p>
                    <p class="text-lg font-black text-emerald-700">${capacidadReal.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>

                <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p class="text-[9px] font-black text-indigo-400 uppercase">Ingresos TPV (Mes)</p>
                    <p class="text-lg font-black text-indigo-600">${tpvMes.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</p>
                </div>
            </div>

            ${comisionesMes < 0 ? `
            <div class="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 flex justify-between items-center">
                <span class="text-[10px] font-bold text-amber-600">⚠️ El banco te ha cobrado comisiones este mes</span>
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
                        <p class="text-xs">Sube tu Excel del banco para empezar</p>
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

    // --- 1. LÓGICA DE IMPORTACIÓN EXCEL (Nueva y Potente) ---
    container.querySelector("#bankCsv").onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        // Overlay de carga
        listBank.innerHTML = `<div class="flex h-full items-center justify-center text-indigo-500 font-bold animate-pulse">Analizando Excel...</div>`;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                // Leemos el Excel
                const workbook = XLSX.read(data, {type: 'array'});
                // Cogemos la primera hoja
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // Convertimos a JSON (Array de Arrays para ser más flexibles)
                const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false, dateNF: 'yyyy-mm-dd'});

                if (!rows || rows.length === 0) return alert("El Excel parece vacío");

                let imported = 0;
                
                // INTELIGENCIA PARA DETECTAR COLUMNAS
                // Buscamos en las primeras 10 filas qué índice tiene pinta de qué
                let dateIdx = -1, descIdx = -1, amountIdx = -1;

                // Buscamos cabeceras o datos
                for(let i=0; i<Math.min(rows.length, 10); i++) {
                    const row = rows[i];
                    row.forEach((cell, idx) => {
                        const txt = String(cell).toLowerCase();
                        if (txt.includes('fecha') || txt.includes('date') || txt.match(/\d{2}\/\d{2}/)) dateIdx = idx;
                        if (txt.includes('concepto') || txt.includes('desc') || txt.length > 15) descIdx = idx;
                        if (txt.includes('importe') || txt.includes('cantidad') || txt.includes('amount') || (!isNaN(parseFloat(txt)) && txt.includes(','))) amountIdx = idx;
                    });
                    if (dateIdx > -1 && descIdx > -1 && amountIdx > -1) break;
                }

                // Fallback si no encuentra cabeceras (asumimos estándar A=Fecha, B=Desc, C=Importe)
                if (dateIdx === -1) dateIdx = 0;
                if (descIdx === -1) descIdx = 1;
                if (amountIdx === -1) amountIdx = 2; // A veces el importe está en la 3 o 4

                // PROCESAMOS FILAS
                rows.forEach((row, idx) => {
                    // Saltamos filas muy cortas o vacías
                    if (!row[dateIdx] || !row[amountIdx]) return;

                    const dateRaw = row[dateIdx];
                    const descRaw = row[descIdx] || "Sin concepto";
                    // Limpieza agresiva de importe (quita 'EUR', espacios, etc)
                    let amountStr = String(row[amountIdx]).replace(/[^\d.,-]/g, '');
                    // Si tiene coma y punto, asumimos formato español (1.000,00) -> 1000.00
                    if (amountStr.includes('.') && amountStr.includes(',')) {
                        amountStr = amountStr.replace('.', '').replace(',', '.');
                    } else if (amountStr.includes(',')) {
                        amountStr = amountStr.replace(',', '.');
                    }
                    
                    const amount = parseFloat(amountStr);

                    if (!isNaN(amount) && Math.abs(amount) > 0) {
                        // Evitar duplicados exactos
                        const exists = db.banco.some(b => b.date === dateRaw && b.desc === descRaw && Math.abs(b.amount - amount) < 0.01);
                        if(!exists) {
                            db.banco.push({
                                id: 'bank-' + Date.now() + Math.random(),
                                date: dateRaw,
                                desc: descRaw,
                                amount: amount,
                                status: 'pending'
                            });
                            imported++;
                        }
                    }
                });

                await saveFn(`Excel Procesado: ${imported} nuevos 📥`);
                render(container, supabase, db, opts);

            } catch (err) {
                console.error(err);
                alert("Error leyendo el Excel. Asegúrate que no esté corrupto.");
                render(container, supabase, db, opts); // Restaurar vista
            }
        };
        reader.readAsArrayBuffer(file); // IMPORTANTE: ArrayBuffer para Excel
        e.target.value = '';
    };

    // --- 2. RENDER LISTA BANCO ---
    const renderBankList = () => {
        const pending = db.banco.filter(b => b.status === 'pending').sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if(pending.length === 0 && db.banco.length > 0) {
            listBank.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-emerald-500 gap-2"><span class="text-4xl">🎉</span><p class="font-bold">¡Todo Conciliado!</p></div>`;
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

    // --- 3. MATCHING INTELLIGENCE (CEREBRO) ---
    window.selectBankItem = (id) => {
        selectedBankId = id;
        renderBankList();
        
        const item = db.banco.find(b => b.id === id);
        if(!item) return;

        let html = `<div class="animate-fade-in w-full h-full flex flex-col">`;
        
        // Tarjeta Item Seleccionado
        html += `
            <div class="bg-white p-4 rounded-2xl border border-indigo-100 mb-6 shadow-sm">
                <p class="text-[9px] font-black text-indigo-400 uppercase">Movimiento Banco</p>
                <p class="font-bold text-slate-800 text-sm mt-1 mb-1">${item.desc}</p>
                <p class="font-black text-2xl ${item.amount>0?'text-emerald-600':'text-slate-800'}">${item.amount.toFixed(2)}€</p>
                <p class="text-[10px] text-slate-400 mt-2">Fecha: ${item.date}</p>
            </div>
        `;

        // Lógica de búsqueda
        let matches = [];
        const tolerance = 0.05;

        if(item.amount > 0) {
            // Ingresos -> Buscar en Ventas (Facturas)
            db.facturas.filter(f => !f.reconciled).forEach(f => {
                const diff = Math.abs(parseFloat(f.total) - item.amount);
                if(diff <= tolerance) matches.push({ type: 'Venta/Z', data: f, score: 100 });
                else if (diff < 5) matches.push({ type: 'Venta/Z', data: f, score: 50 });
            });
        } else {
            // Gastos -> Buscar en Albaranes
            const target = Math.abs(item.amount);
            db.albaranes.filter(a => !a.reconciled).forEach(a => {
                const diff = Math.abs(parseFloat(a.total) - target);
                // Por importe exacto
                if(diff <= tolerance) matches.push({ type: 'Gasto', data: a, score: 100 });
                // Por nombre aproximado
                else if (item.desc.toLowerCase().includes((a.prov||'').toLowerCase()) && diff < 10) {
                    matches.push({ type: 'Gasto', data: a, score: 80 });
                }
            });
        }

        matches.sort((a,b) => b.score - a.score);

        if(matches.length > 0) {
            html += `<p class="text-[10px] font-black text-slate-400 uppercase mb-3 px-2">Posibles Coincidencias</p>`;
            html += `<div class="space-y-2 overflow-y-auto custom-scrollbar flex-1 pb-4">`;
            html += matches.map(m => `
                <div class="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center hover:border-emerald-400 transition cursor-pointer" 
                     onclick="window.confirmMatch('${item.id}', '${m.data.id}', '${m.type}')">
                    <div>
                        <span class="bg-slate-100 text-[8px] font-bold px-2 py-0.5 rounded text-slate-500 uppercase">${m.type}</span>
                        <p class="font-bold text-xs text-slate-700 mt-1">${m.data.cliente || m.data.prov || m.data.numero}</p>
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
                    <p class="text-xs font-bold">No encuentro coincidencia.</p>
                    <p class="text-[10px]">¿Es una comisión o gasto sin registrar?</p>
                </div>
            `;
        }

        // CREAR GASTO RÁPIDO (Solo para salidas sin match)
        if(item.amount < 0 && matches.length === 0) {
            html += `
                <div class="mt-4 pt-4 border-t border-slate-200">
                    <button onclick="window.createExpenseFromBank('${item.id}')" class="w-full bg-indigo-600 text-white py-3 rounded-xl text-xs font-black shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                        <span>⚡</span> CREAR GASTO AUTOMÁTICO
                    </button>
                    <p class="text-[9px] text-center text-slate-400 mt-2">Crea un albarán con este concepto</p>
                </div>
            `;
        }

        html += `</div>`;
        matchPanel.innerHTML = html;
    };

    // --- 4. ACCIONES DE MATCH ---
    window.confirmMatch = async (bankId, erpId, type) => {
        const bItem = db.banco.find(b => b.id === bankId);
        if(bItem) bItem.status = 'matched';

        if(type === 'Gasto') {
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

        const concepto = prompt("Confirma el concepto:", item.desc) || item.desc;
        const importe = Math.abs(item.amount);

        // Creamos el albarán automáticamente
        db.albaranes.push({
            id: 'auto-' + Date.now(),
            date: item.date, // Usamos la fecha del banco
            prov: concepto,
            num: "BANCO",
            total: importe,
            base: importe, // Asumimos sin IVA por defecto al crear desde banco
            taxes: 0,
            paid: true,
            reconciled: true,
            notes: "Creado desde Banco"
        });

        item.status = 'matched';
        await saveFn("Gasto creado y conciliado ⚡");
        selectedBankId = null;
        render(container, supabase, db, opts);
    };

    // Botón Limpiar
    container.querySelector("#btnClearBank").onclick = async () => {
        if(confirm("¿Ocultar los movimientos ya conciliados?")) {
            renderBankList();
            render(container, supabase, db, opts);
        }
    };

    renderBankList();
}
