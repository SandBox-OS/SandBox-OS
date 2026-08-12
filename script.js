// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://wkofppnubrxrlhvrzfir.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B0MrTnAMNF6o_-0LNBlBSA_QcyfeM8U';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'SUA_SUPABASE_URL_AQUI') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let isSignUpMode = true; // Alterna entre Criar Conta (true) e Fazer Login (false)

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

// Mapeamento de Ícones dos Apps
const appIcons = {
    'notepad': '📝',
    'settings': '⚙️',
    'calc': '🧮',
    'files': '📁'
};

// --- 🔐 GERENCIAMENTO DE SESSÃO E AUTENTICAÇÃO ---
async function checkUserSession() {
    if (!supabaseClient) {
        // Se ainda não configurou as chaves do Supabase, libera a tela normalmente em modo local
        document.getElementById("auth-modal-overlay").style.display = "none";
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        document.getElementById("auth-modal-overlay").style.display = "none";
        const username = session.user.user_metadata?.username || session.user.email.split('@')[0];
        updateUserInfoUI(username);
    } else {
        document.getElementById("auth-modal-overlay").style.display = "flex";
    }
}

function toggleAuthMode(event) {
    if (event) event.preventDefault();
    isSignUpMode = !isSignUpMode;
    
    const subtitle = document.getElementById("auth-subtitle");
    const submitBtn = document.getElementById("auth-submit-btn");
    const toggleText = document.getElementById("auth-toggle-text");
    const toggleLink = document.getElementById("auth-toggle-link");
    const emailGroup = document.getElementById("auth-email").parentElement;
    const errorMsg = document.getElementById("auth-error-msg");
    
    errorMsg.style.display = "none";

    if (isSignUpMode) {
        subtitle.innerText = "Crie sua conta para começar a usar";
        submitBtn.innerText = "Criar Conta e Entrar";
        toggleText.innerText = "Já tem uma conta?";
        toggleLink.innerText = "Fazer Login";
        emailGroup.style.display = "flex";
    } else {
        subtitle.innerText = "Digite suas credenciais para entrar";
        submitBtn.innerText = "Entrar no OS";
        toggleText.innerText = "Não tem uma conta?";
        toggleLink.innerText = "Criar Conta";
        emailGroup.style.display = "none";
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const usernameInput = document.getElementById("auth-username").value.trim().toLowerCase();
    const passwordInput = document.getElementById("auth-password").value;
    const emailInput = document.getElementById("auth-email").value.trim();
    const errorMsg = document.getElementById("auth-error-msg");
    const submitBtn = document.getElementById("auth-submit-btn");

    errorMsg.style.display = "none";

    if (!supabaseClient) {
        alert("Atenção: Configure as chaves do Supabase no topo do arquivo script.js para habilitar o login remoto.");
        document.getElementById("auth-modal-overlay").style.display = "none";
        return;
    }

    // Como o Supabase Auth exige formato de e-mail interno para autenticação por senha:
    const targetEmail = emailInput || `${usernameInput}@sandboxos.internal`;

    submitBtn.disabled = true;
    submitBtn.innerText = "Processando...";

    try {
        if (isSignUpMode) {
            // Cadastro de Usuário
            const { data, error } = await supabaseClient.auth.signUp({
                email: targetEmail,
                password: passwordInput,
                options: {
                    data: { username: usernameInput }
                }
            });

            if (error) throw error;

            alert("Conta criada com sucesso! Bem-vindo ao SandBox-OS.");
            document.getElementById("auth-modal-overlay").style.display = "none";
            updateUserInfoUI(usernameInput);

        } else {
            // Login de Usuário
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: targetEmail,
                password: passwordInput
            });

            if (error) throw error;

            document.getElementById("auth-modal-overlay").style.display = "none";
            const loggedUsername = data.user.user_metadata?.username || usernameInput;
            updateUserInfoUI(loggedUsername);
        }
    } catch (err) {
        errorMsg.innerText = err.message || "Ocorreu um erro ao autenticar.";
        errorMsg.style.display = "block";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = isSignUpMode ? "Criar Conta e Entrar" : "Entrar no OS";
    }
}

