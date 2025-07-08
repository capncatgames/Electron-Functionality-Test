const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onScreenSource: (cb) => ipcRenderer.on('set-screen-source', (_, id) => cb(id)),
    sendBase64ToPython: (base64) => ipcRenderer.send('send-captured-base64', base64),
    onOCRResult: (cb) => ipcRenderer.on('ocr-result', (_, msg) => cb(msg)),
});
