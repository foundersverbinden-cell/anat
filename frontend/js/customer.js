requireAuth('customer');

let allProducts = [];

async function loadProducts() {
    try {
        allProducts = await api.request('/customer/products', { headers: api.getHeaders() });
        displayProducts(allProducts);
    } catch (e) {
        console.error(e);
    }
}

function displayProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    if(products.length === 0) {
        grid.innerHTML = `
            <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔎</div>
                <h3>No vibes found</h3>
                <p style="color:var(--text-muted);">Try adjusting your search or filters.</p>
            </div>
        `;
        return;
    }
    
    products.forEach((p, index) => {
        const sellerBadge = api.renderSellerBadge(p.seller_email);
        const charCodeSum = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const stock = 2 + (charCodeSum % 8);
        const viewing = 5 + (charCodeSum % 25);
        const badge = index < 2 ? 'New' : (index % 3 === 0 ? 'Bestseller' : (index % 5 === 0 ? 'Trending' : ''));
        
        grid.innerHTML += `
            <div class="glass-panel card" onclick="openModal(${p.id})">
                <div style="position: relative;">
                    <img src="${IMAGE_BASE}/${p.image}" class="card-img" alt="${p.name}">
                    ${badge ? `<span class="badge" style="position: absolute; top: 1rem; right: 1rem; background: var(--primary);">${badge}</span>` : ''}
                    <div class="card-overlay" style="position: absolute; bottom: 1rem; left: 1rem; right: 1rem; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 0.5rem; border-radius: 8px; font-size: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="pulse" style="width: 8px; height: 8px; background: var(--accent-green); border-radius: 50%;"></span>
                        ${viewing} people are viewing this vibe
                    </div>
                </div>
                
                <h3 style="margin: 1rem 0 0.5rem 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h3>
                
                <div style="margin-bottom: 1rem;">${sellerBadge}</div>
                
                <div class="d-flex justify-between" style="align-items: flex-end; margin-top: auto;">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-decoration: line-through; margin-bottom: -0.25rem;">₹${(p.price * 1.2).toFixed(0)}</div>
                        <div class="price" style="font-size: 1.4rem; color: var(--text-main);">₹${p.price}</div>
                        <div style="font-size: 0.7rem; color: var(--danger); font-weight: 700;">🔥 Only ${stock} left!</div>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); openModal(${p.id})">View Details</button>
                </div>
            </div>
        `;
    });
}

function filterProducts() {
    const query = document.getElementById('product-search').value.toLowerCase();
    const priceFilter = document.getElementById('price-filter').value;
    
    let filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.seller_email.toLowerCase().includes(query)
    );
    
    if (priceFilter === 'under500') {
        filtered = filtered.filter(p => p.price < 500);
    } else if (priceFilter === '500-1000') {
        filtered = filtered.filter(p => p.price >= 500 && p.price <= 1000);
    } else if (priceFilter === 'over1000') {
        filtered = filtered.filter(p => p.price > 1000);
    }
    
    displayProducts(filtered);
}

function openModal(productId) {
    const p = allProducts.find(x => x.id === productId);
    if(!p) return;

    // Increment View Tracking (V5.1)
    api.request('/customer/view', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ product_id: productId })
    }).catch(e => console.error('View tracking failed', e));

    const modal = document.getElementById('product-modal');
    const body = document.getElementById('modal-body');
    const ctx = api.getSellerContext(p.seller_email);
    
    // Find related products (same price range or just others)
    const related = allProducts.filter(x => x.id !== p.id).slice(0, 3);
    
    body.innerHTML = `
        <div class="modal-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div style="position: sticky; top: 0;">
                <img src="${IMAGE_BASE}/${p.image}" style="width:100%; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.5); transform: perspective(1000px) rotateY(-5deg);">
            </div>
            <div>
                <div class="d-flex" style="gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span class="badge" style="background: var(--secondary);">Vibe Verified</span>
                    <span class="badge" style="background: var(--accent-blue);">Popular</span>
                </div>
                <h2 style="font-size: 2.5rem; margin-bottom: 0.5rem; line-height: 1.1;">${p.name}</h2>
                <div class="price" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1.5rem;">₹${p.price}</div>
                
                <div class="glass-panel" style="padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <p style="color:var(--text-main); font-weight: 600; margin-bottom: 0.5rem;">Description</p>
                    <p style="color:var(--text-muted); line-height:1.6;">${p.description || "This exclusive festival vibe is handcrafted for peak performance. Limited availability."}</p>
                </div>
                
                <div class="glass-panel" style="padding: 1rem; border-radius: 12px; margin-bottom: 2rem;">
                    <p style="color:var(--text-main); font-weight: 600; margin-bottom: 0.75rem;">Meet the Seller</p>
                    ${api.renderSellerBadge(p.seller_email)}
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${ctx.reviews} positive vibes delivered. Response time: < 1hr.</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: center;">
                    <button class="btn btn-primary" style="padding: 1rem 2rem; font-size: 1.1rem; width: 100%; justify-content: center;" onclick="buyProduct(${p.id}, '${p.name}', ${p.price})">🛒 Secure Checkout</button>
                    <div id="quick-qr" style="background:white; padding: 4px; border-radius: 8px;"></div>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 3rem;">
            <h3 style="margin-bottom: 1.5rem;">You might also like...</h3>
            <div class="grid" style="grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                ${related.map(r => `
                    <div class="glass-panel card" style="padding: 1rem;" onclick="openModal(${r.id})">
                        <img src="${IMAGE_BASE}/${r.image}" style="height: 100px; width: 100%; object-fit: cover; border-radius: 8px;">
                        <p style="margin-top: 0.5rem; font-weight: 600; font-size: 0.9rem;">${r.name}</p>
                        <p style="color: var(--primary);">₹${r.price}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    new QRCode(document.getElementById("quick-qr"), {
        text: `upi://pay?pa=${p.upi_id}&pn=FestMarket&am=${p.price}&cu=INR`,
        width: 60,
        height: 60
    });
}

