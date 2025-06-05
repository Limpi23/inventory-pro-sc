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

| Archivo | Descripción | Uso |
|---------|-------------|-----|
| `inventory-suit-vX.X.X Setup.exe` | Instalador completo | Distribución a usuarios |
| `inventory-suit-vX.X.X-full.nupkg` | Paquete de actualización | Sistema de auto-update |
| `RELEASES` | Metadatos de versión | Control de versiones |

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
npm run make:win             # Generar instalador Windows

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

```
out/make/squirrel.windows/x64/
├── inventory-suit-1.4.2 Setup.exe     # Instalador principal
├── inventory-suit-1.4.2-full.nupkg    # Paquete de actualización
└── RELEASES                            # Archivo de metadatos
```

## 🚀 Próximos Pasos

- [ ] Configurar notificaciones Slack/Discord
- [ ] Agregar tests automatizados
- [ ] Configurar builds para macOS/Linux
- [ ] Implementar firma de código
- [ ] Configurar auto-deploy a servidores de actualización

---

**Desarrollado por SuitCore** | [Volver al README](./README.md) 