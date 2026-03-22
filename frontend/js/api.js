// Update this with your live Railway URL
const API_BASE = 'https://anat-production.up.railway.app/api';

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
