// Global state management
let currentUser = null;
let selectedMood = null;
let chatHistory = [];



// Page navigation functions
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showLogin(role) {
    if (role === 'student') {
        showPage('student-login');
    } else if (role === 'teacher') {
        showPage('teacher-login');
    }
}

// Student Signup Function
function handleStudentSignup(event) {
    event.preventDefault();

    const name = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();

    clearMessages();

    if (!name || !email || !password) {
        showMessage('Please fill in all fields.', 'error');
        return false;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 6 characters long.', 'error');
        return false;
    }

    fetch('http://localhost:5000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showMessage('Account created successfully! Please sign in.', 'success');
            document.getElementById('student-signup-form').reset();
            setTimeout(() => showPage('student-login'), 2000);
        } else {
            showMessage(data.message, 'error');
        }
    })
    .catch(err => {
        console.error('Signup error:', err);
        showMessage('Server error. Try again later.', 'error');
    });

    return false;
}


// Student Login Function
function handleStudentLogin(event) {
    event.preventDefault();

    const email = document.getElementById('student-username').value.trim();  // This should be email now
    const password = document.getElementById('student-password').value.trim();

    clearMessages();

    if (!email || !password) {
        showMessage('Please enter both email and password.', 'error');
        return false;
    }

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
            chatHistory = [];
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showPage('student-dashboard');
        } else {
            showMessage(data.error, 'error');
        }
    })
    .catch(err => {
        console.error('Login error:', err);
        showMessage('Server error. Try again later.', 'error');
    });

    return false;
}



function handleTeacherLogin(event) {
    console.log('handleTeacherLogin called');
    event.preventDefault();
    
    const teacherId = document.getElementById('teacher-id').value.trim();
    const password = document.getElementById('teacher-password').value.trim();
    
    console.log('Teacher login attempt:', { teacherId, password: password ? '***' : 'empty' });
    
    // Clear any existing messages
    clearMessages();
    
    // Basic validation
    if (!teacherId || !password) {
        showMessage('Please enter both Teacher ID and password.', 'error');
        return false;
    }
    
    // Mock authentication - for demo purposes, any non-empty credentials work
    if (authenticateTeacher(teacherId, password)) {
        currentUser = { type: 'teacher', id: teacherId };
        console.log('Teacher logged in successfully:', currentUser);
        showPage('teacher-dashboard');
        
        // Initialize charts after a short delay to ensure DOM is ready
        setTimeout(() => {
            initializeCharts();
        }, 100);
        
        // TODO: Integration point for backend teacher session
        // Example: await createTeacherSession(currentUser);
    } else {
        showMessage('Invalid credentials. Please try again.', 'error');
    }
    
    return false;
}

// Mock authentication functions
function authenticateStudent(username, password) {
    // Check against registered users
    const user = registeredUsers.find(user => 
        user.username === username && 
        user.password === password && 
        user.type === 'student'
    );
    
    console.log('Authenticating student:', username, 'Found user:', user ? 'Yes' : 'No');
    return user !== undefined;
}

function authenticateTeacher(teacherId, password) {
    // For demo purposes - accept any non-empty credentials
    // TODO: Replace with actual API call to backend
    console.log('Authenticating teacher:', teacherId);
    return teacherId.length > 0 && password.length > 0;
}

// Message display functions
function showMessage(message, type) {
    const messageClass = type === 'success' ? 'success-message' : 'error-message';
    const messageHtml = `<div class="${messageClass}">${message}</div>`;
    
    // Find the active form and add message
    const activeForm = document.querySelector('.page.active form');
    if (activeForm) {
        // Remove existing messages
        const existingMessages = activeForm.querySelectorAll('.success-message, .error-message');
        existingMessages.forEach(msg => msg.remove());
        
        // Add new message at the top of the form
        activeForm.insertAdjacentHTML('afterbegin', messageHtml);
    }
}

