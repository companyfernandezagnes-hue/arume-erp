/* =============================================================
   🚚 MÓDULO: ALBARANES "IA" (Sin Stock - Solo Control Total)
   ============================================================= */

export async function render(container, supabase, db, opts = {}) {
  const saveFn = opts.save || (window.save ? window.save : async () => {});

  // 1. PREPARACIÓN DE DATOS
  if (!Array.isArray(db.albaranes)) db.albaranes = [];
  const listaSocios = db.listaSocios || ['Jeronimo','Pedro','Pau','Agnes'];
  let filtroTexto = "";
  let filtroOwner = 'Todos'; 

  // 2. INTERFAZ (DISEÑO SPLIT: CEREBRO IZQUIERDA / LISTA DERECHA)
  container.innerHTML = `
    <div class="animate-fade-in space-y-6">
      
      <header class="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
         <div>
            <h2 class="text-xl font-black text-slate-800">Escáner de Facturas</h2>
            <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Digitalización Inteligente</p>
         </div>
         <div class="flex gap-2 mt-4 md:mt-0">
            <button id="btnExport" class="bg-slate-800 text-white px-5 py-2 rounded-2xl text-[10px] font-black shadow-md hover:bg-slate-700 transition">EXPORTAR TODO</button>
            <label class="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-2xl text-[10px] font-black hover:bg-indigo-100 transition cursor-pointer border border-indigo-100">
                IMPORTAR CSV <input type="file" id="csvInput" class="hidden" accept=".csv">
            </label>
         </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div class="lg:col-span-1 space-y-4">
            <div class="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-indigo-50 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                
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
                    <input id="inNotes" type="text" placeholder="📝 Notas (ej. Vino roto, Precio pactado...)" 
                           class="w-full p-3 pl-10 bg-amber-50 text-amber-900 placeholder-amber-400/70 rounded-xl text-xs font-bold border border-amber-100 outline-none focus:ring-2 focus:ring-amber-400 transition">
                    <span class="absolute left-3 top-3 text-amber-400">⚠️</span>
                </div>

                <div class="relative">
                    <textarea id="inText" placeholder="Pega aquí el texto...&#10;Ejemplos:&#10;2 Solomillos 45.50&#10;Caja Gambas 22.00&#10;Limones 3.50" 
                        class="w-full h-32 bg-slate-50 rounded-2xl p-4 text-xs font-mono border-0 outline-none resize-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition shadow-inner"></textarea>
                </div>

                <div id="livePreview" class="mt-3 space-y-1 max-h-32 overflow-y-auto custom-scrollbar px-1">
                    <p class="text-[10px] text-slate-300 text-center italic py-2">Escribe arriba para ver la magia...</p>
                </div>

                <div class="mt-4 p-4 bg-slate-900 rounded-2xl flex justify-between items-center shadow-lg transform transition-all">
                    <div class="text-left">
                        <span class="text-[9px] font-black text-slate-400 uppercase block">Total Reconocido</span>
                        <span id="itemCount" class="text-[9px] font-bold text-indigo-400">0 líneas</span>
                    </div>
                    <span id="liveTotal" class="text-2xl font-black text-white">0.00€</span>
                </div>

                <button id="btnProcesar" class="w-full mt-4 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition">
                    GUARDAR ALBARÁN
                </button>
            </div>
        </div>

        <div class="lg:col-span-2 space-y-6">
            
            <div class="bg-white p-2 rounded-full shadow-sm border border-slate-100 flex justify-between items-center px-4 sticky top-0 z-10">
                <div class="flex items-center gap-2 w-full">
                    <span class="text-lg">🔍</span>
                    <input id="searchBox" type="text" placeholder="Buscar proveedor, ref o nota..." class="bg-transparent text-sm font-bold outline-none w-full text-slate-600 placeholder-slate-300">
                </div>
                <div class="flex gap-1 shrink-0">
                    <button data-filter="Todos" class="filter-btn px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-slate-900 text-white transition">Todos</button>
                    <button data-filter="Arume" class="filter-btn px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400 transition">Rest.</button>
                    <button data-filter="Socios" class="filter-btn px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400 transition">Socios</button>
                </div>
            </div>

            <div id="listaAlbaranes" class="space-y-3 pb-20"></div>
        </div>
      </div>
    </div>

    <div id="modalDetalle" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex justify-center items-center p-4"></div>
  `;

  // --- 3. EL CEREBRO DE LA IA (Regex Engine) ---
  const inText = container.querySelector("#inText");
  const livePreview = container.querySelector("#livePreview");
  const liveTotal = container.querySelector("#liveTotal");
  const itemCount = container.querySelector("#itemCount");

  // Función Inteligente: Convierte texto sucio en datos limpios
  const analizarTexto = (texto) => {
    return texto.split('\n').filter(l => l.trim()).map(line => {
        let cleanLine = line.trim();
        
        // 1. Buscamos el precio al final (soporta "12.50", "12,50", "12.50€")
        const priceMatch = cleanLine.match(/(\d+[\.,]?\d*)\s*€?$/);
        
        if (priceMatch) {
            const priceStr = priceMatch[1].replace(',', '.');
            const price = parseFloat(priceStr);
            
            // Quitamos el precio de la línea para buscar el resto
            let rest = cleanLine.substring(0, priceMatch.index).trim();
            
            // 2. Buscamos cantidad al principio (opcional)
            let qty = 1;
            const qtyMatch = rest.match(/^(\d+[\.,]?\d*)\s+/);
            
            if (qtyMatch) {
                // Si empieza por número, es la cantidad
                qty = parseFloat(qtyMatch[1].replace(',', '.'));
                // El nombre es lo que queda
                let name = rest.substring(qtyMatch[0].length).trim();
                // Limpiamos unidades comunes (kg, ud, cajas) si están pegadas al nombre
                name = name.replace(/^(cajas?|kg|gr|uds?|botellas?)\s+/i, '');
                return { q: qty, n: name || "Varios", p: price, t: qty * price };
            } else {
                // Si no hay numero al principio, es 1 unidad
                return { q: 1, n: rest || "Varios", p: price, t: price }; // Aquí asumimos que el precio final es el total de la línea
            }
        }
        return null; 
    }).filter(Boolean);
  };

  // Evento: Escribir en tiempo real
  inText.addEventListener('input', () => {
    const items = analizarTexto(inText.value);
    const total = items.reduce((acc, it) => acc + it.t, 0); // Sumamos los totales de línea

    // Pintar Previsualización
    if (items.length > 0) {
        livePreview.innerHTML = items.map(it => `
            <div class="flex justify-between items-center text-[10px] p-2 bg-indigo-50/50 rounded-lg border border-indigo-50">
                <div class="flex gap-2">
                    <span class="font-bold text-indigo-600 w-8 text-right">${it.q} x</span>
                    <span class="font-bold text-slate-700 truncate max-w-[120px]">${it.n}</span>
                </div>
                <span class="font-black text-slate-900">${it.t.toFixed(2)}€</span>
            </div>
        `).join('');
        itemCount.innerText = `${items.length} líneas detectadas`;
        itemCount.classList.replace('text-indigo-400', 'text-emerald-400');
    } else {
        livePreview.innerHTML = '<p class="text-[10px] text-slate-300 text-center italic py-2">Escribe arriba para ver la magia...</p>';
        itemCount.innerText = "0 líneas";
    }

    liveTotal.innerText = total.toLocaleString('es-ES', {minimumFractionDigits: 2}) + "€";
  });

  // --- 4. GUARDAR ALBARÁN ---
  container.querySelector("#btnProcesar").onclick = async () => {
    const prov = container.querySelector("#inProv").value || "Varios";
    const ref = container.querySelector("#inRef").value || "S/N";
    const date = container.querySelector("#inDate").value;
    const socio = container.querySelector("#inSocio").value;
    const notes = container.querySelector("#inNotes").value;
    
    // Usamos la IA para generar los items finales
    const items = analizarTexto(inText.value);
    const total = parseFloat(liveTotal.innerText.replace('.','').replace(',','.').replace('€',''));

    if (items.length === 0 && total === 0) return alert("⚠️ No he detectado ningún precio. Revisa el texto.");

    const nuevo = {
        id: Date.now().toString(),
        prov, num: ref, date, socio, notes,
        items: items, // Guardamos los items procesados por si acaso
        total: total,
        invoiced: false
    };

    db.albaranes.push(nuevo);
    await saveFn("Albarán procesado correctamente 🚀");
    
    // Reset
    inText.value = "";
    container.querySelector("#inRef").value = "";
    container.querySelector("#inNotes").value = "";
    liveTotal.innerText = "0.00€";
    livePreview.innerHTML = '<p class="text-[10px] text-slate-300 text-center italic py-2">Listo para el siguiente...</p>';
    pintarLista();
  };

  // --- 5. LISTADO INTELIGENTE ---
  const pintarLista = () => {
    const term = container.querySelector("#searchBox").value.toLowerCase();
    
    const filtered = db.albaranes.filter(a => {
        const esSocio = a.socio && a.socio !== 'Arume' && a.socio !== 'Restaurante';
        if (filtroOwner === 'Arume' && esSocio) return false;
        if (filtroOwner === 'Socios' && !esSocio) return false;
        
        const txt = `${a.prov} ${a.num} ${a.notes || ''}`.toLowerCase();
        return txt.includes(term);
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    container.querySelector("#listaAlbaranes").innerHTML = filtered.map(a => `
        <div onclick="window.abrirAlbaran('${a.id}')" class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md hover:scale-[1.01] transition cursor-pointer relative overflow-hidden group">
            
            ${a.notes ? `<div class="absolute top-0 right-0 bg-amber-100 text-amber-600 px-3 py-1 rounded-bl-2xl text-[9px] font-black border-l border-b border-amber-200">📝 NOTA</div>` : ''}

            <div class="flex justify-between items-center">
                <div>
                    <h4 class="font-black text-slate-800 text-base group-hover:text-indigo-600 transition">${a.prov}</h4>
                    <div class="flex gap-2 items-center mt-1">
                        <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">${formatDate(a.date)}</span>
                        <span class="text-[10px] text-slate-400 font-mono">Ref: ${a.num}</span>
                        ${a.invoiced ? '<span class="text-[8px] border border-emerald-200 text-emerald-600 px-1.5 rounded font-black">FACTURADO</span>' : ''}
                    </div>
                    ${a.notes ? `<p class="mt-2 text-xs font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100 inline-block">⚠️ ${a.notes}</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="font-black text-slate-900 text-xl">${parseFloat(a.total).toFixed(2)}€</p>
                    <p class="text-[9px] text-indigo-400 font-bold uppercase">${a.socio || 'Restaurante'}</p>
                </div>
            </div>
        </div>
    `).join('');
  };

  // --- 6. EDICIÓN ---
  window.abrirAlbaran = (id) => {
    const a = db.albaranes.find(x => x.id === id);
    if (!a) return;

    const modal = container.querySelector("#modalDetalle");
    modal.classList.remove("hidden");
    
    // Generamos la lista de items guardados
    const listItems = (a.items || []).map(it => `
        <div class="flex justify-between text-xs py-1 border-b border-slate-50">
            <span class="text-slate-600 w-2/3 truncate">${it.q} x ${it.n}</span>
            <span class="font-bold text-slate-900">${it.t.toFixed(2)}€</span>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative">
            <h3 class="text-2xl font-black text-slate-800 mb-1">${a.prov}</h3>
            <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-6">Editando Albarán</p>

            <div class="space-y-4">
                <div>
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-2">Notas / Incidencias</label>
                    <input id="editNotes" type="text" value="${a.notes || ''}" class="w-full p-3 bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-amber-100 outline-none">
                </div>

                <div class="bg-slate-50 p-4 rounded-2xl max-h-40 overflow-y-auto">
                    ${listItems || '<p class="text-xs italic text-slate-400">Sin detalle</p>'}
                </div>

                <div class="flex justify-between items-center pt-2">
                    <span class="font-black text-slate-400 uppercase text-xs">Total</span>
                    <span class="font-black text-3xl text-slate-900">${parseFloat(a.total).toFixed(2)}€</span>
                </div>

                <div class="grid grid-cols-2 gap-3 mt-4">
                    <button id="btnSaveEdit" class="bg-indigo-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg">GUARDAR CAMBIOS</button>
                    <button onclick="borrarAlbaran('${a.id}')" class="bg-rose-50 text-rose-500 py-3 rounded-2xl font-black text-xs border border-rose-100">ELIMINAR</button>
                </div>
                <button onclick="document.getElementById('modalDetalle').classList.add('hidden')" class="w-full mt-2 text-slate-400 text-xs font-bold">CANCELAR</button>
            </div>
        </div>
    `;

    modal.querySelector("#btnSaveEdit").onclick = async () => {
        a.notes = modal.querySelector("#editNotes").value;
        await saveFn("Nota actualizada");
        modal.classList.add("hidden");
        pintarLista();
    };
  };

  window.borrarAlbaran = async (id) => {
    if (!confirm("¿Eliminar definitivamente?")) return;
    db.albaranes = db.albaranes.filter(x => x.id !== id);
    await saveFn("Albarán eliminado");
    container.querySelector("#modalDetalle").classList.add("hidden");
    pintarLista();
  };

  // Filtros UI
  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => {
        container.querySelectorAll(".filter-btn").forEach(b => {
            b.classList.remove("bg-slate-900", "text-white");
            b.classList.add("bg-slate-100", "text-slate-400");
        });
        btn.classList.remove("bg-slate-100", "text-slate-400");
        btn.classList.add("bg-slate-900", "text-white");
        filtroOwner = btn.dataset.filter;
        pintarLista();
    };
  });
  
  container.querySelector("#searchBox").addEventListener('input', pintarLista);
  
  function formatDate(d) { try { return new Date(d).toLocaleDateString('es-ES', {day:'2-digit', month:'short'}); } catch { return d; } }

  // Init
  pintarLista();
}
