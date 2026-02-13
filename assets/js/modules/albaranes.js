/* =============================================================
   🚚 MÓDULO: ALBARANES MAESTRO (Blindado contra errores)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
  const saveFn = opts.save || (window.save ? window.save : async () => {});

  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  const listaSocios = db.listaSocios || ['Jeronimo','Pedro','Pau','Agnes'];
  let filtroOwner = 'Todos'; 

  // --- INTERFAZ ---
  container.innerHTML = `
    <div class="animate-fade-in space-y-6">
      
      <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
         <div class="mb-4 md:mb-0">
            <h2 class="text-xl font-black text-slate-800">Escáner Multi-IVA</h2>
            <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Digitalización & Importación</p>
         </div>
         
         <div class="flex gap-2 items-center">
            <button id="btnExport" class="bg-slate-800 text-white px-5 py-3 rounded-2xl text-[10px] font-black shadow-md hover:bg-slate-700 transition flex items-center gap-2">
                <span>⬇️</span> CSV
            </button>
            <label class="bg-indigo-50 text-indigo-600 px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-indigo-100 transition cursor-pointer border border-indigo-100 flex items-center gap-2">
                <span>📂</span> IMPORTAR
                <input type="file" id="csvInput" class="hidden" accept=".csv">
            </label>
         </div>
      </header>

      <div class="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
         <span class="text-[10px] font-black text-slate-400 uppercase">Total Soportado (Histórico)</span>
         <span class="text-xl font-black text-slate-800" id="total-global-kpi">0.00€</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div class="lg:col-span-1 space-y-4">
            <div class="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 relative">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>

                <h3 class="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                   ⚡ Entrada Rápida
                </h3>

                <div class="space-y-3 mb-4">
                    <input id="inProv" type="text" placeholder="Proveedor (ej. Makro)" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder-slate-300 text-slate-700">
                    <div class="flex gap-2">
                        <input id="inDate" type="date" value="${new Date().toISOString().split('T')[0]}" class="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none text-slate-700">
                        <input id="inRef" type="text" placeholder="Nº Ref" class="w-1/3 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none text-slate-700">
                    </div>
                    <select id="inSocio" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-0 outline-none text-slate-600 cursor-pointer">
                        <option value="Arume">Gasto: Restaurante</option>
                        ${listaSocios.map(s => `<option value="${s}">Gasto: ${s}</option>`).join('')}
                    </select>
                </div>

                <div class="mb-4 relative">
                    <input id="inNotes" type="text" placeholder="📝 Notas (ej. Vino roto, Devolución...)" 
                           class="w-full p-3 pl-10 bg-amber-50 text-amber-900 placeholder-amber-400/70 rounded-xl text-xs font-bold border border-amber-100 outline-none focus:ring-2 focus:ring-amber-400 transition">
                    <span class="absolute left-3 top-3 text-amber-400">⚠️</span>
                </div>

                <div class="relative mb-3">
                    <textarea id="inText" placeholder="Ejemplos:&#10;2 Cajas Tomates 15.00&#10;1 Ginebra 12.50 21%&#10;Lejía 5.00 21" 
                        class="w-full h-40 bg-slate-50 rounded-2xl p-4 text-xs font-mono border-0 outline-none resize-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition shadow-inner"></textarea>
                    <p class="absolute bottom-2 right-4 text-[9px] text-slate-300 font-bold pointer-events-none">Añade '21' al final para alcohol</p>
                </div>

                <div id="livePreview" class="mt-3 space-y-1 max-h-40 overflow-y-auto custom-scrollbar px-1 bg-slate-50/50 rounded-xl p-2 min-h-[50px]">
                    <p class="text-[10px] text-slate-300 text-center italic py-2">Esperando datos...</p>
                </div>

                <div class="mt-4 p-4 bg-slate-900 rounded-2xl shadow-lg space-y-2">
                    <div id="taxSummary" class="space-y-1"></div>
                    <div class="flex justify-between items-center pt-2 border-t border-slate-700 mt-2">
                        <span class="text-xs font-black text-white uppercase">TOTAL</span>
                        <span id="liveTotal" class="text-2xl font-black text-white">0.00€</span>
                    </div>
                </div>

                <button id="btnProcesar" class="w-full mt-4 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition">
                    GUARDAR ALBARÁN
                </button>
            </div>
        </div>

        <div class="lg:col-span-2 space-y-6">
            <div class="bg-white p-2 rounded-full shadow-sm border border-slate-100 flex justify-between items-center px-4 sticky top-0 z-10">
                <input id="searchBox" type="text" placeholder="Buscar..." class="bg-transparent text-sm font-bold outline-none w-full text-slate-600">
                <div class="flex gap-1">
                    <button data-filter="Todos" class="filter-btn px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-900 text-white">Todos</button>
                    <button data-filter="Arume" class="filter-btn px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400">Rest.</button>
                </div>
            </div>
            <div id="listaAlbaranes" class="space-y-3 pb-20"></div>
        </div>
      </div>
    </div>

    <div id="modalDetalle" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4"></div>
  `;

  // --- REFERENCIAS & IA ---
  const inText = container.querySelector("#inText");
  const livePreview = container.querySelector("#livePreview");
  const liveTotal = container.querySelector("#liveTotal");
  const taxSummary = container.querySelector("#taxSummary");
  const csvInput = container.querySelector("#csvInput");
  const btnExport = container.querySelector("#btnExport");

  /* =============================================================
     📥 IMPORTACIÓN CSV
     ============================================================= */
  csvInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const text = evt.target.result;
        const rows = text.split('\n').slice(1);
        let importedCount = 0;

        rows.forEach(row => {
            if (!row.trim()) return;
            let cols = row.includes(';') ? row.split(';') : row.split(',');
            
            if (cols.length >= 4) {
                const total = parseFloat(cols[3].replace(',', '.')) || 0;
                const base = total / 1.10;
                const tax = total - base;

                const newItem = {
                    id: Date.now() + Math.random(),
                    date: cols[0].trim(),
                    prov: cols[1].trim(),
                    num: cols[2].trim(),
                    socio: cols[4] ? cols[4].trim() : "Arume",
                    total: total,
                    taxes: tax,
                    items: [{ q:1, n: "Importado CSV", p: total, rate: 10, t: total, base: base, tax: tax }],
                    invoiced: false,
                    notes: cols[7] || "Importado CSV"
                };
                db.albaranes.push(newItem);
                importedCount++;
            }
        });
        await saveFn(`Importados ${importedCount} albaranes 📂`);
        pintarLista();
        csvInput.value = "";
    };
    reader.readAsText(file);
  });

  /* =============================================================
     ⬇️ EXPORTACIÓN
     ============================================================= */
  btnExport.onclick = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Fecha;Proveedor;Referencia;Socio;Base;CuotaIVA;Total;Notas\n";

    db.albaranes.forEach(a => {
        const fecha = a.date || "";
        const prov = (a.prov || "").replace(/;/g, ",");
        const ref = (a.num || "").replace(/;/g, ",");
        const soc = (a.socio || "Arume");
        const total = (parseFloat(a.total)||0).toFixed(2).replace('.', ',');
        const taxes = (parseFloat(a.taxes)||0).toFixed(2).replace('.', ',');
        const base = ((parseFloat(a.total)||0) - (parseFloat(a.taxes)||0)).toFixed(2).replace('.', ',');
        const notas = (a.notes || "").replace(/;/g, " ").replace(/\n/g, " ");

        csvContent += `${fecha};${prov};${ref};${soc};${base};${taxes};${total};${notas}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Arume_Albaranes_" + new Date().toISOString().slice(0,10) + ".csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  /* =============================================================
     🧠 LÓGICA IA
     ============================================================= */
  const analizarTexto = (texto) => {
    return texto.split('\n').filter(l => l.trim()).map(line => {
        let clean = line.trim();
        let rate = 10; 
        const taxMatch = clean.match(/\s(\d{1,2})%?$/);
        if (taxMatch) {
            const detected = parseInt(taxMatch[1]);
            if([0, 4, 10, 21].includes(detected)) {
                rate = detected;
                clean = clean.substring(0, taxMatch.index).trim();
            }
        }
        const priceMatch = clean.match(/(\d+[\.,]?\d*)\s*€?$/);
        if (priceMatch) {
            const priceVal = parseFloat(priceMatch[1].replace(',', '.'));
            let rest = clean.substring(0, priceMatch.index).trim();
            let qty = 1;
            const qtyMatch = rest.match(/^(\d+[\.,]?\d*)\s+/);
            if (qtyMatch) {
                qty = parseFloat(qtyMatch[1].replace(',', '.'));
                rest = rest.substring(qtyMatch[0].length).trim();
            }
            let name = rest.replace(/^(cajas?|kg|gr|uds?|botellas?)\s+/i, '') || "Varios";
            const totalLine = qty * priceVal;
            const baseLine = totalLine / (1 + rate/100);
            const taxLine = totalLine - baseLine;
            return { q: qty, n: name, p: priceVal, rate: rate, t: totalLine, base: baseLine, tax: taxLine };
        }
        return null;
    }).filter(Boolean);
  };

  inText.addEventListener('input', () => {
    const items = analizarTexto(inText.value);
    const taxes = { 10: {b:0, i:0}, 21: {b:0, i:0}, 4: {b:0, i:0}, 0: {b:0, i:0} };
    let grandTotal = 0;
    items.forEach(it => {
        if(!taxes[it.rate]) taxes[it.rate] = {b:0, i:0};
        taxes[it.rate].b += it.base;
        taxes[it.rate].i += it.tax;
        grandTotal += it.t;
    });

    if (items.length > 0) {
        livePreview.innerHTML = items.map(it => `
            <div class="flex justify-between items-center text-[10px] py-1 border-b border-slate-200 last:border-0">
                <div class="flex gap-2 items-center">
                    <span class="font-bold text-slate-500 w-6 text-right">${it.q}x</span>
                    <span class="font-bold text-slate-700 truncate max-w-[100px]">${it.n}</span>
                    <span class="px-1.5 py-0.5 rounded text-[8px] font-black ${getTaxColor(it.rate)}">${it.rate}%</span>
                </div>
                <span class="font-black text-slate-900">${it.t.toFixed(2)}€</span>
            </div>
        `).join('');
    } else {
        livePreview.innerHTML = '<p class="text-[10px] text-slate-300 text-center italic py-2">Escribe para desglosar impuestos...</p>';
    }

    taxSummary.innerHTML = Object.keys(taxes).map(r => {
        if(taxes[r].b === 0) return '';
        return `<div class="flex justify-between text-[10px] text-slate-300"><span class="font-bold w-10">IVA ${r}%</span><span class="font-mono text-right flex-1">${taxes[r].b.toFixed(2)}€</span><span class="font-mono text-right w-16 text-emerald-400">+${taxes[r].i.toFixed(2)}€</span></div>`;
    }).join('');
    liveTotal.innerText = grandTotal.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
  });

  // GUARDAR
  container.querySelector("#btnProcesar").onclick = async () => {
    const items = analizarTexto(inText.value);
    const notes = container.querySelector("#inNotes").value; 
    const total = parseFloat(liveTotal.innerText.replace('.','').replace(',','.').replace('€','')) || 0;
    
    if(total === 0 && items.length === 0) return alert("Introduce datos.");

    let totalTax = 0;
    if(items.length > 0) {
        totalTax = items.reduce((a,b) => a + b.tax, 0);
    }

    const nuevo = {
        id: Date.now().toString(),
        prov: container.querySelector("#inProv").value || "Varios",
        num: container.querySelector("#inRef").value || "S/N",
        date: container.querySelector("#inDate").value,
        socio: container.querySelector("#inSocio").value,
        items: items,
        total: total,
        taxes: totalTax,
        invoiced: false,
        notes: notes
    };

    db.albaranes.push(nuevo);
    await saveFn("Guardado ✅");
    
    inText.value = "";
    container.querySelector("#inNotes").value = ""; 
    container.querySelector("#inRef").value = "";
    livePreview.innerHTML = "";
    taxSummary.innerHTML = "";
    liveTotal.innerText = "0.00€";
    pintarLista();
  };

  // LISTADO
  const pintarLista = () => {
    const term = container.querySelector("#searchBox").value.toLowerCase();
    const totalGlobal = db.albaranes.reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);
    container.querySelector("#total-global-kpi").innerText = totalGlobal.toLocaleString('es-ES',{minimumFractionDigits:2}) + "€";

    const filtered = db.albaranes.filter(a => {
        if (filtroOwner === 'Arume' && a.socio !== 'Arume' && a.socio !== 'Restaurante') return false;
        return `${a.prov} ${a.num} ${a.notes || ''}`.toLowerCase().includes(term);
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    // AÑADIDO ONCLICK DIRECTO AL HTML PARA EVITAR ERRORES DE BINDING
    container.querySelector("#listaAlbaranes").innerHTML = filtered.map(a => `
        <div onclick="window.editarAlbaran('${a.id}')" class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:bg-slate-50 transition cursor-pointer relative overflow-hidden group">
            ${a.notes ? `<div class="absolute top-0 right-0 bg-amber-100 text-amber-600 px-3 py-1 rounded-bl-2xl text-[9px] font-black border-l border-b border-amber-200">📝 NOTA</div>` : ''}
            <div class="flex justify-between items-center">
                <div>
                    <h4 class="font-black text-slate-800 text-base">${a.prov}</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">${formatDate(a.date)} · ${a.num}</p>
                    ${a.notes ? `<p class="mt-2 text-xs font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100 inline-block">⚠️ ${a.notes}</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="font-black text-slate-900 text-xl">${parseFloat(a.total).toFixed(2)}€</p>
                    ${a.invoiced ? '<span class="text-[8px] text-indigo-400 font-black">FACTURADO</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');
  };

  // --- FUNCIÓN DE EDICIÓN CON PROTECCIÓN CONTRA CRASHES ---
  window.editarAlbaran = (id) => {
    container.scrollTop = 0; 
    window.scrollTo(0, 0);

    const a = db.albaranes.find(x => x.id === id);
    if (!a) return;
    const modal = container.querySelector("#modalDetalle");
    modal.classList.remove("hidden");
    
    let itemsHTML = '';
    // AQUI ESTABA EL ERROR: Añadida protección (it.t || 0) y (it.rate || 0)
    if(Array.isArray(a.items) && a.items.length > 0) {
        itemsHTML = a.items.map(it => `
            <div class="flex justify-between text-xs py-2 border-b border-slate-100">
                <div class="flex gap-2">
                    <span class="font-bold text-slate-500">${it.q || 1}x</span>
                    <span>${it.n || 'Item'}</span>
                    <span class="text-[9px] font-black ${getTaxColor(it.rate || 0)} px-1 rounded bg-slate-100">${it.rate || 0}%</span>
                </div>
                <span class="font-bold">${(it.t || 0).toFixed(2)}€</span>
            </div>
        `).join('');
    } else {
        itemsHTML = `<div class="p-2 text-xs italic text-slate-400">Sin detalle de líneas</div>`;
    }

    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
            <h3 class="text-2xl font-black text-slate-800 mb-6">Editar Albarán</h3>
            
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Proveedor</label>
                        <input id="ed-prov" type="text" value="${a.prov}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-200">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase ml-2">Fecha</label>
                        <input id="ed-date" type="date" value="${a.date}" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border border-slate-200">
                    </div>
                </div>

                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase">Total Bruto (€)</label>
                        <input id="ed-total" type="number" value="${a.total}" class="w-full p-2 bg-white rounded-lg font-black text-lg border border-slate-200">
                    </div>
                    <div class="flex gap-4">
                        <div class="flex-1">
                            <label class="text-[9px] font-bold text-slate-400 uppercase">Cuota IVA</label>
                            <input id="ed-tax" type="number" value="${a.taxes || 0}" class="w-full p-2 bg-white rounded-lg font-bold text-emerald-600 border border-slate-200">
                        </div>
                    </div>
                </div>

                <div>
                    <label class="text-[9px] font-black text-amber-500 uppercase ml-2">NOTAS / INCIDENCIAS</label>
                    <input id="ed-notes" type="text" value="${a.notes || ''}" class="w-full p-3 bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-amber-100 outline-none focus:ring-2 focus:ring-amber-400">
                </div>

                <div class="max-h-40 overflow-y-auto custom-scrollbar bg-slate-50 p-4 rounded-2xl">
                    ${itemsHTML}
                </div>

                <div class="grid grid-cols-2 gap-3 pt-4">
                    <button id="btnSaveEd" class="bg-indigo-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg">GUARDAR</button>
                    <button onclick="borrarAlbaran('${a.id}')" class="bg-rose-50 text-rose-500 py-3 rounded-2xl font-black text-xs border border-rose-100">ELIMINAR</button>
                </div>
                <button onclick="document.getElementById('modalDetalle').classList.add('hidden')" class="w-full text-slate-400 text-xs font-bold mt-2">CANCELAR</button>
            </div>
        </div>
    `;

    modal.querySelector("#btnSaveEd").onclick = async () => {
        a.prov = modal.querySelector("#ed-prov").value;
        a.date = modal.querySelector("#ed-date").value;
        a.total = parseFloat(modal.querySelector("#ed-total").value);
        a.taxes = parseFloat(modal.querySelector("#ed-tax").value);
        a.notes = modal.querySelector("#ed-notes").value; 
        
        await saveFn("Albarán actualizado");
        modal.classList.add("hidden");
        pintarLista();
    };
  };

  window.borrarAlbaran = async (id) => {
    if(!confirm("¿Borrar?")) return;
    db.albaranes = db.albaranes.filter(x => x.id !== id);
    await saveFn("Borrado");
    container.querySelector("#modalDetalle").classList.add("hidden");
    pintarLista();
  };

  function getTaxColor(r) {
      if(r == 21) return "text-rose-500";
      if(r == 10) return "text-indigo-500";
      return "text-slate-400";
  }
  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => { filtroOwner = btn.dataset.filter; pintarLista(); };
  });
  container.querySelector("#searchBox").addEventListener('input', pintarLista);
  function formatDate(d) { try { return new Date(d).toLocaleDateString('es-ES', {day:'2-digit', month:'short'}); } catch { return d; } }
  
  // CSV y Exportar
  csvInput.addEventListener('change', async (e) => { /* Logic */ }); 
  // Nota: La lógica CSV está arriba en el listener real, este comentario es solo visual
  // El código real de CSV está en la parte superior del archivo, no lo duplico aquí abajo

  pintarLista();
}
