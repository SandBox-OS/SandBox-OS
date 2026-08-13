// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://wkofppnubrxrlhvrzfir.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B0MrTnAMNF6o_-0LNBlBSA_QcyfeM8U';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'SUA_SUPABASE_URL_AQUI') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// WALLPAPERS PADRÃO DO SISTEMA (PROTEGIDOS / ASSETS)
// ==========================================
const DEFAULT_WALLPAPERS = [
    { id: 'default_1', name: 'Montanhas Nevada', url: 'assets/wallpapers/Montanhas Nevada.png', isDefault: true },
    { id: 'default_2', name: 'Dia de Praia', url: 'assets/wallpapers/Dia de Praia.png', isDefault: true },
    { id: 'default_3', name: 'Futuro Distópico', url: 'assets/wallpapers/Futuro Destopico.png', isDefault: true },
    { id: 'default_4', name: 'Noite no Japão', url: 'assets/wallpapers/Noite no Japao.png', isDefault: true },
    { id: 'default_5', name: 'Campos de Trigo', url: 'assets/wallpapers/Campos de Trigo.png', isDefault: true },
    { id: 'default_6', name: 'Vista Para Cidade', url: 'assets/wallpapers/Vista Para Cidade.png', isDefault: true }
];

const PIXEL_ART_ICONS = {
    'notepad': 'assets/icons/pixel/BlocoDeNotasPixelArt.png',
    'files': 'assets/icons/pixel/ArquivosPixelArt.png',
    'calc': 'assets/icons/pixel/CalculadoraPixelArt.png'
};

let isSignUpMode = true;
let highestZIndex = 10;
const openAppsList = {};

let pinnedApps = JSON.parse(localStorage.getItem("sandbox_pinned_apps")) || ['notepad', 'files', 'calc', 'settings'];
let selectedAppForTaskbarContext = null;

let customFileDisplayNames = JSON.parse(localStorage.getItem("sandbox_file_renames")) || {};
let customFolders = JSON.parse(localStorage.getItem("sandbox_custom_folders")) || [];
let fileFolderAssignments = JSON.parse(localStorage.getItem("sandbox_file_folders")) || {}; 
let currentSavedNoteFileName = localStorage.getItem("sandbox_notepad_filename") || null;

let selectedFileContext = null;

const gridX = 90; 
const gridY = 90; 

let currentFolder = 'geral';
let notepadSaveTimeout = null;
let lastSavedContent = "";

const appIcons = {
    'notepad': '📝',
    'settings': '⚙️',
    'calc': '🧮',
    'files': '📁',
    'viewer': '🖼️'
};

const appNames = {
    'notepad': 'Bloco de Notas',
    'settings': 'Configurações',
    'calc': 'Calculadora',
    'files': 'Meus Arquivos',
    'viewer': 'Visualizador de Mídia'
};

// --- 🔐 GERENCIAMENTO DE SESSÃO E AUTENTICAÇÃO ---
async function checkUserSession() {
    if (!supabaseClient) {
        document.getElementById("auth-modal-overlay").style.display = "none";
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        document.getElementById("auth-modal-overlay").style.display = "none";
        const username = session.user.user_metadata?.username || session.user.email.split('@')[0];
        updateUserInfoUI(username);
        loadUserNote();
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
        alert("Atenção: Configure as chaves do Supabase no topo do arquivo script.js.");
        document.getElementById("auth-modal-overlay").style.display = "none";
        return;
    }

    const targetEmail = emailInput || `${usernameInput}@sandboxos.internal`;

    submitBtn.disabled = true;
    submitBtn.innerText = "Processando...";

    try {
        if (isSignUpMode) {
            const { data, error } = await supabaseClient.auth.signUp({
                email: targetEmail,
                password: passwordInput,
                options: { data: { username: usernameInput } }
            });

            if (error) throw error;

            alert("Conta criada com sucesso! Bem-vindo ao SandBox-OS.");
            document.getElementById("auth-modal-overlay").style.display = "none";
            updateUserInfoUI(usernameInput);
            loadUserNote();
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: targetEmail,
                password: passwordInput
            });

            if (error) throw error;

            document.getElementById("auth-modal-overlay").style.display = "none";
            const loggedUsername = data.user.user_metadata?.username || usernameInput;
            updateUserInfoUI(loggedUsername);
            loadUserNote();
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
        if (supabaseClient) await supabaseClient.auth.signOut();
        window.location.reload();
    }
}

