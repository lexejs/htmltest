// Default configuration
const DEFAULT_CONFIG = {
    openai: {
        apiKey: "",
        model: "gpt-4o-mini-realtime-preview",  // Will be updated with actual model from settings
        modalities: ["audio", "text"],  // Static configuration
        voice: "alloy",
        instructions: "You are a friendly AI assistant. You should keep your responses concise and natural. Always respond in English. If you don't understand something, ask for clarification."
    }
};

// Initialize global config and state
window.APP_CONFIG = { ...DEFAULT_CONFIG };
let openaiClient = null;
let mediaStream = null;
let isCallActive = false;
let lastAction = null;

// Settings Management
const SETTINGS_KEY = 'openai_chat_settings';

function loadSettings() {
    const settings = localStorage.getItem(SETTINGS_KEY);
    if (settings) {
        const parsed = JSON.parse(settings);
        document.getElementById('apiKey').value = parsed.apiKey || '';
        document.getElementById('model').value = parsed.model || DEFAULT_CONFIG.openai.model;
        document.getElementById('voice').value = parsed.voice || DEFAULT_CONFIG.openai.voice;
        document.getElementById('instructions').value = parsed.instructions || DEFAULT_CONFIG.openai.instructions;
        
        // Update APP_CONFIG with saved settings
        APP_CONFIG.openai = {
            ...DEFAULT_CONFIG.openai,
            ...parsed
        };
    } else {
        // Load defaults
        document.getElementById('model').value = DEFAULT_CONFIG.openai.model;
        document.getElementById('voice').value = DEFAULT_CONFIG.openai.voice;
        document.getElementById('instructions').value = DEFAULT_CONFIG.openai.instructions;
    }
}

function saveSettings() {
    const settings = {
        apiKey: document.getElementById('apiKey').value,
        model: document.getElementById('model').value,
        voice: document.getElementById('voice').value,
        instructions: document.getElementById('instructions').value
    };
    
    // Update APP_CONFIG
    APP_CONFIG.openai = {
        ...DEFAULT_CONFIG.openai,
        ...settings
    };
    
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// DOM Elements
const elements = {
    toggleButton: document.getElementById('toggleButton'),
    errorModal: document.getElementById('errorModal'),
    errorMessage: document.getElementById('errorMessage'),
    errorDetails: document.getElementById('errorDetails'),
    errorTimestamp: document.getElementById('errorTimestamp'),
    errorDismiss: document.getElementById('errorDismiss'),
    errorRetry: document.getElementById('errorRetry'),
    closeModal: document.querySelector('.close-modal'),
    connectionStatus: document.getElementById('connectionStatus'),
    saveSettings: document.getElementById('saveSettings'),
    collapsible: document.querySelector('.collapsible'),
    collapsibleHeader: document.querySelector('.collapsible-header')
};

// Event Listeners
elements.toggleButton.addEventListener('click', toggleCall);
elements.errorDismiss.addEventListener('click', hideErrorModal);
elements.errorRetry.addEventListener('click', retryLastAction);
elements.closeModal.addEventListener('click', hideErrorModal);
elements.saveSettings.addEventListener('click', () => {
    saveSettings();
    elements.collapsible.classList.add('collapsed');
});
elements.collapsibleHeader.addEventListener('click', () => {
    elements.collapsible.classList.toggle('collapsed');
});

function updateConnectionStatus(status, isError = false) {
    elements.connectionStatus.textContent = status;
    elements.connectionStatus.classList.remove('active', 'error');
    if (isError) {
        elements.connectionStatus.classList.add('error');
    } else if (status === 'Connected') {
        elements.connectionStatus.classList.add('active');
    }
}

async function toggleCall() {
    if (!isCallActive) {
        await startCall();
    } else {
        hangup();
    }
}

async function startCall() {
    try {
        // Check if we have API key
        if (!APP_CONFIG.openai.apiKey) {
            elements.collapsible.classList.remove('collapsed');
            throw new Error("Please set your OpenAI API key in settings");
        }

        // Update UI first
        lastAction = startCall;
        isCallActive = true;
        updateConnectionStatus('Requesting microphone access...');
        elements.toggleButton.disabled = true;

        // Get microphone access
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
        } catch (micError) {
            throw new Error('Microphone access denied or not available');
        }
        
        updateConnectionStatus('Connecting to OpenAI...');
        
        // Initialize OpenAI client and session
        openaiClient = new OpenAIRealtimeClient(APP_CONFIG.openai.apiKey);
        await openaiClient.createSession();
        
        // Add local audio track
        if (mediaStream) {
            const audioTrack = mediaStream.getAudioTracks()[0];
            openaiClient.sendAudio(audioTrack);
            console.log('Audio track sent successfully');
            
            // Update UI
            elements.toggleButton.textContent = 'Stop Chat';
            elements.toggleButton.disabled = false;
            updateConnectionStatus('Connected');
        } else {
            throw new Error('No media stream available');
        }
        
    } catch (error) {
        console.error('Call failed:', error);
        updateConnectionStatus('Error', true);
        showError('Failed to start call', error);
        
        // Clean up on error
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                track.enabled = false;
                track.stop();
            });
            mediaStream = null;
        }
        resetUI();
    }
}

function hangup() {
    try {
        isCallActive = false;
        elements.toggleButton.disabled = true;
        updateConnectionStatus('Disconnecting...');
        
        // Clean up resources
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                track.enabled = false;
                track.stop();
                console.log('Audio track stopped');
            });
            mediaStream = null;
        }
        
        if (openaiClient) {
            openaiClient.close();
            openaiClient = null;
        }
        
        updateConnectionStatus('Disconnected');
        resetUI();
    } catch (error) {
        showError('Failed to hang up call', error);
    } finally {
        elements.toggleButton.disabled = false;
    }
}

function resetUI() {
    elements.toggleButton.textContent = 'Start Chat';
    elements.toggleButton.disabled = false;
    isCallActive = false;
}

function showError(context, error = null) {
    elements.errorMessage.textContent = context;
    elements.errorDetails.textContent = error ? error.message : '';
    elements.errorTimestamp.textContent = new Date().toLocaleString();
    elements.errorModal.style.display = 'block';
    elements.errorRetry.style.display = lastAction ? 'block' : 'none';
}

function hideErrorModal() {
    elements.errorModal.style.display = 'none';
}

async function retryLastAction() {
    if (lastAction) {
        hideErrorModal();
        await lastAction();
    }
}

// Initialize app
(async function init() {
    resetUI();
    updateConnectionStatus('Disconnected');
    loadSettings();
    
    // Show settings by default since API key is required
    elements.collapsible.classList.remove('collapsed');
})(); 