function updateUserInfoUI(username) {
    const userInfoEl = document.getElementById("user-info-display");
    if (userInfoEl) userInfoEl.innerText = `Usuário Conectado: ${username}`;
}

async function logoutUser() {
    if (confirm("Deseja encerrar a sessão e sair da conta?")) {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        window.location.reload();
    }
}

function initializeOS() {
    checkUserSession();

    // Restaurar Wallpaper/Plano de Fundo
    const savedWallpaper = localStorage.getItem('sandbox_wallpaper');
    const wallpaperType = localStorage.getItem('sandbox_wallpaper_type');
    const savedBg = localStorage.getItem("sandboxos_bg");
    const desktop = document.getElementById('desktop');

    if (savedWallpaper && desktop) {
        if (wallpaperType === 'color') {
            desktop.style.backgroundImage = 'none';
            desktop.style.backgroundColor = savedWallpaper;
        } else {
            desktop.style.backgroundImage = `url('${savedWallpaper}')`;
            desktop.style.backgroundSize = 'cover';
            desktop.style.backgroundPosition = 'center';
        }
    } else if (savedBg) {
        applyBackgroundLogic(savedBg);
    }

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

    initDesktopSelection();
    updateClockEngine();
    setInterval(updateClockEngine, 1000);
}

document.addEventListener("DOMContentLoaded", initializeOS);

// --- 🕒 RELÓGIO & CALENDÁRIO ---
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

function toggleCalendar(event) {
    event.stopPropagation();
    closeAllPopups();
    const popup = document.getElementById("calendar-popup");
    if (!popup) return;
    
    if (popup.style.display === "block") {
        popup.style.display = "none";
    } else {
        renderCalendar();
        popup.style.display = "block";
    }
}

function renderCalendar() {
    const monthYearEl = document.getElementById("calendar-month-year");
    const daysEl = document.getElementById("calendar-days");
    if (!monthYearEl || !daysEl) return;

    const now = new Date();
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthYearEl.innerText = `${months[now.getMonth()]} ${now.getFullYear()}`;

    daysEl.innerHTML = "";
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        daysEl.appendChild(document.createElement("div"));
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayEl = document.createElement("div");
        dayEl.className = "calendar-day";
        if (day === now.getDate()) dayEl.classList.add("today");
        dayEl.innerText = day;
        daysEl.appendChild(dayEl);
    }
}

// --- 🔔 ÁREA DE NOTIFICAÇÃO (TRAY) ---
function toggleTrayPopup(popupId, event) {
    event.stopPropagation();
    const targetPopup = document.getElementById(popupId);
    const isOpen = targetPopup.style.display === "block";
    closeAllPopups();
    if (!isOpen) targetPopup.style.display = "block";
}

function updateVolumeLabel(val) {
    document.getElementById("volume-val").innerText = val + "%";
}

function closeAllPopups() {
    document.querySelectorAll('.tray-popup').forEach(p => p.style.display = 'none');
}

// --- 🔍 MENU INICIAR COM BUSCA ---
function filterStartMenuApps(query) {
    const filter = query.toLowerCase();
    document.querySelectorAll('.start-app-item').forEach(item => {
        const appName = item.getAttribute('data-name');
        item.style.display = appName.includes(filter) ? 'block' : 'none';
    });
}

