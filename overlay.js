const { ipcRenderer } = window.electronAPI;
const canvas = document.getElementById('selectCanvas');
const ctx = canvas.getContext('2d');
let isSelecting = false, startX, startY, endX, endY;

canvas.addEventListener('mousedown', (e) => {
    isSelecting = true;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;
    endX = startX;
    endY = startY;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    endX = (e.clientX - rect.left) * scaleX;
    endY = (e.clientY - rect.top) * scaleY;
    drawSelection();
});

canvas.addEventListener('mouseup', e => {
    isSelecting=false;
    const { left, top, width: cw, height: ch } = canvas.getBoundingClientRect();
    const scaleX=canvas.width/cw, scaleY=canvas.height/ch;
    endX=(e.clientX-left)*scaleX;
    endY=(e.clientY-top)*scaleY;
    drawSelection();
    // 계산된 영역을 main으로 전송
    const area = {
        x: Math.min(startX,endX),
        y: Math.min(startY,endY),
        width: Math.abs(endX-startX),
        height: Math.abs(endY-startY)
    };

    window.electronAPI.sendMessage('request-drag-finish', area);

    canvas.style.pointerEvents = 'none';
    document.getElementById('backdrop').style.background = 'rgba(0,0,0,0)';
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
    document.getElementById('backdrop').style.background='rgba(0,0,0,0.5)';
    canvas.style.pointerEvents='auto';
});
