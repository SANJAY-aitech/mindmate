// Global state
let currentUser = null;
let selectedMood = null;

// Show page
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showLogin(role) {
    showPage(role === 'student' ? 'student-login' : 'teacher-login');
}

// Student Signup
function handleStudentSignup(event) {
    event.preventDefault();
    const name = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    clearMessages();
    if (!name || !email || !password) return showMessage('Please fill in all fields.', 'error');
    if (password.length < 6) return showMessage('Password must be at least 6 characters long.', 'error');

    fetch('http://localhost:5000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showMessage('Account created! Please sign in.', 'success');
            document.getElementById('student-signup-form').reset();
            setTimeout(() => showPage('student-login'), 2000);
        } else showMessage(data.message, 'error');
    })
    .catch(() => showMessage('Server error. Try again later.', 'error'));
}

// Student Login
function handleStudentLogin(event) {
    event.preventDefault();
    const email = document.getElementById('student-username').value.trim();
    const password = document.getElementById('student-password').value.trim();
    clearMessages();
    if (!email || !password) return showMessage('Please enter both email and password.', 'error');

    fetch('http://localhost:5000/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.user) {
            currentUser = data.user;
            selectedMood = null;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showPage('student-dashboard');
            loadChatHistory(); // 👈 Load previous messages from backend
        } else showMessage(data.error, 'error');
    })
    .catch(() => showMessage('Server error. Try again later.', 'error'));
}

// Teacher Login
function handleTeacherLogin(event) {
    event.preventDefault();
    const teacherId = document.getElementById('teacher-id').value.trim();
    const password = document.getElementById('teacher-password').value.trim();
    clearMessages();
    if (!teacherId || !password) return showMessage('Please enter both Teacher ID and password.', 'error');

    fetch('http://localhost:5000/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.user) {
            currentUser = data.user;
            showPage('teacher-dashboard');
            setTimeout(() => initializeCharts(), 100);
        } else showMessage(data.error, 'error');
    })
    .catch(() => showMessage('Server error. Try again later.', 'error'));
}

// Load past chat history from backend
function toggleHistory() {
    const container = document.getElementById('chat-history-container');
    container.classList.toggle('hidden');
}

// Load history into separate container
function loadChatHistory() {
    fetch(`http://localhost:5000/history?email=${currentUser.email}`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('chat-history-list');
            container.innerHTML = ''; // Clear existing

            if (data.history && Array.isArray(data.history)) {
                data.history.forEach(entry => {
                    const msgBlock = document.createElement('div');
                    msgBlock.innerHTML = `
                        <div style="color: #90cdf4;"><strong>You:</strong> ${entry.user}</div>
                        <div style="color: #fbcfe8;"><strong>AI:</strong> ${entry.bot}</div>
                        <hr style="border: 0.5px solid rgba(255,255,255,0.1); margin: 8px 0;">
                    `;
                    container.appendChild(msgBlock);
                });
            }
        })
        .catch(err => console.error("Error loading history:", err));
}

// Mood selection
function selectMood(mood) {
    selectedMood = mood;
    document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
    document.getElementById('chat-section').classList.remove('hidden');
    storeMoodData(currentUser, mood, new Date());
    addAIResponse(getMoodResponse(mood));
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (message) {
        addUserMessage(message);
        input.value = '';
        processUserMessage(message);
    }
}

function addUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px; margin: 10px 0; text-align: right;';
    msgDiv.textContent = message;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addAIResponse(response) {
    const chatMessages = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('ai-response');
    msgDiv.innerHTML = formatAIResponse(response);  
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatAIResponse(text) {
     return marked.parse(text);
}

async function processUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.textContent = "MindMate is thinking...";
    loadingDiv.style.cssText = 'color: #aaa; font-style: italic; text-align: left; margin-top: 5px;';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const res = await fetch("http://127.0.0.1:5000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                email: currentUser.email,
                mood: selectedMood
            }),
        });
        const data = await res.json();
        loadingDiv.remove();
        addAIResponse(data.response);
    } catch (err) {
        console.error("Chat API Error:", err);
        loadingDiv.textContent = "❌ Something went wrong. Try again.";
    }
}

function storeMoodData(user, mood, timestamp) {
    console.log('Mood data:', { user: user.email, mood, timestamp });
}

function getMoodResponse(mood) {
    const responses = {
        happy: "I'm so glad you're feeling happy today! 😊",
        sad: "I'm here for you. It's okay to feel sad sometimes. 💙",
        anxious: "You're feeling anxious. Let's take it one step at a time. 🌸",
        neutral: "Thanks for checking in. Every feeling is valid. 🌿",
        excited: "Your excitement is wonderful! ✨",
        tired: "Rest is important. Be gentle with yourself. 🌙"
    };
    return responses[mood] || "Thank you for sharing how you're feeling.";
}

function clearMessages() {
    document.querySelectorAll('.success-message, .error-message').forEach(m => m.remove());
}

function showMessage(message, type) {
    const messageClass = type === 'success' ? 'success-message' : 'error-message';
    const html = `<div class="${messageClass}">${message}</div>`;
    const activeForm = document.querySelector('.page.active form');
    if (activeForm) {
        activeForm.querySelectorAll('.success-message, .error-message').forEach(m => m.remove());
        activeForm.insertAdjacentHTML('afterbegin', html);
    }
}

function initializeCharts() {
    console.log("Charts initialized (placeholder)");
}

function logout() {
    currentUser = null;
    selectedMood = null;
    document.getElementById('student-username').value = '';
    document.getElementById('student-password').value = '';
    document.getElementById('teacher-id').value = '';
    document.getElementById('teacher-password').value = '';
    document.getElementById('chat-section').classList.add('hidden');
    document.getElementById('chat-messages').innerHTML = '<div style="color: rgba(255,255,255,0.8); text-align: center; margin-top: 2rem;">Hi! I\'m here to listen and support you. How can I help today?</div>';
    document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
    showPage('landing');
}

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});
