const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './src/assets/app-icon',
    // Nombre del ejecutable sin espacios para evitar problemas con Squirrel (dummy update.exe)
    executableName: 'InventarioPro',
    // Evita que electron-packager intente procesar archivos .env inexistentes
    // (corrige error ENOENT lstat .env durante "Finalizing package" en Windows)
    ignore: [
      // Cualquier .env en la raíz o subcarpetas (incluye .env.local, etc.)
      /(^|[\\/])\.env(\..*)?$/,
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'inventory-suit',
        authors: 'SuitCore',
        // Debe coincidir con packagerConfig.executableName + '.exe'
        exe: 'InventarioPro.exe',
        setupIcon: './src/assets/app-icon.ico',
        loadingGif: './src/assets/installer.gif'
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
