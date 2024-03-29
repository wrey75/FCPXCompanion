module.exports = {
  packagerConfig: {
    asar: true,
    icon: './AppIcon'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
        name: '@electron-forge/plugin-webpack',
        config: {
          mainConfig: './webpack.main.config.js',
          renderer: {
            config: './webpack.renderer.config.js',
            entryPoints: [{
              name: 'main_window',
              html: './src/renderer/index.html',
              js: './src/renderer/index.js',
              preload: {
                js: './src/preload.js'
              }
            }]
          }
        }
      }
  ],
};
