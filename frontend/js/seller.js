requireAuth('seller');

let dashboardState = {
    revenue: 0,
    orders_count: 0,
    views: 0,
    products: [],
    orders: []
};

// --- Identity System ---
function initIdentity() {
    const userEmail = localStorage.getItem('email') || 'seller@festmarket.com';
    const ctx = api.getSellerContext(userEmail);
    const nameEl = document.getElementById('seller-name-display');
    if (nameEl) nameEl.textContent = ctx.name;
    
    // Update avatar if exists
    const avatarEl = document.querySelector('.nav-profile .avatar');
    if (avatarEl) {
        avatarEl.textContent = ctx.initials;
        avatarEl.style.background = api.getAvatarColor(userEmail);
    }
}

// --- Counter Animation ---
function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const currentText = el.innerText.replace(/[^0-9.]/g, '');
    const current = parseFloat(currentText) || 0;
    const duration = 1000;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = current + (target - current) * progress;
        el.innerText = id === 'stat-revenue' ? `₹${Math.floor(value)}` : Math.floor(value);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// --- Dashboard Logic ---
async function fetchDashboard(silent = false) {
    try {
        const data = await api.request('/seller/dashboard', { headers: api.getHeaders() });
        
        // Update counters with animation if changed
        if (data.revenue !== dashboardState.revenue) animateCounter('stat-revenue', data.revenue);
        if (data.orders_count !== dashboardState.orders_count) animateCounter('stat-orders', data.orders_count);
        if (data.views !== dashboardState.views) animateCounter('stat-views', data.views);

        dashboardState = data;
        renderDashboard();
    } catch (e) {
        console.error('Polling error:', e);
    }
}

function renderDashboard() {
    renderProducts(dashboardState.products);
    renderOrders(dashboardState.orders);
}

function renderProducts(products) {
    const grid = document.getElementById('seller-products-grid');
    if (!grid) return;
    grid.innerHTML = products.length === 0 
        ? '<div class="glass-panel" style="grid-column: 1 / -1; padding: 2rem; text-align: center;">No vibes launched yet.</div>'
        : products.map(p => `
            <div class="glass-panel card" style="padding: 1rem;">
                <img src="${IMAGE_BASE}/${p.image}" class="card-img" style="height: 150px; margin-bottom: 0.75rem;">
                <div class="d-flex justify-between" style="align-items: center; margin-bottom: 0.5rem;">
                    <h3 style="font-size: 1rem; margin:0;">${p.name}</h3>
                    <span style="font-size: 0.8rem; color: var(--success); font-weight: 700;">₹${p.price}</span>
                </div>
                <div class="d-flex justify-between" style="font-size: 0.75rem; color: var(--text-muted); padding-top: 0.5rem; border-top: 1px solid var(--glass-border);">
                    <span>👁️ ${p.views || 0} views</span>
                    <span>📈 Managed</span>
                </div>
                <button class="btn btn-outline btn-small" style="width: 100%; margin-top: 0.75rem; color: var(--danger); border-color: var(--danger);" onclick="deleteProduct(${p.id})">Remove Vibe</button>
            </div>
        `).join('');
}

function renderOrders(orders) {
    const grid = document.getElementById('seller-orders-grid');
    if (!grid) return;
    grid.innerHTML = orders.length === 0 
        ? '<div class="glass-panel" style="padding: 2rem; text-align: center;">No incoming orders yet.</div>'
        : orders.map(o => {
            let statusColor = 'var(--warning)';
            if (o.status === 'VERIFIED' || o.status === 'DELIVERED') statusColor = 'var(--success)';
            if (o.status === 'CANCELLED' || o.status === 'REJECTED') statusColor = 'var(--danger)';

            return `
                <div class="glass-panel" style="margin-bottom: 1rem; padding: 1.25rem;">
                    <div class="d-flex justify-between" style="align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div class="d-flex" style="gap: 1.5rem; align-items: center;">
                            <div style="background: var(--glass); padding: 5px; border-radius: 8px;">
                                <img src="${IMAGE_BASE}/${o.payment_proof || 'placeholder.png'}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; cursor: pointer;" onclick="window.open('${IMAGE_BASE}/${o.payment_proof}', '_blank')">
                            </div>
                            <div>
                                <h4 style="margin:0;">${o.product_name}</h4>
                                <p style="font-size: 0.8rem; color: var(--text-muted);">${o.customer_email}</p>
                            </div>
                        </div>
                        
                        <div style="flex: 1; min-width: 120px; text-align: center;">
                            <span class="badge" style="background: ${statusColor}; font-size: 0.7rem; letter-spacing: 1px;">${o.status}</span>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">₹${o.price}</p>
                        </div>

                        <div class="d-flex" style="gap: 0.5rem;">
                            ${(o.status === 'PAYMENT_UPLOADED' || o.status === 'NEEDS_ATTENTION') ? `
                                <button class="btn btn-primary btn-small" style="background: var(--success);" onclick="handleOrderAction(${o.id}, 'approve')">Approve</button>
                                <button class="btn btn-outline btn-small" style="color: var(--danger); border-color: var(--danger);" onclick="handleOrderAction(${o.id}, 'reject')">Reject</button>
                            ` : ''}
                            ${o.status === 'VERIFIED' ? `
                                <button class="btn btn-primary btn-small" style="background: var(--primary);" onclick="handleOrderAction(${o.id}, 'deliver')">Mark Delivered</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
}

// --- Optimistic UI Actions ---
async function handleOrderAction(orderId, action) {
    const orderIndex = dashboardState.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const originalStatus = dashboardState.orders[orderIndex].status;
    const newStatus = action === 'approve' ? 'VERIFIED' : (action === 'deliver' ? 'DELIVERED' : 'REJECTED');
    
    dashboardState.orders[orderIndex].status = newStatus;
    renderDashboard();

    try {
        const endpoint = action === 'deliver' ? '/seller/deliver' : '/seller/verify';
        await api.request(endpoint, {
            method: 'POST',
            headers: api.getHeaders(),
            body: JSON.stringify({ order_id: orderId, action })
        });
        fetchDashboard(true);
    } catch (e) {
        dashboardState.orders[orderIndex].status = originalStatus;
        renderDashboard();
    }
}

async function addProduct() {
    const name = document.getElementById('prod-name').value;
    const desc = document.getElementById('prod-desc').value;
    const price = document.getElementById('prod-price').value;
    const upi_id = document.getElementById('prod-upi').value;
    const imageInput = document.getElementById('prod-image');
    
    if(!name || !price || !upi_id || !imageInput.files[0]) return alert("All fields required.");
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', desc);
    formData.append('price', price);
    formData.append('upi_id', upi_id);
    formData.append('image', imageInput.files[0]);
    
    try {
        await api.request('/seller/product', {
            method: 'POST',
            headers: api.getHeaders(true),
            body: formData
        });
        document.getElementById('add-vibe-form')?.reset();
        fetchDashboard();
    } catch (e) { console.error(e); }
}

async function deleteProduct(productId) {
    if(!confirm('Delete this vibe?')) return;
    try {
        await api.request(`/seller/product/${productId}`, { method: 'DELETE', headers: api.getHeaders() });
        fetchDashboard();
    } catch (e) { console.error(e); }
}

// --- Lifecycle ---
document.addEventListener('DOMContentLoaded', () => {
    initIdentity();
    fetchDashboard();
    setInterval(() => fetchDashboard(true), 5000);
});
