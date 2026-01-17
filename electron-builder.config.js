module.exports = {
  appId: 'com.example.eaters-react-electron',
  productName: 'Eaters App',
  directories: {
    output: 'dist',
  },
  files: ['dist/**/*', 'electron/**/*', 'package.json'],
  win: {
    target: 'nsis',
  },
  linux: {
    target: 'AppImage',
  },
};
