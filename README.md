
# ARUME ERP 🍽️

Sistema de Gestión Integral para Hostelería (Single Page Application).
Diseñado para control de costes, escandallos y auditoría de caja.

## 🚀 Características V52

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

## 🛠️ Instalación y Desarrollo

### Para usuarios finales
No requiere instalación ni servidores.
1.  Clona este repositorio o descarga el archivo `index.html`.
2.  Ábrelo en cualquier navegador (Chrome, Safari, Edge).
3.  ¡Listo!

### Para desarrolladores

#### Requisitos
- Node.js 18 o superior
- npm

#### Instalación de dependencias
```bash
npm install
```

#### Ejecutar tests
```bash
npm test
```

#### Ejecutar linter
```bash
npm run lint
```

## 📁 Estructura del Proyecto

```
arume-erp/
├── index.html              # Aplicación principal (UI)
├── src/
│   ├── index.js           # Punto de entrada de módulos
│   └── logic/             # Lógica de negocio extraída (testable)
│       ├── recipes.js     # Cálculo de costos de recetas
│       ├── stock.js       # Gestión de stock y PMP
│       ├── backup.js      # Exportar/importar datos
│       └── auth.js        # Autenticación con PIN hash
├── tests/                 # Tests unitarios con Jest
│   ├── recipes.test.js
│   ├── stock.test.js
│   ├── backup.test.js
│   └── auth.test.js
├── .github/
│   └── workflows/
│       └── ci.yml         # GitHub Actions CI/CD
├── jest.config.js         # Configuración de Jest
├── .eslintrc.json         # Configuración de ESLint
└── package.json           # Dependencias y scripts
```

## 🧪 Tests Unitarios

El proyecto incluye 70 tests unitarios que cubren la lógica crítica:

- **Recipes (9 tests)**: Validación de cálculos de costos de recetas
- **Stock (15 tests)**: Gestión de inventario y PMP
- **Backup (22 tests)**: Exportación e importación de datos
- **Auth (24 tests)**: Autenticación y hashing de PINs

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con cobertura
npm test -- --coverage
```

## 🔧 Integración Continua

El proyecto usa GitHub Actions para ejecutar automáticamente:
- ESLint (linting)
- Jest (tests unitarios)

En cada Pull Request y push a `main`.

## 🔐 Seguridad
* Acceso mediante PIN de usuario con hash SHA-256.
* Datos almacenados en local (LocalStorage).
* Sistema de Backup manual incluido.
* Validación de datos en importación de backups.

## 📝 Notas de la Última Versión (V52)

### Refactor y Test Infrastructure
- ✅ Extraída lógica testable de `index.html` a módulos independientes
- ✅ Añadidos 70 tests unitarios con Jest
- ✅ Configurado ESLint para calidad de código
- ✅ Implementado CI/CD con GitHub Actions
- ✅ Mejorada la seguridad con PIN hash (SHA-256)
- ✅ Mantenido comportamiento idéntico (sin cambios en UI)

---
*Desarrollado para Arume.*