function clearMessages() {
    const messages = document.querySelectorAll('.success-message, .error-message');
    messages.forEach(msg => msg.remove());
}


        // Mood selection functionality
        function selectMood(mood) {
            selectedMood = mood;
            
            // Update UI
            const moodBtns = document.querySelectorAll('.mood-btn');
            moodBtns.forEach(btn => btn.classList.remove('selected'));
            event.target.classList.add('selected');
            
            // Show chat interface
            document.getElementById('chat-section').classList.remove('hidden');
            
            // TODO: Store mood data for ChromaDB/Vector database integration
            storeMoodData(currentUser, mood, new Date());
            
            // Add initial AI response based on mood
            addAIResponse(getMoodResponse(mood));
        }

        // Chat functionality
        function sendMessage() {
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            
            if (message) {
                addUserMessage(message);
                input.value = '';
                
                // TODO: Integration point for LLM/AI response
                processUserMessage(message);
            }
        }

        function addUserMessage(message) {
            const chatMessages = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = 'background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px; margin: 10px 0; text-align: right;';
            messageDiv.textContent = message;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Store in chat history for backend integration
            chatHistory.push({ type: 'user', message: message, timestamp: new Date() });
        }

        function addAIResponse(response) {
            const chatMessages = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = 'background: rgba(255,255,255,0.15); padding: 10px; border-radius: 10px; margin: 10px 0; text-align: left;';
            messageDiv.textContent = response;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Store in chat history for backend integration
            chatHistory.push({ type: 'ai', message: response, timestamp: new Date() });
        }

        // Data storage functions for backend integration
        function storeMoodData(user, mood, timestamp) {
            // TODO: Integration point for ChromaDB/Vector database
            const moodData = {
                userId: user.username || user.id,
                mood: mood,
                timestamp: timestamp,
                userType: user.type
            };
            
            console.log('Storing mood data:', moodData);
            // Example: await saveMoodToVectorDB(moodData);
        }

        function processUserMessage(message) {
            // TODO: Integration point for LLM processing
            // This is where you would send the message to your AI backend
            
            const contextData = {
                userId: currentUser.username || currentUser.id,
                currentMood: selectedMood,
                message: message,
                chatHistory: chatHistory,
                timestamp: new Date()
            };
            
            console.log('Processing user message with context:', contextData);
            
            // Mock AI response (replace with actual LLM call)
            setTimeout(() => {
                const aiResponse = generateMockAIResponse(message, selectedMood);
                addAIResponse(aiResponse);
                
                // TODO: Store conversation in vector database
                // Example: await storeConversationInVectorDB(contextData, aiResponse);
            }, 1000);
        }

        // Mock AI response generation (replace with actual LLM integration)
        function generateMockAIResponse(message, mood) {
            // TODO: Replace with actual LLM/AI model integration
            const responses = {
                happy: "That's wonderful to hear! What's been making you feel so positive today?",
                sad: "I'm sorry you're feeling down. Would you like to talk about what's bothering you?",
                anxious: "I understand you're feeling anxious. Let's work through this together. What's on your mind?",
                neutral: "Thanks for sharing. How has your day been going overall?",
                excited: "Your excitement is contagious! What's got you feeling so energized?",
                tired: "It sounds like you might need some rest. Have you been getting enough sleep lately?"
            };
            
            return responses[mood] || "I'm here to listen. Tell me more about how you're feeling.";
        }

        function getMoodResponse(mood) {
            const responses = {
                happy: "I'm so glad you're feeling happy today! That's amazing. 😊",
                sad: "I'm here for you. It's okay to feel sad sometimes. 💙",
                anxious: "I understand you're feeling anxious. Let's take this one step at a time. 🌸",
                neutral: "Thanks for checking in. Every feeling is valid. 🌿",
                excited: "Your excitement is wonderful! I love your energy! ✨",
                tired: "Rest is important. Be gentle with yourself today. 🌙"
            };
            return responses[mood] || "Thank you for sharing how you're feeling.";
        }

        // Teacher dashboard chart initialization
        function initializeCharts() {
            // Mood trends chart
            const moodCtx = document.getElementById('moodChart').getContext('2d');
            new Chart(moodCtx, {
                type: 'line',
                data: {
                    labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                    datasets: [{
                        label: 'Happy',
                        data: [45, 52, 48, 61, 58],
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Neutral',
                        data: [30, 28, 35, 25, 32],
                        borderColor: '#fbbf24',
                        backgroundColor: 'rgba(251, 191, 36, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Sad',
                        data: [15, 12, 10, 8, 6],
                        borderColor: '#f87171',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: { color: 'white' }
                        }
                    },
                    scales: {
                        y: { 
                            ticks: { color: 'white' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        },
                        x: { 
                            ticks: { color: 'white' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        }
                    }
                }
            });

            // Check-ins chart
            const checkinCtx = document.getElementById('checkinChart').getContext('2d');
            new Chart(checkinCtx, {
                type: 'bar',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    datasets: [{
                        label: 'Daily Check-ins',
                        data: [89, 95, 87, 102, 94],
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: { color: 'white' }
                        }
                    },
                    scales: {
                        y: { 
                            ticks: { color: 'white' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        },
                        x: { 
                            ticks: { color: 'white' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        }
                    }
                }
            });
        }

        // Logout functionality
        function logout() {
            currentUser = null;
            selectedMood = null;
            chatHistory = [];
            
            // Reset forms
            document.getElementById('student-username').value = '';
            document.getElementById('student-password').value = '';
            document.getElementById('teacher-id').value = '';
            document.getElementById('teacher-password').value = '';
            
            // Hide chat section
            document.getElementById('chat-section').classList.add('hidden');
            
            // Clear chat messages
            document.getElementById('chat-messages').innerHTML = '<div style="color: rgba(255,255,255,0.8); text-align: center; margin-top: 2rem;">Hi! I\'m here to listen and support you. How can I help today?</div>';
            
            // Reset mood selection
            const moodBtns = document.querySelectorAll('.mood-btn');
            moodBtns.forEach(btn => btn.classList.remove('selected'));
            
            // Return to landing page
            showPage('landing');
        }

        // Enter key support for chat input and form debugging
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM Content Loaded - Initializing event listeners');
            
            // Chat input enter key support
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            }
            
            // Add enter key support for login forms
            const studentUsername = document.getElementById('student-username');
            const studentPassword = document.getElementById('student-password');
            const teacherId = document.getElementById('teacher-id');
            const teacherPassword = document.getElementById('teacher-password');
            
            [studentUsername, studentPassword].forEach(input => {
                if (input) {
                    input.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            const form = e.target.closest('form');
                            if (form) {
                                form.dispatchEvent(new Event('submit'));
                            }
                        }
                    });
                }
            });
            
            [teacherId, teacherPassword].forEach(input => {
                if (input) {
                    input.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            const form = e.target.closest('form');
                            if (form) {
                                form.dispatchEvent(new Event('submit'));
                            }
                        }
                    });
                }
            });
            
            // Debug form submission
            const studentForm = document.querySelector('#student-login form');
            const teacherForm = document.querySelector('#teacher-login form');
            
            if (studentForm) {
                console.log('Student form found and event listener attached');
            }
            
            if (teacherForm) {
                console.log('Teacher form found and event listener attached');
            }
        });

       
          async function sendMessage() {
    const userInput = document.getElementById("user-input").value;

    const res = await fetch("http://127.0.0.1:5000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: userInput }),
    });

    const data = await res.json();
    document.getElementById("chat-response").innerText = data.response;
  }
        

        async function saveMoodToVectorDB(moodData) {
   
            console.log('Vector DB Integration Point: saveMoodToVectorDB', moodData);
        }

        async function storeConversationInVectorDB(contextData, aiResponse) {
           
            console.log('Vector DB Integration Point: storeConversationInVectorDB', { contextData, aiResponse });
        }

        /**
         * LLM/AI INTEGRATION POINTS
         * These functions should be implemented to connect with your chosen LLM or AI service
         */

        async function generateAIResponse(userMessage, context) {
           
            console.log('Embedding Integration Point: generateEmbedding', text);
            return null;
        }

        

        async function validateStudentCredentials(username, password) {
           
            console.log('Auth Integration Point: validateStudentCredentials', { username });
            return username.length > 0 && password.length > 0;
        }

        async function validateTeacherCredentials(teacherId, password) {
           
            console.log('Auth Integration Point: validateTeacherCredentials', { teacherId });
            return teacherId.length > 0 && password.length > 0;
        }

        function getAuthToken() {
           
            return 'mock-token';
        }

        async function fetchStudentAnalytics() {
           
            console.log('Analytics Integration Point: fetchStudentAnalytics');
            return {
                totalStudents: 127,
                mostCommonMood: 'happy',
                positiveResponseRate: 85,
                studentsNeedingSupport: 12
            };
        }

        

        function initializeWebSocket() {
           
            console.log('WebSocket Integration Point: initializeWebSocket');
        }

      

        function exportChatHistory() {
            // TODO: Implement chat history export functionality
            const exportData = {
                userId: currentUser.username || currentUser.id,
                chatHistory: chatHistory,
                selectedMood: selectedMood,
                timestamp: new Date()
            };
            
            console.log('Export Integration Point: exportChatHistory', exportData);
            
            // Create downloadable JSON file
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chat-history-${Date.now()}.json`;
            link.click();
        }

        // Initialize the application
        function initializeApp() {
            console.log('MindMate AI Application Initialized');
            console.log('Ready for backend integration:');
            console.log('- Vector Database (ChromaDB)');
            console.log('- LLM Services');
            console.log('- Authentication APIs');
            console.log('- Real-time WebSocket connections');
            
        }

        // Call initialization when DOM is loaded
        document.addEventListener('DOMContentLoaded', initializeApp);
