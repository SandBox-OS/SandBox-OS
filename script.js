let highestZIndex = 10;
const openAppsList = {}; 

const gridX = 90; 
const gridY = 90; 

let currentFolder = 'downloads';
let virtualFileSystem = {
    downloads: [],
    imagens: [],
    videos: []
};

function initializeOS() {
    const savedBg = localStorage.getItem("sandboxos_bg");
    if (savedBg) applyBackgroundLogic(savedBg);

    const savedText = localStorage.getItem("sandboxos_note_text");
    const textarea = document.getElementById("notepad-textarea");
    if (textarea) textarea.value = savedText || "";

    const savedFiles = localStorage.getItem("sandboxos_files");
    if (savedFiles) virtualFileSystem = JSON.parse(savedFiles);

    renderWallpaperHistory();

    document.querySelectorAll('.draggable-shortcut').forEach(function(shortcut) {
        const coords = localStorage.getItem("pos_" + shortcut.id);
        if (coords) {
            const pos = JSON.parse(coords);
            shortcut.style.top = pos.top;
            shortcut.style.left = pos.left;
        }
        makeShortcutDraggable(shortcut);
        
        shortcut.removeAttribute('onclick');
        shortcut.ondblclick = function(e) {
            e.stopPropagation();
            const appId = shortcut.id.replace('shortcut-', '');
            openApp(appId);
        };
    });

    document.querySelectorAll('.window').forEach(function(win) {
        makeDraggableAndResizable(win);
        win.addEventListener('mousedown', () => focusWindow(win));
    });

    updateClockEngine();
    setInterval(updateClockEngine, 1000);
}

document.addEventListener("DOMContentLoaded", initializeOS);

function updateClockEngine() {
    const timeEl = document.getElementById("clock-time");
    const dateEl = document.getElementById("clock-date");
    if (!timeEl || !dateEl) return;
    const now = new Date();
    let hours = String(now.getHours()).padStart(2, '0');
    let minutes = String(now.getMinutes()).padStart(2, '0');
    let seconds = String(now.getSeconds()).padStart(2, '0');
    timeEl.innerText = `${hours}:${minutes}:${seconds}`;
    
    let day = String(now.getDate()).padStart(2, '0');
    let month = String(now.getMonth() + 1).padStart(2, '0');
    let year = now.getFullYear();
    dateEl.innerText = `${day}/${month}/${year}`;
}

// --- 🎨 WALLPAPERS ---
function uploadWallpaper(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Image = "url('" + e.target.result + "')";
        changeBackground(base64Image);

        let history = JSON.parse(localStorage.getItem("sandboxos_bg_history")) || [];
        if (!history.includes(base64Image)) {
            history.unshift(base64Image);
            if (history.length > 4) history.pop();
            localStorage.setItem("sandboxos_bg_history", JSON.stringify(history));
            renderWallpaperHistory();
        }
    };
    reader.readAsDataURL(file);
}

function renderWallpaperHistory() {
    const container = document.getElementById("wallpaper-history-grid");
    if (!container) return;
    container.innerHTML = "";
    let history = JSON.parse(localStorage.getItem("sandboxos_bg_history")) || [];
    
    history.forEach(function(bgData) {
        const ball = document.createElement("div");
        ball.className = "color-ball";
        ball.style.background = bgData;
        ball.onclick = function() { changeBackground(bgData); };
        container.appendChild(ball);
    });
}

// --- 🖱️ DRAG & DROP ÍCONES ---
function makeShortcutDraggable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;

    elmnt.onmousedown = function(e) {
        e = e || window.event;
        e.stopPropagation();
        isDragging = false;
        pos3 = e.clientX; 
        pos4 = e.clientY;
        document.onmouseup = closeDragShortcut;
        document.onmousemove = dragShortcut;
    };

    function dragShortcut(e) {
        e = e || window.event; 
        e.preventDefault(); 
        isDragging = true;
        pos1 = pos3 - e.clientX; 
        pos2 = pos4 - e.clientY; 
        pos3 = e.clientX; 
        pos4 = e.clientY;

        let newTop = elmnt.offsetTop - pos2; 
        let newLeft = elmnt.offsetLeft - pos1;
        const maxW = window.innerWidth - 85; 
        const maxH = window.innerHeight - 130;

        if (newTop < 10) newTop = 10; 
        if (newLeft < 10) newLeft = 10;
        if (newLeft > maxW) newLeft = maxW; 
        if (newTop > maxH) newTop = maxH;

        elmnt.style.top = newTop + "px"; 
        elmnt.style.left = newLeft + "px";
    }

    function closeDragShortcut() {
        document.onmouseup = null; 
        document.onmousemove = null;

        if (isDragging) {
            let snappedLeft = Math.round((elmnt.offsetLeft - 10) / gridX) * gridX + 20;
            let snappedTop = Math.round((elmnt.offsetTop - 10) / gridY) * gridY + 20;
            let positionOccupied = true;

            while (positionOccupied) {
                positionOccupied = false;
                const shortcuts = document.querySelectorAll('.draggable-shortcut');
                for (let i = 0; i < shortcuts.length; i++) {
                    const other = shortcuts[i];
                    if (other.id !== elmnt.id) {
                        if (other.style.left === snappedLeft + "px" && other.style.top === snappedTop + "px") {
                            positionOccupied = true; 
                            break;
                        }
                    }
                }
                if (positionOccupied) snappedTop += gridY;
            }

            const maxH = window.innerHeight - 130;
            if (snappedTop > maxH) { 
                snappedTop = 20; 
                snappedLeft += gridX; 
            }

            elmnt.style.left = snappedLeft + "px"; 
            elmnt.style.top = snappedTop + "px";
            localStorage.setItem("pos_" + elmnt.id, JSON.stringify({ top: elmnt.style.top, left: elmnt.style.left }));
        }
    }
}

