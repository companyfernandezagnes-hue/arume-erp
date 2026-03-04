/* =============================================================
   🏦 MÓDULO: BANCO v13.0 (Conciliación Facturas, Z y Albaranes VIP)
   ============================================================= */
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

const Utils = {
    normalize: (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(),
    
    generateHash: (dateISO, amount, desc, ref = '') => {
        const cents = Math.round(amount * 100); 
        const str = `${dateISO}_${cents}_${Utils.normalize(desc)}_${ref}`;
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
        return (h >>> 0).toString(16);
    },

    parseAmount: (raw) => {
        if (typeof raw === 'number') return raw;
        let s = String(raw).trim();
        s = s.replace(/\u2212/g, '-'); 
        if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
        return window.Num.parse(s);
    },
    
    parseDate: (raw) => {
        if (!raw) return null;
        if (raw instanceof Date) return raw;
        if (typeof raw === 'number' && raw > 20000) return new Date((raw - (25567 + 2)) * 86400 * 1000);
        const s = String(raw).trim();
        if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s)) {
            let [d, m, y] = s.split(/[\/\-]/);
            if (y.length === 2) y = '20' + y;
            return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
        }
        return new Date(raw);
    }
};

let lastUndo = null;

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // Aseguramos que existan todas las bases de datos necesarias
    ['banco','facturas','albaranes','cierres','bankImports'].forEach(k => { if(!db[k]) db[k]=[]; });
    if(!db.config) db.config = {};
    if(db.config.saldoInicial === undefined) db.config.saldoInicial = 0;
    
    // 🚨 URL PROFESIONAL Y PERMANENTE (CLOUDFLARE)
    if(!db.config.n8nUrlBanco) db.config.n8nUrlBanco = "https://ia.permatunnelopen.org/webhook/1085406f-324c-42f7-b50f-22f211f445cd";

    const reCalc = () => {
        const sumaMovs = db.banco.reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);
        const saldo = (parseFloat(db.config.saldoInicial) || 0) + sumaMovs;
        const pending = db.banco.filter(b => b.status === 'pending');
        const matched = db.banco.length - pending.length;
        const pct = db.banco.length > 0 ? Math.round((matched / db.banco.length) * 100) : 0;
        return { saldo, percent: pct, pending: pending.length, total: db.banco.length, matched };
    };

    let kpis = reCalc();
    let selectedBankId = null;

    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
            <div class="flex justify-between items-start relative z-10">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Banco</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer hover:underline" id="btnConfigN8n">⚙️ Configurar Túnel n8n</p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-black text-slate-400 uppercase mb-1">Saldo Banco</p>
                    <div class="flex items-center justify-end gap-2" id="btnEditSaldo">
                        <span class="text-3xl font-black text-slate-800">${window.Num.fmt(kpis.saldo)}</span>
                        <span class="text-xs text-slate-400 cursor-pointer">✏️</span>
                    </div>
                </div>
            </div>
            
            <div class="mt-6">
                <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    <span>Estado Conciliación</span>
                    <span id="lblProgress">${kpis.matched} / ${kpis.total}</span>
                </div>
                <div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div id="barProgress" class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style="width: ${kpis.percent}%"></div>
                </div>
            </div>

            <div class="mt-6 flex flex-wrap gap-2">
                <button id="btnPaste" class="bg-indigo-600 text-white px-5 py-3 rounded-xl text-[10px] font-black hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg">📋 PEGAR</button>
                <label class="bg-slate-900 text-white px-5 py-3 rounded-xl text-[10px] font-black cursor-pointer shadow-lg hover:scale-105 transition flex items-center gap-2">
                    📂 SUBIR EXCEL <input type="file" id="bankCsv" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
                <button id="btnMagic" class="bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-5 py-3 rounded-xl text-[10px] font-black hover:shadow-lg hover:scale-105 transition shadow-lg">
                    🪄 AUTO-MATCH (IA)
                </button>
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-5 space-y-4">
                <div class="bg-white p-2 rounded-2xl border border-slate-100 flex items-center gap-2 shadow-sm sticky top-0 z-10">
                    <span class="pl-2 text-slate-400">🔍</span>
                    <input id="searchBank" type="text" placeholder="Buscar movimiento..." class="w-full bg-transparent text-xs font-bold outline-none text-slate-600 h-8">
                </div>
                <div class="flex justify-between px-2">
                    <span class="text-[9px] font-bold text-slate-400 uppercase">Pendientes de revisar</span>
                    <button id="btnNuke" class="text-[9px] font-bold text-rose-400 hover:text-rose-600">🗑️ Limpiar Conciliados</button>
                </div>
                <div id="list-bank" class="space-y-2 h-[600px] overflow-y-auto custom-scrollbar pb-20 pr-1"></div>
            </div>

            <div class="lg:col-span-7">
                <div class="bg-white p-8 rounded-[2.5rem] border border-slate-100 relative h-[600px] flex flex-col shadow-xl overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    <div id="match-panel" class="flex-1 flex flex-col relative justify-center items-center text-center overflow-y-auto custom-scrollbar">
                        <span class="text-6xl mb-4 grayscale opacity-30">🤖</span>
                        <p class="text-sm font-bold text-slate-400">Selecciona un movimiento de la lista para ver coincidencias exactas con Facturas y Albaranes.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    container.querySelector("#btnConfigN8n").onclick = async () => {
        const nuevaUrl = prompt("Pega aquí tu nueva URL (Cloudflare) seguida de /webhook/... :", db.config.n8nUrlBanco);
        if(nuevaUrl) { db.config.n8nUrlBanco = nuevaUrl.trim(); await saveFn("URL de n8n actualizada."); }
    };

    const updateUI = () => {
        kpis = reCalc();
        container.querySelector("#lblProgress").innerText = `${kpis.matched} / ${kpis.total} Conciliados`;
        container.querySelector("#barProgress").style.width = `${kpis.percent}%`;
        const elSaldo = container.querySelector("#btnEditSaldo span");
        if(elSaldo) elSaldo.innerText = window.Num.fmt(kpis.saldo);
        
        const term = container.querySelector("#searchBank").value.toLowerCase();
        const lista = db.banco
            .filter(b => b.status === 'pending')
            .filter(b => b.desc.toLowerCase().includes(term) || b.amount.toString().includes(term))
            .sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

        container.querySelector("#list-bank").innerHTML = lista.map(b => `
            <div onclick="window.selectBankItem('${b.id}')" 
                 class="group relative bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md cursor-pointer transition ${selectedBankId===b.id ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''}">
                <div class="flex justify-between items-start gap-2">
                    <div class="min-w-0">
                        <p class="font-bold text-slate-700 text-[11px] truncate">${b.desc}</p>
                        <p class="text-[9px] text-slate-400 font-mono mt-1">${b.date}</p>
                    </div>
                    <span class="font-black text-xs whitespace-nowrap ${b.amount < 0 ? 'text-slate-800' : 'text-emerald-500'}">
                        ${b.amount > 0 ? '+' : ''}${b.amount.toFixed(2)}€
                    </span>
                </div>
                <button onclick="window.deleteBankItem('${b.id}', event)" class="absolute -top-1 -right-1 bg-white text-rose-400 hover:text-white hover:bg-rose-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition">✕</button>
            </div>
        `).join('') || '<p class="text-center text-xs text-slate-300 py-10">Todo limpio ✨</p>';
    };

    // --- LÓGICA DE BUSCADOR DE COINCIDENCIAS (MAGIA PURA) ---
    const getMatches = (item) => {
        const amt = Math.abs(item.amount);
        let matches = [];
        
        if (item.amount > 0) {
            // ES INGRESO: Buscar en Cierres Z (por importe de tarjeta) y Facturas emitidas
            db.cierres.forEach(c => {
                if (Math.abs((parseFloat(c.tarjeta)||0) - amt) <= 2) {
                    const zNum = `Z-${c.date.replace(/-/g,'')}`;
                    const fZ = db.facturas.find(f => f.num === zNum);
                    if (fZ && !fZ.reconciled) {
                        matches.push({ type: 'FACTURA Z', id: fZ.id, date: c.date, title: `Cierre Caja ${c.date}`, amount: parseFloat(c.tarjeta).toFixed(2), bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' });
                    }
                }
            });
            db.facturas.forEach(f => {
                if (f.cliente !== "Z DIARIO" && !f.reconciled && f.total > 0 && Math.abs(parseFloat(f.total) - amt) <= 2) {
                    matches.push({ type: 'FACTURA CLIENTE', id: f.id, date: f.date, title: `Fac ${f.num} (${f.cliente})`, amount: parseFloat(f.total).toFixed(2), bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' });
                }
            });
        } else {
            // ES GASTO: Buscar en Albaranes sueltos y Facturas de proveedores
            db.albaranes.forEach(a => {
                if (!a.reconciled && Math.abs(parseFloat(a.total) - amt) <= 2) {
                    matches.push({ type: 'ALBARÁN', id: a.id, date: a.date, title: `${a.prov} (${a.num})`, amount: parseFloat(a.total).toFixed(2), bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' });
                }
            });
            db.facturas.forEach(f => {
                if (f.total < 0 && !f.reconciled && Math.abs(Math.abs(parseFloat(f.total)) - amt) <= 2) {
                    matches.push({ type: 'FACTURA PROV', id: f.id, date: f.date, title: `Fac ${f.num} (${f.proveedor||'Prov'})`, amount: Math.abs(parseFloat(f.total)).toFixed(2), bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' });
                }
            });
        }
        return matches;
    };

    window.selectBankItem = (id) => {
        selectedBankId = id; updateUI();
        const item = db.banco.find(b => b.id === id);
        if(!item) return;

        const matches = getMatches(item);
        
        let matchHTML = '';
        if (matches.length > 0) {
            matchHTML = `
                <div class="mb-6 w-full">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase mb-3 text-left">🔗 Coincidencias Encontradas</h4>
                    <div class="space-y-2">
                        ${matches.map(m => `
                            <div class="flex justify-between items-center p-3 rounded-xl border ${m.bg} ${m.border}">
                                <div class="text-left">
                                    <span class="text-[8px] font-black ${m.text} uppercase tracking-widest">${m.type}</span>
                                    <p class="text-xs font-bold text-slate-800">${m.title}</p>
                                    <p class="text-[9px] text-slate-500">${m.date}</p>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="font-black text-sm text-slate-800">${m.amount}€</span>
                                    <button onclick="window.linkItem('${item.id}', '${m.type}', '${m.id}')" class="bg-slate-900 text-white px-3 py-2 rounded-lg text-[9px] font-black hover:scale-105 transition shadow-md">ENLAZAR</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const panel = container.querySelector("#match-panel");
        panel.innerHTML = `
            <div class="w-full text-left animate-fade-in">
                <div class="border-b border-slate-100 pb-4 mb-6">
                    <span class="text-[9px] font-black ${item.amount>0?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'} px-2 py-1 rounded uppercase tracking-widest">${item.amount>0?'INGRESO':'GASTO'}</span>
                    <h3 class="font-black text-lg mt-3 leading-tight">${item.desc}</h3>
                    <p class="text-4xl font-black mt-1 ${item.amount>0?'text-emerald-500':'text-slate-900'}">${window.Num.fmt(item.amount)}</p>
                    <p class="text-[10px] text-slate-400 font-mono mt-2">Fecha: ${item.date}</p>
                </div>
                
                ${matchHTML}
                
                <h4 class="text-[10px] font-black text-slate-400 uppercase mb-3 text-left">⚡ Creación Rápida (Sin enlace)</h4>
                <div class="grid grid-cols-2 gap-2 mb-4">
                    <button onclick="window.createQuickExpense('${item.id}', 'Comisión Bancaria')" class="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition">🏦 Comisión / Banco</button>
                    <button onclick="window.createQuickExpense('${item.id}', 'Suministros')" class="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition">💡 Luz / Agua / Gas</button>
                    <button onclick="window.createQuickExpense('${item.id}', 'Personal')" class="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition">👨‍🍳 Nómina / SS</button>
                    <button onclick="window.createQuickExpense('${item.id}', 'Alquiler')" class="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition">🏢 Alquiler</button>
                </div>
                <button onclick="window.createCustomExpense('${item.id}')" class="w-full bg-slate-100 text-slate-600 border border-slate-200 py-3 rounded-xl text-[10px] font-black hover:bg-slate-200 transition">CREAR GASTO MANUAL NUEVO</button>
            </div>
        `;
    };

    // Función que enlaza un movimiento del banco con una factura o albarán existente
    window.linkItem = async (bankId, matchType, docId) => {
        const bItem = db.banco.find(b => b.id === bankId);
        if(!bItem) return;

        if (matchType === 'ALBARÁN') {
            const alb = db.albaranes.find(a => a.id === docId);
            if(alb) { alb.reconciled = true; alb.paid = true; }
        } else { // FACTURA Z, PROV O CLIENTE
            const fac = db.facturas.find(f => f.id === docId);
            if(fac) { fac.reconciled = true; fac.paid = true; }
        }
        
        bItem.status = 'matched';
        await saveFn(`🔗 Enlazado con ${matchType}`);
        selectedBankId = null;
        updateUI();
        container.querySelector("#match-panel").innerHTML = '<div class="flex-1 flex flex-col justify-center items-center text-center"><span class="text-6xl mb-4 grayscale opacity-30">✨</span><p class="text-sm font-bold text-slate-400">Conciliado correctamente</p></div>';
    };

    window.createQuickExpense = window.createCustomExpense = async (id, name=null) => {
        const item = db.banco.find(b => b.id === id);
        const concepto = name || prompt("Concepto del gasto nuevo:", item.desc);
        if(!concepto) return;

        const newAlb = {
            id: 'auto-'+Date.now(), date: item.date, prov: concepto, num: "BANCO",
            total: Math.abs(item.amount), paid: true, status: 'ok', reconciled: true
        };
        db.albaranes.push(newAlb);
        item.status = 'matched';
        lastUndo = { bankId: item.id, albId: newAlb.id }; 
        await saveFn("Gasto creado y conciliado");
        selectedBankId = null; updateUI();
        
        const toast = document.createElement('div');
        toast.className = "fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg z-[10000] flex gap-4 items-center animate-slide-up";
        toast.innerHTML = `<span class="text-xs font-bold">Gasto creado</span> <button id="btnUndo" class="text-indigo-400 font-black text-xs hover:text-white">DESHACER ↩️</button>`;
        document.body.appendChild(toast);
        toast.querySelector("#btnUndo").onclick = async () => {
            if(lastUndo) {
                db.albaranes = db.albaranes.filter(a => a.id !== lastUndo.albId);
                const bRev = db.banco.find(b => b.id === lastUndo.bankId);
                if(bRev) bRev.status = 'pending';
                await saveFn("Deshecho ↩️"); toast.remove(); updateUI();
            }
        };
        setTimeout(() => toast.remove(), 8000);
        container.querySelector("#match-panel").innerHTML = '<div class="flex-1 flex flex-col justify-center items-center text-center"><span class="text-6xl mb-4 grayscale opacity-30">👈</span><p class="text-sm font-bold text-slate-400">Selecciona otro</p></div>';
    };

    // --- MAGIA: AUTO-MATCH CON IA (Inteligencia de Facturas y Cierres) ---
    container.querySelector("#btnMagic").onclick = async () => {
        let count = 0;
        const todosPendientes = db.banco.filter(b => b.status === 'pending');
        if (todosPendientes.length === 0) return alert("No hay movimientos pendientes.");
        
        const pendings = todosPendientes.slice(0, 25); 
        const btn = container.querySelector("#btnMagic");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="animate-spin inline-block">🪄</span> IA PENSANDO (${pendings.length})...`;
        btn.disabled = true;

        try {
            const response = await fetch(db.config.n8nUrlBanco, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ movimientos: pendings.map(m => ({ ...m, descOriginal: m.desc })), saldoInicial: db.config.saldoInicial })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const datosProcesados = await response.json();

            if (datosProcesados && datosProcesados.movimientos) {
                for (const mov of datosProcesados.movimientos) {
                    if (!mov.id) continue; 
                    const item = db.banco.find(b => b.id === mov.id);
                    if (!item) continue;
                    
                    const amt = Number(item.amount); 
                    if (isNaN(amt)) continue;
                    
                    const conf = Number(mov.confidence ?? 0);

                    // 1. SI ES UN CIERRE DE TPV (Redsys) -> Auto-buscar el Cierre Z
                    if (mov.esCierreTPV) {
                        const zMatch = db.cierres.find(c => Math.abs((parseFloat(c.tarjeta)||0) - amt) <= 2);
                        if (zMatch) {
                            const fZ = db.facturas.find(f => f.num === `Z-${zMatch.date.replace(/-/g,'')}`);
                            if (fZ) fZ.reconciled = true;
                        }
                        item.status = 'matched';
                        count++;
                    } 
                    // 2. SI ES UN GASTO SEGURO CREADO POR IA
                    else if (mov.categoriaAsignada && mov.categoriaAsignada !== 'Gastos Varios' && mov.categoriaAsignada !== 'Ingreso' && conf >= 0.7) {
                        // Antes de crear uno nuevo a lo ciego, revisamos si ya hay un albarán/factura que encaje
                        const matches = getMatches(item);
                        if(matches.length === 1) {
                            // Si hay exactamente UNA coincidencia clara, la enlazamos automáticamente
                            window.linkItem(item.id, matches[0].type, matches[0].id); // Esto ya suma al count
                        } else {
                            // Si no hay coincidencias previas, creamos el gasto nuevo
                            const newAlb = {
                                id: 'auto-' + Date.now() + Math.random(),
                                date: item.date, prov: mov.categoriaAsignada + ' (IA)', num: "BANCO",
                                total: Math.abs(amt), paid: true, status: 'ok', reconciled: true
                            };
                            db.albaranes.push(newAlb);
                            item.status = 'matched';
                            count++;
                        }
                    }
                }
            }

            if(count > 0) { 
                let msg = `✨ ${count} movimientos conciliados.`;
                if (todosPendientes.length > 25) msg += `\n⚠️ Quedan ${todosPendientes.length - 25} más. ¡Vuelve a pulsar!`;
                await saveFn(msg); updateUI(); 
            } else {
                alert("La IA ha revisado esta tanda pero no ha encontrado automatizaciones seguras. Usa el panel manual.");
            }

        } catch (error) { alert(`🚨 Error IA:\n${error.message}`); } 
        finally { btn.innerHTML = originalText; btn.disabled = false; }
    };

    const processIncomingData = async (rawRows, sourceName) => {
        let imported = 0, skipped = 0;
        const newMovs = [];
        const existingHashes = new Set(db.banco.map(b => b.hash));
        rawRows.forEach(row => {
            if(!row.date || !row.amount) return;
            const desc = String(row.desc || 'Sin concepto').trim();
            const dateISO = row.date.toISOString().split('T')[0]; // SIEMPRE YYYY-MM-DD
            const hash = Utils.generateHash(dateISO, row.amount, desc, row.ref);
            if(existingHashes.has(hash)) { skipped++; return; }
            newMovs.push({ id: 'bm-'+Date.now()+Math.random().toString(36).substr(2,5), hash: hash, date: dateISO, desc: desc, amount: row.amount, status: 'pending', source: sourceName });
            existingHashes.add(hash); imported++;
        });
        if (newMovs.length > 0) { db.banco.unshift(...newMovs); await saveFn(`📥 ${imported} importados. (🛡️ ${skipped} dups)`); updateUI(); } 
        else { alert(`⚠️ 0 nuevos.\n🛡️ Bloqueados ${skipped} duplicados.`); }
    };

    container.querySelector("#bankCsv").onchange = (e) => {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'});
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
            let colDate = -1, colAmt = -1, colDesc = -1, colRef = -1;
            rows.slice(0,10).forEach((r, i) => {
                r.forEach((c, j) => {
                    const s = String(c).toLowerCase();
                    if(s.includes('fecha') || s.includes('date') || s.includes('valor')) colDate = j;
                    if(s.includes('importe') || s.includes('amount')) colAmt = j;
                    if(s.includes('concepto') || s.includes('descrip')) colDesc = j;
                    if(s.includes('referencia') || s.includes('ref')) colRef = j;
                });
            });
            if(colDate === -1 || colAmt === -1) return alert("Faltan columnas Fecha/Importe.");
            const cleanRows = [];
            rows.forEach(r => {
                if(r[colDate] && r[colAmt]) {
                    const d = Utils.parseDate(r[colDate]); const a = Utils.parseAmount(r[colAmt]);
                    if(d && !isNaN(a)) cleanRows.push({ date: d, amount: a, desc: r[colDesc], ref: colRef > -1 ? r[colRef] : null });
                }
            });
            processIncomingData(cleanRows, 'Excel');
        };
        reader.readAsArrayBuffer(file); e.target.value = '';
    };

    container.querySelector("#btnPaste").onclick = async () => {
        try {
            const text = await navigator.clipboard.readText(); if(!text) return;
            const lines = text.split('\n'); const cleanRows = [];
            lines.forEach(line => {
                const dMatch = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
                const mMatch = line.match(/(-?[\d.]+,\d{2}|-?[\d,]+\.\d{2})/g); 
                if (dMatch && mMatch) {
                    const rawAmt = mMatch[mMatch.length - 1]; const amt = Utils.parseAmount(rawAmt);
                    if (!isNaN(amt)) cleanRows.push({ date: Utils.parseDate(dMatch[0]), amount: amt, desc: line.replace(dMatch[0], '').replace(rawAmt, '').trim() || "Web" });
                }
            });
            if (cleanRows.length > 0) processIncomingData(cleanRows, 'Portapapeles'); else alert("No entendí el texto.");
        } catch (err) { alert("Usa Ctrl+V."); }
    };

    window.deleteBankItem = async (id, e) => {
        e.stopPropagation();
        if(confirm("¿Borrar movimiento?")) { db.banco = db.banco.filter(b => b.id !== id); await saveFn("Borrado"); selectedBankId = null; updateUI(); }
    };
    
    container.querySelector("#btnNuke").onclick = async () => {
        if(confirm("¿Borrar TODOS los YA CONCILIADOS?")) { db.banco = db.banco.filter(b => b.status === 'pending'); await saveFn("Limpios"); updateUI(); }
    };

    container.querySelector("#btnEditSaldo").onclick = async () => {
        const nuevo = prompt("Saldo:", db.config.saldoInicial); 
        if(nuevo && !isNaN(parseFloat(nuevo.replace(',','.')))) { db.config.saldoInicial = parseFloat(nuevo.replace(',','.')); await saveFn("Saldo Ok"); updateUI(); }
    };

    container.querySelector("#searchBank").addEventListener('input', updateUI);
    updateUI();
}