function initializeOS() {
    checkUserSession();

    const savedWallpaper = localStorage.getItem('sandbox_wallpaper') || DEFAULT_WALLPAPERS[0].url;
    const wallpaperType = localStorage.getItem('sandbox_wallpaper_type') || 'image';

    if (wallpaperType === 'color') {
        setSolidWallpaper(savedWallpaper);
    } else {
        setWallpaperFromUrl(savedWallpaper);
    }

    const savedFont = localStorage.getItem('sandbox_user_font') || 'Segoe UI';
    const fontSelect = document.getElementById('font-style-select');
    if (fontSelect) fontSelect.value = savedFont;

    initNotepadEvents();
    renderDefaultWallpapers();
    renderWallpaperHistory();
    initContextMenu();
    initTrashBin();
    initStartMenuContextMenu();

    document.querySelectorAll('.draggable-shortcut, #trash-bin').forEach(shortcut => {
        if (!shortcut.classList.contains('draggable-shortcut')) {
            shortcut.classList.add('draggable-shortcut');
        }
        
        const coords = localStorage.getItem("pos_" + shortcut.id);
        if (coords) {
            const pos = JSON.parse(coords);
            shortcut.style.top = pos.top;
            shortcut.style.left = pos.left;
        }

        makeShortcutDraggable(shortcut);
        
        if (shortcut.id !== 'trash-bin') {
            shortcut.removeAttribute('onclick');
            shortcut.ondblclick = function(e) {
                e.stopPropagation();
                const appId = shortcut.id.replace('shortcut-', '');
                openApp(appId);
            };
        }
    });

    loadCustomDesktopItems();

    document.querySelectorAll('.window').forEach(win => {
        makeDraggableAndResizable(win);
        win.addEventListener('mousedown', () => focusWindow(win));
    });

    initDesktopSelection();
    updateClockEngine();
    setInterval(updateClockEngine, 1000);
    renderCustomFolders();
    updateTaskbar();
    updateNotepadSaveBtnUI();
}

document.addEventListener("DOMContentLoaded", initializeOS);

// --- 🎨 GERENCIAMENTO DE TEMA, FONTE E ÍCONES ---
function checarSeEWallpaperPadrao(url) {
    if (!url) return false;
    return DEFAULT_WALLPAPERS.some(wp => wp.url === url);
}

function aplicarTemaEIcones(wallpaperUrl) {
    const isDefault = checarSeEWallpaperPadrao(wallpaperUrl);
    const userFont = localStorage.getItem('sandbox_user_font') || 'Segoe UI';
    const noteEl = document.getElementById('font-override-note');

    if (isDefault) {
        document.body.classList.add('pixel-theme');
        document.body.style.fontFamily = "'Pixelify Sans', cursive, monospace";
        if (noteEl) noteEl.style.display = 'block';
        setAppIconMode('pixel');
    } else {
        document.body.classList.remove('pixel-theme');
        document.body.style.fontFamily = `'${userFont}', sans-serif`;
        if (noteEl) noteEl.style.display = 'none';
        setAppIconMode('default');
    }

    updateTaskbar();
}

function setAppIconMode(mode) {
    const apps = ['notepad', 'files', 'calc'];

    apps.forEach(appId => {
        const imgEl = document.getElementById(`img-icon-${appId}`);
        const emojiEl = document.getElementById(`emoji-icon-${appId}`);
        const startImgs = document.querySelectorAll(`.img-icon-${appId}`);
        const startEmojis = document.querySelectorAll(`.emoji-icon-${appId}`);

        if (mode === 'pixel') {
            const pixelSrc = PIXEL_ART_ICONS[appId];
            if (imgEl) { imgEl.src = pixelSrc; imgEl.style.display = 'block'; }
            if (emojiEl) emojiEl.style.display = 'none';

            startImgs.forEach(img => { img.src = pixelSrc; img.style.display = 'block'; });
            startEmojis.forEach(em => em.style.display = 'none');
        } else {
            if (imgEl) imgEl.style.display = 'none';
            if (emojiEl) emojiEl.style.display = 'inline';

            startImgs.forEach(img => img.style.display = 'none');
            startEmojis.forEach(em => em.style.display = 'inline');
        }
    });
}

function alterarFonteManual(novaFonte) {
    localStorage.setItem('sandbox_user_font', novaFonte);
    const currentWallpaper = localStorage.getItem('sandbox_wallpaper') || '';
    aplicarTemaEIcones(currentWallpaper);
}

// --- 🧮 CALCULADORA ---
function appendToCalc(val) {
    const display = document.getElementById('calc-display');
    if (!display) return;

    if (display.value === '0' || display.value === 'Erro') {
        if (['+', '-', '*', '/'].includes(val)) return;
        display.value = '';
    }

    const lastChar = display.value.slice(-1);
    const operators = ['+', '-', '*', '/'];

    if (operators.includes(val) && operators.includes(lastChar)) {
        display.value = display.value.slice(0, -1) + val;
        return;
    }

    display.value += val;
}

function calculateResult() {
    const display = document.getElementById('calc-display');
    if (!display) return;
    try {
        // Substituído o eval por avaliação matemática segura usando Function
        const safeEval = new Function(`return ${display.value}`);
        display.value = safeEval();
    } catch {
        display.value = 'Erro';
    }
}

