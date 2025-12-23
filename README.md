
# ARUME ERP 🍽️

Sistema de Gestión Integral para Hostelería (Single Page Application).
Diseñado para control de costes, escandallos y auditoría de caja.

## 🚀 Características V60 DEFINITIVE

**V60 DEFINITIVE** es la versión más completa y estable del sistema ARUME, integrando todas las funcionalidades de V52 (Financial Control) y V58 (Kitchen & Security), con mejoras significativas en seguridad alimentaria, control financiero e inventario inteligente.

### ⭐ Novedades V60

#### 1. Módulo de Cocina y Seguridad Alimentaria (V58)
* **Sistema de Alérgenos Inteligente:** 
  - 14 alérgenos principales con iconos visuales (🌾 Gluten, 🦐 Crustáceos, 🥚 Huevos, etc.)
  - Herencia automática de alérgenos de ingredientes a recetas
  - Botón "Ficha de Alérgenos" para Modo Inspección Sanitaria
* **Sub-recetas:** Soporte para recetas dentro de recetas con cálculo automático de costes
* **BOM Inverso (Bill of Materials):** Calcula precios objetivo de ingredientes basándose en el precio de venta deseado

#### 2. Módulo Financiero Avanzado (V52 Enhanced)
* **Ingeniería de Menú:**
  - Matriz BCG completa (Estrellas ⭐, Caballos 🐴, Puzzles 🧩, Perros 🐕)
  - Análisis OMNES de amplitud de precios
  - Identificación automática de platos rentables
* **Gráficos de Ventas vs Mermas:** Visualización comparativa con Chart.js
* **Histórico de Precios:** Seguimiento completo de cambios de precio de ingredientes con fecha y proveedor

#### 3. Inventario y Compras Inteligente
* **Lector de Albaranes con Semáforo:**
  - 🔴 Rojo: Subida de precio >10%
  - 🟡 Amarillo: Subida 5-10%
  - 🟢 Verde: Sin cambios o bajadas
* **Generación Automática de Pedido WhatsApp:** 
  - Lista de compra basada en stock mínimo
  - Envío directo por WhatsApp al proveedor
* **Modo Inventario Ciego:** Oculta cantidades actuales para recuentos sin sesgo
* **Fotos de Albaranes:** Almacenamiento en IndexedDB para evidencia documental

#### 4. Exportación y Respaldo
* **Exportación a Excel Real:** Uso de SheetJS para generar archivos .xlsx con múltiples hojas:
  - Ingredientes
  - Recetas con costes
  - Histórico de precios
  - Albaranes
  - Diario de caja
* **Backup JSON Local:** Sistema de respaldo completo en localStorage

### 📊 Características V45-V52 (Mantenidas)

### 📊 Características V45-V52 (Mantenidas)

### 1. Gestión de Stock y Compras
* **Lector de Albaranes Inteligente:** Pega directamente el texto de tu Excel o albarán digital y el sistema lo convierte en stock editable.
* **Conciliación de Facturas:** Agrupa múltiples albaranes en una sola factura y controla su estado de pago (Pagado/Pendiente).
* **Control de Precios:** Actualización automática del Precio Medio Ponderado (PMP) al recibir mercancía.

### 2. Cocina y Escandallos
* **Fichas Técnicas Dinámicas:** Cálculo automático de costes basado en ingredientes.
* **Editor en Tiempo Real:** Añade o quita ingredientes de una receta y ve cómo cambia el coste al instante.
* **Control de Mermas (Yield):** El sistema calcula el coste real basándose en el rendimiento del producto.

### 3. Administración
* **Diario de Caja:** Sustitución del TPV tradicional por un sistema de auditoría de cierre Z (compatible con Madisa).
* **Backup Local:** Descarga todos tus datos en un archivo JSON seguro con un solo clic.
* **Gráficos:** Visualización de la evolución de ventas semanal.

## 🛠️ Instalación

No requiere instalación ni servidores.
1.  Clona este repositorio o descarga el archivo `index.html`.
2.  Ábrelo en cualquier navegador (Chrome, Safari, Edge).
3.  ¡Listo!

## 🔐 Seguridad
* Acceso mediante PIN de usuario.
* Datos almacenados en local (LocalStorage + IndexedDB).
* Sistema de Backup manual incluido.
* Posibilidad de sincronización con Google Apps Script (configuración requerida).

## 📱 Tecnologías

* **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (sin frameworks)
* **Charts:** Chart.js (vía CDN)
* **Excel Export:** SheetJS/xlsx (vía CDN)
* **Storage:** LocalStorage + IndexedDB
* **Sync (Opcional):** Google Apps Script API

## 🎯 Casos de Uso

* **Restaurantes:** Control completo de costes de menú y escandallos
* **Bares y Cafeterías:** Gestión de stock y cierre de caja diario
* **Catering:** Cálculo de costes por evento y control de alérgenos
* **Dark Kitchens:** Ingeniería de menú y análisis de rentabilidad

## 📋 Requisitos Mínimos

* Navegador moderno (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
* JavaScript habilitado
* 2 MB de espacio en localStorage
* IndexedDB disponible (para fotos de albaranes)

## 🔄 Changelog

### V60 DEFINITIVE (2025-12-23)
- ✨ Sistema completo de alérgenos con 14 tipos
- ✨ Sub-recetas y cálculos recursivos
- ✨ BOM Inverso para pricing estratégico
- ✨ Semáforo de cambios de precio
- ✨ Generación automática de pedidos WhatsApp
- ✨ Modo Inventario Ciego
- ✨ Exportación a Excel con SheetJS
- ✨ Almacenamiento de fotos en IndexedDB
- ✨ Gráficos de Ventas vs Mermas
- 🔧 CONFIG.GOOGLE_URL dejado vacío para configuración manual

### V52 (Financial Control)
- 📊 Matriz BCG y análisis OMNES
- 📈 Gráficos de evolución de ventas
- 💰 Control avanzado de facturas

### V45 (Gold Master)
- 🎯 Sistema base estable
- 📦 Gestión de stock y albaranes
- 👨‍🍳 Fichas técnicas de recetas

---
*Desarrollado para Arume · V60 DEFINITIVE · Single Page Application*
