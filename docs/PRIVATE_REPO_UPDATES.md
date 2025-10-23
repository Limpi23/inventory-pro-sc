# 🔐 Configuración de Actualizaciones con Repositorio Privado

## Problema Actual

Tu repositorio `Limpi23/inventory-pro-sc` es **PRIVADO**, lo que causa el error 404 al buscar actualizaciones:

```
Error: HttpError: 404
method: GET url: https://github.com/Limpi23/inventory-pro-sc/releases.atom
```

## ✅ Soluciones

### Opción 1: Hacer el Repositorio Público (RECOMENDADO)

Esta es la forma más común y simple para distribuir aplicaciones Electron con auto-update.

**Ventajas:**
- ✅ No requiere tokens de autenticación
- ✅ Las actualizaciones funcionan para todos los usuarios
- ✅ Compatible nativo con `electron-updater`
- ✅ Sin límites de rate en GitHub API
- ✅ Es el estándar de la industria (VS Code, Atom, Discord, etc.)

**Desventajas:**
- ⚠️ El código fuente será visible públicamente
- ⚠️ Los binarios (.exe) serán descargables por cualquiera

**Cómo hacerlo:**

```bash
# Opción A: Usar GitHub CLI
gh repo edit --visibility public

# Opción B: Usar la interfaz web
# 1. Ve a https://github.com/Limpi23/inventory-pro-sc/settings
# 2. Scroll hasta "Danger Zone"
# 3. Clic en "Change repository visibility"
# 4. Selecciona "Make public"
```

**Después de hacer público:**
1. Reinicia la aplicación
2. El auto-updater funcionará automáticamente
3. No necesitas configurar `GH_TOKEN`

---

### Opción 2: Mantener Privado + Token de GitHub

Si DEBES mantener el repositorio privado:

**⚠️ IMPORTANTE**: Esta opción tiene limitaciones significativas:
- Los usuarios finales NO podrán actualizar (no tienen tu token)
- Solo funcionará para desarrollo/testing
- **NO recomendado para producción**

**Pasos:**

1. **Crear Personal Access Token**:
   ```
   1. Ve a: https://github.com/settings/tokens
   2. Clic en "Generate new token (classic)"
   3. Nombre: "Inventory Pro Auto-Update"
   4. Scopes: Marca solo "repo"
   5. Genera y COPIA el token (ghp_xxxxx...)
   ```

2. **Configurar en .env**:
   ```bash
   # Edita el archivo .env en la raíz del proyecto
   GH_TOKEN=ghp_tu_token_aqui
   ```

3. **Reiniciar la aplicación**:
   ```bash
   npm run dev
   ```

**Limitación crítica**: El token quedará embebido en la aplicación empaquetada, lo que es un **riesgo de seguridad**. Cualquiera podría extraer el token del ejecutable.

---

### Opción 3: Servidor de Actualizaciones Personalizado

Si necesitas privacidad Y actualizaciones automáticas:

**Configuración:**
1. Aloja los archivos `RELEASES` y `.nupkg` en tu propio servidor
2. Configura la URL en `.env`:
   ```bash
   UPDATE_FEED_URL=https://tu-servidor.com/updates
   ```

**Estructura del servidor:**
```
https://tu-servidor.com/updates/
├── RELEASES (archivo de texto con metadata)
├── inventory-suit-1.7.1-full.nupkg
└── inventory-suit-Setup-1.7.1.exe
```

---

## 🎯 Recomendación Final

**Para una aplicación comercial de inventario**: Mantén el repositorio **PRIVADO** y usa la **Opción 3** (servidor propio).

**Para distribución gratuita/open source**: Haz el repositorio **PÚBLICO** (Opción 1).

**NUNCA uses la Opción 2 en producción** (token embebido).

---

## 📝 Próximos Pasos

1. **Decide qué opción usar** según tu modelo de negocio
2. Si eliges Opción 1, ejecuta: `gh repo edit --visibility public`
3. Si eliges Opción 3, necesitarás configurar un servidor de actualizaciones

¿Necesitas ayuda para configurar alguna de estas opciones?
