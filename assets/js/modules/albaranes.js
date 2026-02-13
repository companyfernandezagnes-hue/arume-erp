/* =============================================================
   🚚 MÓDULO: ALBARANES DIAMOND (Multi-IVA por Línea)
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
         <div>
            <h2 class="text-xl font-black text-slate-800">Escáner Multi-IVA</h2>
            <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Desglose Fiscal Automático</p>
         </div>
         <div class="flex gap-2 mt-4 md:mt-0">
             <div class="text-right">
                <p class="text-[9px] font-black text-slate-400 uppercase">Total Soportado</p>
                <p class="text-xl font-black text-slate-800" id="total-global-kpi">0.00€</p>
             </div>
         </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div class="lg:col-span-1 space-y-4">
            <div class="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 relative">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-rose-500"></div>

                <h3 class="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                   ⚡ Entrada Rápida
                </h3>

                <div class="space-y-3 mb-4">
                    <input id="inProv" type="text" placeholder="Proveedor (ej. Makro)" class="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-0 outline-none focus:ring-2 focus:ring-indigo-500">
                    <div class="flex gap-2">
                        <input id="inDate" type="date" value="${new Date().toISOString().split('T')[0]}" class="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0">
                        <input id="inRef" type="text" placeholder="Nº Ref" class="w-1/3 p-3 bg-slate-50 rounded-xl text-sm font-bold border-0">
                    </div>
                    <select id="inSocio" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-0 outline-none text-slate-600">
                        <option value="Arume">Gasto: Restaurante</option>
                        ${listaSocios.map(s => `<option value="${s}">Gasto: ${s}</option>`).join('')}
                    </select>
                </div>

                <div class="relative mb-3">
                    <textarea id="inText" placeholder="Ejemplos:&#10;2 Cajas Tomates 15.00&#10;1 Ginebra 12.50 21%&#10;Lejía 5.00 21" 
                        class="w-full h-40 bg-slate-50 rounded-2xl p-4 text-xs font-mono border-0 outline-none resize-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition shadow-inner"></textarea>
                    <p class="absolute bottom-2 right-4 text-[9px] text-slate-300 font-bold pointer-events-none">Añade '21' al final para alcohol/químicos</p>
                </div>

                <div id="livePreview" class="mt-3 space-y-1 max-h-40 overflow-y-auto custom-scrollbar px-1 bg-slate-50/50 rounded-xl p-2">
                    <p class="text-[10px] text-slate-300 text-center italic py-2">Escribe para desglosar impuestos...</p>
                </div>

                <div class="mt-4 p-4 bg-slate-900 rounded-2xl shadow-lg space-y-2">
                    <div class="flex justify-between text-[10px] text-slate-400 font-bold border-b border-slate-700 pb-1">
                        <span>TIPO</span> <span>BASE</span> <span>CUOTA</span>
                    </div>
                    <div id="taxSummary" class="space-y-1">
                        </div>
                    <div class="flex justify-between items-center pt-2 border-t border-slate-700 mt-2">
                        <span class="text-xs font-black text-white uppercase">TOTAL PAGAR</span>
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

  // --- CEREBRO IA MULTI-IVA ---
  const inText = container.querySelector("#inText");
  const livePreview = container.querySelector("#livePreview");
  const liveTotal = container.querySelector("#liveTotal");
  const taxSummary = container.querySelector("#taxSummary");

  // Función: Analiza línea a línea buscando "21" o "%" al final
  const analizarTexto = (texto) => {
    return texto.split('\n').filter(l => l.trim()).map(line => {
        let clean = line.trim();
        let rate = 10; // Por defecto Hostelería (Comida)

        // 1. Detectar Tasa de IVA al final (ej: "21", "21%", "4%", "10")
        // Buscamos un número (1 o 2 dígitos) seguido opcionalmente de % AL FINAL de la línea
        const taxMatch = clean.match(/\s(\d{1,2})%?$/);
        if (taxMatch) {
            const detected = parseInt(taxMatch[1]);
            if([0, 4, 10, 21].includes(detected)) {
                rate = detected;
                // Quitamos el indicador de IVA de la línea para no confundir al precio
                clean = clean.substring(0, taxMatch.index).trim();
            }
        }

        // 2. Detectar Precio (lo que queda al final)
        const priceMatch = clean.match(/(\d+[\.,]?\d*)\s*€?$/);
        
        if (priceMatch) {
            const priceVal = parseFloat(priceMatch[1].replace(',', '.'));
            
            // 3. Detectar Cantidad y Nombre (lo que queda al principio)
            let rest = clean.substring(0, priceMatch.index).trim();
            let qty = 1;
            const qtyMatch = rest.match(/^(\d+[\.,]?\d*)\s+/);
            
            if (qtyMatch) {
                qty = parseFloat(qtyMatch[1].replace(',', '.'));
                rest = rest.substring(qtyMatch[0].length).trim();
            }
            
            let name = rest.replace(/^(cajas?|kg|gr|uds?|botellas?)\s+/i, '') || "Varios";

            // CÁLCULOS
            const totalLine = qty * priceVal; // Total Bruto (lo que pagas)
            const baseLine = totalLine / (1 + rate/100);
            const taxLine = totalLine - baseLine;

            return { 
                q: qty, n: name, p: priceVal, 
                rate: rate, // Guardamos el % de esta línea
                t: totalLine, 
                base: baseLine, 
                tax: taxLine 
            };
        }
        return null;
    }).filter(Boolean);
  };

  // Renderizar Previsualización
  inText.addEventListener('input', () => {
    const items = analizarTexto(inText.value);
    
    // Agrupar impuestos para el resumen
    const taxes = { 10: {b:0, i:0}, 21: {b:0, i:0}, 4: {b:0, i:0}, 0: {b:0, i:0} };
    let grandTotal = 0;

    items.forEach(it => {
        if(!taxes[it.rate]) taxes[it.rate] = {b:0, i:0};
        taxes[it.rate].b += it.base;
        taxes[it.rate].i += it.tax;
        grandTotal += it.t;
    });

    // Pintar Items
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
        livePreview.innerHTML = '<p class="text-[10px] text-slate-300 text-center italic py-2">Escribe líneas...</p>';
    }

    // Pintar Resumen Fiscal
    taxSummary.innerHTML = Object.keys(taxes).map(r => {
        if(taxes[r].b === 0) return '';
        return `
            <div class="flex justify-between text-[10px] text-slate-300">
                <span class="font-bold w-10">IVA ${r}%</span>
                <span class="font-mono text-right flex-1">${taxes[r].b.toFixed(2)}€</span>
                <span class="font-mono text-right w-16 text-emerald-400">+${taxes[r].i.toFixed(2)}€</span>
            </div>
        `;
    }).join('');

    liveTotal.innerText = grandTotal.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
  });

  // --- GUARDAR ---
  container.querySelector("#btnProcesar").onclick = async () => {
    const items = analizarTexto(inText.value);
    if(items.length === 0) return alert("No hay datos válidos.");

    // Recalcular totales finales
    const total = items.reduce((a,b) => a + b.t, 0);
    const totalTax = items.reduce((a,b) => a + b.tax, 0); // Suma de todas las cuotas

    const nuevo = {
        id: Date.now().toString(),
        prov: container.querySelector("#inProv").value || "Varios",
        num: container.querySelector("#inRef").value || "S/N",
        date: container.querySelector("#inDate").value,
        socio: container.querySelector("#inSocio").value,
        items: items, // Guardamos el array detallado con tipos de IVA
        total: total,
        taxes: totalTax,
        invoiced: false,
        notes: "Entrada Inteligente Multi-IVA"
    };

    db.albaranes.push(nuevo);
    await saveFn("Albarán Multi-IVA Guardado 🚀");
    inText.value = "";
    livePreview.innerHTML = "";
    taxSummary.innerHTML = "";
    liveTotal.innerText = "0.00€";
    pintarLista();
  };

  // --- LISTADO ---
  const pintarLista = () => {
    const term = container.querySelector("#searchBox").value.toLowerCase();
    
    // KPI Global (Total Albaranes)
    const totalGlobal = db.albaranes.reduce((acc, a) => acc + (parseFloat(a.total)||0), 0);
    container.querySelector("#total-global-kpi").innerText = totalGlobal.toLocaleString('es-ES',{minimumFractionDigits:2}) + "€";

    const filtered = db.albaranes.filter(a => {
        if (filtroOwner === 'Arume' && a.socio !== 'Arume' && a.socio !== 'Restaurante') return false;
        return `${a.prov} ${a.num}`.toLowerCase().includes(term);
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    container.querySelector("#listaAlbaranes").innerHTML = filtered.map(a => `
        <div onclick="window.editarAlbaran('${a.id}')" class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:bg-slate-50 transition cursor-pointer relative overflow-hidden group">
            <div class="flex justify-between items-center">
                <div>
                    <h4 class="font-black text-slate-800 text-base">${a.prov}</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">${formatDate(a.date)} · ${a.num}</p>
                    
                    <div class="flex gap-2 mt-2">
                         ${ (a.items && Array.isArray(a.items)) ? 
                            a.items.some(i => i.rate == 21) ? '<span class="text-[8px] bg-rose-100 text-rose-600 px-1.5 rounded font-black">21%</span>' : '' 
                        : '' }
                        <span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 rounded font-bold border border-emerald-100">
                            IVA: ${(a.taxes||0).toFixed(2)}€
                        </span>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-black text-slate-900 text-xl">${parseFloat(a.total).toFixed(2)}€</p>
                    ${a.invoiced ? '<span class="text-[8px] text-indigo-400 font-black">FACTURADO</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');
  };

  // --- EDICIÓN (VISUALIZACIÓN DETALLADA) ---
  window.editarAlbaran = (id) => {
    const a = db.albaranes.find(x => x.id === id);
    if (!a) return;

    const modal = container.querySelector("#modalDetalle");
    modal.classList.remove("hidden");
    
    // Si es antiguo (string) o nuevo (array)
    let itemsHTML = '';
    if(Array.isArray(a.items)) {
        itemsHTML = a.items.map(it => `
            <div class="flex justify-between text-xs py-2 border-b border-slate-100 last:border-0">
                <div class="flex gap-2">
                    <span class="font-bold text-slate-500">${it.q}x</span>
                    <span>${it.n}</span>
                    <span class="text-[9px] font-black ${getTaxColor(it.rate)} px-1 rounded bg-slate-100">${it.rate}%</span>
                </div>
                <span class="font-bold">${it.t.toFixed(2)}€</span>
            </div>
        `).join('');
    } else {
        itemsHTML = `<div class="p-2 text-xs italic text-slate-400">${a.items || 'Sin detalle'}</div>`;
    }

    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
            <h3 class="text-2xl font-black text-slate-800 mb-2">${a.prov}</h3>
            
            <div class="flex justify-between items-center mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                 <div>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Total Cuota IVA</p>
                    <p class="text-lg font-black text-emerald-500">${(a.taxes||0).toFixed(2)}€</p>
                 </div>
                 <div class="text-right">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Total Bruto</p>
                    <p class="text-2xl font-black text-slate-900">${(a.total||0).toFixed(2)}€</p>
                 </div>
            </div>

            <div class="max-h-60 overflow-y-auto custom-scrollbar mb-4 bg-white border border-slate-100 rounded-2xl p-4">
                ${itemsHTML}
            </div>

            <button onclick="borrarAlbaran('${a.id}')" class="w-full bg-rose-50 text-rose-500 py-3 rounded-2xl font-black text-xs border border-rose-100 mb-2">ELIMINAR ALBARÁN</button>
            <button onclick="document.getElementById('modalDetalle').classList.add('hidden')" class="w-full text-slate-400 text-xs font-bold">CERRAR</button>
        </div>
    `;
  };

  window.borrarAlbaran = async (id) => {
    if(!confirm("¿Borrar?")) return;
    db.albaranes = db.albaranes.filter(x => x.id !== id);
    await saveFn("Borrado");
    container.querySelector("#modalDetalle").classList.add("hidden");
    pintarLista();
  };

  // Helpers
  function getTaxColor(r) {
      if(r == 21) return "text-rose-500";
      if(r == 10) return "text-indigo-500";
      if(r == 4) return "text-emerald-500";
      return "text-slate-400";
  }
  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => { filtroOwner = btn.dataset.filter; pintarLista(); };
  });
  container.querySelector("#searchBox").addEventListener('input', pintarLista);
  function formatDate(d) { try { return new Date(d).toLocaleDateString('es-ES', {day:'2-digit', month:'short'}); } catch { return d; } }
  
  pintarLista();
}
