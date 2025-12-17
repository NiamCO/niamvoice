
// Room State
let localStream = null;
let isMuted = false;
let isSpeaking = false;
let roomCode = '';
let participants = new Map(); // participantId -> {name, isSpeaking, isMuted}
let localParticipantId = generateId();
let audioContext = null;
let analyser = null;
let speakingThreshold = -45; // dB threshold for speech

// DOM Elements
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const muteToggleBtn = document.getElementById('muteToggleBtn');
const localMicCircle = document.getElementById('localMicCircle');
const micStatusText = document.getElementById('micStatusText');
const participantsList = document.getElementById('participantsList');
const participantCount = document.getElementById('participantCount');
const audioDeviceSelect = document.getElementById('audioDeviceSelect');
const connectionStatus = document.getElementById('connectionStatus');
const errorModal = document.getElementById('errorModal');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const goHomeBtn = document.getElementById('goHomeBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Generate unique ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Format room code with dash
function formatRoomCode(code) {
    if (code.length === 6) {
        return `${code.substring(0, 3)}-${code.substring(3)}`;
    }
    return code;
}

// Get room code from URL
function getRoomCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('room') || 'ABC123';
    
    if (code.length === 6) {
        return formatRoomCode(code);
    }
    
    return code;
}

// Show toast message
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show error modal
function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorModal.classList.add('active');
}

// Hide error modal
function hideError() {
    errorModal.classList.remove('active');
}

// Update participant list UI
function updateParticipantsUI() {
    participantsList.innerHTML = '';
    let count = 0;
    
    // Add local participant (you)
    const localParticipant = participants.get(localParticipantId);
    if (localParticipant) {
        addParticipantToUI(localParticipantId, localParticipant, true);
        count++;
    }
    
    // Add remote participants
    participants.forEach((participant, id) => {
        if (id !== localParticipantId) {
            addParticipantToUI(id, participant, false);
            count++;
        }
    });
    
    participantCount.textContent = count;
}

// Add participant to UI
function addParticipantToUI(id, participant, isLocal) {
    const participantEl = document.createElement('div');
    participantEl.className = `participant ${isLocal ? 'you' : ''} ${participant.isSpeaking ? 'speaking' : ''}`;
    participantEl.id = `participant-${id}`;
    
    // Generate avatar color based on name
    const colors = ['#3a86ff', '#8338ec', '#ff006e', '#ffbe0b', '#38b000'];
    const colorIndex = id.charCodeAt(0) % colors.length;
    
    participantEl.innerHTML = `
        <div class="avatar" style="background: ${colors[colorIndex]}">
            ${participant.name.charAt(0).toUpperCase()}
        </div>
        <div class="participant-info">
            <div class="participant-name">
                ${participant.name} ${isLocal ? '(You)' : ''}
            </div>
            <div class="participant-status">
                ${participant.isSpeaking ? '<i class="fas fa-volume-up"></i> Speaking' : ''}
                ${participant.isMuted ? '<i class="fas fa-microphone-slash"></i> Muted' : ''}
            </div>
        </div>
    `;
    
    participantsList.appendChild(participantEl);
}

// Update participant in UI
function updateParticipantUI(id) {
    const participant = participants.get(id);
    const participantEl = document.getElementById(`participant-${id}`);
    
    if (participantEl && participant) {
        participantEl.className = `participant ${id === localParticipantId ? 'you' : ''} ${participant.isSpeaking ? 'speaking' : ''}`;
        
        const statusEl = participantEl.querySelector('.participant-status');
        if (statusEl) {
            statusEl.innerHTML = participant.isSpeaking ? 
                '<i class="fas fa-volume-up"></i> Speaking' : 
                participant.isMuted ? '<i class="fas fa-microphone-slash"></i> Muted' : '';
        }
    }
}

// Update mute button UI
function updateMuteButton() {
    if (isMuted) {
        muteToggleBtn.className = 'mute-btn muted';
        muteToggleBtn.innerHTML = '<i class="fas fa-microphone-slash"></i><span>UNMUTE</span>';
        localMicCircle.classList.add('muted');
        localMicCircle.classList.remove('speaking');
        micStatusText.textContent = 'Your mic is OFF';
    } else {
        muteToggleBtn.className = 'mute-btn unmuted';
        muteToggleBtn.innerHTML = '<i class="fas fa-microphone"></i><span>MUTE</span>';
        localMicCircle.classList.remove('muted');
        micStatusText.textContent = 'Your mic is ON';
    }
}

// Update mic circle based on speaking state
function updateMicCircle() {
    if (isMuted) {
        localMicCircle.classList.add('muted');
        localMicCircle.classList.remove('speaking');
    } else if (isSpeaking) {
        localMicCircle.classList.add('speaking');
        localMicCircle.classList.remove('muted');
    } else {
        localMicCircle.classList.remove('speaking', 'muted');
    }
}

// Initialize microphone
async function initMicrophone() {
    try {
        // Request microphone permission
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        console.log('Microphone access granted');
        return true;
    } catch (error) {
        console.error('Error accessing microphone:', error);
        showError('Microphone Error', 
            error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' ?
            'Please allow microphone access to use voice chat.' :
            'Could not access microphone. Please check your audio settings.'
        );
        return false;
    }
}

