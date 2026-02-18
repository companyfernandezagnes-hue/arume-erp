/* =============================================================
   🏦 MÓDULO: TESORERÍA ULTRA v10.0 (Conciliación TPV + Bancaria)
   ============================================================= */

import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

// --- 0. HELPERS GLOBALES ---
const Utils = {
    normalize: (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(),
    
    hashString: (str) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
        return (h >>> 0).toString(16);
    },

    parseAmountSmart: (raw) => {
        if (raw == null) return 0;
        if (typeof raw === 'number') return raw;
        let s = String(raw).trim();
        s = s.replace(/[^\d,.-]/g, ''); 
        if (s.includes(',') && s.includes('.')) {
            if (s.indexOf(',') > s.indexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); // Eur
            else s = s.replace(/,/g, ''); // USA
        } else if (s.includes(',')) s = s.replace(',', '.');
        return parseFloat(s) || 0;
    },

    parseDateSmart: (raw) => {
        if (!raw) return null;
        if (raw instanceof Date) return raw;
        if (typeof raw === 'number' && raw > 20000) return new Date((raw - (25567 + 2)) * 86400 * 1000);
        const s = String(raw).trim();
        if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s)) {
            let [d, m, y] = s.split(/[\/\-]/);
            if (y.length === 2) y = '20' + y;
            return new Date(+y, +m - 1, +d);
        }
        return new Date(s); 
    },

    extractInvoiceNums: (str) => {
        const matches = str.match(/([a-z]{1,3}[-/\s]?\d{3,})|(\d{4,})/gi);
        return matches || [];
    }
};

