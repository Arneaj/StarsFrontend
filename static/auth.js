// auth.js

const AUTH_URL = "http://127.0.0.1:5001";

// Show/hide modal functions
function showModal(modalId) {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.getElementById(modalId).style.display = 'block';
}

function hideModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Track if listeners have been attached
let formListenersAttached = false;

function attachFormListeners() {
    if (formListenersAttached) return;
    formListenersAttached = true;
    console.log('Attaching form listeners'); // Debugging

    // Login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            console.log('Login form submitted'); // Debugging
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                alert("Email and password are required!");
                return;
            }

            try {
                const response = await fetch(`${AUTH_URL}/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({ username: email, password: password })
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("token", data.access_token);
                    alert("Login successful!");
                    hideModals();
                } else {
                    const errorText = await response.text();
                    alert(`Login failed! Error: ${errorText}`);
                }
            } catch (error) {
                console.error("Login error:", error);
                alert("Login failed due to a network error.");
            }
        });
    }

    // Registration form handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            console.log('Register form submitted'); // Debugging
            
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            try {
                const response = await fetch(`${AUTH_URL}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                if (response.ok) {
                    alert("Registration successful! You can now log in.");
                    showModal('login-modal');
                } else {
                    const errorData = await response.json();
                    alert(`Registration failed: ${errorData.detail || "Unknown error"}`);
                }
            } catch (error) {
                console.error("Registration error:", error);
                alert("Registration failed due to a network error.");
            }
        });
    }
}

// Attach listeners once using { once: true }
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', attachFormListeners, { once: true });
} else {
    attachFormListeners();
}