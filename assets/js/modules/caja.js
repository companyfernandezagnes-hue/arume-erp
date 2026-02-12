/* =============================================================
   💰 MÓDULO: CAJA / CIERRES DIARIOS (Versión Inserción Manual)
   ============================================================= */
export async function render(container, supabase, db) {
  const cierresOriginales = db.diario || [];

  container.innerHTML = `
  <section class="p-6 bg-white rounded-3xl shadow-sm mb-6 animate-fade-in border border-slate-100">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-black text-slate-800">Caja / Diario</h2>
        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Control de Ventas Diarias</p>
      </div>
      <button id="btnNuevoCierre" class="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95 transition">
        🪄 NUEVO CIERRE
      </button>
    </div>

    <div id="listaCierres" class="text-sm space-y-2"></div>
  </section>
  <div id="diarioModal"></div>
  `;

  const cierresDiv = container.querySelector("#listaCierres");
  const nuevoBtn = container.querySelector("#btnNuevoCierre");

  nuevoBtn.onclick = () => abrirFormularioCierre();
  renderCierresList();

  function renderCierresList() {
    if (cierresOriginales.length === 0) {
      cierresDiv.innerHTML = `<p class="text-center text-slate-400 py-10 italic">Sin cierres registrados...</p>`;
      return;
    }
    cierresDiv.innerHTML = cierresOriginales
      .sort((a, b) => new Date(b.date || b.fecha) - new Date(a.date || a.fecha))
      .map(c => `
        <div class="glass-card flex justify-between items-center p-4 rounded-2xl border border-slate-50 cursor-pointer hover:bg-indigo-50 transition" onclick="verCierre('${c.id}')">
          <div>
            <p class="font-bold text-slate-800">${formatDate(c.date || c.fecha)}</p>
            <p class="text-[10px] text-slate-400 font-bold uppercase">Neto: ${(parseFloat(c.cash || 0) - parseFloat(c.expenses || 0)).toFixed(2)}€ Efec.</p>
          </div>
          <div class="text-right">
            <p class="font-black text-indigo-600 text-base">${(parseFloat(c.total) || 0).toFixed(2)} €</p>
            <p class="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">${c.usuario || "Staff"}</p>
          </div>
        </div>
      `).join("");
  }

  /* =============================================================
     📝 FORMULARIO PARA NUEVO CIERRE (CON TODOS LOS CAMPOS)
     ============================================================= */
  function abrirFormularioCierre() {
    const modal = container.querySelector("#diarioModal");
    const hoy = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
        <div class="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative animate-slide-up overflow-y-auto max-h-[95vh]">
          <button onclick="document.getElementById('diarioModal').innerHTML=''" class="absolute top-6 right-6 text-slate-400 hover:text-red-500 transition text-2xl">✕</button>
          
          <h3 class="text-2xl font-black text-slate-800 mb-6">Nuevo Cierre de Caja</h3>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label class="text-[10px] font-black text-slate-400 uppercase">Fecha</label>
              <input type="date" id="z-date" value="${hoy}" class="w-full p-3 bg-slate-50 rounded-xl border-0 font-bold">
            </div>
            <div>
              <label class="text-[10px] font-black text-slate-400 uppercase">Usuario</label>
              <input type="text" id="z-user" value="${window.currentUser?.n || ''}" class="w-full p-3 bg-slate-50 rounded-xl border-0 font-bold">
            </div>
          </div>

          <div class="space-y-4">
            <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <p class="text-[10px] font-black text-emerald-600 uppercase mb-2">💵 Efectivo</p>
              <div class="grid grid-cols-2 gap-2">
                <input type="number" id="z-cash" placeholder="Caja Inicial + Ventas" class="p-3 rounded-lg border-0 shadow-sm font-bold text-center" oninput="recalcTotal()">
                <input type="number" id="z-expenses" placeholder="Gastos / Pagos" class="p-3 rounded-lg border-0 shadow-sm font-bold text-center text-red-500" oninput="recalcTotal()">
              </div>
            </div>

            <div class="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <p class="text-[10px] font-black text-blue-600 uppercase mb-2">💳 Tarjetas & TPV</p>
              <div class="grid grid-cols-3 gap-2">
                <input type="number" id="z-tpv" placeholder="TPV" class="p-2 rounded-lg border-0 font-bold text-center text-xs" oninput="recalcTotal()">
                <input type="number" id="z-madisa" placeholder="Madisa" class="p-2 rounded-lg border-0 font-bold text-center text-xs" oninput="recalcTotal()">
                <input type="number" id="z-amex" placeholder="AMEX" class="p-2 rounded-lg border-0 font-bold text-center text-xs" oninput="recalcTotal()">
              </div>
            </div>

            <div class="bg-orange-50 p-4 rounded-2xl border border-orange-100">
              <p class="text-[10px] font-black text-orange-600 uppercase mb-2">🛵 Plataformas (Delivery)</p>
              <div class="grid grid-cols-3 gap-2">
                <input type="number" id="z-uber" placeholder="Uber" class="p-2 rounded-lg border-0 font-bold text-center text-xs" oninput="recalcTotal()">
                <input type="number" id="z-glovo" placeholder="Glovo" class="p-2 rounded-lg border-0 font-bold text-center text-xs" oninput="recalcTotal()">
                <input type="number" id="z-app" placeholder="App/Otros" class="p-2 rounded-lg border-0 font-bold text-center text-xs" oninput="recalcTotal()">
              </div>
            </div>
          </div>

          <div class="mt-6 border-t border-slate-100 pt-6 flex justify-between items-center">
            <span class="text-sm font-black text-slate-400 uppercase">Total Bruto</span>
            <span id="z-total-display" class="text-4xl font-black text-slate-900">0.00€</span>
          </div>

          <button onclick="guardarCierreManual()" class="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition">
            💾 GUARDAR EN LA NUBE
          </button>
        </div>
      </div>
    `;
    window.recalcTotal = () => {
      const vals = ['z-cash', 'z-tpv', 'z-madisa', 'z-amex', 'z-uber', 'z-glovo', 'z-app'].map(id => parseFloat(document.getElementById(id).value) || 0);
      const gast = parseFloat(document.getElementById('z-expenses').value) || 0;
      const total = vals.reduce((a, b) => a + b, 0) - gast;
      document.getElementById('z-total-display').innerText = total.toFixed(2) + '€';
    };
  }

  /* =============================================================
     ☁️ PROCESO DE GUARDADO
     ============================================================= */
  window.guardarCierreManual = async function() {
    const total = parseFloat(document.getElementById('z-total-display').innerText);
    const data = {
      id: Math.random().toString(36).substr(2, 9),
      date: document.getElementById('z-date').value,
      usuario: document.getElementById('z-user').value,
      cash: parseFloat(document.getElementById('z-cash').value) || 0,
      expenses: parseFloat(document.getElementById('z-expenses').value) || 0,
      tpv: parseFloat(document.getElementById('z-tpv').value) || 0,
      madisa: parseFloat(document.getElementById('z-madisa').value) || 0,
      amex: parseFloat(document.getElementById('z-amex').value) || 0,
      visa: (parseFloat(document.getElementById('z-tpv').value) || 0) + (parseFloat(document.getElementById('z-madisa').value) || 0) + (parseFloat(document.getElementById('z-amex').value) || 0),
      uber: parseFloat(document.getElementById('z-uber').value) || 0,
      glovo: parseFloat(document.getElementById('z-glovo').value) || 0,
      app: parseFloat(document.getElementById('z-app').value) || 0,
      total: total
    };

    db.diario = [...cierresOriginales, data];
    
    if (window.save) {
      await window.save("Cierre de caja guardado ✅");
    } else {
      await supabase.from('arume_data').upsert({ id: 1, data: db });
    }

    document.getElementById('diarioModal').innerHTML = '';
    render('Diario'); // Refrescar vista
  };

  window.verCierre = function(id) {
    const data = cierresOriginales.find(x => x.id === id);
    if (!data) return;
    // ... lógica del modal verCierre que ya tenías ...
    alert(`Cierre del ${data.date}: ${data.total}€\n(Desglose disponible en modal detallado)`);
  };

  function formatDate(str) {
    try {
      const d = new Date(str);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch { return str; }
  }
}