// --- 📁 EXPLORADOR DE ARQUIVOS ---
function switchFolder(folderName) {
    currentFolder = folderName;
    document.querySelectorAll('.file-manager-sidebar button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById("folder-btn-" + folderName);
    if (activeBtn) activeBtn.classList.add('active');
    renderFiles();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const newFile = { name: file.name, type: file.type };
    virtualFileSystem[currentFolder].push(newFile);
    localStorage.setItem("sandboxos_files", JSON.stringify(virtualFileSystem));
    renderFiles();
}

function renderFiles() {
    const container = document.getElementById("file-list-container");
    if (!container) return;
    container.innerHTML = "";

    const filesInFolder = virtualFileSystem[currentFolder];

    if (filesInFolder.length === 0) {
        container.innerHTML = "<p style='color:#999; font-size:13px; padding:10px;'>Esta pasta está vazia.</p>";
        return;
    }

    filesInFolder.forEach(function(file) {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";

        let icon = "📄";
        if (file.type.startsWith("image/")) icon = "🖼️";
        else if (file.type.startsWith("video/")) icon = "🎬";
        else if (file.type.includes("pdf")) icon = "📕";

        fileItem.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-name" title="${file.name}">${file.name}</div>
        `;
        container.appendChild(fileItem);
    });
}

// --- 🧮 CALCULADORA ---
function pressCalcNum(num) {
    const screen = document.getElementById("calc-screen");
    if (screen) {
        if (screen.value === "0" || screen.value === "Erro") screen.value = "";
        screen.value += num;
    }
}

function pressCalcOp(op) {
    const screen = document.getElementById("calc-screen");
    if (!screen || screen.value === "Erro") return;
    let currentVal = screen.value;
    if (currentVal === "") return;
    const lastChar = currentVal.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) return; 
    screen.value += op; 
}

function clearCalc() {
    const screen = document.getElementById("calc-screen");
    if (screen) screen.value = "";
}

function calculateResult() {
    const screen = document.getElementById("calc-screen");
    if (!screen || screen.value === "") return;
    try {
        const sanitizedExpression = screen.value.replace(/[^0-9+\-*/.]/g, '');
        const result = Function(`'use strict'; return (${sanitizedExpression})`)();
        screen.value = Number.isFinite(result) ? result : "Erro";
    } catch (err) {
        screen.value = "Erro";
    }
}

function saveNoteText() {
    const textarea = document.getElementById("notepad-textarea");
    if (textarea) localStorage.setItem("sandboxos_note_text", textarea.value);
}

// --- 🪟 JANELAS ---
function openApp(appId) {
    const win = document.getElementById("win-" + appId);
    if (win) {
        win.style.display = 'flex';
        focusWindow(win);
        if (!openAppsList[appId]) {
            openAppsList[appId] = { maximized: false, prevStyle: {} };
            updateTaskbar();
        }
        if (appId === 'files') renderFiles();
    }
}

function makeDraggableAndResizable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(elmnt.id + "-header");
    if (header) header.onmousedown = dragMouseDown;

    ['top', 'bottom', 'left', 'right'].forEach(dir => {
        const border = elmnt.querySelector(`.border-${dir}`);
        if (border) border.onmousedown = dragMouseDown;
    });

    function dragMouseDown(e) {
        const appId = elmnt.id.replace('win-', '');
        if (openAppsList[appId] && openAppsList[appId].maximized) return;
        e = e || window.event;
        if (['BUTTON', 'INPUT', 'LABEL', 'TEXTAREA'].includes(e.target.tagName)) return; 
        e.preventDefault();
        pos3 = e.clientX; 
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event; 
        e.preventDefault();
        pos1 = pos3 - e.clientX; 
        pos2 = pos4 - e.clientY; 
        pos3 = e.clientX; 
        pos4 = e.clientY;

        let newTop = elmnt.offsetTop - pos2; 
        let newLeft = elmnt.offsetLeft - pos1;
        const rect = elmnt.getBoundingClientRect();

        if (newTop < 0) newTop = 0; 
        if (newLeft < 0) newLeft = 0;
        if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
        if (newTop + rect.height > window.innerHeight - 45) newTop = window.innerHeight - 45 - rect.height;

        elmnt.style.top = newTop + "px"; 
        elmnt.style.left = newLeft + "px";
    }

    function closeDragElement() { 
        document.onmouseup = null; 
        document.onmousemove = null; 
    }

    const resizeHandle = elmnt.querySelector('.window-resize-handle');
    if (resizeHandle) {
        resizeHandle.onmousedown = function(e) {
            e.preventDefault(); 
            e.stopPropagation(); 
            pos3 = e.clientX; 
            pos4 = e.clientY;
            document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
            document.onmousemove = function(e) {
                e.preventDefault();
                let widthDiff = e.clientX - pos3; 
                let heightDiff = e.clientY - pos4;
                pos3 = e.clientX; 
                pos4 = e.clientY;
                let currentWidth = parseInt(window.getComputedStyle(elmnt).width);
                let currentHeight = parseInt(window.getComputedStyle(elmnt).height);
                if (currentWidth + widthDiff > 250) elmnt.style.width = (currentWidth + widthDiff) + "px";
                if (currentHeight + heightDiff > 150) elmnt.style.height = (currentHeight + heightDiff) + "px";
            };
        };
    }
}

function closeApp(appId) {
    const win = document.getElementById("win-" + appId);
    if (win) {
        win.style.display = 'none';
        delete openAppsList[appId]; 
        updateTaskbar();
    }
}

function focusWindow(elmnt) {
    highestZIndex++;
    elmnt.style.zIndex = highestZIndex;
    document.querySelectorAll('.taskbar-button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById("tb-" + elmnt.id.replace('win-', ''));
    if (activeBtn) activeBtn.classList.add('active');
}

function minimizeApp(appId) {
    const win = document.getElementById("win-" + appId);
    if (win) {
        win.style.display = 'none';
        const activeBtn = document.getElementById("tb-" + appId);
        if (activeBtn) activeBtn.classList.remove('active');
    }
}

function maximizeApp(appId) {
    const win = document.getElementById("win-" + appId);
    if (!win) return;
    if (!openAppsList[appId].maximized) {
        openAppsList[appId].prevStyle = {
            top: win.style.top, left: win.style.left, width: win.style.width, height: win.style.height
        };
        win.style.top = '0px'; 
        win.style.left = '0px'; 
        win.style.width = '100%'; 
        win.style.height = 'calc(100vh - 45px)';
        openAppsList[appId].maximized = true;
    } else {
        const prev = openAppsList[appId].prevStyle;
        win.style.top = prev.top; 
        win.style.left = prev.left; 
        win.style.width = prev.width; 
        win.style.height = prev.height;
        openAppsList[appId].maximized = false;
    }
}

function updateTaskbar() {
    const container = document.getElementById('taskbar-apps');
    if (!container) return;
    container.innerHTML = ''; 
    Object.keys(openAppsList).forEach(function(appId) {
        const btn = document.createElement('button');
        btn.id = "tb-" + appId;
        btn.className = 'taskbar-button';
        const nameMap = { 
            'notepad': '📝 Bloco de Notas', 
            'settings': '⚙️ Configurações', 
            'calc': '🧮 Calculadora', 
            'files': '📁 Meus Arquivos' 
        };
        btn.innerText = nameMap[appId] || appId;
        btn.onclick = function() {
            const win = document.getElementById("win-" + appId);
            if (win.style.display === 'none') {
                win.style.display = 'flex';
                focusWindow(win);
            } else {
                minimizeApp(appId);
            }
        };
        container.appendChild(btn);
    });
}

function toggleStartMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById("start-menu");
    if (menu) menu.style.display = (menu.style.display === "none" || !menu.style.display) ? "flex" : "none";
}

function openAppFromStart(appId) {
    openApp(appId);
    document.getElementById("start-menu").style.display = "none";
}

function closeStartMenuOutside(event) {
    const menu = document.getElementById("start-menu");
    if (menu && menu.style.display === "flex") menu.style.display = "none";
}

function clearSystemData() {
    if (confirm("Deseja redefinir o sistema? Isso limpará posições de ícones, arquivos e dados salvos.")) {
        localStorage.clear();
        window.location.reload();
    }
}

function changeBackground(colorOrType) {
    applyBackgroundLogic(colorOrType);
    localStorage.setItem("sandboxos_bg", colorOrType);
}

function applyBackgroundLogic(colorOrType) {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    if (colorOrType === 'image') {
        desktop.style.background = "url('https://picsum.photos/1920/1080') no-repeat center center";
        desktop.style.backgroundSize = "cover";
    } else if (colorOrType.startsWith("url(")) {
        desktop.style.background = colorOrType + " no-repeat center center";
        desktop.style.backgroundSize = "cover";
    } else {
        desktop.style.background = colorOrType;
    }
}
