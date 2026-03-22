// Update this with your live Railway URL
const API_BASE = 'https://anat-production.up.railway.app/api';
const IMAGE_BASE = 'https://anat-production.up.railway.app/uploads';

const api = {
    getToken: () => localStorage.getItem('token'),
    getRefreshToken: () => localStorage.getItem('refresh_token'),
    setToken: (token, role, refreshToken) => {
        localStorage.setItem('token', token);
        localStorage.setItem('role', role);
        if(refreshToken) localStorage.setItem('refresh_token', refreshToken);
    },
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('refresh_token');
        window.location.href = 'index.html';
    },
    getHeaders: (isFormData = false) => {
        const headers = {
            'Authorization': `Bearer ${api.getToken()}`
        };
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    },
    request: async (endpoint, options = {}, isRetry = false) => {
        try {
            let res = await fetch(`${API_BASE}${endpoint}`, options);
            
            // Handle Token Expiry silently
            if (res.status === 401 && !isRetry && api.getRefreshToken()) {
                const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: api.getRefreshToken() })
                });
                
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    api.setToken(refreshData.token, localStorage.getItem('role'), refreshData.refresh_token);
                    
                    if(!options.headers) options.headers = {};
                    options.headers['Authorization'] = `Bearer ${refreshData.token}`;
                    
                    res = await fetch(`${API_BASE}${endpoint}`, options);
                } else {
                    api.logout();
                    throw new Error('Session expired. Please login again.');
                }
            }
            
            const data = await res.json();
            if (!res.ok) {
                if(res.status === 401) api.logout();
                throw new Error(data.error || 'API Error');
            }
            return data;
        } catch (error) {
            if(!isRetry) alert(error.message);
            throw error;
        }
    },
    // V5 Trust & Identity Utilities
    getSellerContext: (email) => {
        if (!email) return { name: 'Unknown Seller', avatar: '?', rating: '0.0', reviews: 0, verified: false };
        
        const prefix = email.split('@')[0];
        const name = prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._]/g, ' ');
        
        // Deterministic mock data based on email hash-like string
        const charCodeSum = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const rating = (4.0 + (charCodeSum % 10) / 10).toFixed(1);
        const reviews = 10 + (charCodeSum % 90);
        const verified = charCodeSum % 3 === 0; // 33% chance of being verified
        const initials = prefix.substring(0, 2).toUpperCase();
        
        return { name, initials, rating, reviews, verified };
    },
    renderSellerBadge: (email) => {
        const ctx = api.getSellerContext(email);
        return `
            <div class="seller-badge">
                <div class="avatar" style="background: ${api.getAvatarColor(email)}">${ctx.initials}</div>
                <span style="font-weight:600;">${ctx.name}</span>
                ${ctx.verified ? '<span class="badge-verified" title="Verified Seller">✔️</span>' : ''}
                <span style="color:var(--warning); margin-left: auto;">⭐ ${ctx.rating}</span>
            </div>
        `;
    },
    getAvatarColor: (email) => {
        const colors = ['#ff3366', '#7000ff', '#00d2ff', '#00ff88', '#f59e0b', '#ec4899'];
        const charCodeSum = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[charCodeSum % colors.length];
    },
    showToast: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '2rem';
        toast.style.padding = '1rem 2rem';
        toast.style.borderRadius = '12px';
        toast.style.background = type === 'success' ? 'var(--success)' : (type === 'error' ? 'var(--danger)' : 'var(--glass)');
        toast.style.color = 'white';
        toast.style.backdropFilter = 'blur(10px)';
        toast.style.boxShadow = '0 10px 40px rgba(0,0,0,0.5)';
        toast.style.zIndex = '10000';
        toast.style.animation = 'slideUp 0.3s ease-out';
        
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },
    formatTimeAgo: (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    },
    toggleMobileMenu: () => {
        const links = document.getElementById('nav-links');
        if (links) links.classList.toggle('active');
    }
};

function requireAuth(expectedRole) {
    const token = api.getToken();
    const role = localStorage.getItem('role');
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    if (expectedRole && role !== expectedRole) {
        alert('Unauthorized access');
        api.logout();
        return false;
    }
    return true;
}
