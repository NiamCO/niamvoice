// DOM Elements
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const loadingModal = document.getElementById('loadingModal');
const themeToggle = document.getElementById('themeToggle');

// Generate a random room code (e.g., ABC-123)
function generateRoomCode() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    let code = '';
    // 3 random letters
    for (let i = 0; i < 3; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    code += '-';
    // 3 random numbers
    for (let i = 0; i < 3; i++) {
        code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    
    return code;
}

// Format code for URL (remove dash)
function formatCodeForURL(code) {
    return code.replace('-', '');
}

// Show loading modal
function showLoading() {
    loadingModal.classList.add('active');
}

// Hide loading modal
function hideLoading() {
    loadingModal.classList.remove('active');
}

// Create new room
createRoomBtn.addEventListener('click', async () => {
    const roomCode = generateRoomCode();
    
    // Show loading
    showLoading();
    
    // Simulate network delay (in real app, this would create room in Supabase)
    setTimeout(() => {
        const urlCode = formatCodeForURL(roomCode);
        window.location.href = `room.html?room=${urlCode}`;
    }, 800);
});

// Join existing room
joinRoomBtn.addEventListener('click', () => {
    let code = roomCodeInput.value.trim().toUpperCase();
    
    if (!code) {
        alert('Please enter a room code');
        return;
    }
    
    // Validate format (ABC-123 or ABC123)
    if (!/^[A-Z]{3}[-]?[0-9]{3}$/.test(code)) {
        alert('Please enter a valid room code (e.g., ABC-123 or ABC123)');
        return;
    }
    
    // Ensure it has dash for consistency
    if (!code.includes('-')) {
        code = `${code.substring(0, 3)}-${code.substring(3)}`;
    }
    
    showLoading();
    
    // In real app, check if room exists in Supabase
    setTimeout(() => {
        const urlCode = formatCodeForURL(code);
        window.location.href = `room.html?room=${urlCode}`;
    }, 800);
});

// Enter key to join
roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoomBtn.click();
    }
});

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('niamvoice-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function updateThemeButton(theme) {
    const icon = themeToggle.querySelector('i');
    const text = themeToggle.querySelector('span') || document.createElement('span');
    
    if (!themeToggle.querySelector('span')) {
        themeToggle.appendChild(text);
    }
    
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        text.textContent = ' Light Mode';
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = ' Dark Mode';
    }
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('niamvoice-theme', newTheme);
    updateThemeButton(newTheme);
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    roomCodeInput.focus();
    
    // Auto-focus on input
    roomCodeInput.addEventListener('focus', function() {
        this.select();
    });
});
