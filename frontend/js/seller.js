requireAuth('seller');

async function loadProducts() {
    try {
        const products = await api.request('/seller/products', { headers: api.getHeaders() });
        const grid = document.getElementById('seller-products-grid');
        grid.innerHTML = '';
        
        if(products.length === 0) {
            grid.innerHTML = '<p>You haven\'t added any products yet.</p>';
            return;
        }
        
        products.forEach(p => {
            grid.innerHTML += `
                <div class="glass-panel card">
                    <img src="${IMAGE_BASE}/${p.image}" class="card-img" alt="${p.name}">
                    <div class="d-flex justify-between" style="margin-top: 1rem;">
                        <h3>${p.name}</h3>
                        <p class="price">₹${p.price}</p>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--text-dim);">UPI: ${p.upi_id}</p>
                    <button class="btn btn-primary btn-small mt-2" style="background: var(--danger);" onclick="deleteProduct(${p.id})">🗑️ Delete</button>
                </div>
            `;
        });
    } catch (e) {
        console.error(e);
    }
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
            grid.innerHTML = '<p>No orders yet.</p>';
            return;
        }
        
        orders.forEach(o => {
            const badgeClass = o.status.replace('_', '-').toLowerCase();
            
            let actions = '';
            let proofImage = '';
            
            if(o.payment_proof) {
                // FIXED: Using IMAGE_BASE for live rendering
                proofImage = `<img src="${IMAGE_BASE}/${o.payment_proof}" class="card-img" style="height: 150px; cursor: pointer; border: 1px solid var(--primary);" onclick="window.open(this.src)" title="Click to enlarge">`;
            }
            
            if(o.status === 'PAYMENT_UPLOADED') {
                actions = `
                    <div class="d-flex mt-2" style="gap: 0.5rem;">
                        <button class="btn btn-primary" style="background: var(--success); flex: 1;" onclick="verifyPayment(${o.id}, 'approve')">Approve</button>
                        <button class="btn btn-primary" style="background: var(--danger); flex: 1;" onclick="verifyPayment(${o.id}, 'reject')">Reject</button>
                    </div>
                `;
            } else if (o.status === 'VERIFIED') {
                actions = `
                    <button class="btn btn-primary mt-2" onclick="deliverOrder(${o.id})">Mark Delivered</button>
                `;
            }

            grid.innerHTML += `
                <div class="glass-panel card">
                    <div class="d-flex justify-between">
                        <h3>${o.name}</h3>
                        <span class="badge badge-${badgeClass.split('-')[0]}">${o.status}</span>
                    </div>
                    <p class="price">₹${o.price}</p>
                    <p>Customer: ${o.customer_email}</p>
                    <p style="font-size: 0.8rem; margin-bottom: 1rem;">Ordered: ${new Date(o.created_at).toLocaleString()}</p>
                    ${proofImage}
                    ${actions}
                </div>
            `;
        });
    } catch (e) {
        console.error(e);
    }
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