// --- 1. PERFILES DE BANCO ---
const BANK_PROFILES = [
    {
        name: 'Banca March',
        detect: (row) => row.includes('f. operación') && row.includes('importe'),
        map: (r) => ({ colDate: r.indexOf('f. operación'), colDesc: r.indexOf('concepto'), colAmount: r.indexOf('importe') })
    },
    {
        name: 'CaixaBank',
        detect: (row) => row.includes('f. valor') && row.includes('importe'),
        map: (r) => ({ colDate: r.indexOf('f. valor'), colDesc: r.indexOf('concepto'), colAmount: r.indexOf('importe') })
    },
    {
        name: 'Genérico',
        detect: (row) => (row.includes('fecha') || row.includes('date')) && (row.includes('importe') || row.includes('amount')),
        map: (r) => ({ 
            colDate: r.findIndex(c => /fecha|date/i.test(c)), 
            colDesc: r.findIndex(c => /concepto|desc/i.test(c)), 
            colAmount: r.findIndex(c => /importe|amount/i.test(c)) 
        })
    }
];

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // Inicializar Datos
    if(!db.banco) db.banco = [];
    if(!db.facturas) db.facturas = []; 
    if(!db.albaranes) db.albaranes = [];
    if(!db.cierres) db.cierres = [];
    if(!db.bankImports) db.bankImports = [];
    if(!db.config) db.config = {};
    if(!db.config.customProfiles) db.config.customProfiles = [];
    if(db.config.saldoInicial === undefined) db.config.saldoInicial = 0;

    // --- KPIs en tiempo real ---
    const reCalc = () => {
        const sumaMovimientos = db.banco.reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);
        const saldoReal = (parseFloat(db.config.saldoInicial) || 0) + sumaMovimientos;
        const totalItems = db.banco.length;
        const matchedItems = db.banco.filter(b => b.status === 'matched').length;
        const percent = totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0;
        return { saldoReal, percent, totalItems, matchedItems };
    };

    let kpis = reCalc();
    let selectedBankId = null;

    // --- INTERFAZ PRINCIPAL ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
            <div class="flex justify-between items-start relative z-10">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Tesoreria</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <span>Gestión Bancaria</span>
                        <span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">TPV Connected</span>
                    </p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-black text-slate-400 uppercase mb-1">Saldo Real</p>
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
                <button id="btnExport" class="bg-slate-100 text-slate-600 px-5 py-3 rounded-xl text-[10px] font-black hover:bg-slate-200 transition">⬇️ CSV</button>
            </div>
            
            <div id="import-msg" class="mt-2 empty:hidden"></div>
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
                <div id="list-bank" class="space-y-2 h-[600px] overflow-y-auto custom-scrollbar pb-20 pr-1"></div>
            </div>

            <div class="lg:col-span-7">
                <div class="bg-white p-8 rounded-[2.5rem] border border-slate-100 relative h-[600px] flex flex-col shadow-xl overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    <h3 class="text-sm font-black text-indigo-900 uppercase mb-6 flex items-center gap-2"><span>🧠</span> Arume Brain</h3>
                    <div id="match-panel" class="flex-1 flex flex-col relative">
                        <div class="absolute inset-0 flex flex-col items-center justify-center text-center opacity-30 pointer-events-none">
                            <span class="text-6xl mb-4 grayscale">👈</span>
                            <p class="text-sm font-bold text-slate-800">Selecciona un movimiento para conciliar</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="wizardModal" class="hidden fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-4"></div>
    `;

    const listBank = container.querySelector("#list-bank");
    const matchPanel = container.querySelector("#match-panel");
    const importMsg = container.querySelector("#import-msg");

    // -------------------------------------------------------------
    // ⚙️ IMPORTACIÓN EXCEL
    // -------------------------------------------------------------
    container.querySelector("#bankCsv").onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        importMsg.innerHTML = `<div class="text-xs font-bold text-indigo-500 animate-pulse">Analizando fichero...</div>`;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type:'array'});
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false});

                const docHash = Utils.hashString(JSON.stringify(rows.slice(0, 50)));
                const alreadyImported = db.bankImports.find(x => x.hash === docHash);
                if (alreadyImported) {
                    if (!confirm(`⚠️ Fichero ya importado el ${new Date(alreadyImported.date).toLocaleDateString()}. ¿Re-importar?`)) {
                        importMsg.innerHTML = ''; return;
                    }
                }

                let profile = null, headerRowIdx = -1, mapping = null;
                const allProfiles = [...BANK_PROFILES, ...db.config.customProfiles];

                for (let i = 0; i < Math.min(rows.length, 20); i++) {
                    const rowStr = rows[i].map(c => Utils.normalize(c));
                    const found = allProfiles.find(p => p.detect(rowStr));
                    if (found) { profile = found; headerRowIdx = i; mapping = found.map(rowStr); break; }
                }

                if (!profile) {
                    mapping = await showMappingWizard(rows[0] || rows[1]);
                    if (!mapping) { importMsg.innerHTML = ''; return; }
                    headerRowIdx = 0; profile = { name: 'Manual' };
                }

                let imported = 0, skipped = 0;
                const newMovs = [];

                for (let i = headerRowIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row[mapping.colDate] && !row[mapping.colAmount]) continue;

                    const dateObj = Utils.parseDateSmart(row[mapping.colDate]);
                    const amount = Utils.parseAmountSmart(row[mapping.colAmount]);
                    const desc = String(row[mapping.colDesc] || 'Sin concepto').trim();

                    if (!dateObj || isNaN(amount)) continue;

                    const dateISO = dateObj.toISOString().split('T')[0];
                    const movHash = Utils.hashString(`${dateISO}_${amount}_${Utils.normalize(desc)}`);

                    if (db.banco.some(m => m.hash === movHash)) { skipped++; continue; }

                    newMovs.push({
                        id: 'bm-' + Date.now() + Math.random().toString(36).substr(2,5),
                        hash: movHash,
                        date: dateISO,
                        desc,
                        descNorm: Utils.normalize(desc),
                        amount,
                        status: 'pending'
                    });
                    imported++;
                }

                if (newMovs.length > 0) {
                    db.banco.unshift(...newMovs);
                    db.bankImports.push({ hash: docHash, date: new Date().toISOString(), rows: newMovs.length });
                    await saveFn(`📥 ${imported} movimientos. Omitidos ${skipped}.`);
                    updateUI();
                } else {
                    alert(`⚠️ Sin movimientos nuevos.`);
                }
                importMsg.innerHTML = '';

            } catch (err) {
                console.error(err);
                alert("Error: " + err.message);
                importMsg.innerHTML = '';
            } finally { e.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    };

    const showMappingWizard = (sampleRow) => {
        return new Promise((resolve) => {
            const modal = container.querySelector('#wizardModal');
            modal.classList.remove('hidden');
            const options = sampleRow.map((cell, i) => `<option value="${i}">Columna ${i}: ${cell}</option>`).join('');
            
            modal.innerHTML = `
                <div class="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl animate-slide-up">
                    <h3 class="text-lg font-black text-slate-800 mb-2">Formato Desconocido</h3>
                    <div class="space-y-3">
                        <div><label class="text-[10px] font-bold text-indigo-500">Fecha</label><select id="w-date" class="w-full p-2 bg-slate-50 rounded border text-xs">${options}</select></div>
                        <div><label class="text-[10px] font-bold text-indigo-500">Concepto</label><select id="w-desc" class="w-full p-2 bg-slate-50 rounded border text-xs">${options}</select></div>
                        <div><label class="text-[10px] font-bold text-indigo-500">Importe</label><select id="w-amount" class="w-full p-2 bg-slate-50 rounded border text-xs">${options}</select></div>
                    </div>
                    <div class="flex gap-2 mt-6">
                        <button id="w-cancel" class="flex-1 py-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
                        <button id="w-save" class="flex-1 py-3 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700">Importar</button>
                    </div>
                </div>`;

            modal.querySelector('#w-cancel').onclick = () => { modal.classList.add('hidden'); resolve(null); };
            modal.querySelector('#w-save').onclick = () => {
                const map = {
                    colDate: parseInt(modal.querySelector('#w-date').value),
                    colDesc: parseInt(modal.querySelector('#w-desc').value),
                    colAmount: parseInt(modal.querySelector('#w-amount').value)
                };
                db.config.customProfiles.push({ name: 'Personalizado '+Date.now(), detect: ()=>true, map: ()=>map });
                modal.classList.add('hidden');
                resolve(map);
            };
        });
    };

    // --- 2. RENDER LISTA ---
    const updateUI = () => {
        kpis = reCalc();
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
            .sort((a,b) => new Date(b.date) - new Date(a.date))
            .slice(0, 50);

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

    // --- 3. MATCHING INTELLIGENCE (ACTUALIZADO: CIERRES + AMEX/MADISA) ---
    window.selectBankItem = (id) => {
        selectedBankId = id;
        renderBankList();
        const item = db.banco.find(b => b.id === id);
        if(!item) return;

        let html = `<div class="animate-fade-in w-full h-full flex flex-col bg-white rounded-3xl p-6 relative z-10">`;
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

        let matches = [];
        const potentialInvoiceNums = Utils.extractInvoiceNums(item.desc);
        const bankNorm = item.descNorm || Utils.normalize(item.desc);

        // A. MATCHING DE GASTOS (ALBARANES)
        if (item.amount < 0) {
            db.albaranes.forEach(a => {
                if(a.reconciled || a.paid) return;
                const diff = Math.abs(parseFloat(a.total) - Math.abs(item.amount));
                let score = 0;
                if(diff <= 0.05) score += 50; else if(diff < 5) score += 10;
                if(bankNorm.includes(Utils.normalize(a.prov))) score += 40;
                if(score > 30) matches.push({ type: 'Gasto', data: a, text: `${a.prov} (${a.date})`, score, amount: parseFloat(a.total) });
            });
        }

        // B. MATCHING DE INGRESOS (FACTURAS B2B Y CIERRES TPV)
        if (item.amount > 0) {
            // B1. Facturas
            db.facturas.forEach(f => {
                if(f.reconciled || f.paid) return;
                const diff = Math.abs(parseFloat(f.total) - Math.abs(item.amount));
                let score = 0;
                if(diff <= 0.05) score += 50;
                if(bankNorm.includes(Utils.normalize(f.cliente || f.prov))) score += 40;
                if (potentialInvoiceNums.length > 0 && potentialInvoiceNums.some(num => (f.num||'').includes(num))) score += 100;
                if(score > 30) matches.push({ type: 'Factura', data: f, text: `Fra. ${f.num} - ${f.cliente||'Varios'}`, score, amount: parseFloat(f.total) });
            });

            // B2. Cierres de Caja (NUEVO: Madisa, Amex, TPV)
            db.cierres.forEach(c => {
                if(c.conciliado_banco) return;
                
                const t = parseFloat(c.tarjeta) || 0;
                const apps = parseFloat(c.apps) || 0;
                
                // Opción 1: Coincide con el total de tarjeta del día (TPV Genérico)
                const diffT = Math.abs(t - item.amount);
                if (diffT < 5) { // Margen de 5€ por comisiones
                    matches.push({ type: 'TPV Diario', data: c, text: `Cierre Caja Z: ${c.date}`, score: 80 - diffT, amount: t, targetField: 'tarjeta' });
                }

                // Opción 2: Coincide con Apps (Glovo/Uber/Madisa)
                const diffA = Math.abs(apps - item.amount);
                if (diffA < 2) {
                    matches.push({ type: 'Delivery/Apps', data: c, text: `Apps Delivery: ${c.date}`, score: 80 - diffA, amount: apps, targetField: 'apps' });
                }
                
                // Opción 3: Coincide con AMEX (si tuvieras campo amex, o si es un parcial)
                // Aquí asumimos que si la descripción pone AMEX, buscamos coincidencia aproximada
                if (item.desc.toUpperCase().includes('AMEX') && t > item.amount) {
                     matches.push({ type: 'Cobro AMEX', data: c, text: `Parte de Cierre: ${c.date}`, score: 60, amount: item.amount, targetField: 'parcial' });
                }
            });
        }
        
        matches.sort((a,b) => b.score - a.score);

        if(matches.length > 0) {
            html += `<p class="text-[10px] font-bold text-indigo-500 uppercase mb-2">💡 Sugerencia inteligente</p>`;
            html += `<div class="space-y-2 mb-6 max-h-40 overflow-y-auto custom-scrollbar">`;
            html += matches.map(m => `
                <div class="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition" 
                     onclick="window.confirmMatch('${item.id}', '${m.data.id}', '${m.type}')">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-[8px] font-bold uppercase text-indigo-400">${m.type}</span>
                            ${m.score >= 100 ? '<span class="text-[8px] bg-emerald-400 text-white px-1 rounded">🔥 MATCH</span>' : ''}
                        </div>
                        <p class="font-bold text-sm text-indigo-900">${m.text}</p>
                        <p class="text-[10px] text-indigo-600">${m.amount.toFixed(2)}€</p>
                    </div>
                    <button class="bg-indigo-600 text-white w-8 h-8 rounded-full shadow-lg font-bold">✓</button>
                </div>
            `).join('');
            html += `</div>`;
        }

        // ACCIONES MANUALES
        html += `<div class="mt-auto">
            <p class="text-[9px] font-bold text-slate-400 uppercase mb-2">Crear Gasto Rápido</p>
            <div class="grid grid-cols-2 gap-2 mb-2">
                <button onclick="window.createQuickExpense('${item.id}', 'Comisión Banco')" class="bg-slate-50 border text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100">🏦 Comisión</button>
                <button onclick="window.createQuickExpense('${item.id}', 'Alquiler')" class="bg-slate-50 border text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100">🏢 Alquiler</button>
                <button onclick="window.createQuickExpense('${item.id}', 'Luz/Agua')" class="bg-slate-50 border text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100">💡 Suministros</button>
                <button onclick="window.createQuickExpense('${item.id}', 'Gestoría')" class="bg-slate-50 border text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-slate-100">⚖️ Gestoría</button>
            </div>
            <button onclick="window.createCustomExpense('${item.id}')" class="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black shadow-lg hover:bg-slate-700 transition">✏️ MANUAL</button>
        </div>`;
        
        html += `</div>`;
        matchPanel.innerHTML = html;
    };

    // --- 4. FUNCIONES GLOBALES ---
    window.confirmMatch = async (bankId, erpId, type) => {
        const bItem = db.banco.find(b => b.id === bankId);
        if(bItem) bItem.status = 'matched';
        
        // Si es Cierre de Caja (TPV/Apps)
        if (type.includes('TPV') || type.includes('Apps') || type.includes('AMEX') || type.includes('Cierre')) {
            const cierre = db.cierres.find(c => c.id === erpId);
            if (cierre) {
                // Marcamos como conciliado (parcialmente si es necesario, pero simple por ahora)
                cierre.conciliado_banco = true; 
            }
        } else {
            // Si es Factura o Gasto
            const targetDb = type.includes('Factura') ? db.facturas : db.albaranes;
            const item = targetDb.find(i => i.id === erpId);
            if(item) { item.reconciled = true; item.paid = true; }
        }
        
        await saveFn("Conciliado ✅");
        selectedBankId = null; matchPanel.innerHTML = ''; updateUI();
    };

    window.createQuickExpense = (id, name) => window.createCustomExpense(id, name);
    
    window.createCustomExpense = async (id, name=null) => {
        const item = db.banco.find(b => b.id === id);
        if(!item) return;
        const concepto = name || prompt("Nombre del gasto:", item.desc);
        if(!concepto) return;
        
        const importe = Math.abs(item.amount);
        db.albaranes.push({
            id: 'auto-' + Date.now(),
            date: item.date,
            prov: concepto,
            num: "BANCO",
            total: importe,
            base: importe, taxes: 0, items: [{ q: 1, n: concepto, t: importe, rate: 0 }],
            paid: true, reconciled: true, status: 'ok', notes: "Auto desde Tesorería"
        });
        item.status = 'matched';
        item.cat = concepto;
        await saveFn("Gasto creado ✅");
        selectedBankId = null; matchPanel.innerHTML = ''; updateUI();
    };

    window.runMagic = async () => {
        let count = 0;
        const pendings = db.banco.filter(b => b.status === 'pending');
        for (const b of pendings) {
            const desc = b.desc.toLowerCase();
            if (b.amount < 0 && Math.abs(b.amount) < 50 && ['comision','mantenimiento','interes'].some(k => desc.includes(k))) {
                await window.createQuickExpense(b.id, 'Comisión Banco');
                count++;
            }
        }
        if(count > 0) { await saveFn(`✨ ${count} auto-conciliados`); updateUI(); } 
        else alert("No encontré movimientos obvios (comisiones, etc).");
    };

    window.deleteBankItem = async (id, e) => {
        e.stopPropagation();
        if(confirm("¿Borrar movimiento?")) {
            db.banco = db.banco.filter(b => b.id !== id);
            await saveFn("Borrado"); selectedBankId = null; matchPanel.innerHTML = ''; updateUI();
        }
    };

    window.conciliarManual = window.selectBankItem; 

    container.querySelector("#btnNuke").onclick = async () => {
        if(confirm("¿Borrar TODOS los pendientes?")) {
            db.banco = db.banco.filter(b => b.status === 'matched');
            await saveFn("Limpio 🧹"); updateUI();
        }
    };

    container.querySelector("#btnEditSaldo").onclick = async () => {
        const nuevo = prompt("Saldo Inicial en Banco:", db.config.saldoInicial);
        if(nuevo) {
            db.config.saldoInicial = parseFloat(nuevo.replace(',','.')) || 0;
            await saveFn("Saldo actualizado"); updateUI();
        }
    };

    container.querySelector("#searchBank").addEventListener('input', renderBankList);
    updateUI();
}
