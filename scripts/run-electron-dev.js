const { spawn } = require('child_process');

const electronBinary = require('electron');

const child = spawn(electronBinary, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    ELECTRON_START_URL: 'http://localhost:3000',
  },
});

child.on('close', (code) => {
  process.exitCode = code ?? 0;
});
