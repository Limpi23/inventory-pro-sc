# 🚀 Deployment y CI/CD - Inventario Pro

Este documento explica cómo funciona el sistema de construcción y despliegue automático para **Inventario Pro**.

## 📋 Workflows Configurados

### 1. **Build and Test** (`build.yml`)
- **Trigger**: Push a `main`, `master`, `develop` + Pull Requests
- **Propósito**: Verificar que el código compile correctamente
- **Outputs**: Artifacts temporales (7 días de retención)

### 2. **Auto Build on Push** (`auto-build.yml`) 
- **Trigger**: Push a `main` o `master`
- **Propósito**: Generar builds de desarrollo automáticas
- **Outputs**: 
  - Development releases con tag `dev-vX.X.X-YYYY-MM-DD-HASH`
  - Artifacts por 30 días

### 3. **Build and Release** (`release.yml`)
- **Trigger**: Tags `v*.*.*` o manual
- **Propósito**: Crear releases oficiales
- **Outputs**: Release completo con todos los archivos

## 🔄 Flujo de Trabajo

### Desarrollo Diario
```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```
✅ Se ejecutará automáticamente `auto-build.yml` y creará una development build.

### Saltarse el CI
```bash
git commit -m "docs: actualizar README [skip ci]"
```
✅ No se ejecutará el build automático.

### Release Oficial
```bash
# Opción 1: Crear tag
git tag v1.4.3
git push origin v1.4.3

# Opción 2: Manual desde GitHub Actions
# Ve a Actions > Build and Release > Run workflow
```

## 📦 Tipos de Release

### 🔧 Development Builds
- **Ubicación**: GitHub Releases (prerelease)
- **Naming**: `dev-v1.4.2-2025-01-05-abc1234`
- **Contenido**: Instalador + archivos de actualización
- **Uso**: Testing interno, QA

### 🚀 Official Releases  
- **Ubicación**: GitHub Releases (latest)
- **Naming**: `v1.4.3`
- **Contenido**: Instalador + documentación completa
- **Uso**: Distribución pública

## 🛠️ Archivos Generados

Cada build genera los siguientes archivos:

### Windows
| Archivo | Descripción | Uso |
|---------|-------------|-----|
| `inventory-suit-vX.X.X-Setup.exe` | Instalador completo Windows | Distribución a usuarios |
| `inventory-suit-vX.X.X-full.nupkg` | Paquete de actualización | Sistema de auto-update |
| `RELEASES` | Metadatos de versión Windows | Control de versiones |
| `latest.yml` | Configuración auto-update | Electron-updater |

### macOS
| Archivo | Descripción | Uso |
|---------|-------------|-----|
| `Inventario-Pro-vX.X.X-x64.dmg` | Instalador Mac Intel | Distribución a usuarios Intel |
| `Inventario-Pro-vX.X.X-arm64.dmg` | Instalador Mac Apple Silicon | Distribución a usuarios M1/M2/M3 |
| `Inventario-Pro-vX.X.X-x64-mac.zip` | Versión portable Intel | Alternativa al DMG |
| `Inventario-Pro-vX.X.X-arm64-mac.zip` | Versión portable Apple Silicon | Alternativa al DMG |
| `latest-mac.yml` | Configuración auto-update macOS | Electron-updater |

## ⚙️ Configuración Local

### Variables de Entorno (Opcional)
```bash
# Para builds locales
ELECTRON_BUILDER_COMPRESSION_LEVEL=9
ELECTRON_BUILDER_CACHE=$HOME/.cache/electron-builder
```

### Scripts Disponibles
```bash
# Desarrollo
npm run dev:electron          # Ejecutar en modo desarrollo
npm run build                # Build para producción

# Windows
npm run make:win             # Generar instalador Windows
npm run build:nsis           # Build con electron-builder (Windows)
npm run publish:nsis         # Build y publicar Windows

# macOS
npm run build:mac            # Generar instaladores macOS (x64 + arm64)
npm run build:mac:x64        # Solo Intel
npm run build:mac:arm64      # Solo Apple Silicon
npm run publish:mac          # Build y publicar macOS

# CI/CD
npm run lint                 # Verificar código
npm run build:preload        # Build del preload script
```

## 🔒 Permisos Requeridos

Los workflows necesitan los siguientes permisos:
- `contents: write` - Para crear releases y subir archivos
- `actions: read` - Para acceder a artifacts

## 🐛 Troubleshooting

### Build Falla en CI
1. **Revisar logs** en la pestaña Actions
2. **Verificar localmente**: `npm run make:win`
3. **Dependencias**: Asegurar que `package-lock.json` esté actualizado

### Release No Se Crea
1. **Verificar permisos** del token GitHub
2. **Revisar naming** del tag (debe ser `v*.*.*`)
3. **Confirmar que el workflow** esté habilitado

### Archivos Faltantes
1. **Verificar paths** en los workflows
2. **Confirmar que el build** termine exitosamente
3. **Revisar .gitignore** para archivos excluidos

## 📁 Estructura de Artifacts

### Windows (Electron Forge)
```
out/make/squirrel.windows/x64/
├── inventory-suit-1.4.2 Setup.exe     # Instalador principal
├── inventory-suit-1.4.2-full.nupkg    # Paquete de actualización
├── RELEASES                            # Archivo de metadatos
└── latest.yml                          # Auto-update config
```

### macOS (Electron Builder)
```
dist-builder/
├── C.O.M.P.A-1.4.2-x64.dmg            # Instalador Intel
├── C.O.M.P.A-1.4.2-arm64.dmg          # Instalador Apple Silicon
├── C.O.M.P.A-1.4.2-x64-mac.zip        # Portable Intel
├── C.O.M.P.A-1.4.2-arm64-mac.zip      # Portable Apple Silicon
└── latest-mac.yml                      # Auto-update config
```

## 🍎 Consideraciones para macOS

### Code Signing (Opcional)
Para distribución en producción, considera firmar la aplicación:
```bash
# Requiere Apple Developer Account
export APPLE_ID="tu-email@ejemplo.com"
export APPLE_ID_PASSWORD="app-specific-password"
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"
```

### Notarización (Opcional)
Para evitar advertencias de seguridad en macOS:
```bash
# Agregar a electron-builder.yml
afterSign: "scripts/notarize.js"
```

## 🚀 Próximos Pasos

- [x] Configurar builds para macOS
- [ ] Configurar notificaciones Slack/Discord
- [ ] Agregar tests automatizados
- [ ] Implementar firma de código para macOS
- [ ] Configurar notarización de macOS
- [ ] Configurar auto-deploy a servidores de actualización

---

**Desarrollado por SuitCore** | [Volver al README](./README.md) 