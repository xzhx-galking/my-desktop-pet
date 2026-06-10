console.log('process.type:', process.type);
console.log('process.noAsar:', process.noAsar);
console.log('process.resourcesPath:', process.resourcesPath);

// Check what the global scope contains
const electronKeys = Object.keys(globalThis).filter(k => 
  k.toLowerCase().includes('electron') || k === 'app' || k === 'BrowserWindow'
);
console.log('global keys:', electronKeys);

// Check if process has electron properties
const procKeys = Object.getOwnPropertyNames(process).filter(k => 
  k.includes('electron') || k.includes('Electron')
);
console.log('process keys:', procKeys);

process.exit(0);
