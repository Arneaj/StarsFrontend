// auth.js

// const AUTH_URL = "http://127.0.0.1:5001";
const AUTH_URL = "https://authentication.delightfulwater-b24a63e0.uksouth.azurecontainerapps.io";

// Make modal functions available globally
window.showModal = function(modalId) {
    // First hide all modals without triggering login
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    // Then show the requested modal
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
};

// This function is used by the close buttons
window.hideModals = function() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
};

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

            localStorage.setItem("username", email);

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
                    localStorage.setItem("userId", data.user_id);
                    alert("Login successful!");
                    // Make sure all modals are hidden
                    document.querySelectorAll('.modal').forEach(modal => {
                        modal.style.display = 'none';
                    });
                    updateAuthUI();
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
                    // Just close all modals
                    document.querySelectorAll('.modal').forEach(modal => {
                        modal.style.display = 'none';
                    });
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

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            localStorage.removeItem("token");
            localStorage.removeItem("userId");
            localStorage.removeItem("username");
            alert("Logged out successfully!");
            updateAuthUI(); // Update UI after logout
        });
    }

    // Call updateAuthUI on page load to set the initial state
    document.addEventListener('DOMContentLoaded', updateAuthUI);


}

function updateAuthUI() {
    const authButton = document.getElementById('auth-button');
    const logoutButton = document.getElementById('logout-button');
    const token = localStorage.getItem("token");

    if (token) {
        // User is logged in
        authButton.style.display = 'none';
        logoutButton.style.display = 'block';
    } else {
        // User is logged out
        authButton.style.display = 'block';
        logoutButton.style.display = 'none';
    }
}

// Attach listeners once using { once: true }
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', attachFormListeners, { once: true });
} else {
    attachFormListeners();
}