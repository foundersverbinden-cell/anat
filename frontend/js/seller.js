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

function renderOrders() {
    const list = document.getElementById('seller-orders-grid');
    if (!list) return;

    if (dashboardState.orders.length === 0) {
        list.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--text-muted);">No orders yet.</div>';
        return;
    }

    list.innerHTML = dashboardState.orders.map(o => {
        let statusColor = 'var(--warning)';
        if (o.status === 'VERIFIED' || o.status === 'DELIVERED') statusColor = 'var(--success)';
        if (o.status === 'REJECTED' || o.status === 'CANCELLED' || o.status === 'EXPIRED') statusColor = 'var(--danger)';
        if (o.status === 'PAYMENT_UPLOADED' || o.status === 'NEEDS_ATTENTION') statusColor = 'var(--accent-blue)';

        const buyerName = o.customer_email.split('@')[0];
        const timeAgo = o.updated_at ? api.formatTimeAgo(o.updated_at) : 'Just now';

        return `
            <div class="glass-panel order-card" style="padding: 1.25rem; margin-bottom: 1rem; border-left: 4px solid ${statusColor};">
                <div class="d-flex justify-between" style="align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div class="d-flex" style="gap: 1.25rem; align-items: center;">
                        <div style="background: white; padding: 4px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                            <img src="${IMAGE_BASE}/${o.payment_proof || 'placeholder.png'}" 
                                 style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover; cursor: zoom-in;" 
                                 onclick="window.open('${IMAGE_BASE}/${o.payment_proof}', '_blank')"
                                 title="Click to zoom proof">
                        </div>
                        <div>
                            <h4 style="margin:0; font-size: 1.1rem;">${o.product_name}</h4>
                            <p style="font-size: 0.85rem; color: var(--text-main); font-weight: 600;">👤 ${buyerName} <span style="font-weight: 400; color: var(--text-muted);">(${o.customer_email})</span></p>
                            ${o.utr_id ? `<p style="font-size: 0.75rem; color: var(--accent-blue); font-weight: 700; background: rgba(0,200,255,0.1); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">UTR: ${o.utr_id}</p>` : ''}
                        </div>
                    </div>
                    
                    <div style="flex: 1; min-width: 140px; text-align: right;">
                        <span class="badge" style="background: ${statusColor}; font-size: 0.75rem;">${o.status.replace('_', ' ')}</span>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">₹${o.price} • ${timeAgo}</p>
                        ${o.rejection_reason ? `<p style="font-size: 0.7rem; color: var(--danger); margin-top: 0.25rem; font-style: italic;">"${o.rejection_reason}"</p>` : ''}
                    </div>

                    <div class="d-flex" style="gap: 0.5rem;">
                        ${(o.status === 'PAYMENT_UPLOADED' || o.status === 'NEEDS_ATTENTION') ? `
                            <button class="btn btn-primary btn-small" style="background: var(--success); border:none;" onclick="handleOrderAction(${o.id}, 'approve')">Approve</button>
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
    let reason = '';
    if (action === 'reject') {
        reason = prompt("Enter rejection reason (e.g. Amount mismatch, Invalid UTR):");
        if (reason === null) return; // Cancelled
    }

    const orderIndex = dashboardState.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const originalState = { ...dashboardState.orders[orderIndex] };
    const newStatus = action === 'approve' ? 'VERIFIED' : (action === 'deliver' ? 'DELIVERED' : 'REJECTED');
    
    // Optimistic Update
    dashboardState.orders[orderIndex].status = newStatus;
    if (action === 'reject') dashboardState.orders[orderIndex].rejection_reason = reason;
    renderDashboard();

    try {
        const endpoint = action === 'deliver' ? '/seller/deliver' : '/seller/verify';
        await api.request(endpoint, {
            method: 'POST',
            headers: api.getHeaders(),
            body: JSON.stringify({ order_id: orderId, action, reason })
        });
        api.showToast(`Order ${action}ed successfuly`, 'success');
        fetchDashboard(true);
    } catch (e) {
        api.showToast(e.message || 'Action failed', 'error');
        dashboardState.orders[orderIndex] = originalState;
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
