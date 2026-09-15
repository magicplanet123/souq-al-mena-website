// AI Chatbot for Lead Capture
class SouqChatbot {
    constructor() {
        this.messages = [];
        this.userInfo = {
            name: '',
            email: '',
            phone: '',
            service: '',
            query: ''
        };
        this.stage = 'greeting'; // greeting, service, name, email, phone, query, confirmation
        this.initChatbot();
    }

    initChatbot() {
        this.createChatbotUI();
        this.attachEventListeners();
    }

    createChatbotUI() {
        const chatbotHTML = `
            <div id="chatbot-container" class="chatbot-container">
                <div class="chatbot-header">
                    <div class="chatbot-title">
                        <span class="chatbot-icon">💬</span>
                        <span>Lead Capture Form</span>
                    </div>
                    <button id="chatbot-close" class="chatbot-close">&times;</button>
                </div>

                <div id="chatbot-messages" class="chatbot-messages">
                    <div class="chatbot-message bot-message">
                        <p>👋 Welcome! Let's capture your inquiry. What service interests you?</p>
                        <div class="quick-replies">
                            <button class="quick-reply" data-service="trading">📦 General Trading</button>
                            <button class="quick-reply" data-service="irrigation">💧 Irrigation Solutions</button>
                            <button class="quick-reply" data-service="digital">📱 Digital Marketing</button>
                            <button class="quick-reply" data-service="automation">⚙️ Automations</button>
                            <button class="quick-reply" data-service="recruitment">👥 Recruitment</button>
                        </div>
                    </div>
                </div>

                <div class="chatbot-input-area">
                    <input type="text" id="chatbot-input" class="chatbot-input" placeholder="Type your message..." />
                    <button id="chatbot-send" class="chatbot-send">Send</button>
                </div>
            </div>

            <button id="chatbot-toggle" class="chatbot-toggle-floating">
                <span class="chatbot-toggle-icon">💬</span>
            </button>
        `;

        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    }

