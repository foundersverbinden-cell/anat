requireAuth('seller');

async function loadProducts() {
    try {
        const products = await api.request('/seller/products', { headers: api.getHeaders() });
        displayProducts(products);
    } catch (e) {
        console.error(e);
    }
}

function displayProducts(products) {
    const grid = document.getElementById('seller-products-grid');
    grid.innerHTML = '';
    
    if(products.length === 0) {
        grid.innerHTML = '<div class="glass-panel" style="grid-column: 1 / -1; padding: 2rem; text-align: center;">No vibes launched yet. Use the sidebar to start!</div>';
        return;
    }
    
    products.forEach(p => {
        const charCodeSum = p.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const views = 50 + (charCodeSum % 500);
        
        grid.innerHTML += `
            <div class="glass-panel card" style="padding: 1rem; cursor: default; transition: none;">
                <img src="${IMAGE_BASE}/${p.image}" class="card-img" style="height: 150px; margin-bottom: 0.75rem;">
                <div class="d-flex justify-between" style="align-items: center; margin-bottom: 0.5rem;">
                    <h3 style="font-size: 1rem; margin:0;">${p.name}</h3>
                    <span style="font-size: 0.8rem; color: var(--success); font-weight: 700;">₹${p.price}</span>
                </div>
                <div class="d-flex justify-between" style="font-size: 0.75rem; color: var(--text-muted); padding-top: 0.5rem; border-top: 1px solid var(--glass-border);">
                    <span>👁️ ${views} views</span>
                    <span>📈 ${Math.floor(views/20)} sales</span>
                </div>
                <button class="btn btn-outline btn-small" style="width: 100%; margin-top: 0.75rem; color: var(--danger); border-color: var(--danger);" onclick="deleteProduct(${p.id})">Remove Vibe</button>
            </div>
        `;
    });
}

async function deleteProduct(productId) {
    if(!confirm('Are you sure you want to delete this product?')) return;
    try {
        await api.request(`/seller/product/${productId}`, {
            method: 'DELETE',
            headers: api.getHeaders()
        });
        loadProducts(); // Reload lists
    } catch (e) {
        console.error(e);
    }
}

async function loadOrders() {
    try {
        const orders = await api.request('/seller/orders', { headers: api.getHeaders() });
        const grid = document.getElementById('seller-orders-grid');
        grid.innerHTML = '';
        
        if(orders.length === 0) {
            grid.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center;">No incoming orders yet.</div>';
            return;
        }
        
        orders.forEach(o => {
            const statusColor = o.status === 'approved' ? 'var(--success)' : (o.status === 'rejected' ? 'var(--danger)' : 'var(--warning)');
            
            grid.innerHTML += `
                <div class="glass-panel" style="margin-bottom: 1rem; padding: 1.25rem;">
                    <div class="d-flex justify-between" style="align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div class="d-flex" style="gap: 1.5rem; align-items: center;">
                            <img src="${IMAGE_BASE}/${o.image}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                            <div>
                                <h4 style="margin:0;">${o.product_name}</h4>
                                <p style="font-size: 0.8rem; color: var(--text-muted);">${o.customer_email}</p>
                            </div>
                        </div>
                        
                        <div style="flex: 1; min-width: 150px; text-align: center;">
                            <span class="badge" style="background: ${statusColor}">${o.status.toUpperCase()}</span>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">₹${o.price}</p>
                        </div>

                        <div class="d-flex" style="gap: 0.5rem;">
                            ${o.proof_image ? `
                                <button class="btn btn-outline btn-small" onclick="window.open('${IMAGE_BASE}/${o.proof_image}', '_blank')">👁️ Proof</button>
                            ` : ''}
                            
                            ${o.status === 'pending' ? `
                                <button class="btn btn-primary btn-small" style="background: var(--success); box-shadow: 0 0 10px rgba(16,185,129,0.3);" onclick="updateStatus(${o.id}, 'approved')">Approve</button>
                                <button class="btn btn-outline btn-small" style="color: var(--danger); border-color: var(--danger);" onclick="updateStatus(${o.id}, 'rejected')">Reject</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

async function addProduct() {
    const name = document.getElementById('prod-name').value;
    const desc = document.getElementById('prod-desc').value;
    const price = document.getElementById('prod-price').value;
    const upi_id = document.getElementById('prod-upi').value;
    const imageInput = document.getElementById('prod-image');
    
    if(!name || !price || !upi_id || !imageInput.files[0]) {
        return alert("Please fill all fields and select an image.");
    }
    
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
        alert('Product added successfully!');
        
        // Reset form
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-desc').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-upi').value = '';
        imageInput.value = '';
        
        loadProducts(); // Load the new product
    } catch (e) {
        console.error(e);
    }
}

async function verifyPayment(orderId, action) {
    try {
        await api.request('/seller/verify', {
            method: 'POST',
            headers: api.getHeaders(),
            body: JSON.stringify({ order_id: orderId, action })
        });
        loadOrders();
    } catch (e) {
        console.error(e);
    }
}

async function deliverOrder(orderId) {
    try {
        await api.request('/seller/deliver', {
            method: 'POST',
            headers: api.getHeaders(),
            body: JSON.stringify({ order_id: orderId })
        });
        loadOrders();
    } catch (e) {
        console.error(e);
    }
}

// Initial load
loadProducts();
loadOrders();
