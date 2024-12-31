// DOM Elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// WebSocket setup
const ws = new WebSocket(`ws://${window.location.host}/chat`);

// WebSocket event handlers
ws.onopen = () => {
    console.log('Connected to WebSocket');
    appendSystemMessage('Connected to chat');
};

ws.onclose = () => {
    console.log('Disconnected from WebSocket');
    appendSystemMessage('Disconnected from chat');
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    appendSystemMessage('Error: Could not connect to chat');
};

ws.onmessage = (event) => {
    try {
        const response = JSON.parse(event.data);
        if (response.error) {
            appendSystemMessage(`Error: ${response.error.message}`);
            return;
        }
        
        if (response.content) {
            // Handle MCP message content
            const content = response.content;
            if (Array.isArray(content)) {
                content.forEach(msg => {
                    if (msg.text) {
                        appendMessage(msg.text, 'assistant');
                    }
                });
            } else if (content.text) {
                appendMessage(content.text, 'assistant');
            }
        } else {
            // Fallback for simple text responses
            appendMessage(event.data, 'assistant');
        }
    } catch (e) {
        console.error('Error parsing message:', e);
        appendMessage(event.data, 'assistant');
    }
};

// UI event handlers
sendButton.onclick = sendMessage;
messageInput.onkeypress = (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
};

// Functions
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        ws.send(message);
        appendMessage(message, 'user');
        messageInput.value = '';
    }
}

function appendMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function appendSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Focus input on load
messageInput.focus(); 