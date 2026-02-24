/* =============================================================
   MÓDULO: IMPORTADOR INTELIGENTE DE VENTAS (importador.js)
   Lee Excels/CSVs del TPV e inyecta los datos en Supabase
   ============================================================= */

export async function render(container, sb, db) {
    // 1. DIBUJAR LA INTERFAZ DE USUARIO (UI)
    container.innerHTML = `
        <div class="max-w-2xl mx-auto bg-white p-8 rounded-[2rem] shadow-xl animate-slide-up">
            <header class="text-center mb-8">
                <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">📥</div>
                <h2 class="text-2xl font-black text-slate-800">Importador de Ventas TPV</h2>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Sube el cierre de Qmarero / Madissa</p>
            </header>

            <div class="border-2 border-dashed border-slate-300 rounded-3xl p-10 text-center hover:bg-slate-50 transition cursor-pointer relative" id="drop-zone">
                <input type="file" id="file-upload" accept=".xlsx, .xls, .csv" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                <span class="text-4xl block mb-2">📊</span>
                <p class="text-sm font-bold text-slate-600">Pulsa aquí o arrastra tu archivo Excel/CSV</p>
                <p class="text-[10px] text-slate-400 mt-2 uppercase">Formatos soportados: .xlsx, .csv</p>
            </div>

            <div id="resultado-importacion" class="hidden mt-6 bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                <h3 class="font-black text-emerald-800 mb-2">✅ Lectura Exitosa</h3>
                <ul id="lista-resumen" class="text-sm text-emerald-700 space-y-1"></ul>
                <button id="btn-confirmar" class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition shadow-lg">
                    GUARDAR EN EL CEREBRO (SUPABASE)
                </button>
            </div>
        </div>
    `;

    // 2. LÓGICA DE LECTURA DEL ARCHIVO EXCEL
    const fileInput = document.getElementById('file-upload');
    let datosProcesados = null; // Guardaremos los datos aquí temporalmente

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            // Usamos la librería XLSX (SheetJS) que ya tienes en el index.html
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Asumimos que los datos están en la primera hoja del Excel
            const primeraHoja = workbook.Sheets[workbook.SheetNames[0]];
            // Convertimos la hoja a un array de objetos (JSON)
            const filasExcel = XLSX.utils.sheet_to_json(primeraHoja);

            procesarDatosDelTPV(filasExcel);
        };
        reader.readAsArrayBuffer(file);
    });

    // 3. LÓGICA PARA ENTENDER LOS DATOS (El "Cerebro" del importador)
    function procesarDatosDelTPV(filas) {
        if(filas.length === 0) return alert("El archivo está vacío");

        let totalVentaDelDia = 0;
        let desglosePlatos = [];

        // Recorremos cada fila del Excel
        filas.forEach(fila => {
            /* IMPORTANTE: Los nombres ('Producto', 'Total') dependerán 
               de cómo llame a las columnas tu programa (Qmarero). 
               Aquí usamos nombres estándar como ejemplo. */
               
            const nombreProducto = fila['Producto'] || fila['Articulo'];
            const cantidadVendida = window.Num.parse(fila['Cantidad'] || fila['Uds']);
            const totalLinea = window.Num.parse(fila['Total'] || fila['Importe']);

            if (nombreProducto && cantidadVendida > 0) {
                totalVentaDelDia += totalLinea;
                desglosePlatos.push({
                    nombre: nombreProducto,
                    cantidad: cantidadVendida,
                    total: totalLinea
                });
            }
        });

        // Preparamos los datos para guardarlos
        const fechaHoy = window.DateUtil.today(); // Usamos tu función global
        
        datosProcesados = {
            cierre: {
                id: `cierre-imp-${Date.now()}`,
                date: fechaHoy,
                totalVenta: totalVentaDelDia,
                origen: 'Importación TPV'
            },
            ventasMenu: {
                fecha: fechaHoy,
                platos: desglosePlatos
            }
        };

        // Mostramos el resumen en la pantalla
        document.getElementById('resultado-importacion').classList.remove('hidden');
        document.getElementById('lista-resumen').innerHTML = `
            <li>🗓️ <b>Fecha:</b> ${fechaHoy}</li>
            <li>💰 <b>Total Caja detectado:</b> ${window.Num.fmt(totalVentaDelDia)}</li>
            <li>🍽️ <b>Platos vendidos detectados:</b> ${desglosePlatos.length} referencias</li>
        `;
    }

    // 4. GUARDAR EN SUPABASE AL CONFIRMAR
    document.getElementById('btn-confirmar')?.addEventListener('click', async () => {
        if(!datosProcesados) return;

        // Añadimos el nuevo cierre al array existente
        if(!db.cierres) db.cierres = [];
        db.cierres.push(datosProcesados.cierre);

        // Añadimos el desglose de ventas para el Menu Engineering
        if(!db.ventas_menu) db.ventas_menu = [];
        db.ventas_menu.push(datosProcesados.ventasMenu);

        // Usamos tu función global de guardado
        const guardadoOk = await window.save("Ventas importadas correctamente");
        
        if(guardadoOk) {
            alert("¡Datos integrados en el ERP con éxito!");
            window.loadModule('dashboard'); // Volvemos al inicio
        }
    });
}
