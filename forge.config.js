module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'src/assets/app-icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-wix',
      config: {
        language: 3082,
        description: 'Inventario Pro - SC',
        manufacturer: 'SuitCore',
        exe: 'inventory-suit.exe',
        name: 'inventory-suit'
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new (require('@electron-forge/plugin-fuses').FusesPlugin)({
      version: require('@electron/fuses').FuseVersion.V1,
      [require('@electron/fuses').FuseV1Options.RunAsNode]: false,
      [require('@electron/fuses').FuseV1Options.EnableCookieEncryption]: true,
      [require('@electron/fuses').FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [require('@electron/fuses').FuseV1Options.EnableNodeCliInspectArguments]: false,
      [require('@electron/fuses').FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [require('@electron/fuses').FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
