# 🍎 Configuración de Builds para macOS

## ✅ ¿Qué se configuró?

Se agregó soporte completo para generar instaladores de macOS con el mismo flujo que Windows.

### Archivos Modificados:
1. **`electron-builder.yml`** - Configuración de build para macOS
2. **`.github/workflows/release.yml`** - Job de CI/CD para macOS
3. **`package.json`** - Scripts para builds locales
4. **`DEPLOYMENT.md`** - Documentación actualizada

### Archivos Nuevos:
1. **`build/entitlements.mac.plist`** - Permisos de seguridad para macOS

## 🚀 Flujo de Release (Sin Cambios)

El flujo sigue siendo exactamente el mismo:

```bash
# 1. Crear nueva versión y tag
npm version patch  # o minor, major

# 2. Pushear a GitHub
git push origin main --tags

# 3. GitHub Actions automáticamente:
#    ✅ Detecta el tag v*.*.*
#    ✅ Genera build de Windows
#    ✅ Genera build de macOS (NUEVO)
#    ✅ Crea release con todos los instaladores
```

## 📦 Archivos Generados en el Release

Después del build, el release incluirá:

### Windows
- `inventory-suit-X.X.X-Setup.exe`
- `inventory-suit-X.X.X-full.nupkg`
- `RELEASES`
- `latest.yml`

### macOS (NUEVO)
- `Inventario-Pro-X.X.X-x64.dmg` (Intel)
- `Inventario-Pro-X.X.X-arm64.dmg` (Apple Silicon)
- `Inventario-Pro-X.X.X-x64-mac.zip` (Intel portable)
- `Inventario-Pro-X.X.X-arm64-mac.zip` (Apple Silicon portable)
- `latest-mac.yml`

## 🛠️ Builds Locales (Opcional)

Si quieres generar builds de macOS localmente:

```bash
# Ambas arquitecturas (requiere Mac)
npm run build:mac

# Solo Intel
npm run build:mac:x64

# Solo Apple Silicon
npm run build:mac:arm64
```

Los archivos se generan en `dist-builder/`

## 📝 Notas Importantes

### Requisitos de GitHub Actions
- El runner de macOS (`macos-latest`) está incluido en GitHub Actions
- No requiere configuración adicional en tu repo

### Iconos
- Windows usa: `src/assets/app-icon.ico` ✅
- macOS: Genera icono automáticamente desde el .ico

### Code Signing (Opcional)
Por ahora, las apps de macOS **NO están firmadas**. Los usuarios verán una advertencia de seguridad que pueden omitir en Preferencias del Sistema.

Para firmar la app en el futuro (requiere Apple Developer Account):
1. Agregar secrets en GitHub:
   - `APPLE_ID`
   - `APPLE_ID_PASSWORD`
   - `CSC_LINK` (certificado)
   - `CSC_KEY_PASSWORD`

2. Descomentar opciones de firma en `electron-builder.yml`

## ⚡ Próximo Release

La próxima vez que hagas:

```bash
npm version patch
git push origin main --tags
```

Obtendrás instaladores para **Windows Y macOS** automáticamente! 🎉

## 🐛 Troubleshooting

### El build de macOS falla en CI
- Verificar que `electron-builder` esté en las dependencias
- Revisar logs en la pestaña Actions de GitHub

### Los usuarios de Mac no pueden abrir la app
Es normal si no está firmada. Instrucciones para usuarios:
1. Click derecho en la app
2. Seleccionar "Abrir"
3. Confirmar en el diálogo de seguridad

O:
1. Preferencias del Sistema > Seguridad y Privacidad
2. Click en "Abrir de todas formas"

---

**¿Dudas?** Revisa `DEPLOYMENT.md` para más detalles.