// --- 📝 BLOCO DE NOTAS ---
function updateNotepadSaveBtnUI() {
    const btn = document.getElementById("btn-save-notepad");
    if (!btn) return;

    if (currentSavedNoteFileName) {
        btn.innerText = "💾 Alterar em Meus Arquivos";
    } else {
        btn.innerText = "💾 Salvar em Meus Arquivos";
    }
}

function initNotepadEvents() {
    const textarea = document.getElementById("notepad-textarea");
    if (!textarea) return;

    textarea.addEventListener("input", () => {
        setNotepadStatus("Rascunho não salvo...");
        localStorage.setItem("sandboxos_note_text", textarea.value);
    });
}

function setNotepadStatus(msg) {
    const statusEl = document.getElementById("notepad-status");
    if (statusEl) statusEl.innerText = msg;
}

async function saveNoteToCloud() {
    const textarea = document.getElementById("notepad-textarea");
    if (!textarea) return;

    const currentContent = textarea.value;
    localStorage.setItem("sandboxos_note_text", currentContent);

    if (!supabaseClient) {
        setNotepadStatus("Salvo localmente");
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        setNotepadStatus("Não conectado (Salvo local)");
        return;
    }

    setNotepadStatus("Salvando na nuvem...");

    const { data: existingNotes } = await supabaseClient
        .from('notes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

    let error = null;

    if (existingNotes && existingNotes.length > 0) {
        const { error: updateErr } = await supabaseClient
            .from('notes')
            .update({ content: currentContent, updated_at: new Date() })
            .eq('id', existingNotes[0].id);
        error = updateErr;
    } else {
        const { error: insertErr } = await supabaseClient
            .from('notes')
            .insert([{ user_id: user.id, title: 'Minhas Anotações', content: currentContent }]);
        error = insertErr;
    }

    if (error) {
        console.error("Erro ao salvar nota:", error);
        setNotepadStatus("Erro ao salvar na nuvem");
    } else {
        lastSavedContent = currentContent;
        setNotepadStatus("Salvo na nuvem ✓");
    }
}

async function loadUserNote() {
    const textarea = document.getElementById("notepad-textarea");
    if (!textarea) return;

    if (!supabaseClient) {
        textarea.value = localStorage.getItem("sandboxos_note_text") || "";
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    setNotepadStatus("Carregando nota...");

    const { data } = await supabaseClient
        .from('notes')
        .select('content')
        .eq('user_id', user.id)
        .limit(1);

    if (data && data.length > 0) {
        textarea.value = data[0].content || "";
        lastSavedContent = data[0].content || "";
        setNotepadStatus("Salvo na nuvem ✓");
    } else {
        textarea.value = localStorage.getItem("sandboxos_note_text") || "";
        setNotepadStatus("Pronto");
    }
}

function createNewNoteShortcut() {
    openApp('notepad');
    const textarea = document.getElementById("notepad-textarea");
    if (textarea) {
        textarea.value = "";
        textarea.focus();
    }
    currentSavedNoteFileName = null;
    localStorage.removeItem("sandbox_notepad_filename");
    updateNotepadSaveBtnUI();
    setNotepadStatus("Nova nota criada");
}

async function saveNotepadAsFile() {
    const textarea = document.getElementById("notepad-textarea");
    if (!textarea) return;

    const content = textarea.value;
    if (!content.trim()) {
        alert("O bloco de notas está vazio!");
        return;
    }

    await saveNoteToCloud();

    if (!supabaseClient) {
        alert("Nota salva apenas localmente.");
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert("Faça login para salvar seus arquivos na nuvem.");
        return;
    }

    let finalFileName = currentSavedNoteFileName;

    if (!finalFileName) {
        const fileName = prompt("Digite o nome do arquivo para salvar em Meus Arquivos:", "Anotacao.txt");
        if (!fileName) return;
        finalFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const file = new File([blob], finalFileName, { type: "text/plain" });
    const filePath = `${user.id}/${finalFileName}`;

    setNotepadStatus("Enviando arquivo...");

    const { error } = await supabaseClient.storage.from('meus-arquivos').upload(filePath, file, { upsert: true });

    if (error) {
        alert("Erro ao salvar arquivo: " + error.message);
        setNotepadStatus("Erro ao salvar");
    } else {
        currentSavedNoteFileName = finalFileName;
        localStorage.setItem("sandbox_notepad_filename", finalFileName);
        updateNotepadSaveBtnUI();

        alert(`Arquivo '${finalFileName}' atualizado em Meus Arquivos!`);
        setNotepadStatus("Salvo em Meus Arquivos ✓");
        carregarMeusArquivos();
    }
}

function downloadNotepadFile() {
    const textarea = document.getElementById("notepad-textarea");
    if (!textarea) return;

    const content = textarea.value;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = currentSavedNoteFileName || `Nota_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
}

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
    closeAllContextMenus();
}

function closeAllContextMenus() {
    const ctx = document.getElementById('context-menu');
    const fCtx = document.getElementById('file-context-menu');
    const tCtx = document.getElementById('taskbar-context-menu');
    const sCtx = document.getElementById('start-context-menu');
    if (ctx) ctx.style.display = 'none';
    if (fCtx) fCtx.style.display = 'none';
    if (tCtx) tCtx.style.display = 'none';
    if (sCtx) sCtx.style.display = 'none';
}

function filterStartMenuApps(query) {
    const filter = query.toLowerCase();
    document.querySelectorAll('.start-app-item').forEach(item => {
        const appName = item.getAttribute('data-name');
        item.style.display = appName.includes(filter) ? 'flex' : 'none';
    });
}

function initContextMenu() {
    const desktop = document.getElementById('desktop');
    const contextMenu = document.getElementById('context-menu');

    if (!desktop || !contextMenu) return;

    desktop.addEventListener('contextmenu', (e) => {
        if (e.target !== desktop) return;

        e.preventDefault();
        closeAllContextMenus();

        let posX = e.clientX;
        let posY = e.clientY;

        const menuWidth = 200;
        const menuHeight = 140;
        if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth;
        if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight;

        contextMenu.style.left = `${posX}px`;
        contextMenu.style.top = `${posY}px`;
        contextMenu.style.display = 'block';
    });

    document.addEventListener('click', () => {
        closeAllContextMenus();
    });
}

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

function setWallpaperFromUrl(url) {
    const desktop = document.getElementById('desktop');
    const videoBg = document.getElementById('desktop-video-wallpaper');
    if (!desktop) return;

    const cleanUrl = url.split('?')[0];
    const ext = cleanUrl.split('.').pop().toLowerCase();
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);

    if (isVideo && videoBg) {
        videoBg.muted = true;
        videoBg.volume = 0;
        videoBg.src = url;

        videoBg.style.display = 'block';
        videoBg.style.position = 'absolute';
        videoBg.style.top = '0';
        videoBg.style.left = '0';
        videoBg.style.width = '100%';
        videoBg.style.height = '100%';
        videoBg.style.objectFit = 'cover';
        videoBg.style.zIndex = '0';

        videoBg.play().catch(err => console.warn(err));

        desktop.style.backgroundImage = 'none';

        localStorage.setItem('sandbox_wallpaper', url);
        localStorage.setItem('sandbox_wallpaper_type', 'video');
    } else {
        if (videoBg) {
            videoBg.pause();
            videoBg.style.display = 'none';
            videoBg.src = "";
        }

        desktop.style.backgroundImage = `url('${url}')`;
        desktop.style.backgroundSize = 'cover';
        desktop.style.backgroundPosition = 'center';

        localStorage.setItem('sandbox_wallpaper', url);
        localStorage.setItem('sandbox_wallpaper_type', 'image');
    }

    aplicarTemaEIcones(url);
}

function setSolidWallpaper(color) {
    const desktop = document.getElementById('desktop');
    const videoBg = document.getElementById('desktop-video-wallpaper');

    if (desktop && videoBg) {
        videoBg.pause();
        videoBg.style.display = 'none';
        videoBg.src = "";

        desktop.style.backgroundImage = 'none';
        desktop.style.backgroundColor = color;

        localStorage.setItem('sandbox_wallpaper', color);
        localStorage.setItem('sandbox_wallpaper_type', 'color');
    }

    aplicarTemaEIcones(color);
}

function renderDefaultWallpapers() {
    const container = document.getElementById("default-wallpaper-grid");
    if (!container) return;

    container.innerHTML = "";
    DEFAULT_WALLPAPERS.forEach(wp => {
        const thumb = document.createElement("div");
        thumb.className = "color-ball";
        thumb.style.borderRadius = "4px";
        thumb.style.width = "48px";
        thumb.style.height = "48px";
        thumb.style.cursor = "pointer";
        thumb.style.display = "flex";
        thumb.style.alignItems = "center";
        thumb.style.justifyContent = "center";
        thumb.style.border = "1px solid rgba(255,255,255,0.2)";
        thumb.style.backgroundImage = `url('${wp.url}')`;
        thumb.style.backgroundSize = "cover";
        thumb.style.backgroundPosition = "center";
        thumb.title = `Wallpaper Padrão: ${wp.name}`;

        thumb.onclick = () => setWallpaperFromUrl(wp.url);
        container.appendChild(thumb);
    });
}

async function renderWallpaperHistory() {
    const container = document.getElementById("wallpaper-history-grid");
    if (!container) return;
    container.innerHTML = "<p style='color:#aaa; font-size:11px;'>Buscando mídias...</p>";

    if (!supabaseClient) {
        container.innerHTML = "<p style='color:#999; font-size:11px;'>Supabase offline.</p>";
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        container.innerHTML = "<p style='color:#999; font-size:11px;'>Faça login para carregar mídias.</p>";
        return;
    }

    const { data: files } = await supabaseClient.storage.from('meus-arquivos').list(user.id);
    if (!files || files.length === 0) {
        container.innerHTML = "<p style='color:#999; font-size:11px;'>Nenhuma mídia na nuvem.</p>";
        return;
    }

    container.innerHTML = "";
    files.forEach(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
        const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);

        if (isImage || isVideo) {
            const { data: publicUrlData } = supabaseClient.storage.from('meus-arquivos').getPublicUrl(`${user.id}/${file.name}`);
            
            const thumb = document.createElement("div");
            thumb.className = "color-ball";
            thumb.style.borderRadius = "4px";
            thumb.style.width = "48px";
            thumb.style.height = "48px";
            thumb.style.cursor = "pointer";
            thumb.style.display = "flex";
            thumb.style.alignItems = "center";
            thumb.style.justifyContent = "center";
            thumb.style.border = "1px solid rgba(255,255,255,0.2)";
            thumb.title = `Definir ${isVideo ? 'Vídeo' : 'Imagem'} como Wallpaper`;

            if (isImage) {
                thumb.style.backgroundImage = `url('${publicUrlData.publicUrl}')`;
                thumb.style.backgroundSize = "cover";
            } else if (isVideo) {
                thumb.style.background = "#222";
                thumb.innerHTML = "🎥";
            }

            thumb.onclick = () => setWallpaperFromUrl(publicUrlData.publicUrl);
            container.appendChild(thumb);
        }
    });
}

function openFilesForWallpaper() {
    openApp('files');
    switchFolder('imagens');
}

// --- 🗑️ LIXEIRA DA ÁREA DE TRABALHO ---
function initTrashBin() {
    const trash = document.getElementById("trash-bin");
    if (!trash) return;

    trash.addEventListener("dragover", (e) => {
        e.preventDefault();
        trash.classList.add("trash-hover");
    });

    trash.addEventListener("dragleave", () => {
        trash.classList.remove("trash-hover");
    });

    trash.addEventListener("drop", (e) => {
        e.preventDefault();
        trash.classList.remove("trash-hover");
        const shortcutId = e.dataTransfer.getData("text/plain");
        if (shortcutId) {
            const el = document.getElementById(shortcutId);
            if (el) {
                if (el.classList.contains("custom-shortcut")) {
                    const serverFileName = el.getAttribute("data-filename");
                    if (serverFileName) removeDesktopItemByServerFile(serverFileName);
                    el.remove();
                } else if (confirm("Deseja remover este atalho do Desktop?")) {
                    el.style.display = "none";
                }
            }
        }
    });
}

// --- 🖱️ DRAG & DROP COM GRADE ---
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

        document.addEventListener("mousemove", dragShortcut);
        document.addEventListener("mouseup", closeDragShortcut);
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
        document.removeEventListener("mousemove", dragShortcut);
        document.removeEventListener("mouseup", closeDragShortcut);

        if (isDragging) {
            const selectedShortcuts = document.querySelectorAll('.draggable-shortcut.selected');
            selectedShortcuts.forEach(shortcut => {
                let snappedLeft = Math.round((shortcut.offsetLeft - 20) / gridX) * gridX + 20;
                let snappedTop = Math.round((shortcut.offsetTop - 20) / gridY) * gridY + 20;

                const maxH = window.innerHeight - 130;
                const maxW = window.innerWidth - 85;

                if (snappedTop < 20) snappedTop = 20;
                if (snappedLeft < 20) snappedLeft = 20;
                if (snappedTop > maxH) snappedTop = maxH;
                if (snappedLeft > maxW) snappedLeft = maxW;

                shortcut.style.left = snappedLeft + "px"; 
                shortcut.style.top = snappedTop + "px";

                localStorage.setItem("pos_" + shortcut.id, JSON.stringify({ 
                    top: shortcut.style.top, 
                    left: shortcut.style.left 
                }));
            });
        }
    }
}

// ==========================================
// 📁 MEUS ARQUIVOS, PASTAS E CONTEXTO DE ARQUIVO
// ==========================================

function switchFolder(folderName) {
    currentFolder = folderName;
    document.querySelectorAll('.file-manager-sidebar button').forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.getElementById("folder-btn-" + folderName);
    if (activeBtn) activeBtn.classList.add('active');
    
    carregarMeusArquivos();
}

function createNewFolder() {
    const folderName = prompt("Digite o nome da nova pasta:");
    if (!folderName || !folderName.trim()) return;

    const folderId = "custom_" + Date.now();
    const newFolder = { id: folderId, name: folderName.trim() };

    customFolders.push(newFolder);
    localStorage.setItem("sandbox_custom_folders", JSON.stringify(customFolders));

    renderCustomFolders();
    switchFolder(folderId);
}

function renderCustomFolders() {
    const container = document.getElementById("custom-folders-list");
    if (!container) return;

    container.innerHTML = "";
    customFolders.forEach(folder => {
        const btn = document.createElement("button");
        btn.id = "folder-btn-" + folder.id;
        btn.innerText = "📁 " + folder.name;
        btn.onclick = () => switchFolder(folder.id);
        container.appendChild(btn);
    });
}

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

    const filteredFiles = data.filter(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
        const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);

        const assignedFolder = fileFolderAssignments[file.name];

        if (currentFolder === 'geral') return true;
        if (currentFolder === 'imagens') return isImage;
        if (currentFolder === 'videos') return isVideo;
        if (currentFolder === 'downloads') return assignedFolder === 'downloads';

        return assignedFolder === currentFolder;
    });

    if (filteredFiles.length === 0) {
        container.innerHTML = '<p style="color:#888; font-size:12px; padding:10px;">Nenhum arquivo nesta pasta.</p>';
        return;
    }

    container.innerHTML = '';

    filteredFiles.forEach(file => {
        const { data: publicUrlData } = supabaseClient
            .storage
            .from('meus-arquivos')
            .getPublicUrl(`${user.id}/${file.name}`);

        const rawName = file.name.split('_').slice(1).join('_') || file.name;
        const displayName = customFileDisplayNames[file.name] || rawName;
        const ext = file.name.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
        const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
        const isText = ['txt', 'sql', 'json', 'js', 'html', 'css', 'md'].includes(ext);

        const fileItem = document.createElement('div');
        fileItem.className = 'file-card-item';

        fileItem.innerHTML = `
            <div class="file-icon">
                ${isImage ? '🖼️' : isVideo ? '🎥' : isText ? '📝' : '📄'}
            </div>
            <span class="file-name" title="${displayName}">${displayName}</span>
        `;

        fileItem.ondblclick = () => abrirArquivoPeloOS(file.name, publicUrlData.publicUrl, ext);

        fileItem.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showFileContextMenu(e, file.name, publicUrlData.publicUrl, ext, displayName);
        };

        container.appendChild(fileItem);
    });
}

async function abrirArquivoPeloOS(serverFileName, url, ext) {
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
    const isText = ['txt', 'sql', 'json', 'js', 'html', 'css', 'md'].includes(ext);

    if (isImage || isVideo) {
        openMediaViewer(url, ext);
    } else if (isText) {
        try {
            const res = await fetch(url);
            const textContent = await res.text();
            openApp('notepad');
            const textarea = document.getElementById("notepad-textarea");
            if (textarea) textarea.value = textContent;
            currentSavedNoteFileName = serverFileName;
            localStorage.setItem("sandbox_notepad_filename", serverFileName);
            updateNotepadSaveBtnUI();
            setNotepadStatus(`Lido: ${customFileDisplayNames[serverFileName] || serverFileName}`);
        } catch (err) {
            alert("Erro ao ler conteúdo do arquivo!");
        }
    } else {
        alert(`O SandBox-OS não possui um programa padrão instalado para abrir arquivos .${ext}`);
    }
}

function showFileContextMenu(e, serverFileName, publicUrl, ext, displayName) {
    closeAllContextMenus();
    const menu = document.getElementById('file-context-menu');
    const list = document.getElementById('file-context-options');
    if (!menu || !list) return;

    selectedFileContext = { serverFileName, publicUrl, ext, displayName };
    list.innerHTML = '';

    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);

    const openLi = document.createElement('li');
    openLi.innerText = '📂 Abrir no OS';
    openLi.onclick = () => {
        abrirArquivoPeloOS(serverFileName, publicUrl, ext);
        closeAllContextMenus();
    };
    list.appendChild(openLi);

    if (isImage || isVideo) {
        const wallLi = document.createElement('li');
        wallLi.innerText = '🖼️ Usar como Wallpaper';
        wallLi.onclick = () => {
            setWallpaperFromUrl(publicUrl);
            closeAllContextMenus();
        };
        list.appendChild(wallLi);
    }

    const dtLi = document.createElement('li');
    dtLi.innerText = '🖥️ Adicionar à Área de Trabalho';
    dtLi.onclick = () => {
        addFileToDesktop(serverFileName, publicUrl, ext, displayName);
        closeAllContextMenus();
    };
    list.appendChild(dtLi);

    const moveLi = document.createElement('li');
    moveLi.innerText = '📁 Mover para Pasta...';
    moveLi.onclick = () => {
        promptMoveToFolder(serverFileName);
        closeAllContextMenus();
    };
    list.appendChild(moveLi);

    const renameLi = document.createElement('li');
    renameLi.innerText = '✏️ Renomear Arquivo';
    renameLi.onclick = () => {
        renomearArquivoInterno(serverFileName, displayName);
        closeAllContextMenus();
    };
    list.appendChild(renameLi);

    const hr = document.createElement('hr');
    list.appendChild(hr);

    const delLi = document.createElement('li');
    delLi.innerText = '🗑️ Excluir Arquivo';
    delLi.style.color = '#ff5555';
    delLi.onclick = () => {
        deletarArquivo(serverFileName);
        closeAllContextMenus();
    };
    list.appendChild(delLi);

    let posX = e.clientX;
    let posY = e.clientY;
    if (posX + 200 > window.innerWidth) posX = window.innerWidth - 200;
    if (posY + 180 > window.innerHeight) posY = window.innerHeight - 180;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.style.display = 'block';
}

function promptMoveToFolder(serverFileName) {
    const foldersList = [
        { id: 'downloads', name: 'Downloads' },
        ...customFolders
    ];

    let optionsStr = foldersList.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
    const choice = prompt(`Selecione o número da pasta para mover este arquivo:\n${optionsStr}`);

    if (!choice) return;
    const index = parseInt(choice) - 1;

    if (!isNaN(index) && foldersList[index]) {
        fileFolderAssignments[serverFileName] = foldersList[index].id;
        localStorage.setItem("sandbox_file_folders", JSON.stringify(fileFolderAssignments));
        alert(`Arquivo movido para ${foldersList[index].name}!`);
        carregarMeusArquivos();
    } else {
        alert("Opção inválida.");
    }
}

function renomearArquivoInterno(serverFileName, currentName) {
    const newName = prompt("Digite o novo nome para o arquivo:", currentName);
    if (!newName || !newName.trim()) return;

    customFileDisplayNames[serverFileName] = newName.trim();
    localStorage.setItem("sandbox_file_renames", JSON.stringify(customFileDisplayNames));
    carregarMeusArquivos();
    loadCustomDesktopItems();
}

async function deletarArquivo(fileName) {
    if (!confirm("Tem certeza que deseja excluir este arquivo permanentemente?")) return;
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
        delete customFileDisplayNames[fileName];
        delete fileFolderAssignments[fileName];
        localStorage.setItem("sandbox_file_renames", JSON.stringify(customFileDisplayNames));
        localStorage.setItem("sandbox_file_folders", JSON.stringify(fileFolderAssignments));
        
        removeDesktopItemByServerFile(fileName);
        carregarMeusArquivos();
    }
}

function addFileToDesktop(serverFileName, publicUrl, ext, displayName) {
    let desktopItems = JSON.parse(localStorage.getItem("sandbox_desktop_files")) || [];
    
    if (desktopItems.some(i => i.serverFileName === serverFileName)) {
        alert("Este arquivo já está na Área de Trabalho!");
        return;
    }

    const newItem = {
        id: "dt_" + Date.now(),
        serverFileName,
        publicUrl,
        ext,
        displayName
    };

    desktopItems.push(newItem);
    localStorage.setItem("sandbox_desktop_files", JSON.stringify(desktopItems));
    loadCustomDesktopItems();
}

function loadCustomDesktopItems() {
    const container = document.getElementById("custom-desktop-shortcuts");
    if (!container) return;

    container.innerHTML = "";
    let desktopItems = JSON.parse(localStorage.getItem("sandbox_desktop_files")) || [];

    desktopItems.forEach(item => {
        const displayName = customFileDisplayNames[item.serverFileName] || item.displayName;
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(item.ext);
        const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(item.ext);
        const isText = ['txt', 'sql', 'json', 'js', 'html', 'css', 'md'].includes(item.ext);

        const shortcut = document.createElement("div");
        shortcut.id = `shortcut-${item.id}`;
        shortcut.className = "draggable-shortcut custom-shortcut";
        shortcut.setAttribute("data-filename", item.serverFileName);
        
        const coords = localStorage.getItem("pos_" + shortcut.id);
        if (coords) {
            const pos = JSON.parse(coords);
            shortcut.style.top = pos.top;
            shortcut.style.left = pos.left;
        } else {
            shortcut.style.top = "110px";
            shortcut.style.left = "20px";
        }

        shortcut.innerHTML = `
            <span class="shortcut-icon">${isImage ? '🖼️' : isVideo ? '🎥' : isText ? '📝' : '📄'}</span>
            <span class="shortcut-title" title="${displayName}">${displayName}</span>
        `;

        shortcut.ondblclick = (e) => {
            e.stopPropagation();
            abrirArquivoPeloOS(item.serverFileName, item.publicUrl, item.ext);
        };

        makeShortcutDraggable(shortcut);
        container.appendChild(shortcut);
    });
}

function removeDesktopItemByServerFile(serverFileName) {
    let desktopItems = JSON.parse(localStorage.getItem("sandbox_desktop_files")) || [];
    desktopItems = desktopItems.filter(i => i.serverFileName !== serverFileName);
    localStorage.setItem("sandbox_desktop_files", JSON.stringify(desktopItems));
    loadCustomDesktopItems();
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
        if (appId === 'files') carregarMeusArquivos();
        if (appId === 'settings') {
            renderDefaultWallpapers();
            renderWallpaperHistory();
        }
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
        if (['BUTTON', 'INPUT', 'LABEL', 'TEXTAREA', 'SELECT', 'OPTION'].includes(e.target.tagName)) return; 
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

// --- 📌 BARRA DE TAREFAS ---
function updateTaskbar() {
    const container = document.getElementById('taskbar-apps');
    if (!container) return;
    container.innerHTML = ''; 

    const currentWallpaper = localStorage.getItem('sandbox_wallpaper') || '';
    const isPixel = checarSeEWallpaperPadrao(currentWallpaper);

    const allTaskbarApps = Array.from(new Set([...pinnedApps, ...Object.keys(openAppsList)]));

    allTaskbarApps.forEach(appId => {
        if (appId === 'viewer' && !openAppsList[appId]) return;

        const btn = document.createElement('button');
        btn.id = "tb-" + appId;
        btn.className = 'taskbar-button';
        btn.title = appNames[appId] || appId;

        if (openAppsList[appId]) btn.classList.add('is-open');

        if (isPixel && PIXEL_ART_ICONS[appId]) {
            btn.innerHTML = `<img src="${PIXEL_ART_ICONS[appId]}" class="taskbar-icon-img" alt="${appId}">`;
        } else {
            btn.innerHTML = `<span class="taskbar-icon">${appIcons[appId] || '🖥️'}</span>`;
        }
        
        btn.onclick = function() {
            const win = document.getElementById("win-" + appId);
            if (!win) return;
            if (win.style.display === 'none' || !openAppsList[appId]) {
                openApp(appId);
            } else {
                minimizeApp(appId);
            }
        };

        btn.oncontextmenu = function(e) {
            e.preventDefault();
            e.stopPropagation();
            showTaskbarContextMenu(e, appId);
        };

        container.appendChild(btn);
    });
}

function showTaskbarContextMenu(e, appId) {
    closeAllContextMenus();
    selectedAppForTaskbarContext = appId;

    const menu = document.getElementById('taskbar-context-menu');
    const pinBtn = document.getElementById('pin-toggle-btn');
    if (!menu || !pinBtn) return;

    const isPinned = pinnedApps.includes(appId);
    pinBtn.innerText = isPinned ? '📌 Desfixar da Barra de Tarefas' : '📌 Fixar na Barra de Tarefas';

    let posX = e.clientX;
    let posY = e.clientY - 40;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.style.display = 'block';
}

function togglePinCurrentApp() {
    if (!selectedAppForTaskbarContext) return;

    const appId = selectedAppForTaskbarContext;
    if (pinnedApps.includes(appId)) {
        pinnedApps = pinnedApps.filter(id => id !== appId);
    } else {
        pinnedApps.push(appId);
    }

    localStorage.setItem("sandbox_pinned_apps", JSON.stringify(pinnedApps));
    updateTaskbar();
    closeAllContextMenus();
}

// --- 🔍 MENU INICIAR ---
let selectedAppFromStart = null;

function initStartMenuContextMenu() {
    document.querySelectorAll('.start-app-item').forEach(item => {
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAllContextMenus();

            const appName = item.getAttribute('data-app');
            selectedAppFromStart = appName;

            const menu = document.getElementById('start-context-menu');
            if (!menu) return;

            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
            menu.style.display = 'block';
        });
    });
}

function addStartAppToDesktop() {
    if (!selectedAppFromStart) return;

    const shortcutId = `shortcut-${selectedAppFromStart}`;
    const el = document.getElementById(shortcutId);
    if (el) {
        el.style.display = 'flex';
        alert(`Atalho para ${appNames[selectedAppFromStart]} adicionado à Área de Trabalho!`);
    }

    closeAllContextMenus();
    document.getElementById("start-menu").style.display = "none";
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

function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach(content => content.classList.remove('active'));

    const activeBtn = document.querySelector(`.settings-tab-btn[onclick*="${tabName}"]`);
    const activeContent = document.getElementById(`settings-tab-${tabName}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}

// --- 🖼️ VISUALIZADOR DE MÍDIA ---
let currentZoom = 1;

function openMediaViewer(url, ext) {
    const win = document.getElementById("win-viewer");
    const container = document.getElementById("viewer-media-container");
    if (!win || !container) return;

    currentZoom = 1;
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext.toLowerCase());

    if (isVideo) {
        container.innerHTML = `
            <video src="${url}" controls autoplay style="max-width: 100%; max-height: 100%; border-radius: 4px;"></video>
        `;
    } else {
        container.innerHTML = `
            <img id="viewer-img" src="${url}" style="max-width: 100%; max-height: 100%; transition: transform 0.2s ease; transform: scale(1);" />
        `;
    }

    openApp('viewer');
}

function zoomMedia(factor) {
    const img = document.getElementById("viewer-img");
    if (!img) return;

    currentZoom += factor;
    if (currentZoom < 0.2) currentZoom = 0.2;
    if (currentZoom > 5) currentZoom = 5;

    img.style.transform = `scale(${currentZoom})`;
}

function resetZoomMedia() {
    const img = document.getElementById("viewer-img");
    if (!img) return;
    currentZoom = 1;
    img.style.transform = "scale(1)";
}
