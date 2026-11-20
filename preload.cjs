const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'inkmath',
  Object.fromEntries([
    ...[
      'load-library',
      'save-library',
      'compile',
      'cancel-compile',
      'export-pdf',
      'export-tex',
      'import-file',
      'backup-library',
      'open-guide',
      'default-pdf',
      'close-app',
    ].map((name) => [name, (data) => ipcRenderer.invoke(name, data)]),
    ['onProgress', (fn) => ipcRenderer.on('compile-progress', (_, text) => fn(text))],
    ['onClose', (fn) => ipcRenderer.on('before-close', () => fn())],
  ]),
);
