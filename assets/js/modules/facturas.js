/* =============================================================
   📄 MÓDULO: FACTURAS PRO (Revisión, Agrupación y Control de Pagos)
   ============================================================= */
export async function render(container, supabase, db) {
  const albaranes = db.albaranes || [];
  const facturasRealizadas = db.facturas || [];

  container.innerHTML = `
  <div class="animate-fade-in space-y-6">
    <section class="p-6 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
      <h2 class="text-xl font-black text-slate-800 mb-1">Centro de Facturación</h2>
      <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Revisión y Cierre de Ciclo</p>

      <div class="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
          <button id="btnTabPend" class="flex-1 py-2.5 rounded-xl font-bold text-xs transition bg-white shadow-sm text-indigo-600">📦 ALBARANES PENDIENTES</button>
          <button id="btnTabHist" class="flex-1 py-2.5 rounded-xl font-bold text-xs transition text-slate-500">💰 FACTURAS Y PAGOS</button>
      </div>

      <div id="contentArea"></div>
    </section>
  </div>
  <div id="modalFactura"></div>
  `;

  const contentArea = container.querySelector("#contentArea");
  container.querySelector("#btnTabPend").onclick = () => renderPendientes();
  container.querySelector("#btnTabHist").onclick = () => renderHistorial();

  renderPendientes(); // Inicio por defecto

  /* =============================================================
     1. VISTA: PENDIENTES (Agrupados por Distribuidor)
     ============================================================= */
  function renderPendientes() {
    actualizarTabs(true);
    const pendientes = albaranes.filter(a => !a.invoiced);
    const grupos = {};

    pendientes.forEach(a => {
      const prov = a.proveedor || a.prov || "S/N";
      if (!grupos[prov]) grupos[prov] = { t: 0, items: [] };
      grupos[prov].t += parseFloat(a.total) || 0;
      grupos[prov].items.push(a);
    });

    if (Object.keys(grupos).length === 0) {
      contentArea.innerHTML = `<div class="py-12 text-center text-slate-400 italic text-sm">No hay albaranes pendientes ✅</div>`;
      return;
    }

    contentArea.innerHTML = Object.entries(grupos).map(([prov, data]) => `
      <div class="bg-slate-50 rounded-[2rem] p-6 mb-4 border border-slate-100 shadow-sm">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-black text-slate-800 text-lg uppercase">${prov}</h3>
            <p class="text-[10px] text-indigo-500 font-bold tracking-tighter">${data.items.length} ALBARANES PARA REVISAR</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-black text-slate-900">${data.t.toFixed(2)}€</p>
          </div>
        </div>
        
        <div class="space-y-2 mb-4">
          ${data.items.map(alb => `
            <div class="flex justify-between items-center bg-white/80 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-400 transition" onclick="window.revisarAlbaran('${alb.id}')">
              <span class="text-xs font-bold text-slate-600">Ref: ${alb.numero || alb.num || '---'}</span>
              <span class="text-xs font-black text-slate-800">${parseFloat(alb.total).toFixed(2)}€ 👁️</span>
            </div>
          `).join('')}
        </div>

        <button class="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition" 
                onclick="window.prepararFactura('${prov}')">
          GENERAR FACTURA OFICIAL
        </button>
      </div>
    `).join("");
  }

  /* =============================================================
     2. VISTA: HISTORIAL (Control de Pagos)
     ============================================================= */
  function renderHistorial() {
    actualizarTabs(false);
    if (facturasRealizadas.length === 0) {
      contentArea.innerHTML = `<div class="py-12 text-center text-slate-400 italic text-sm">Aún no hay facturas generadas.</div>`;
      return;
    }

    contentArea.innerHTML = `
      <div class="overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
        <table class="w-full text-left text-sm bg-white">
          <thead class="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr>
              <th class="p-4">Empresa / Fecha</th>
              <th class="p-4 text-right">Total</th>
              <th class="p-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            ${facturasRealizadas.sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => `
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-4">
                  <p class="font-bold text-slate-800">${f.prov || f.cliente}</p>
                  <p class="text-[10px] text-slate-400 font-mono">${f.date} | #${f.num || f.numero}</p>
                </td>
                <td class="p-4 text-right font-black text-slate-900">${parseFloat(f.total).toFixed(2)}€</td>
                <td class="p-4 text-center">
                  <button onclick="window.cambiarEstadoPago('${f.id}')" 
                    class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition ${f.paid ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-rose-100 text-rose-600 border border-rose-200'}">
                    ${f.paid ? 'PAGADO' : 'PENDIENTE'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* =============================================================
     🧪 FUNCIONES DE ACCIÓN (Revisar, Facturar, Pagar)
     ============================================================= */
  
  // Revisar albarán individual antes de agrupar
  window.revisarAlbaran = function(id) {
    const alb = albaranes.find(a => a.id === id);
    alert(`Revisando Albarán: ${alb.numero || alb.num}\nProveedor: ${alb.proveedor || alb.prov}\nTotal: ${alb.total}€\n\nAquí podrías ver los productos si están guardados.`);
  };

  // Crear factura y marcar albaranes como procesados
  window.prepararFactura = async function(prov) {
    const numFra = prompt(`Introduce el Número de Factura para ${prov}:`);
    if (!numFra) return;

    const albs = albaranes.filter(a => (a.proveedor === prov || a.prov === prov) && !a.invoiced);
    const total = albs.reduce((acc, a) => acc + (parseFloat(a.total) || 0), 0);

    const nuevaFra = {
      id: Math.random().toString(36).substr(2, 9),
      prov,
      num: numFra,
      date: new Date().toISOString().split('T')[0],
      total,
      paid: false
    };

    // Marcar albaranes como facturados
    albs.forEach(a => a.invoiced = true);
    db.facturas = [...facturasRealizadas, nuevaFra];

    if (window.save) await window.save("Factura generada y albaranes vinculados ✅");
    renderPendientes();
  };

  // Cambiar de Pagado a Pendiente y viceversa
  window.cambiarEstadoPago = async function(id) {
    const f = facturasRealizadas.find(x => x.id === id);
    if (f) {
      f.paid = !f.paid;
      if (window.save) await window.save(`Estado de factura ${f.num} actualizado`);
      renderHistorial();
    }
  };

  function actualizarTabs(esPend) {
    container.querySelector("#btnTabPend").className = `flex-1 py-2.5 rounded-xl font-bold text-xs transition ${esPend ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`;
    container.querySelector("#btnTabHist").className = `flex-1 py-2.5 rounded-xl font-bold text-xs transition ${!esPend ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`;
  }

  function formatDate(str) {
    try { return new Date(str).toLocaleDateString("es-ES"); } catch { return str; }
  }
}
