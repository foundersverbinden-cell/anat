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
        grid.innerHTML = '<p>No products found matching your search.</p>';
        return;
    }
    
    products.forEach(p => {
        grid.innerHTML += `
            <div class="glass-panel card" onclick="openModal(${p.id})">
                <img src="${IMAGE_BASE}/${p.image}" class="card-img" alt="${p.name}">
                <h3>${p.name}</h3>
                <p style="margin-bottom: 0.5rem;">Seller: ${p.seller_email}</p>
                <div class="d-flex justify-between" style="align-items: center;">
                    <p class="price" style="margin:0;">₹${p.price}</p>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); buyProduct(${p.id}, '${p.name}', ${p.price})">🛒 Buy</button>
                </div>
            </div>
        `;
    });
}

function openModal(productId) {
    const p = allProducts.find(x => x.id === productId);
    if(!p) return;

    const modal = document.getElementById('product-modal');
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <div class="modal-grid">
            <img src="${IMAGE_BASE}/${p.image}" style="width:100%; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.3);">
            <div>
                <h2 style="margin-top:0;">${p.name}</h2>
                <p class="price" style="font-size:2rem;">₹${p.price}</p>
                <p style="color:var(--text-light); margin-bottom:2rem; line-height:1.6;">${p.description || 'No description provided for this vibe yet.'}</p>
                <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1.5rem;">Seller: ${p.seller_email}</p>
                <button class="btn btn-primary" onclick="buyProduct(${p.id}, '${p.name}', ${p.price})">🛒 Checkout Now</button>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeModal(e) {
    if(!e || e.target.id === 'product-modal' || e.target.className === 'modal-close') {
        document.getElementById('product-modal').classList.remove('active');
    }
}

// Chatbot Logic
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
                <div class="mini-card" onclick="openModal(${p.id})">
                    <img src="${IMAGE_BASE}/${p.image}">
                    <div style="margin-top:0.25rem; font-weight:600;">${p.name}</div>
                    <div style="color:var(--success);">₹${p.price}</div>
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
            grid.innerHTML = '<p>You have no orders yet.</p>';
            return;
        }
        
        orders.forEach(o => {
            const badgeClass = o.status.replace('_', '-').toLowerCase();
            let actionHtml = '';
            
            if(o.status === 'PAYMENT_PENDING') {
                actionHtml = `
                    <div style="margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                        <p style="margin-bottom:0.5rem"><strong>1. Scan & Pay ₹${o.price}</strong></p>
                        <div id="qr-${o.id}" style="background: white; padding: 10px; display: inline-block; border-radius: 8px; margin-bottom: 1rem;"></div>
                        <p style="margin-bottom:0.5rem"><strong>2. Upload Screenshot</strong></p>
                        <input type="file" id="proof-${o.id}" accept="image/*" class="form-group" style="padding: 0;">
                        <button class="btn btn-primary btn-small mt-2" onclick="uploadProof(${o.id})">Upload Proof</button>
                    </div>
                `;
            }
            
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
