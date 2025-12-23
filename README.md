
# ARUME ERP 🍽️

Sistema de Gestión Integral para Hostelería (Single Page Application).
Diseñado para control de costes, escandallos y auditoría de caja.

## 🚀 Características V45 (Gold Master)

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
* Datos almacenados en local (LocalStorage).
* Sistema de Backup manual incluido.

## 🧪 Tests

Este proyecto incluye tests unitarios para las funciones críticas de lógica de negocio.

### Ejecutar tests localmente

```bash
# Instalar dependencias
npm ci

# Ejecutar todos los tests (rápido, sin cobertura)
npm test

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar tests en modo watch (útil durante desarrollo)
npm run test:watch

# Ejecutar linter
npm run lint
```

### Estructura de tests

Los tests están organizados en el directorio `__tests__/`:

- `recipes.test.js` - Tests de cálculo de costes de recetas, yield/merma, y scaling
- `stock.test.js` - Tests de actualización de stock y cálculo de Precio Medio Ponderado (PMP)
- `backup.test.js` - Tests de exportación/importación de backups y validación de formato
- `auth.test.js` - Tests de hashing y verificación de PINs

### Lógica extraída

La lógica de negocio ha sido extraída a módulos en `src/logic/`:

- `recipes.js` - Cálculo de costes de recetas
- `stock.js` - Gestión de stock y PMP
- `backup.js` - Exportación e importación de datos
- `auth.js` - Hashing y verificación de PINs

### Integración Continua

El proyecto incluye un workflow de GitHub Actions (`.github/workflows/ci.yml`) que:

- Ejecuta el linter en cada push/PR a `main`
- Ejecuta todos los tests con cobertura
- Soporta Node.js 18.x

---
*Desarrollado para Arume.*
