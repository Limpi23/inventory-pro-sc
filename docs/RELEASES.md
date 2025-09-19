# Release Runbook (Windows)

Este documento describe el flujo recomendado para publicar una versión con instalador en GitHub y que los clientes reciban la actualización automática (autoUpdater).

## Requisitos previos
- Repo público en GitHub (o configurar feed genérico/token si es privado).
- `package.json` con `version` semver correcta (ej. 1.4.8).
- Workflows de GitHub Actions activos en `.github/workflows/`.
- La app incluye en el menú: Herramientas → “Buscar actualizaciones”.

## Opción A (recomendada): Release por TAG
1) Verifica/actualiza la versión en `package.json`.
2) Crea y empuja el tag con prefijo `v` (ej. `v1.4.8`).

```powershell
git fetch origin
git switch main
git pull

# Tag anotado
git tag -a v1.4.8 -m "Release v1.4.8"
# Empujar tag (dispara release.yml)
git push origin v1.4.8
```

Qué ocurre:
- Corre `release.yml`, construye y publica un Release con:
  - `inventory-suit-1.4.8 Setup.exe`
  - `inventory-suit-1.4.8-full.nupkg`
  - `RELEASES`
- Los clientes verán la actualización al iniciar o desde “Buscar actualizaciones”.

## Opción B: Push a main con [release]
1) Deja la versión lista en `package.json`.
2) Haz un commit con `[release]` en el mensaje (puede ser vacío):

```powershell
git commit --allow-empty -m "chore: publish 1.4.8 [release]"
git push
```

Qué ocurre:
- Corre `auto-release-latest.yml`, crea/actualiza un Release para esa versión con los artefactos.

## Scripts útiles
Puedes añadir scripts para facilitar el release por tag:

```json
{
  "scripts": {
    "release:tag:patch": "npm version patch -m 'chore: release v%s' && git push && git push --tags",
    "release:tag:minor": "npm version minor -m 'chore: release v%s' && git push && git push --tags",
    "release:tag:major": "npm version major -m 'chore: release v%s' && git push && git push --tags"
  }
}
```

Luego de ejecutar, se dispara automáticamente el workflow `release.yml`.

## Verificación
- GitHub → Releases: debe existir "Inventario Pro vX.Y.Z" con `Setup.exe`, `.nupkg` y `RELEASES`.
- En la app: Herramientas → “Buscar actualizaciones” debería detectar e iniciar descarga.

## Troubleshooting
- "Artifact storage quota has been hit":
  - No afecta a los Releases estables (suben como assets del Release).
  - El workflow `build-windows.yml` solo sube artifacts al almacenamiento de Actions cuando lo ejecutas manualmente (para evitar agotar la cuota en cada push).
- Si el Release se crea pero falta algún archivo:
  - Verifica que el nombre de los archivos coincida con la versión sin prefijo `v` (ya manejado en `release.yml`).
- Repo privado:
  - Considera usar `generic provider` en `electron-updater` o un token para descargas.

---

Listo. Con este flujo, publicar un tag `vX.Y.Z` es suficiente para que los clientes puedan actualizarse automáticamente.