// --- 🖱️ SELEÇÃO MÚLTIPLA NO DESKTOP ---
function initDesktopSelection() {
    const desktop = document.getElementById('desktop');
    const box = document.getElementById('selection-box');
    let startX = 0, startY = 0, isSelecting = false;

    desktop.addEventListener('mousedown', (e) => {
        if (e.target !== desktop) return;
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        box.style.left = startX + 'px';
        box.style.top = startY + 'px';
        box.style.width = '0px';
        box.style.height = '0px';
        box.style.display = 'block';

        document.querySelectorAll('.draggable-shortcut').forEach(s => s.classList.remove('selected'));
    });

    desktop.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        let currentX = e.clientX;
        let currentY = e.clientY;

        let left = Math.min(startX, currentX);
        let top = Math.min(startY, currentY);
        let width = Math.abs(currentX - startX);
        let height = Math.abs(currentY - startY);

        box.style.left = left + 'px';
        box.style.top = top + 'px';
        box.style.width = width + 'px';
        box.style.height = height + 'px';

        const boxRect = box.getBoundingClientRect();
        document.querySelectorAll('.draggable-shortcut').forEach(shortcut => {
            const rect = shortcut.getBoundingClientRect();
            if (!(rect.right < boxRect.left || rect.left > boxRect.right || rect.bottom < boxRect.top || rect.top > boxRect.bottom)) {
                shortcut.classList.add('selected');
            } else {
                shortcut.classList.remove('selected');
            }
        });
    });

    document.addEventListener('mouseup', () => {
        if (isSelecting) {
            isSelecting = false;
            box.style.display = 'none';
        }
    });
}

// --- 🎨 WALLPAPERS ---
function renderWallpaperHistory() {
    const container = document.getElementById("wallpaper-history-grid");
    if (!container) return;
    container.innerHTML = "";

    const imagesInFolder = virtualFileSystem.imagens || [];

    if (imagesInFolder.length === 0) {
        container.innerHTML = "<p style='color:#999; font-size:12px; grid-column: 1 / -1;'>Nenhuma imagem local disponível.</p>";
        return;
    }

    imagesInFolder.forEach(function(file) {
        if (file.type && file.type.startsWith("image/") && file.data) {
            const bgData = "url('" + file.data + "')";
            const ball = document.createElement("div");
            ball.className = "color-ball";
            ball.style.background = bgData;
            ball.style.backgroundSize = "cover";
            ball.title = file.name;
            ball.onclick = function() { changeBackground(bgData); };
            container.appendChild(ball);
        }
    });
}

// --- 🖱️ DRAG & DROP ÍCONES (COM SUPORTE A SELEÇÃO MÚLTIPLA) ---
function makeShortcutDraggable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;

    elmnt.onmousedown = function(e) {
        e = e || window.event;
        e.stopPropagation();
        
        if (!elmnt.classList.contains('selected')) {
            if (!e.ctrlKey) {
                document.querySelectorAll('.draggable-shortcut').forEach(s => s.classList.remove('selected'));
            }
            elmnt.classList.add('selected');
        }

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

        const selectedShortcuts = document.querySelectorAll('.draggable-shortcut.selected');
        
        selectedShortcuts.forEach(shortcut => {
            let newTop = shortcut.offsetTop - pos2; 
            let newLeft = shortcut.offsetLeft - pos1;
            const maxW = window.innerWidth - 85; 
            const maxH = window.innerHeight - 130;

            if (newTop < 10) newTop = 10; 
            if (newLeft < 10) newLeft = 10;
            if (newLeft > maxW) newLeft = maxW; 
            if (newTop > maxH) newTop = maxH;

            shortcut.style.top = newTop + "px"; 
            shortcut.style.left = newLeft + "px";
        });
    }

    function closeDragShortcut() {
        document.onmouseup = null; 
        document.onmousemove = null;

        if (isDragging) {
            const selectedShortcuts = document.querySelectorAll('.draggable-shortcut.selected');
            selectedShortcuts.forEach(shortcut => {
                let snappedLeft = Math.round((shortcut.offsetLeft - 10) / gridX) * gridX + 20;
                let snappedTop = Math.round((shortcut.offsetTop - 10) / gridY) * gridY + 20;

                const maxH = window.innerHeight - 130;
                if (snappedTop > maxH) snappedTop = maxH;

                shortcut.style.left = snappedLeft + "px"; 
                shortcut.style.top = snappedTop + "px";
                localStorage.setItem("pos_" + shortcut.id, JSON.stringify({ top: shortcut.style.top, left: shortcut.style.left }));
            });
        }
    }
}

