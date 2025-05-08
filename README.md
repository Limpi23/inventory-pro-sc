# Inventario Pro - SC

Sistema profesional de inventario con Electron y Vite, diseñado para gestionar productos, entradas, salidas y notas de venta.

## Características

- Gestión de productos (creación, edición, eliminación)
- Control de entradas y salidas de inventario
- Generación de notas de venta
- Seguimiento de stock en tiempo real
- Reportes de inventario y ventas
- Interfaz moderna y responsiva

## Tecnologías

- Electron.js - Framework para aplicaciones de escritorio
- Vite - Herramienta de desarrollo rápido para React
- React - Biblioteca para interfaces de usuario
- TypeScript - Tipado estático para JavaScript
- TailwindCSS - Framework CSS utilitario
- SQLite - Base de datos local

## Instalación

1. Clona este repositorio:
```bash
git clone https://github.com/tuusuario/inventory-suit.git
cd inventory-suit
```

2. Instala las dependencias:
```bash
npm install
```

3. Ejecuta en modo desarrollo:
```bash
npm run electron:dev
```

## Estructura de Archivos

```
inventory-suit/
├── src/                      # Código fuente
│   ├── main/                 # Proceso principal de Electron
│   │   ├── index.ts          # Punto de entrada de Electron
│   │   └── preload.ts        # Script de precarga
│   └── renderer/             # Proceso de renderizado (React)
│       ├── components/       # Componentes reutilizables
│       ├── views/            # Vistas principales
│       ├── assets/           # Recursos estáticos
│       ├── App.tsx           # Componente raíz de React
│       └── main.tsx          # Punto de entrada de React
├── index.html                # HTML principal
├── vite.config.ts            # Configuración de Vite
├── tailwind.config.js        # Configuración de TailwindCSS
└── package.json              # Dependencias y scripts
```

## Scripts

- `npm run dev` - Inicia sólo el servidor de desarrollo de Vite
- `npm run electron:dev` - Inicia el servidor de desarrollo y la aplicación Electron
- `npm run build` - Construye la aplicación para producción
- `npm run electron:build` - Construye y empaqueta la aplicación Electron

## Contribuir

1. Haz fork del proyecto
2. Crea una rama para tu característica (`git checkout -b feature/nueva-caracteristica`)
3. Haz commit de tus cambios (`git commit -m 'Añade nueva característica'`)
4. Empuja a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT. 