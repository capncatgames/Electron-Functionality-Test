const { ipcRenderer } = window.electronAPI;
const canvas = document.getElementById('selectCanvas');
const ctx = canvas.getContext('2d');
let isSelecting = false, startX, startY, endX, endY;

canvas.addEventListener('mousedown', (e) => {
    isSelecting = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    endX = startX;
    endY = startY;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    const rect = canvas.getBoundingClientRect();
    endX = e.clientX - rect.left;
    endY = e.clientY - rect.top;
    drawSelection();
});

canvas.addEventListener('mouseup', (e) => {
    isSelecting = false;
    const rect = canvas.getBoundingClientRect();
    endX = e.clientX - rect.left;
    endY = e.clientY - rect.top;
    drawSelection();
    // 좌표 계산
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);
    // 좌표 기능 창에 전달
    ipcRenderer.send('area-selected', { x, y, width: w, height: h });
    canvas.style.pointerEvents = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function drawSelection() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setLineDash([6]);
    ctx.strokeStyle = '#00f';
    ctx.lineWidth = 2;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);
    ctx.strokeRect(x, y, w, h);
}

window.electronAPI.onEnableDrag(() => {
    console.log("[overlay] drag mode enabled");
    // show semi-transparent black full-screen backdrop
    document.getElementById('backdrop').style.background = 'rgba(0,0,0,0.5)';
    // now allow canvas to receive pointer events for drawing
    const canvas = document.getElementById('selectCanvas');
    canvas.style.pointerEvents = 'auto';
});

// And when drag ends (in your mouseup handler), reset backdrop:
canvas.addEventListener('mouseup', (e) => {
    // ... existing mouseup logic ...
    // hide the tint again
    document.getElementById('backdrop').style.background = 'rgba(0,0,0,0)';
});