// ==========================================
// 📁 SUPABASE STORAGE (MEUS ARQUIVOS)
// ==========================================

function switchFolder(folderName) {
    currentFolder = folderName;
    document.querySelectorAll('.file-manager-sidebar button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById("folder-btn-" + folderName);
    if (activeBtn) activeBtn.classList.add('active');
    carregarMeusArquivos();
}

// 1. Upload de Arquivo para a Nuvem
async function uploadArquivo(input) {
    const file = input.files[0];
    if (!file) return;

    if (!supabaseClient) {
        alert("Supabase não está configurado!");
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert("Sua sessão expirou. Faça login novamente para enviar arquivos.");
        return;
    }

    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const filesList = document.getElementById('file-list-container');
    if (filesList) {
        filesList.innerHTML = '<p style="color: #0078d4; font-size: 12px; padding: 10px;">Enviando arquivo para a nuvem...</p>';
    }

    const { error } = await supabaseClient
        .storage
        .from('meus-arquivos')
        .upload(filePath, file);

    if (error) {
        alert("Erro no upload: " + error.message);
    } else {
        alert("Arquivo enviado com sucesso!");
    }

    input.value = '';
    carregarMeusArquivos();
}

// 2. Carregar e Renderizar Arquivos do Supabase
async function carregarMeusArquivos() {
    const container = document.getElementById("file-list-container");
    if (!container) return;

    container.innerHTML = '<p style="color:#888; font-size:12px; padding:10px;">Carregando arquivos...</p>';

    if (!supabaseClient) {
        container.innerHTML = '<p style="color:#ff5555; font-size:12px; padding:10px;">Supabase não conectado.</p>';
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        container.innerHTML = '<p style="color:#888; font-size:12px; padding:10px;">Faça login para ver seus arquivos.</p>';
        return;
    }

    const { data, error } = await supabaseClient
        .storage
        .from('meus-arquivos')
        .list(user.id);

    if (error) {
        console.error("Erro ao listar arquivos:", error);
        container.innerHTML = '<p style="color:#ff5555; font-size:12px; padding:10px;">Erro ao carregar arquivos.</p>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color:#888; font-size:12px; padding:10px;">Nenhum arquivo na nuvem.</p>';
        return;
    }

    container.innerHTML = '';

    data.forEach(file => {
        const { data: publicUrlData } = supabaseClient
            .storage
            .from('meus-arquivos')
            .getPublicUrl(`${user.id}/${file.name}`);

        const displayName = file.name.split('_').slice(1).join('_') || file.name;

        const fileItem = document.createElement('div');
        fileItem.style.cssText = 'text-align: center; width: 90px; word-break: break-all; margin: 5px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);';

        fileItem.innerHTML = `
            <div style="font-size: 28px; cursor: pointer;" onclick="window.open('${publicUrlData.publicUrl}', '_blank')" title="Clique para abrir/baixar">📄</div>
            <span style="font-size: 11px; display: block; margin-top: 4px; color: #eee; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${displayName}</span>
            <button onclick="deletarArquivo('${file.name}')" style="background: none; border: none; color: #ff5555; cursor: pointer; font-size: 10px; margin-top: 4px;">Excluir</button>
        `;

        container.appendChild(fileItem);
    });
}

// 3. Excluir Arquivo da Nuvem
async function deletarArquivo(fileName) {
    if (!confirm("Tem certeza que deseja excluir este arquivo?")) return;

    if (!supabaseClient) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { error } = await supabaseClient
        .storage
        .from('meus-arquivos')
        .remove([`${user.id}/${fileName}`]);

    if (error) {
        alert("Erro ao excluir: " + error.message);
    } else {
        carregarMeusArquivos();
    }
}

function saveNoteText() {
    const textarea = document.getElementById("notepad-textarea");
    if (textarea) localStorage.setItem("sandboxos_note_text", textarea.value);
}

// --- 🪟 JANELAS & TRAVA NAS BORDAS ---
function openApp(appId) {
    const win = document.getElementById("win-" + appId);
    if (win) {
        win.style.display = 'flex';
        focusWindow(win);
        if (!openAppsList[appId]) {
            openAppsList[appId] = { maximized: false, prevStyle: {} };
            updateTaskbar();
        }
        if (appId === 'files') carregarMeusArquivos();
        if (appId === 'settings') renderWallpaperHistory();
    }
}

function makeDraggableAndResizable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(elmnt.id + "-header");
    if (header) header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        const appId = elmnt.id.replace('win-', '');
        if (openAppsList[appId] && openAppsList[appId].maximized) return;
        e = e || window.event;
        if (['BUTTON', 'INPUT', 'LABEL', 'TEXTAREA'].includes(e.target.tagName)) return; 
        e.preventDefault();
        
        elmnt.classList.remove('snap-left', 'snap-right');

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

        const taskbarHeight = 45;
        const maxTop = window.innerHeight - taskbarHeight - 40;
        const maxLeft = window.innerWidth - 60;

        if (newTop < 0) newTop = 0;
        if (newLeft < 0) newLeft = 0;
        if (newTop > maxTop) newTop = maxTop;
        if (newLeft > maxLeft) newLeft = maxLeft;

        elmnt.style.top = newTop + "px"; 
        elmnt.style.left = newLeft + "px";
    }

    function closeDragElement(e) { 
        document.onmouseup = null; 
        document.onmousemove = null; 

        if (e.clientX <= 10) {
            elmnt.classList.add('snap-left');
        } else if (e.clientX >= window.innerWidth - 10) {
            elmnt.classList.add('snap-right');
        }
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
        win.classList.remove('snap-left', 'snap-right');
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

    win.classList.remove('snap-left', 'snap-right');

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

// --- 📌 BARRA DE TAREFAS SÓ COM ÍCONES ---
function updateTaskbar() {
    const container = document.getElementById('taskbar-apps');
    if (!container) return;
    container.innerHTML = ''; 
    Object.keys(openAppsList).forEach(function(appId) {
        const btn = document.createElement('button');
        btn.id = "tb-" + appId;
        btn.className = 'taskbar-button';
        btn.title = appId.toUpperCase();
        
        btn.innerHTML = `<span class="taskbar-icon">${appIcons[appId] || '🖥️'}</span>`;
        
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
    closeAllPopups();
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
    closeAllPopups();
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
    localStorage.setItem("sandbox_wallpaper", colorOrType.replace("url('", "").replace("')", ""));
    localStorage.setItem("sandbox_wallpaper_type", colorOrType.startsWith("url") ? "image" : "color");
}

function applyBackgroundLogic(colorOrType) {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    if (colorOrType.startsWith("url(")) {
        desktop.style.background = colorOrType + " no-repeat center center";
        desktop.style.backgroundSize = "cover";
    } else {
        desktop.style.background = colorOrType;
    }
}

// ==========================================
// CONFIGURAÇÕES E PERSONALIZAÇÃO DE TELA
// ==========================================

function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach(content => content.classList.remove('active'));

    const activeBtn = document.querySelector(`.settings-tab-btn[onclick*="${tabName}"]`);
    const activeContent = document.getElementById(`settings-tab-${tabName}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}

function setSolidWallpaper(color) {
    const desktop = document.getElementById('desktop');
    if (desktop) {
        desktop.style.backgroundImage = 'none';
        desktop.style.backgroundColor = color;
        localStorage.setItem('sandbox_wallpaper', color);
        localStorage.setItem('sandbox_wallpaper_type', 'color');
    }
}

function openFilesForWallpaper() {
    if (typeof openApp === 'function') {
        openApp('files');
    } else if (typeof openAppFromStart === 'function') {
        openAppFromStart('files');
    }
    
    if (typeof switchFolder === 'function') {
        switchFolder('imagens');
    }
}
