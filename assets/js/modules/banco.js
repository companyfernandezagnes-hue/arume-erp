/* =============================================================
   🏦 MÓDULO: BANCO v12.2+ (Integración n8n + Simplicidad Arume)
   ============================================================= */
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

const Utils = {
    normalize: (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(),
    
    // Hash Robusto (Fecha + Céntimos + Desc + Ref)
    generateHash: (dateISO, amount, desc, ref = '') => {
        const cents = Math.round(amount * 100); // Evita errores de punto flotante
        const str = `${dateISO}_${cents}_${Utils.normalize(desc)}_${ref}`;
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
        return (h >>> 0).toString(16);
    },

    // Parseo inteligente de importes (soporta negativos raros)
    parseAmount: (raw) => {
        if (typeof raw === 'number') return raw;
        let s = String(raw).trim();
        s = s.replace(/\u2212/g, '-'); // Signo menos unicode
        // Formato contable (100) = -100
        if (s.startsWith('(') && s.endsWith(')')) { 
            s = '-' + s.slice(1, -1);
        }
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

let lastUndo = null; // Para deshacer acciones

export async function render(container, supabase, db, opts = {}) {
    const saveFn = opts.save || (window.save ? window.save : async () => {});
    
    // Inicializar
    ['banco','facturas','albaranes','cierres','bankImports','logs'].forEach(k => { if(!db[k]) db[k]=[]; });
    if(!db.config) db.config = {};
    if(db.config.saldoInicial === undefined) db.config.saldoInicial = 0;

    // --- KPIs ---
    const reCalc = () => {
        const sumaMovs = db.banco.reduce((acc, b) => acc + (parseFloat(b.amount)||0), 0);
        const saldo = (parseFloat(db.config.saldoInicial) || 0) + sumaMovs;
        const pending = db.banco.filter(b => b.status === 'pending');
        const matched = db.banco.length - pending.length;
        const pct = db.banco.length > 0 ? Math.round((matched / db.banco.length) * 100) : 0;
        return { saldo, percent: pct, pending: pending.length, total: db.banco.length };
    };

    let kpis = reCalc();
    let selectedBankId = null;

    // --- INTERFAZ ---
    container.innerHTML = `
    <div class="animate-fade-in space-y-6 pb-24">
        <header class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
            <div class="flex justify-between items-start relative z-10">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Banco</h2>
                    <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Conciliación n8n AI v12.2</p>
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
                <button id="btnPaste" class="bg-indigo-600 text-white px-5 py-3 rounded-xl text-[10px] font-black hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg">
                    📋 PEGAR PORTAPAPELES
                </button>
                <label class="bg-slate-900 text-white px-5 py-3 rounded-xl text-[10px] font-black cursor-pointer shadow-lg hover:scale-105 transition flex items-center gap-2">
                    📂 SUBIR EXCEL
                    <input type="file" id="bankCsv" class="hidden" accept=".csv, .xlsx, .xls">
                </label>
                <button id="btnMagic" class="bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-5 py-3 rounded-xl text-[10px] font-black hover:shadow-lg hover:scale-105 transition">
                    🪄 AUTO-MATCH (AI)
                </button>
            </div>
            <div id="import-msg" class="mt-2 text-xs font-bold text-indigo-500 empty:hidden"></div>
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
                    <div id="match-panel" class="flex-1 flex flex-col relative justify-center items-center text-center">
                        <span class="text-6xl mb-4 grayscale opacity-30">👈</span>
                        <p class="text-sm font-bold text-slate-400">Selecciona un movimiento de la lista</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // --- FUNCIONES CORE ---
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
            .sort((a,b) => new Date(b.date) - new Date(a.date))
            .slice(0, 50);

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

    // --- PROCESADOR DE ENTRADA (Anti-Duplicados) ---
    const processIncomingData = async (rawRows, sourceName = 'unknown') => {
        let imported = 0, skipped = 0;
        const newMovs = [];
        
        const existingHashes = new Set(db.banco.map(b => b.hash));

        rawRows.forEach(row => {
            if(!row.date || !row.amount) return;
            
            const desc = String(row.desc || 'Sin concepto').trim();
            const dateISO = row.date.toISOString().split('T')[0];
            const hash = Utils.generateHash(dateISO, row.amount, desc, row.ref); // Incluye ref si existe

            if(existingHashes.has(hash)) { skipped++; return; }

            newMovs.push({
                id: 'bm-' + Date.now() + Math.random().toString(36).substr(2,5),
                hash: hash,
                date: dateISO,
                desc: desc,
                descNorm: Utils.normalize(desc),
                amount: row.amount,
                status: 'pending',
                source: sourceName
            });
            existingHashes.add(hash);
            imported++;
        });

        if (newMovs.length > 0) {
            db.banco.unshift(...newMovs);
            db.logs.push({ ts: Date.now(), action: 'bank_import', count: imported, source: sourceName });
            await saveFn(`📥 ${imported} nuevos movimientos. (🛡️ ${skipped} duplicados)`);
            updateUI();
        } else {
            alert(`⚠️ Sin movimientos nuevos.\n🛡️ Se bloquearon ${skipped} duplicados.`);
        }
    };

    // 1. IMPORTAR EXCEL
    container.querySelector("#bankCsv").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
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

            if(colDate === -1 || colAmt === -1) return alert("No encontré columnas Fecha/Importe.");

            const cleanRows = [];
            rows.forEach(r => {
                if(r[colDate] && r[colAmt]) {
                    const dateObj = Utils.parseDate(r[colDate]);
                    const amt = Utils.parseAmount(r[colAmt]);
                    if(dateObj && !isNaN(amt)) {
                        cleanRows.push({ 
                            date: dateObj, 
                            amount: amt, 
                            desc: r[colDesc], 
                            ref: colRef > -1 ? r[colRef] : null 
                        });
                    }
                }
            });
            processIncomingData(cleanRows, 'Excel: ' + file.name);
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // 2. PEGAR DESDE PORTAPAPELES
    container.querySelector("#btnPaste").onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if(!text) return alert("Portapapeles vacío");

            const lines = text.split('\n');
            const cleanRows = [];
            
            lines.forEach(line => {
                const dateMatch = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
                const moneyMatch = line.match(/(-?[\d.]+,\d{2}|-?[\d,]+\.\d{2})/g); 

                if (dateMatch && moneyMatch) {
                    const rawAmt = moneyMatch[moneyMatch.length - 1]; 
                    const amt = Utils.parseAmount(rawAmt);
                    let desc = line.replace(dateMatch[0], '').replace(rawAmt, '').trim();
                    if (!isNaN(amt)) {
                        cleanRows.push({ date: Utils.parseDate(dateMatch[0]), amount: amt, desc: desc || "Movimiento Web" });
                    }
                }
            });

            if (cleanRows.length > 0) processIncomingData(cleanRows, 'Portapapeles');
            else alert("No pude entender el texto.");

        } catch (err) { console.error(err); alert("Error leyendo portapapeles. Usa Ctrl+V."); }
    };

    // --- MAGIA: AUTO-MATCH (Conectado a n8n) ---
    container.querySelector("#btnMagic").onclick = async () => {
        let count = 0;
        const pendings = db.banco.filter(b => b.status === 'pending');
        
        if (pendings.length === 0) return alert("No hay movimientos pendientes para procesar.");
        
        // 1. Mostrar estado de carga (n8n puede tardar unos segundos)
        const btn = container.querySelector("#btnMagic");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="animate-spin inline-block">🪄</span> PROCESANDO EN LA NUBE...`;
        btn.disabled = true;

        try {
            // 2. ENVIAR A n8n - LA MAGIA ESTÁ AQUÍ
          const n8nWebhookURL = "http://localhost:5678/webhook/1085406f-324c-42f7-b50f-22f211f445cd";
            
            const response = await fetch(n8nWebhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movimientos: pendings })
            });

            if (!response.ok) throw new Error("Error conectando con n8n");

            // 3. RECIBIR RESPUESTA DE n8n
            const datosProcesadosPorN8n = await response.json();

            // 4. APLICAR LOS CAMBIOS
            if (datosProcesadosPorN8n && datosProcesadosPorN8n.movimientos) {
                for (const movProcesado of datosProcesadosPorN8n.movimientos) {
                    // Si n8n encontró una categoría, creamos el gasto
                    if (movProcesado.categoriaAsignada) {
                        await window.createQuickExpense(movProcesado.id, movProcesado.categoriaAsignada + ' (n8n)');
                        count++;
                    }
                    // Si n8n determinó que es un cierre TPV
                    else if (movProcesado.esCierreTPV) {
                        const item = db.banco.find(b => b.id === movProcesado.id);
                        if(item) item.status = 'matched';
                        count++;
                    }
                }
            }

            if(count > 0) { 
                await saveFn(`✨ ${count} movimientos conciliados por IA`); 
                updateUI(); 
            } else {
                alert("n8n recibió los datos, pero aún no tiene configurada la IA para devolver coincidencias.");
            }

        } catch (error) {
            console.error(error);
            alert(error.message || "Error al conectar con la automatización.");
        } finally {
            // Restaurar el botón
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    // --- PANELES MANUALES ---
    window.selectBankItem = (id) => {
        selectedBankId = id;
        updateUI();
        const item = db.banco.find(b => b.id === id);
        if(!item) return;

        const panel = container.querySelector("#match-panel");
        panel.innerHTML = `
            <div class="w-full text-left">
                <div class="border-b pb-4 mb-4">
                    <span class="text-[9px] font-black bg-slate-100 px-2 py-1 rounded">${item.amount>0?'INGRESO':'GASTO'}</span>
                    <h3 class="font-black text-lg mt-2">${item.desc}</h3>
                    <p class="text-3xl font-black ${item.amount>0?'text-emerald-500':'text-slate-900'}">${window.Num.fmt(item.amount)}</p>
                </div>
                
                <p class="text-[10px] font-bold text-slate-400 uppercase mb-2">Acciones Rápidas</p>
                <div class="grid grid-cols-2 gap-2 mb-4">
                    <button onclick="window.createQuickExpense('${item.id}', 'Comisión')" class="p-2 border rounded hover:bg-slate-50 text-xs font-bold">🏦 Comisión</button>
                    <button onclick="window.createQuickExpense('${item.id}', 'Suministros')" class="p-2 border rounded hover:bg-slate-50 text-xs font-bold">💡 Luz/Agua</button>
                    <button onclick="window.createQuickExpense('${item.id}', 'Personal')" class="p-2 border rounded hover:bg-slate-50 text-xs font-bold">👨‍🍳 Nómina</button>
                    <button onclick="window.createQuickExpense('${item.id}', 'Alquiler')" class="p-2 border rounded hover:bg-slate-50 text-xs font-bold">🏢 Alquiler</button>
                </div>
                <button onclick="window.createCustomExpense('${item.id}')" class="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black">CREAR GASTO MANUAL</button>
            </div>
        `;
    };

    // --- CREAR GASTO DESDE BANCO CON DESHACER ---
    window.createQuickExpense = window.createCustomExpense = async (id, name=null) => {
        const item = db.banco.find(b => b.id === id);
        const concepto = name || prompt("Concepto del gasto:", item.desc);
        if(!concepto) return;

        const newAlb = {
            id: 'auto-'+Date.now(),
            date: item.date,
            prov: concepto,
            num: "BANCO",
            total: Math.abs(item.amount),
            paid: true,
            status: 'ok'
        };
        db.albaranes.push(newAlb);
        item.status = 'matched';
        
        lastUndo = { bankId: item.id, albId: newAlb.id }; // Guardar para deshacer

        await saveFn("Gasto creado");
        selectedBankId = null; 
        updateUI();
        
        // Toast Deshacer
        const toast = document.createElement('div');
        toast.className = "fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg z-[10000] flex gap-4 items-center animate-slide-up";
        toast.innerHTML = `<span class="text-xs font-bold">Gasto creado</span> <button id="btnUndo" class="text-indigo-400 font-black text-xs hover:text-white">DESHACER ↩️</button>`;
        document.body.appendChild(toast);
        
        toast.querySelector("#btnUndo").onclick = async () => {
            if(lastUndo) {
                db.albaranes = db.albaranes.filter(a => a.id !== lastUndo.albId);
                const bRev = db.banco.find(b => b.id === lastUndo.bankId);
                if(bRev) bRev.status = 'pending';
                await saveFn("Deshecho ↩️");
                toast.remove();
                updateUI();
            }
        };
        setTimeout(() => toast.remove(), 8000);
        
        container.querySelector("#match-panel").innerHTML = '<div class="flex-1 flex flex-col justify-center items-center text-center"><span class="text-6xl mb-4 grayscale opacity-30">👈</span><p class="text-sm font-bold text-slate-400">Selecciona otro</p></div>';
    };

    window.deleteBankItem = async (id, e) => {
        e.stopPropagation();
        if(confirm("¿Borrar movimiento?")) {
            db.banco = db.banco.filter(b => b.id !== id);
            await saveFn("Borrado"); selectedBankId = null; container.querySelector("#match-panel").innerHTML = ''; updateUI();
        }
    };
    
    container.querySelector("#btnNuke").onclick = async () => {
        if(confirm("¿Borrar TODOS los movimientos YA CONCILIADOS?")) {
            db.banco = db.banco.filter(b => b.status === 'pending');
            await saveFn("Limpieza completada"); updateUI();
        }
    };

    container.querySelector("#btnEditSaldo").onclick = async () => {
        // Modal simple para evitar prompt
        const nuevo = prompt("Saldo Inicial:", db.config.saldoInicial); 
        // (Copilot sugería modal HTML, pero prompt es más rápido y suficiente aquí)
        if(nuevo) {
            const val = parseFloat(nuevo.replace(',','.'));
            if(!isNaN(val)) {
                db.config.saldoInicial = val;
                await saveFn("Saldo actualizado"); updateUI();
            }
        }
    };

    container.querySelector("#searchBank").addEventListener('input', updateUI);
    updateUI();
}
