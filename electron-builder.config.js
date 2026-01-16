module.exports = {
  appId: 'com.example.eaters-react-electron',
  productName: 'Eaters App',
  directories: {
    output: 'dist',
  },
  files: ['dist/**/*', 'electron/**/*', 'package.json'],
  mac: {
    category: 'public.app-category.productivity',
  },
  win: {
    target: 'nsis',
  },
  linux: {
    target: 'AppImage',
  },
};
