// Try to initialize electron runtime
try {
  // In Electron, the runtime is initialized via electron/js2c/node_init
  // But it needs to be called in the right context
  const init = require('electron/js2c/node_init');
  console.log('init type:', typeof init);
  console.log('init:', Object.keys(init).slice(0, 10));
} catch(e) {
  console.log('init error:', e.message);
}

// Check if process._linkedBinding has any bindings
try {
  const list = process._linkedBinding('electron_browser');
  console.log('electron_browser binding found');
} catch(e) {
  console.log('electron_browser:', e.message);
}

process.exit(0);
