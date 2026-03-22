function toggleAuth() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('signup-form').classList.toggle('hidden');
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if(!email || !password) return alert('Please fill all fields');
    
    try {
        const data = await api.request('/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password })
        });
        
        api.setToken(data.token, data.role, data.refresh_token);
        window.location.href = data.role === 'seller' ? 'seller.html' : 'customer.html';
    } catch (e) {
        console.error("Login failed", e);
    }
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    
    if(!email || !password) return alert('Please fill all fields');
    
    try {
        await api.request('/auth/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password, role })
        });
        
        alert('Signup successful! Please login.');
        document.getElementById('login-email').value = email;
        toggleAuth();
    } catch (e) {
        console.error("Signup failed", e);
    }
}

window.onload = () => {
    const role = localStorage.getItem('role');
    if (api.getToken() && role) {
        window.location.href = role === 'seller' ? 'seller.html' : 'customer.html';
    }
}
