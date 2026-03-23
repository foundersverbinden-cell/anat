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
        const token = api.getToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    },
    request: async (endpoint, options = {}, isRetry = false) => {
        try {
            // Auto-merge default headers if not provided
            if (!options.headers) {
                options.headers = api.getHeaders();
            } else if (!options.headers['Authorization'] && api.getToken()) {
                // Merge token if headers exist but lack Auth
                options.headers['Authorization'] = `Bearer ${api.getToken()}`;
            }

            const fullUrl = `${API_BASE}${endpoint}`;
            let res = await fetch(fullUrl, options);
            
            // Handle Token Expiry silently
            if (res.status === 401 && !isRetry && api.getRefreshToken()) {
                const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: api.getRefreshToken() })
                });
                
                if (refreshRes.ok) {
                    const contentType = refreshRes.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const refreshData = await refreshRes.json();
                        api.setToken(refreshData.token, localStorage.getItem('role'), refreshData.refresh_token);
                        
                        if(!options.headers) options.headers = {};
                        options.headers['Authorization'] = `Bearer ${refreshData.token}`;
                        res = await fetch(fullUrl, options);
                    }
                } else {
                    api.logout();
                    throw new Error('Session expired. Please login again.');
                }
            }
            
            const contentType = res.headers.get("content-type");
            let data;
            
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            } else {
                const text = await res.text();
                console.error('Non-JSON Response:', text);
                throw new Error(`Server error (${res.status}). Please try again later.`);
            }

            if (!res.ok) {
                throw new Error(data.error || data.message || `API error (${res.status})`);
            }
            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                console.error('Network Error / CORS Issue:', error);
                if(!isRetry) api.showToast('Network Error: Cannot reach the secure server. Please check your internet or refresh.', 'error');
                throw new Error('Network Error: Cannot reach the secure server. Please check your internet or refresh.');
            }
            console.error(`Request failed [${endpoint}]:`, error);
            if(!isRetry) api.showToast(error.message, 'error');
            throw error;
        }
    },
    // V5 Trust & Identity Utilities
    getSellerContext: (email, isVerifiedFromDb = false) => {
        if (!email) return { name: 'Unknown Seller', avatar: '?', verified: false };
        
        const prefix = email.split('@')[0];
        const name = prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._]/g, ' ');
        const initials = prefix.substring(0, 2).toUpperCase();
        
        return { name, initials, verified: isVerifiedFromDb };
    },
    renderSellerBadge: (email, isVerifiedFromDb = false) => {
        if (!email) return `<div class="d-flex" style="gap: 0.5rem; align-items: center;"><div class="avatar" style="width: 24px; height: 24px; font-size: 0.6rem; background: #333; text-align: center; border-radius: 50%; color: white;">?</div><span style="font-size: 0.85rem; color: var(--text-muted);">Unknown Curator</span></div>`;
        const ctx = api.getSellerContext(email, isVerifiedFromDb);
        const verifiedBadge = ctx.verified ? '<span title="Vibe Verified" style="color: var(--primary); font-size: 0.8rem; margin-top: -2px;">🛡️</span>' : '';
        
        return `
            <div class="seller-badge" style="display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.03); padding: 4px 10px; border-radius: 50px; border: 1px solid var(--glass-border); width: fit-content;">
                <div class="avatar" style="background: ${api.getAvatarColor(email)}; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 50%; color: white; font-size: 0.65rem;">${ctx.initials}</div>
                <span style="font-weight:600; font-size: 0.85rem;">${ctx.name}</span>
                ${verifiedBadge}
            </div>
        `;
    },
    renderSkeletons: (containerId, count = 4) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = Array(count).fill(0).map(() => `
            <div class="glass-panel skeleton skeleton-card"></div>
        `).join('');
    },
    renderSocialProof: (productId) => {
        return ''; // Feature dismantled - use actual DB views directly in component instead
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
    },

    safeGet: (obj, path, fallback = '—') => {
        try {
            const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
            return (value === undefined || value === null || value === '') ? fallback : value;
        } catch (e) { return fallback; }
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
