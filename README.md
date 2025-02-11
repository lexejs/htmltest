# OpenAI Audio Chat

A web-based real-time audio chat application using OpenAI's real-time API and WebRTC. This is a Progressive Web App (PWA) that allows you to have voice conversations with OpenAI's GPT models.

## Features

- Real-time voice conversations with GPT models
- Browser-based, no installation required
- Configurable voice selection
- Secure API key storage using browser password manager
- Persistent settings across sessions
- Mobile-friendly interface
- PWA support for mobile devices
- Full iOS support with splash screens and home screen icons

## Usage

1. Visit [https://lexejs.github.io/htmltest/](https://lexejs.github.io/htmltest/)
2. Enter your OpenAI API key in the settings
3. Select your preferred voice model
4. Click "Start Chat" to begin the conversation
5. Allow microphone access when prompted
6. Speak naturally and listen to the AI's responses

## Security

- API keys are stored securely using the browser's password manager
- All communication is done over HTTPS
- No server-side storage of sensitive data
- API keys are never logged or transmitted except to OpenAI

## Browser Support

Requires a modern browser with support for:
- WebRTC
- MediaRecorder API
- Web Audio API
- LocalStorage
- Secure Context (HTTPS)

## Development

To run locally:

1. Clone the repository
```bash
git clone https://github.com/lexejs/htmltest.git
```

2. Serve the files using a web server (HTTPS required for microphone access)
```bash
# Example using Python
python3 -m http.server 8000

# Example using Node.js
npx http-server -S -C cert.pem -K key.pem
```

3. Open in your browser
```
https://localhost:8000
```

## License

MIT License. See [LICENSE](LICENSE) for details. 