function closeModal(e) {
    if(!e || e.target.id === 'product-modal' || e.target.className === 'modal-close') {
        document.getElementById('product-modal').classList.remove('active');
    }
}

// Chatbot Utility Upgrade
function toggleChat() {
    document.getElementById('chat-window').classList.toggle('active');
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;

    appendMessage('user', text);
    input.value = '';

    try {
        const data = await api.request('/customer/chat', {
            method: 'POST',
            headers: api.getHeaders(),
            body: JSON.stringify({ message: text })
        });

        appendMessage('ai', data.response, data.products);
    } catch (e) {
        console.error(e);
        appendMessage('ai', "Sorry, I'm having trouble connecting to the Vibe engine. Try again?");
    }
}

function appendMessage(sender, text, products = []) {
    const body = document.getElementById('chat-body');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble bubble-${sender}`;
    bubble.innerText = text;
    body.appendChild(bubble);

    if(products && products.length > 0) {
        const miniGrid = document.createElement('div');
        miniGrid.className = 'chat-products-mini';
        products.forEach(p => {
            miniGrid.innerHTML += `
                <div class="mini-card" onclick="openModal(${p.id})" style="background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 12px; cursor: pointer;">
                    <img src="${IMAGE_BASE}/${p.image}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px;">
                    <div style="margin-top:0.25rem; font-weight:700; font-size: 0.8rem;">${p.name}</div>
                    <div style="color:var(--primary); font-size: 0.75rem;">₹${p.price}</div>
                    <button class="btn btn-primary btn-small" style="width: 100%; margin-top: 0.5rem; font-size: 0.7rem; padding: 0.25rem;">View</button>
                </div>
            `;
        });
        body.appendChild(miniGrid);
    }
    body.scrollTop = body.scrollHeight;
}
async function loadOrders() {
    try {
        const orders = await api.request('/customer/orders', { headers: api.getHeaders() });
        const grid = document.getElementById('orders-grid');
        grid.innerHTML = '';
        
        if(orders.length === 0) {
            grid.innerHTML = `
                <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📦</div>
                    <h3>No orders yet</h3>
                    <p style="color:var(--text-muted);">Your festival finds will appear here.</p>
                    <button class="btn btn-primary btn-small" style="margin-top: 1.5rem;" onclick="toggleView('products-view')">Start Shopping</button>
                </div>
            `;
            return;
        }
        
        orders.forEach(order => {
            const statusColor = order.status === 'approved' ? 'var(--success)' : (order.status === 'rejected' ? 'var(--danger)' : 'var(--warning)');
            const statusText = order.status.toUpperCase();
            
            // Timeline state
            const step1 = 'active'; // Ordered is always done
            const step2 = order.status !== 'pending' ? 'active' : ''; // Verified if not pending
            const step3 = order.status === 'approved' ? 'active' : ''; // Delivered placeholder
            
            grid.innerHTML += `
                <div class="glass-panel card">
                    <div class="d-flex justify-between">
                        <h3>${o.name}</h3>
                        <span class="badge badge-${badgeClass.split('-')[0]}">${o.status}</span>
                    </div>
                    <p class="price">₹${o.price}</p>
                    <p style="font-size: 0.8rem">Ordered: ${new Date(o.created_at).toLocaleString()}</p>
                    ${actionHtml}
                </div>
            `;
        });
        
        // Render QRs for pending ones
        orders.filter(o => o.status === 'PAYMENT_PENDING').forEach(o => {
            const upiUrl = `upi://pay?pa=${o.upi_id}&pn=FestSeller&am=${o.price}`;
            new QRCode(document.getElementById(`qr-${o.id}`), {
                text: upiUrl,
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        });
    } catch (e) {
        console.error(e);
    }
}

async function buyProduct(productId, name, price) {
    if(!confirm(`Order ${name} for ₹${price}?`)) return;
    try {
        await api.request('/customer/order', {
            method: 'POST',
            headers: api.getHeaders(),
            body: JSON.stringify({ product_id: productId })
        });
        alert('Order placed! Please upload the payment proof.');
        toggleView('orders-view');
    } catch (e) {
        console.error(e);
    }
}

async function uploadProof(orderId) {
    const fileInput = document.getElementById(`proof-${orderId}`);
    if(!fileInput.files[0]) return alert('Please select a file first');
    
    const formData = new FormData();
    formData.append('order_id', orderId);
    formData.append('proof', fileInput.files[0]);
    
    try {
        await api.request('/customer/payment-proof', {
            method: 'POST',
            headers: api.getHeaders(true),
            body: formData
        });
        alert('Proof uploaded successfully!');
        loadOrders();
    } catch (e) {
        console.error(e);
    }
}

function toggleView(viewId) {
    document.getElementById('products-view').classList.add('hidden');
    document.getElementById('orders-view').classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
    
    if(viewId === 'products-view') loadProducts();
    if(viewId === 'orders-view') loadOrders();
}

// Initial load
loadProducts();