// Setup audio analysis for voice detection
function setupAudioAnalysis() {
    if (!localStream || !window.AudioContext) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        
        const source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyser);
        
        // Start checking for speech
        checkSpeakingLevel();
    } catch (error) {
        console.warn('Audio analysis not supported:', error);
    }
}

// Check if user is speaking
function checkSpeakingLevel() {
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    
    // Convert to dB (simplified)
    const dB = 20 * Math.log10(average / 255);
    
    // Update speaking state
    const wasSpeaking = isSpeaking;
    isSpeaking = !isMuted && dB > speakingThreshold;
    
    if (isSpeaking !== wasSpeaking) {
        // Update local participant
        const localParticipant = participants.get(localParticipantId);
        if (localParticipant) {
            localParticipant.isSpeaking = isSpeaking;
            updateParticipantUI(localParticipantId);
            updateMicCircle();
            
            // In real app, broadcast speaking state to others via Supabase
        }
    }
    
    // Continue checking
    requestAnimationFrame(checkSpeakingLevel);
}

// Populate audio device selector
async function populateAudioDevices() {
    try {
        // Wait for permission if needed
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        audioDeviceSelect.innerHTML = '<option value="">Select microphone...</option>';
        
        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${audioDeviceSelect.length}`;
            audioDeviceSelect.appendChild(option);
        });
    } catch (error) {
        console.warn('Could not enumerate audio devices:', error);
    }
}

// Change audio device
async function changeAudioDevice(deviceId) {
    if (!deviceId) return;
    
    try {
        // Stop current stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Get new stream with selected device
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Restart audio analysis
        if (audioContext) {
            audioContext.close();
            audioContext = null;
            analyser = null;
        }
        
        setupAudioAnalysis();
        
        showToast('Microphone changed');
    } catch (error) {
        console.error('Error changing audio device:', error);
        showToast('Failed to change microphone');
    }
}

// Toggle mute
function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });
    
    // Update local participant
    const localParticipant = participants.get(localParticipantId);
    if (localParticipant) {
        localParticipant.isMuted = isMuted;
        updateParticipantUI(localParticipantId);
    }
    
    updateMuteButton();
    updateMicCircle();
    
    // In real app, broadcast mute state to others via Supabase
}

// Copy room link to clipboard
function copyRoomLink() {
    const url = `${window.location.origin}/room.html?room=${roomCode.replace('-', '')}`;
    
    navigator.clipboard.writeText(url).then(() => {
        showToast('Room link copied to clipboard!');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Link copied!');
    });
}

// Initialize room
async function initRoom() {
    roomCode = getRoomCodeFromURL();
    roomCodeDisplay.textContent = roomCode;
    document.title = `Room ${roomCode} - VoiceChat.audio`;
    
    // Add local participant
    participants.set(localParticipantId, {
        name: 'You',
        isSpeaking: false,
        isMuted: false
    });
    
    updateParticipantsUI();
    
    // Try to get microphone access
    const micSuccess = await initMicrophone();
    if (micSuccess) {
        setupAudioAnalysis();
        populateAudioDevices();
        updateMuteButton();
    }
    
    // Simulate other participants (for demo)
    setTimeout(() => {
        // Add demo participants
        const demoParticipants = [
            { id: generateId(), name: 'Alex', isSpeaking: false, isMuted: false },
            { id: generateId(), name: 'Sam', isSpeaking: true, isMuted: false },
            { id: generateId(), name: 'Jordan', isSpeaking: false, isMuted: true }
        ];
        
        demoParticipants.forEach(p => {
            participants.set(p.id, p);
        });
        
        updateParticipantsUI();
        
        // Simulate speaking changes
        setInterval(() => {
            demoParticipants.forEach(p => {
                const participant = participants.get(p.id);
                if (participant && !participant.isMuted) {
                    participant.isSpeaking = Math.random() > 0.7;
                    updateParticipantUI(p.id);
                }
            });
        }, 3000);
    }, 2000);
}

// Event Listeners
copyLinkBtn.addEventListener('click', copyRoomLink);

leaveRoomBtn.addEventListener('click', () => {
    if (confirm('Leave this voice room?')) {
        window.location.href = 'index.html';
    }
});

muteToggleBtn.addEventListener('click', toggleMute);

localMicCircle.addEventListener('click', toggleMute);

audioDeviceSelect.addEventListener('change', (e) => {
    changeAudioDevice(e.target.value);
});

retryBtn.addEventListener('click', () => {
    hideError();
    initRoom();
});

goHomeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleMute();
    }
    
    if (e.code === 'KeyL' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        copyRoomLink();
    }
    
    if (e.code === 'Escape') {
        if (errorModal.classList.contains('active')) {
            hideError();
        }
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initRoom();
    
    // Show connection tip
    setTimeout(() => {
        console.log('Demo mode: For real voice chat, Supabase backend is required.');
        console.log('See README.md for setup instructions.');
    }, 1000);
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (audioContext) {
        audioContext.close();
    }
});
