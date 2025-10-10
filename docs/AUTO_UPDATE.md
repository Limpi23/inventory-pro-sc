# Sistema de Actualizaciones Automáticas

## Configuración

La aplicación **Inventario Pro** utiliza `electron-updater` con **Squirrel.Windows** para proporcionar actualizaciones automáticas en Windows.

### Plataformas Soportadas
- ✅ **Windows**: Actualizaciones automáticas completas
- ❌ **macOS/Linux**: No soportado (la aplicación es solo para Windows)

## Cómo Funciona

### 1. Construcción y Publicación

Cuando se crea un nuevo release (mediante un tag `v*.*.*`):

```bash
git tag v1.7.1
git push origin v1.7.1
```

El workflow de GitHub Actions (`.github/workflows/release.yml`):
1. Construye la aplicación para Windows
2. Genera los siguientes archivos:
   - `inventory-suit-X.X.X-Setup.exe` - Instalador completo
   - `inventory-suit-X.X.X-full.nupkg` - Paquete de actualización
   - `RELEASES` - Archivo de metadatos para Squirrel.Windows
3. Crea un release en GitHub con estos archivos

### 2. Detección de Actualizaciones

La aplicación busca actualizaciones de dos formas:

#### Automática (en Producción)
- Se ejecuta 3 segundos después de iniciar la aplicación
- Solo en builds de producción (`NODE_ENV !== 'development'`)
- Solo en Windows

#### Manual
- Menú: **Ayuda > Buscar actualizaciones**
- El usuario puede verificar manualmente si hay nuevas versiones
- Muestra un mensaje si ya está actualizado

### 3. Configuración del Feed

El feed de actualizaciones está configurado en `electron.cjs`:

```javascript
autoUpdater.setFeedURL({ 
  provider: 'github',
  owner: 'Limpi23',
  repo: 'inventory-pro-sc'
});
```

`electron-updater` automáticamente:
- Busca el archivo `RELEASES` en los releases de GitHub
- Compara la versión actual con la disponible
- Descarga el archivo `.nupkg` si hay una actualización

## Proceso de Actualización

1. **Detección**: La app detecta una nueva versión
2. **Notificación**: Muestra un diálogo preguntando si descargar
3. **Descarga**: Si el usuario acepta, descarga el paquete `.nupkg`
4. **Instalación**: Al finalizar la descarga, pregunta si reiniciar
5. **Aplicación**: Al reiniciar, Squirrel instala la actualización

## Pruebas

### Probar en Desarrollo (macOS/Linux)
El auto-updater está **deshabilitado** en desarrollo para evitar el error que veías. El menú muestra un mensaje explicando que las actualizaciones solo funcionan en Windows.

### Probar en Windows

1. **Construir la versión actual**:
```bash
npm run build
npm run build:preload
npm run make:win
```

2. **Instalar la versión construida**:
```bash
# El Setup.exe estará en: out/make/squirrel.windows/x64/
```

3. **Crear un nuevo release con versión superior**:
```bash
# Incrementar versión en package.json
npm version patch  # o minor, o major

# Crear tag y push
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git tag v$(node -p "require('./package.json').version")
git push origin main --tags
```

4. **Probar la actualización**:
   - Esperar que GitHub Actions complete el build
   - Abrir la aplicación instalada
   - Ir a **Ayuda > Buscar actualizaciones**
   - Debería detectar la nueva versión

## Solución de Problemas

### Error 404 al buscar actualizaciones

**Síntoma**: Error "HttpError: 404 ... releases.atom"

**Causa**: La aplicación está ejecutándose en macOS/Linux durante desarrollo

**Solución**: 
- Este error es normal en desarrollo en macOS/Linux
- Las actualizaciones solo funcionan en Windows con la versión instalada
- El error ahora está manejado y muestra un mensaje apropiado

### No se detectan actualizaciones

**Verificar**:
1. ¿El release está publicado en GitHub?
2. ¿El release contiene los archivos `RELEASES` y `.nupkg`?
3. ¿La versión del release es superior a la instalada?
4. ¿Estás ejecutando desde el instalador o desde `npm run dev`?

**Solución**:
- Las actualizaciones solo funcionan con la app **instalada** desde el Setup.exe
- No funcionan cuando ejecutas `npm run dev` o `npm run start`

### Rate Limiting de GitHub API

Si obtienes errores de rate limit:

```javascript
// Agregar token de GitHub (opcional para repos públicos)
autoUpdater.setFeedURL({ 
  provider: 'github',
  owner: 'Limpi23',
  repo: 'inventory-pro-sc',
  token: process.env.GH_TOKEN  // Token personal de GitHub
});
```

## Variables de Entorno (Opcional)

### `UPDATE_FEED_URL`
Permite apuntar a un servidor de actualizaciones personalizado:

```bash
UPDATE_FEED_URL=https://tu-servidor.com/updates npm run start
```

### `GH_TOKEN`
Token de GitHub para evitar rate limits:

```bash
GH_TOKEN=ghp_xxxxxxxxxxxx npm run start
```

## Logs de Actualización

Los logs se guardan automáticamente gracias a `electron-log`:

- **Windows**: `%USERPROFILE%\AppData\Roaming\inventory-suit\logs\main.log`

Para ver logs en tiempo real, abrir DevTools y ver mensajes de consola.

## Referencias

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [Squirrel.Windows](https://github.com/Squirrel/Squirrel.Windows)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
