class OpenAIRealtimeClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.peerConnection = null;
        this.dataChannel = null;
        this.audioElement = null;
        this.audioContext = null;
        this.streamSource = null;
    }

    async createSession() {
        try {
            if (!this.apiKey) {
                throw new Error('API key is required');
            }

            const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: APP_CONFIG.openai.model,
                    modalities: APP_CONFIG.openai.modalities,
                    voice: APP_CONFIG.openai.voice,
                    input_audio_transcription: {
                        model: "whisper-1",
                    },
                    instructions: APP_CONFIG.openai.instructions
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            await this.initializeWebRTC(data.client_secret.value);
            return data;
        } catch (error) {
            console.error('Session creation failed:', error);
            throw error;
        }
    }

    async initializeWebRTC(sessionToken) {
        try {
            // Create peer connection
            this.peerConnection = new RTCPeerConnection();

            // Set up audio element
            this.audioElement = document.createElement("audio");
            this.audioElement.autoplay = true;
            
            // Configure audio settings
            const audioSettings = {
                sampleRate: 48000,
                channelCount: 1,
                volume: 1.0
            };
            
            // Set initial volume
            this.audioElement.volume = audioSettings.volume;
            
            document.body.appendChild(this.audioElement);

            // Set up track handler
            this.peerConnection.ontrack = (e) => {
                const stream = e.streams[0];
                
                // Prevent duplicate audio streams
                if (this.audioElement.srcObject) {
                    return;
                }
                
                this.audioElement.srcObject = stream;

                // Handle audio playback errors
                this.audioElement.addEventListener('error', (error) => {
                    console.error('Audio playback error:', error);
                    this.addLogEntry('System', 'Audio playback error', 'status');
                });

                // Add iOS specific handling
                const playAudio = () => {
                    if (this.audioElement.paused) {
                        this.audioElement.play().catch(error => {
                            console.error('Failed to play audio:', error);
                            this.addLogEntry('System', 'Failed to play audio', 'status');
                        });
                    }
                };

                // Handle iOS audio activation
                document.addEventListener('touchstart', playAudio, { once: true });
                
                playAudio();
            };

            // Set up data channel for events
            this.dataChannel = this.peerConnection.createDataChannel('oai-events');
            this.setupDataChannel();

            // Get local audio stream with specific constraints
            const ms = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 48000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            this.peerConnection.addTrack(ms.getTracks()[0]);

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Send offer to OpenAI
            const baseUrl = 'https://api.openai.com/v1/realtime';
            const model = APP_CONFIG.openai.model;
            const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type': 'application/sdp'
                }
            });

            if (!sdpResponse.ok) {
                throw new Error(`Failed to send SDP offer: ${sdpResponse.statusText}`);
            }

            const answer = {
                type: 'answer',
                sdp: await sdpResponse.text()
            };

            await this.peerConnection.setRemoteDescription(answer);

            // Monitor connection state
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange(state);
                }
            };

        } catch (error) {
            console.error('WebRTC initialization failed:', error);
            throw error;
        }
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => {
            this.addLogEntry('System', 'Connection established', 'status');
            
            // Send initial response.create event
            const responseCreate = {
                type: "response.create",
                response: {
                    modalities: APP_CONFIG.openai.modalities,
                    instructions: APP_CONFIG.openai.instructions
                }
            };
            this.dataChannel.send(JSON.stringify(responseCreate));
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                // Check message uniqueness
                const messageId = message.event_id || message.item_id;
                if (messageId && messageId === this.lastMessageId) {
                    return;
                }
                this.lastMessageId = messageId;

                // Prevent concurrent message processing
                if (this.isProcessingMessage) {
                    setTimeout(() => this.handleMessage(message), 100);
                    return;
                }

                this.handleMessage(message);
            } catch (error) {
                console.error('Error handling message:', error);
                this.addLogEntry('System', `Error: ${error.message}`, 'status');
            }
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.addLogEntry('System', `Error: ${error.message}`, 'status');
        };

        this.dataChannel.onclose = () => {
            this.addLogEntry('System', 'Connection closed', 'status');
        };
    }

    handleMessage(message) {
        try {
            // Ignore response.audio_transcript.delta messages
            if (message.type === 'response.audio_transcript.delta') {
                return;
            }
            // Log all messages for debugging
            console.log('Received message:', message);

            // Only try to log to UI if log container exists
            const logContainer = document.getElementById('logContainer');
            if (!logContainer) {
                // Skip UI logging if container doesn't exist
                return;
            }

            // Create function for adding message
            const addMessage = (speaker, text) => {
                const entry = document.createElement('div');
                entry.className = `log-entry ${speaker.toLowerCase()}`;
                entry.innerHTML = `
                    <span class="timestamp">${new Date().toLocaleTimeString()}</span>
                    <span class="message">${text}</span>
                `;
                logContainer.appendChild(entry);
                logContainer.scrollTop = logContainer.scrollHeight;
            };

            // Handle different message types
            switch (message.type) {
                case 'error':
                    const errorMessage = message.error?.message || JSON.stringify(message.error);
                    addMessage('System', `Error: ${errorMessage}`);
                    break;

                case 'conversation.item.created':
                    // Handle user message
                    if (message.item?.input?.content?.text) {
                        addMessage('User', message.item.input.content.text);
                    }
                    break;

                case 'response.audio_transcript.done':
                    if (message.transcript && message.response_id) {
                        // Only assistant messages
                        addMessage('Assistant', message.transcript);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    addLogEntry(speaker, message, type = 'message') {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) {
            console.error('Log container not found');
            return;
        }

        const entry = document.createElement('div');
        entry.className = `log-entry ${speaker.toLowerCase()} ${type}`;

        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        entry.appendChild(timestamp);

        const messageSpan = document.createElement('span');
        messageSpan.className = 'message';
        messageSpan.textContent = message;
        entry.appendChild(messageSpan);

        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    sendAudio(audioTrack) {
        if (!this.peerConnection) {
            throw new Error('WebRTC connection not initialized');
        }

        try {
            this.peerConnection.addTrack(audioTrack);
        } catch (error) {
            console.error('Failed to send audio:', error);
            throw error;
        }
    }

    close() {
        try {
            if (this.dataChannel) {
                this.dataChannel.close();
                this.dataChannel = null;
            }
            
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            if (this.audioElement) {
                if (this.audioElement.srcObject) {
                    const tracks = this.audioElement.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    this.audioElement.srcObject = null;
                }
                this.audioElement.remove();
                this.audioElement = null;
            }
        } catch (error) {
            console.error('Failed to close connection:', error);
        }
    }
}

// Export the client
window.OpenAIRealtimeClient = OpenAIRealtimeClient; 