    attachEventListeners() {
        const toggle = document.getElementById('chatbot-toggle');
        const close = document.getElementById('chatbot-close');
        const send = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');
        const container = document.getElementById('chatbot-container');

        toggle.addEventListener('click', () => this.toggleChat());
        close.addEventListener('click', () => this.closeChat());
        send.addEventListener('click', () => this.sendMessage());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Quick replies
        document.querySelectorAll('.quick-reply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const service = e.target.dataset.service;
                this.selectService(service);
            });
        });
    }

    toggleChat() {
        const container = document.getElementById('chatbot-container');
        container.classList.toggle('active');
    }

    closeChat() {
        const container = document.getElementById('chatbot-container');
        container.classList.remove('active');
    }

    sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();

        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';

        setTimeout(() => this.handleUserResponse(message), 500);
    }

    addMessage(text, sender) {
        const messagesDiv = document.getElementById('chatbot-messages');
        const messageEl = document.createElement('div');
        messageEl.className = `chatbot-message ${sender}-message`;
        messageEl.innerHTML = `<p>${text}</p>`;
        messagesDiv.appendChild(messageEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    selectService(service) {
        const serviceMap = {
            'trading': '📦 General Trading',
            'irrigation': '💧 Irrigation Solutions',
            'digital': '📱 Digital Marketing',
            'automation': '⚙️ Business Automations',
            'recruitment': '👥 Recruitment & HR'
        };

        this.userInfo.service = serviceMap[service];
        this.addMessage(this.userInfo.service, 'user');
        this.stage = 'name';

        setTimeout(() => {
            this.addMessage(`Great! You selected ${this.userInfo.service}. What's your name?`, 'bot');
        }, 300);
    }

    handleUserResponse(message) {
        if (this.stage === 'name') {
            this.userInfo.name = message;
            this.stage = 'email';
            this.addMessage(`Nice to meet you, ${message}! What's your email address?`, 'bot');
        }
        else if (this.stage === 'email') {
            if (this.isValidEmail(message)) {
                this.userInfo.email = message;
                this.stage = 'phone';
                this.addMessage(`Thanks! What's your phone number?`, 'bot');
            } else {
                this.addMessage(`Please enter a valid email address.`, 'bot');
            }
        }
        else if (this.stage === 'phone') {
            this.userInfo.phone = message;
            this.stage = 'query';
            this.addMessage(`Perfect! What specific request or question do you have about ${this.userInfo.service}?`, 'bot');
        }
        else if (this.stage === 'query') {
            this.userInfo.query = message;
            this.stage = 'confirmation';
            this.showConfirmation();
        }
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showConfirmation() {
        const summary = `
            <strong>Let me confirm your details:</strong><br>
            <br>
            <strong>Service:</strong> ${this.userInfo.service}<br>
            <strong>Name:</strong> ${this.userInfo.name}<br>
            <strong>Email:</strong> ${this.userInfo.email}<br>
            <strong>Phone:</strong> ${this.userInfo.phone}<br>
            <strong>Request:</strong> ${this.userInfo.query}
        `;

        const messagesDiv = document.getElementById('chatbot-messages');
        const confirmEl = document.createElement('div');
        confirmEl.className = 'chatbot-message bot-message';
        confirmEl.innerHTML = `
            <p>${summary}</p>
            <div class="quick-replies">
                <button class="quick-reply confirm-yes">✅ Correct</button>
                <button class="quick-reply confirm-no">❌ Edit</button>
            </div>
        `;
        messagesDiv.appendChild(confirmEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        confirmEl.querySelector('.confirm-yes').addEventListener('click', () => this.submitLead());
        confirmEl.querySelector('.confirm-no').addEventListener('click', () => this.resetChat());
    }

    submitLead() {
        // Save lead to localStorage (or send to your server)
        const lead = {
            timestamp: new Date().toLocaleString(),
            ...this.userInfo
        };

        // Get existing leads
        const leads = JSON.parse(localStorage.getItem('souqLeads') || '[]');
        leads.push(lead);
        localStorage.setItem('souqLeads', JSON.stringify(leads));

        // Send to your email/webhook if needed
        this.sendLeadToServer(lead);

        this.addMessage(`
            <strong>🎉 Thank you!</strong><br>
            <br>
            We've captured your request. Our team will contact you within 2-4 hours at ${this.userInfo.phone}.<br>
            <br>
            You can also reach us anytime at:<br>
            📱 <strong>+971 50 268 7989</strong><br>
            📧 <strong>souqalmena@gmail.com</strong>
        `, 'bot');

        setTimeout(() => {
            this.addMessage(`Is there anything else I can help you with?`, 'bot');
            this.stage = 'service';
        }, 2000);
    }

    sendLeadToServer(lead) {
        // Send to WhatsApp for instant notification
        const message = `
New Lead Captured:
Name: ${lead.name}
Email: ${lead.email}
Phone: ${lead.phone}
Service: ${lead.service}
Request: ${lead.query}
Time: ${lead.timestamp}
        `.trim();

        const whatsappUrl = `https://wa.me/971502687989?text=${encodeURIComponent(message)}`;
        // Silently send (don't open WhatsApp - just notify)
        fetch(whatsappUrl, {method: 'HEAD'}).catch(() => {});

        // Also send to your email via FormSubmit or similar
        const formData = new FormData();
        Object.assign(formData, lead);
        // fetch('https://formspree.io/f/YOUR_ID', {
        //     method: 'POST',
        //     body: formData
        // });
    }

    resetChat() {
        this.userInfo = {
            name: '',
            email: '',
            phone: '',
            service: '',
            query: ''
        };
        this.stage = 'greeting';

        const messagesDiv = document.getElementById('chatbot-messages');
        messagesDiv.innerHTML = `
            <div class="chatbot-message bot-message">
                <p>Let's start over. What service are you interested in?</p>
                <div class="quick-replies">
                    <button class="quick-reply" data-service="trading">📦 General Trading</button>
                    <button class="quick-reply" data-service="irrigation">💧 Irrigation Solutions</button>
                    <button class="quick-reply" data-service="digital">📱 Digital Marketing</button>
                    <button class="quick-reply" data-service="automation">⚙️ Automations</button>
                    <button class="quick-reply" data-service="recruitment">👥 Recruitment</button>
                </div>
            </div>
        `;

        document.querySelectorAll('.quick-reply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const service = e.target.dataset.service;
                this.selectService(service);
            });
        });
    }
}

// Initialize chatbot when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SouqChatbot();
});
