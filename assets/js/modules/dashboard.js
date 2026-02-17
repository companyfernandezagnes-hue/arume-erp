/* =============================================================
   📊 MÓDULO: DASHBOARD v5.5 (Arume Master Edition)
   ============================================================= */

// CONFIGURACIÓN ESTÁTICA (Ajustar según realidad del restaurante)
const CONF = {
    PERSONAL_ESTIMADO: 18000, // Coste mensual aprox de nóminas
    COMISION_TPV: 0.015,      // 1.5% de comisión media
    META_VENTAS: 40000        // Objetivo mensual
};

export async function render(container, supabase, db, opts = {}) {
    
    // --- 1. CARGA SEGURA DE LIBRERÍAS (CHART.JS) ---
    // Optimizado para no duplicar carga si ya existe en el index
    const ensureChartJS = async () => {
        if (window.Chart) return true;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('Error cargando gráficas'));
            document.head.appendChild(script);
        });
    };

    // Aquí esperamos a que cargue antes de seguir con la lógica pesada
    try { await ensureChartJS(); } catch(e) { console.error(e); }

  // --- 2. HELPERS ROBUSTOS ---
    const parseFechaSafe = (d) => {
        if (!d) return null;
        if (d instanceof Date) return d;
        if (typeof d === 'number') {
            // Por si viene fecha serial de Excel
            return new Date((d - 25569) * 86400 * 1000);
        }
        if (typeof d === 'string') {
            const s = d.trim();
            if (s.includes('/')) {
                const parts = s.split('/');
                if (parts.length === 3) {
                    const y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                    return new Date(`${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                }
            }
            const t = new Date(s);
            return isNaN(t) ? null : t;
        }
        return null;
    };

    const esMes = (d, m, y) => {
        const fecha = parseFechaSafe(d);
        if (!fecha) return false;
        return fecha.getMonth() === m && fecha.getFullYear() === y;
    };

    const fmt = (n) => {
        const val = parseFloat(n) || 0;
        return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    };

    const pctSafe = (val) => {
        if (!Number.isFinite(val) || isNaN(val)) return 0;
        return Math.min(100, Math.max(0, val));
    };
   // --- 3. CALCULADORA FINANCIERA (CON PROTECCIÓN ANTI-CRASH) ---
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const yearActual = hoy.getFullYear();
    const diasDelMes = new Date(yearActual, mesActual + 1, 0).getDate();
    const diaHoy = hoy.getDate();

    // A) VENTAS (Seguras contra undefined)
    const ventasCierres = (db.cierres || [])
        .filter(c => c && c.date && esMes(c.date, mesActual, yearActual))
        .reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0);

    const ventasFacturas = (db.facturas || [])
        .filter(f => f && f.date && esMes(f.date, mesActual, yearActual) && !String(f.num || '').startsWith('Z-'))
        .reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);

    const ventasMes = ventasCierres + ventasFacturas;

    // B) GASTOS & FOOD COST (Detección inteligente mejorada)
    let gastosComida = 0;
    let gastosBebida = 0;
    let gastosOtros = 0;

    const albaranesMes = (db.albaranes || []).filter(a => a && a.date && esMes(a.date, mesActual, yearActual));
    
    const gastosMes = albaranesMes.reduce((acc, a) => {
        const total = parseFloat(a.total) || 0;
        const p = (a.prov || '').toLowerCase();
        
        // Categorización ultra-rápida por palabras clave
        if (p.match(/fruta|carne|pesca|makro|mercadona|pan|huevo|verdu|aliment/)) {
            gastosComida += total;
        } else if (p.match(/estrella|mahou|coca|vino|bebida|licor|bodega|drinks|cerveza/)) {
            gastosBebida += total;
        } else {
            gastosOtros += total;
        }
        return acc + total;
    }, 0);

    // C) GASTOS FIJOS & ESTRUCTURA
    const fijosMes = (db.gastos_fijos || []).reduce((acc, g) => {
        let val = parseFloat(g.amount) || 0;
        if (g.freq === 'anual') val /= 12;
        else if (g.freq === 'trimestral') val /= 3;
        return acc + val;
    }, 0);

    const costePersonal = (db.config?.personalMensual || CONF.PERSONAL_ESTIMADO);
    const costeTPV = ventasCierres * CONF.COMISION_TPV; // Solo aplicamos TPV a lo cobrado en tarjeta/cierres

    // D) BENEFICIO NETO REAL (Facturación - Todo)
    const totalGastosReal = gastosMes + fijosMes + costePersonal + costeTPV;
    const beneficio = ventasMes - totalGastosReal;

    // E) FORECAST (IA LIGERA - Ponderando Fines de Semana)
    let pesoTotalMes = 0;
    let pesoLlevado = 0;
    for (let i = 1; i <= diasDelMes; i++) {
        const f = new Date(yearActual, mesActual, i);
        const diaSemana = f.getDay(); // 0 Dom, 5 Vie, 6 Sab
        const peso = (diaSemana === 0 || diaSemana === 5 || diaSemana === 6) ? 1.4 : 1.0;
        pesoTotalMes += peso;
        if (i <= diaHoy) pesoLlevado += peso;
    }
    const forecastVentas = pesoLlevado > 0 ? (ventasMes / pesoLlevado) * pesoTotalMes : ventasMes;

    // F) ALERTAS INFLACIÓN (Comparativa mensual)
    const subidas = [];
    if (db.priceHistory) {
        Object.keys(db.priceHistory).forEach(prod => {
            const hist = db.priceHistory[prod];
            if (hist && hist.length >= 2) {
                const last = hist[hist.length - 1];
                const prev = hist[hist.length - 2];
                // Si el último cambio es de este mes y subió más del 5%
                if (last.date && esMes(last.date, mesActual, yearActual) && last.unit > (prev.unit * 1.05)) {
                    const diffPct = ((last.unit - prev.unit) / prev.unit * 100).toFixed(1);
                    subidas.push({ prod, diff: diffPct, old: prev.unit, new: last.unit });
                }
            }
        });
    }
   // --- 4. DATOS GRÁFICA SEMESTRAL (DATOS PROTEGIDOS) ---
    const labels = [];
    const dataV = [], dataG = [], dataB = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(yearActual, mesActual - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        
        // Ventas: Cierres + Facturas (Seguro contra nulos y tipos de datos)
        const v = (db.cierres || [])
            .filter(c => c && c.date && esMes(c.date, m, y))
            .reduce((acc, c) => acc + (parseFloat(c.totalVenta) || 0), 0) +
            (db.facturas || [])
            .filter(f => f && f.date && esMes(f.date, m, y) && !String(f.num || '').startsWith('Z-'))
            .reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
        
        // Gastos: Albaranes (Seguro contra nulos)
        const g = (db.albaranes || [])
            .filter(a => a && a.date && esMes(a.date, m, y))
            .reduce((acc, a) => acc + (parseFloat(a.total) || 0), 0);
        
        // Beneficio histórico (Estimación: V - G - Fijos - Personal)
        const b = v - g - fijosMes - costePersonal;

        labels.push(d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase());
        dataV.push(v);
        dataG.push(g);
        dataB.push(b);
    }
   // --- 6. INICIALIZAR GRÁFICA (CHART.JS) ---
    await ensureChartJS();
    
    // Pequeño retardo para asegurar que el HTML se ha pintado en la pantalla
    setTimeout(() => {
        const el = document.getElementById('chartSemestral');
        if (!el) return;

        const ctx = el.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { 
                        label: 'Ventas', 
                        data: dataV, 
                        backgroundColor: '#6366f1', 
                        borderRadius: 6, 
                        order: 2 
                    },
                    { 
                        label: 'Gastos', 
                        data: dataG, 
                        backgroundColor: '#fb7185', 
                        borderRadius: 6, 
                        order: 3 
                    },
                    { 
                        label: 'Beneficio', 
                        data: dataB, 
                        type: 'line', 
                        borderColor: '#10b981', 
                        borderWidth: 2, 
                        tension: 0.4, 
                        order: 1,
                        fill: false,
                        pointBackgroundColor: '#10b981'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false } 
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9' },
                        ticks: { font: { size: 10 } }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { font: { size: 10, weight: 'bold' } }
                    }
                }
            }
        });
    }, 150);
} // <--- ESTA ES LA LLAVE FINAL QUE CIERRA EL RENDER
  // --- 6. INICIALIZAR GRÁFICA (CHART.JS) ---
    await ensureChartJS();
    
    // Usamos un pequeño delay para asegurar que el DOM ha renderizado el canvas
    setTimeout(() => {
        const chartEl = document.getElementById('chartSemestral');
        if (!chartEl) return;

        const ctx = chartEl.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { 
                        label: 'Beneficio', 
                        data: dataB, 
                        type: 'line', 
                        borderColor: '#10b981', 
                        borderWidth: 3, 
                        tension: 0.4, 
                        order: 1,
                        fill: false,
                        pointRadius: 3,
                        pointBackgroundColor: '#10b981'
                    },
                    { 
                        label: 'Ventas', 
                        data: dataV, 
                        backgroundColor: '#6366f1', 
                        borderRadius: 6, 
                        order: 2,
                        barPercentage: 0.6
                    },
                    { 
                        label: 'Gastos', 
                        data: dataG, 
                        backgroundColor: '#fb7185', 
                        borderRadius: 6, 
                        order: 3,
                        barPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 12,
                        cornerRadius: 10,
                        callbacks: {
                            label: (context) => ` ${context.dataset.label}: ${fmt(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9', drawBorder: false },
                        ticks: { 
                            font: { size: 10 },
                            callback: (value) => value >= 1000 ? (value/1000) + 'k€' : value + '€'
                        }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { font: { size: 10, weight: '600' } }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                }
            }
        });
    }, 200);
} // <--- CIERRE DE LA FUNCIÓN EXPORT ASYNC FUNCTION RENDER
