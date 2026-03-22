requireAuth('customer');

async function loadProducts() {
    try {
        const products = await api.request('/customer/products', { headers: api.getHeaders() });
        const grid = document.getElementById('products-grid');
        grid.innerHTML = '';
        
        if(products.length === 0) {
            grid.innerHTML = '<p>No products available yet. Check back later!</p>';
            return;
        }
        
        products.forEach(p => {
            grid.innerHTML += `
                <div class="glass-panel card">
                    <img src="http://localhost:5000/api/uploads/${p.image}" class="card-img" alt="${p.name}">
                    <h3>${p.name}</h3>
                    <p>Seller: ${p.seller_email}</p>
                    <p class="price">₹${p.price}</p>
                    <button class="btn btn-primary" onclick="buyProduct(${p.id}, '${p.name}', ${p.price})">🛒 Buy Now</button>
                </div>
            `;
        });
    } catch (e) {
        console.error(e);
    }
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
