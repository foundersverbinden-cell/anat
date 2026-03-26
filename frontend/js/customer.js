requireAuth('customer');

let allProducts = [];
let activeIntent = null;

async function loadProducts() {
    try {
        api.renderSkeletons('products-grid', 8);
        allProducts = await api.request('/customer/products', { headers: api.getHeaders() });
        displayProducts(allProducts);
        loadSocialProofTicker();
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
        const verifiedBadgeHtml = p.is_verified === 1 ? '<span class="badge" style="position: absolute; top: 1rem; right: 1rem; background: var(--success); z-index: 10;">Guaranteed Vibe</span>' : '';
        const realViews = p.views || 0;
        
        grid.innerHTML += `
            <div class="glass-panel card" onclick="openModal(${p.id})">
                <div style="position: relative;">
                    <img src="${IMAGE_BASE}/${p.image}" class="card-img" alt="${p.name}">
                    ${verifiedBadgeHtml}
                    <div class="card-overlay" style="position: absolute; bottom: 1rem; left: 1rem; right: 1rem; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 0.5rem; border-radius: 8px; font-size: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="pulse" style="width: 8px; height: 8px; background: var(--accent-blue); border-radius: 50%;"></span>
                        👁️ ${realViews} total views
                    </div>
                </div>
                
                <h3 style="margin: 1rem 0 0.5rem 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h3>
                
                <div style="margin-bottom: 1rem;">${api.renderSellerBadge(p.seller_email, p.is_verified === 1)}</div>
                
                <div class="d-flex justify-between" style="align-items: flex-end; margin-top: auto;">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-decoration: line-through; margin-bottom: -0.25rem;">₹${(p.price * 1.2).toFixed(0)}</div>
                        <div class="price" style="font-size: 1.4rem; color: var(--text-main);">₹${p.price}</div>
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
    
    let filtered = allProducts;

    // Apply Intent Filter if active
    if (activeIntent) {
        if (activeIntent === 'healthy') {
            const keywords = ['healthy', 'organic', 'fresh', 'vegan', 'green', 'clean', 'natural', 'fruit', 'salad'];
            filtered = filtered.filter(p => keywords.some(k => p.name.toLowerCase().includes(k) || p.description.toLowerCase().includes(k)));
        } else if (activeIntent === 'budget') {
            filtered = filtered.filter(p => p.price < 500);
        } else if (activeIntent === 'fast') {
            const keywords = ['fast', 'quick', 'instant', 'speedy', 'express', 'ready'];
            filtered = filtered.filter(p => keywords.some(k => p.name.toLowerCase().includes(k) || p.description.toLowerCase().includes(k)));
        } else if (activeIntent === 'premium') {
            const keywords = ['premium', 'luxury', 'exclusive', 'high-end', 'elite', 'gold', 'vip'];
            filtered = filtered.filter(p => p.price > 1000 || keywords.some(k => p.name.toLowerCase().includes(k) || p.description.toLowerCase().includes(k)));
        } else if (activeIntent === 'trending') {
            // Sort by views and take top performers (simulated as those with > 5 views for now or top 20%)
            const avgViews = filtered.length > 0 ? filtered.reduce((acc, p) => acc + (p.views || 0), 0) / filtered.length : 0;
            filtered = filtered.filter(p => (p.views || 0) >= avgViews && (p.views || 0) > 0);
            filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
        }
    }
    
    // Apply Search Query
    filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.seller_email.toLowerCase().includes(query)
    );
    
    // Apply Price Dropdown Filter
    if (priceFilter === 'under500') {
        filtered = filtered.filter(p => p.price < 500);
    } else if (priceFilter === '500-1000') {
        filtered = filtered.filter(p => p.price >= 500 && p.price <= 1000);
    } else if (priceFilter === 'over1000') {
        filtered = filtered.filter(p => p.price > 1000);
    }
    
    displayProducts(filtered);
}

function filterByIntent(intent, el) {
    // Custom intent opens chatbot
    if (intent === 'custom') {
        toggleChat();
        document.getElementById('chat-input').focus();
        document.getElementById('chat-input').placeholder = "Tell me exactly what vibe you need...";
        return;
    }

    // Toggle active state
    if (activeIntent === intent) {
        activeIntent = null;
        el.classList.remove('active');
    } else {
        // Remove active from others
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        activeIntent = intent;
        el.classList.add('active');
    }
    
    filterProducts();
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
    
    // Find related products
    const related = allProducts.filter(x => x.id !== p.id).slice(0, 3);
    
    body.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <button class="btn btn-outline btn-small" style="border:none; padding: 0;" onclick="history.back()">← Back to Catalog</button>
        </div>
        <div class="modal-grid">
            <div style="position: sticky; top: 0;">
                <img src="${IMAGE_BASE}/${p.image}" style="width:100%; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            </div>
            <div>
                <div class="d-flex" style="gap: 0.5rem; margin-bottom: 0.5rem;">
                    ${p.is_verified === 1 ? '<span class="badge" style="background: var(--success);">🛡️ Verified Seller</span>' : ''}
                    <span class="badge" style="background: var(--accent-blue);">Popular</span>
                    <span class="badge" style="background: rgba(255,255,255,0.1);"><span class="pulse" style="width: 6px; height: 6px; background: var(--accent-blue); border-radius: 50%; display: inline-block; margin-right: 4px;"></span>${p.views || 0} views</span>
                </div>
                <h2 style="font-size: 2.5rem; margin-bottom: 0.5rem; line-height: 1.1;">${p.name}</h2>
                <div class="price" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1.5rem;">₹${p.price}</div>
                
                <div class="glass-panel" style="padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <p style="color:var(--text-main); font-weight: 600; margin-bottom: 0.5rem;">Description</p>
                    <p style="color:var(--text-muted); line-height:1.6;">${(p.description && p.description !== "undefined") ? p.description : "This exclusive festival vibe is handcrafted for peak performance. Limited availability."}</p>
                </div>
                
                <div class="glass-panel" style="padding: 1rem; border-radius: 12px; margin-bottom: 2rem;">
                    <p style="color:var(--text-main); font-weight: 600; margin-bottom: 0.75rem;">Meet the Seller</p>
                    ${api.renderSellerBadge(p.seller_email, p.is_verified === 1)}
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Verified identity. Response time: < 1hr.</p>
                </div>
                
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button class="btn btn-primary" style="padding: 1rem 2rem; font-size: 1.1rem; width: 100%; justify-content: center; height: 100%;" onclick="buyProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.upi_id}')">🛒 Secure Checkout</button>
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
    
    // History API for Back Button support
    history.pushState({ modalOpen: true }, '');
    window.onpopstate = (e) => {
        if (!e.state || !e.state.modalOpen) {
            closeModal();
        }
    };
    
    // Encode UPI parameters carefully
    const encodedName = encodeURIComponent('Aivore Marketplace');
    const encodedNote = encodeURIComponent(`Buy ${p.name}`);
    const encodedUpiUrl = `upi://pay?pa=${p.upi_id}&pn=${encodedName}&am=${p.price}&tn=${encodedNote}&cu=INR`;
    
    // QR generation removed for mini-qr to reduce clutter
}

function closeModal(e) {
    if(!e || e.target.id === 'product-modal' || e.target.className === 'modal-close') {
        document.getElementById('product-modal').classList.remove('active');
    }
}

function closeCheckoutModal(e) {
    if(!e || e.target.id === 'checkout-modal' || e.target.className === 'modal-close') {
        document.getElementById('checkout-modal').classList.remove('active');
    }
}

let activeCheckoutOrder = null;

async function buyProduct(productId, name, price, upiId) {
    try {
        api.showToast('Initiating secure checkout...', 'info');
        const res = await api.request('/customer/order', {
            method: 'POST',
            headers: api.getHeaders(),
            body: JSON.stringify({ product_id: productId })
        });
        
        closeModal();
        resumeCheckout(res.order_id, upiId, price, name);
        loadOrders();
    } catch (e) {
        console.error(e);
    }
}

function resumeCheckout(orderId, upiId, price, productName) {
    activeCheckoutOrder = { id: orderId, upi_id: upiId, price: price, name: productName };
    document.getElementById('checkout-modal').classList.add('active');
    renderCheckoutStep(1, orderId, upiId, price, productName);
    
    // History for checkout modal
    history.pushState({ modalOpen: true, checkout: true }, '');
}

function copyUpi(upiId) {
    navigator.clipboard.writeText(upiId).then(() => {
        api.showToast('UPI ID copied to clipboard!', 'success');
    });
}

function renderCheckoutStep(step, id, upi_id, price, productName = 'Aivore Vibe') {
    const body = document.getElementById('checkout-body');
    const encodedName = encodeURIComponent('Aivore Marketplace');
    const encodedNote = encodeURIComponent(`Payment for ${productName} (ORD-${id})`);
    const upiUrl = `upi://pay?pa=${upi_id}&pn=${encodedName}&am=${price}&tn=${encodedNote}&cu=INR`;

    if (step === 1) {
        body.innerHTML = `
            <div style="text-align: center; animation: scaleUp 0.3s ease-out;">
                <button class="btn btn-outline btn-small" style="margin-bottom: 1rem; border: none; padding: 0;" onclick="closeCheckoutModal()">← Back to Info</button>
                <h2 style="margin-bottom: 0.5rem;">Step 1: Secure Payment</h2>
                <p style="color:var(--text-muted); margin-bottom: 1.5rem;">Scan or tap to pay <b style="color:var(--primary);">₹${price}</b> for ${productName}</p>
                
                <div id="checkout-qr" style="background:white; padding:16px; border-radius:16px; display: inline-block; box-shadow: 0 10px 30px rgba(0,0,0,0.3); margin-bottom: 1.5rem;"></div>
                
                <div class="glass-panel" style="padding: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);">
                    <code style="color: var(--primary); font-size: 1rem; letter-spacing: 0.5px;">${upi_id}</code>
                    <button class="btn btn-outline btn-small" onclick="copyUpi('${upi_id}')">Copy</button>
                </div>
                
                <div class="d-flex" style="gap: 1rem;">
                    <a href="${upiUrl}" class="btn btn-outline" style="flex: 1; justify-content: center; display: flex; text-decoration: none; align-items: center;">📱 Pay via App</a>
                    <button class="btn btn-primary" style="flex: 1; justify-content: center;" onclick="renderCheckoutStep(2, ${id}, '${upi_id}', ${price}, '${productName.replace(/'/g, "\\'")}')">I have paid ➔</button>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            new QRCode(document.getElementById("checkout-qr"), {
                text: upiUrl,
                width: 180,
                height: 180,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.M
            });
        }, 50);
    } else if (step === 2) {
        body.innerHTML = `
            <div style="animation: scaleUp 0.3s ease-out;">
                <button class="btn btn-outline btn-small" style="margin-bottom: 1rem; border: none; padding: 0;" onclick="renderCheckoutStep(1, ${id}, '${upi_id}', ${price}, '${productName.replace(/'/g, "\\'")}')">← Back to Payment</button>
                <h2 style="margin-bottom: 0.5rem;">Step 2: Upload Proof</h2>
                <p style="color:var(--text-muted); margin-bottom: 1.5rem;">Provide your UTR and screenshot to verify the order #ORD-${id}.</p>
                
                <input type="text" id="checkout-utr" placeholder="12-Digit UTR ID" class="form-group" style="padding:1rem; width:100%; margin-bottom:1.5rem; font-size: 1.1rem; letter-spacing: 2px;">
                
                <label class="file-upload-wrapper" for="checkout-proof" style="display: block; margin-bottom: 1.5rem;">
                    <div id="checkout-upload-label">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📸</div>
                        <div style="font-size: 1rem; font-weight: 600;">Tap to Upload Screenshot</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">PNG, JPG up to 5MB</div>
                    </div>
                    <img id="checkout-preview" class="file-preview-img" style="margin: 0 auto;">
                    <input type="file" id="checkout-proof" accept="image/*" class="hidden" onchange="handleCheckoutPreview(this)">
                </label>
                
                <button class="btn btn-primary" style="width:100%; justify-content: center; font-size: 1.1rem; padding: 1rem;" onclick="submitCheckoutPayment(${id})">Submit for Verification</button>
            </div>
        `;
    }
}

function handleCheckoutPreview(input) {
    const file = input.files[0];
    const preview = document.getElementById('checkout-preview');
    const label = document.getElementById('checkout-upload-label');
    
    if (file && preview && label) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
            label.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

async function submitCheckoutPayment(orderId) {
    const utrInput = document.getElementById('checkout-utr');
    const fileInput = document.getElementById('checkout-proof');
    
    if(!utrInput.value || !/^\d{12}$/.test(utrInput.value)) {
        return api.showToast('Please enter a valid 12-digit UTR ID', 'error');
    }
    if(!fileInput || !fileInput.files[0]) {
        return api.showToast('Please upload payment screenshot', 'error');
    }

    const formData = new FormData();
    formData.append('order_id', orderId);
    formData.append('utr_id', utrInput.value);
    formData.append('proof', fileInput.files[0]);

    try {
        api.showToast('Uploading payment proof...', 'info');
        await api.request('/customer/payment-proof', {
            method: 'POST',
            headers: api.getHeaders(true),
            body: formData
        });
        
        document.getElementById('checkout-body').innerHTML = `
            <div style="text-align: center; padding: 2rem; animation: scaleUp 0.5s ease-out;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🚀</div>
                <h2 style="color: var(--primary); margin-bottom: 0.5rem;">Payment Received!</h2>
                <p style="color: var(--text-muted); font-size: 1rem; margin-bottom: 2rem;">Our curators are verifying your vibe. Hold tight.</p>
                <button class="btn btn-outline" style="width: 100%; justify-content: center;" onclick="closeCheckoutModal()">View Timeline</button>
            </div>
        `;
        
        setTimeout(loadOrders, 1000);
    } catch (e) {
        api.showToast(e.message || 'Upload failed', 'error');
    }
}

function parseIntent(inputText) {
    const text = inputText.toLowerCase();
    const result = {
        category: null,
        maxPrice: null,
        keywords: []
    };

    // 1. Identify Categories
    if (text.includes('healthy') || text.includes('organic') || text.includes('fresh')) result.category = 'healthy';
    else if (text.includes('budget') || text.includes('cheap') || text.includes('affordable') || text.includes('low price')) result.category = 'budget';
    else if (text.includes('fast') || text.includes('quick') || text.includes('instant')) result.category = 'fast';
    else if (text.includes('premium') || text.includes('luxury') || text.includes('exclusive')) result.category = 'premium';

    // 2. Extract Price Constraints (e.g., "under 100", "below 500")
    const priceMatch = text.match(/(?:under|below|less than|max|budget of)\s*(\d+)/) || text.match(/under(\d+)/);
    if (priceMatch) {
        result.maxPrice = parseFloat(priceMatch[1]);
    }

    // 3. Extract Keywords
    const stopWords = new Set(['i', 'want', 'to', 'eat', 'some', 'looking', 'for', 'a', 'an', 'the', 'is', 'are', 'show', 'me', 'food', 'snacks', 'under', 'below', 'healthy', 'budget', 'cheap', 'fast', 'premium', 'luxury', 'exclusive', 'affordable', 'quick', 'instant', 'vibe', 'vibes', 'please', 'assist', 'me', 'with', 'find', 'searching']);
    const words = text.replace(/[^\w\s]/g, '').split(/\s+/);
    result.keywords = words.filter(word => !stopWords.has(word) && word.length > 2 && isNaN(word));

    return result;
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
        const intent = parseIntent(text);
        
        let products = [];
        let aiResponse = "I have some great vibes for you!";

        // Decision Assistant Flow: Prioritize Recommendations
        if (intent.category || intent.maxPrice || intent.keywords.length > 0) {
            const params = new URLSearchParams();
            if (intent.category) params.append('category', intent.category);
            if (intent.maxPrice) params.append('max_price', intent.maxPrice);
            if (intent.keywords.length > 0) params.append('keyword', intent.keywords[0]);

            products = await api.request(`/customer/recommend?${params.toString()}`, {
                headers: api.getHeaders()
            });

            // Fallback Logic: If no products found, try a broader search
            if (products.length === 0 && (intent.maxPrice || intent.category)) {
                aiResponse = `I couldn't find matches for exactly that, but check out these trending items instead!`;
                // Suggestion: Price hint or general trending
                if (intent.maxPrice) aiResponse = `No items found under ₹${intent.maxPrice}. I've broadened the search for you!`;
                
                const broadParams = new URLSearchParams();
                if (intent.category) broadParams.append('category', intent.category);
                // Omit max_price for broadening
                products = await api.request(`/customer/recommend?${broadParams.toString()}`, {
                    headers: api.getHeaders()
                });
            }

            // Sync Main Shop View
            applyIntentToFilters(intent);
        } else {
            // Standard Chat Fallback
            const data = await api.request('/customer/chat', {
                method: 'POST',
                headers: api.getHeaders(),
                body: JSON.stringify({ message: text })
            });
            aiResponse = data.response;
            products = data.products;
        }

        appendMessage('ai', aiResponse, products);
    } catch (e) {
        console.error(e);
        appendMessage('ai', "Sorry, I'm having trouble connecting to the Vibe engine. Try again?");
    }
}

function applyIntentToFilters(intent) {
    if (intent.category) {
        activeIntent = intent.category;
        const chip = Array.from(document.querySelectorAll('.chip')).find(c => c.innerText.toLowerCase().includes(intent.category));
        if (chip) {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        }
    }
    
    if (intent.maxPrice) {
        const priceSelector = document.getElementById('price-filter');
        if (intent.maxPrice <= 500) priceSelector.value = 'under500';
        else if (intent.maxPrice <= 1000) priceSelector.value = '500-1000';
        else priceSelector.value = 'over1000';
    }

    if (intent.keywords.length > 0) {
        document.getElementById('product-search').value = intent.keywords.join(' ');
    }
    
    filterProducts();
}

function appendMessage(sender, text, products = []) {
    const body = document.getElementById('chat-body');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble bubble-${sender}`;
    bubble.innerText = text;
    body.appendChild(bubble);

    if(products && products.length > 0) {
        // Recommendations Section
        const recSection = document.createElement('div');
        recSection.className = 'chat-recommendations';
        
        const header = document.createElement('div');
        header.className = 'recommendation-header';
        header.innerHTML = `<span>✨</span> Top Matches`;
        recSection.appendChild(header);

        const detailGrid = document.createElement('div');
        detailGrid.className = 'chat-products-detailed';
        
        products.forEach(p => {
            const tags = getVibeTags(p.description, p.name, p.price);
            detailGrid.innerHTML += `
                <div class="recommendation-card" onclick="openModal(${p.id})">
                    <span class="rec-badge">Recommended for you</span>
                    <img src="${IMAGE_BASE}/${p.image}" class="rec-img">
                    <div class="rec-info">
                        <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">${p.name}</div>
                        <div style="color: var(--primary); font-weight: 700; font-size: 0.9rem;">₹${p.price}</div>
                        <div class="tag-container">
                            ${tags.map(t => `<span class="tag-badge vibe-${t.type}">${t.label}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        recSection.appendChild(detailGrid);
        body.appendChild(recSection);
    } else if (sender === 'ai') {
        // Micro-suggestions if no products found or small results
        const suggestions = getMicroSuggestions();
        if (suggestions) {
            const sugEl = document.createElement('div');
            sugEl.className = 'micro-suggestion';
            sugEl.innerHTML = `💡 <b>Vibe Tip:</b> ${suggestions}`;
            body.appendChild(sugEl);
        }
    }

    body.scrollTop = body.scrollHeight;
}

function getVibeTags(desc, name, price) {
    const text = (desc + ' ' + name).toLowerCase();
    const tags = [];
    
    if (text.includes('healthy') || text.includes('organic') || text.includes('fresh')) tags.push({label: 'Healthy 🍃', type: 'healthy'});
    if (price < 500) tags.push({label: 'Budget 💸', type: 'budget'});
    if (text.includes('fast') || text.includes('quick') || text.includes('instant')) tags.push({label: 'Fast ⚡', type: 'fast'});
    if (price > 1000 || text.includes('premium')) tags.push({label: 'Premium ✨', type: 'premium'});
    
    // Add specific food tags mentioned in prompt
    if (text.includes('spicy') || text.includes('chili')) tags.push({label: 'Spicy 🌶️', type: 'default'});
    if (text.includes('protein') || text.includes('meat') || text.includes('chicken')) tags.push({label: 'High Protein 💪', type: 'default'});
    
    return tags;
}

function getMicroSuggestions() {
    const query = document.getElementById('chat-input').value.toLowerCase();
    // Logic based on global state or recent intent
    if (activeIntent === 'budget') return "Try increasing your budget for more premium options.";
    if (allProducts.length > 10) return "Explore our trending items section for the most viral vibes.";
    return "Check out our latest arrivals for more inspiration.";
}
async function loadOrders() {
    try {
        const grid = document.getElementById('orders-grid');
        api.renderSkeletons('orders-grid', 3);
        const orders = await api.request('/customer/orders', { headers: api.getHeaders() });
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
        
        orders.forEach(o => {
            let statusClass = 'warning';
            let statusLabel = o.status;
            
            if(o.status === 'VERIFIED' || o.status === 'DELIVERED') statusClass = 'success';
            if(o.status === 'REJECTED' || o.status === 'CANCELLED' || o.status === 'EXPIRED') statusClass = 'danger';
            if(o.status === 'PAYMENT_UPLOADED') { statusClass = 'info'; statusLabel = 'VERIFYING'; }

            // Timeline Calculation
            const steps = [
                { label: 'Ordered', active: true },
                { label: 'Paid', active: ['PAYMENT_UPLOADED', 'VERIFIED', 'DELIVERED'].includes(o.status) },
                { label: 'Secured', active: ['VERIFIED', 'DELIVERED'].includes(o.status) }
            ];

            const timelineHtml = `
                <div class="order-timeline" style="display:flex; justify-content:space-between; margin: 1.5rem 0; position:relative;">
                    <div style="position:absolute; top:10px; left:0; right:0; height:2px; background:rgba(255,255,255,0.1); z-index:0;"></div>
                    <div style="position:absolute; top:10px; left:0; width:${o.status === 'VERIFIED' ? '100%' : (o.status === 'PAYMENT_UPLOADED' ? '50%' : '0%')}; height:2px; background:var(--primary); transition:width 0.5s; z-index:0;"></div>
                    ${steps.map(s => `
                        <div style="text-align:center; z-index:1; position:relative;">
                            <div style="width:20px; height:20px; border-radius:50%; background:${s.active ? 'var(--primary)' : '#333'}; border:4px solid var(--bg-dark); margin:0 auto 0.5rem;"></div>
                            <span style="font-size:0.7rem; color:${s.active ? 'var(--text-main)' : 'var(--text-muted)'}">${s.label}</span>
                        </div>
                    `).join('')}
                </div>
            `;



            const rejectionHtml = o.status === 'REJECTED' ? `
                <div style="padding:0.75rem; background:rgba(255,0,0,0.1); border-left:4px solid var(--danger); border-radius:4px; margin: 1rem 0;">
                    <p style="font-size:0.8rem; color:var(--danger); font-weight:600;">Rejection Reason:</p>
                    <p style="font-size:0.8rem; color:var(--text-main);">${o.rejection_reason || 'Unknown issue with payment proof.'}</p>
                </div>
            ` : '';

            grid.innerHTML += `
                <div class="glass-panel card" style="border-top: 4px solid var(--${statusClass === 'info' ? 'accent-blue' : (statusClass === 'success' ? 'primary' : 'danger')});">
                    <div class="d-flex justify-between" style="align-items:flex-start;">
                        <div>
                            <h3 style="margin-bottom:0.25rem;">${o.name}</h3>
                            <p style="color:var(--text-muted); font-size:0.8rem;">#ORD-${o.id} • ${new Date(o.created_at).toLocaleDateString()}</p>
                        </div>
                        <span class="badge" style="background:var(--${statusClass === 'info' ? 'accent-blue' : (statusClass === 'success' ? 'accent-green' : 'danger')});">${statusLabel}</span>
                    </div>
                    
                    <div style="margin:1rem 0;">
                        <span class="price" style="font-size:1.5rem;">₹${o.price}</span>
                        ${o.utr_id ? `<p style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">UTR: ${o.utr_id}</p>` : ''}
                    </div>

                    ${timelineHtml}
                    ${rejectionHtml}
                    ${(o.status === 'PAYMENT_PENDING' || o.status === 'REJECTED') ? `
                        <div class="glass-panel" style="padding:1.5rem; margin-top:1rem; border: 1px dashed var(--primary); text-align: center;">
                            <p style="font-size:0.9rem; margin-bottom:1rem; font-weight:600; color: var(--primary);">✨ Complete Payment to Secure Vibe</p>
                            <button class="btn btn-primary" style="width:100%; justify-content: center;" onclick="resumeCheckout(${o.id}, '${o.upi_id}', ${o.price}, '${o.name.replace(/'/g, "\\'")}')">Resume Checkout Process</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        // Render QRs after appending to DOM - Removed since QR is now in modal
    } catch (e) {
        console.error(e);
        api.showToast('Failed to load orders', 'error');
    }
}

async function loadSocialProofTicker() {
    try {
        const feed = await api.request('/customer/recently-purchased', { headers: api.getHeaders() });
        if (feed.length === 0) return;
        
        let ticker = document.getElementById('social-ticker');
        if (!ticker) {
            ticker = document.createElement('div');
            ticker.id = 'social-ticker';
            ticker.style.cssText = 'position:fixed; bottom: 2rem; left: 2rem; z-index: 1000; display: flex; flex-direction: column; gap: 0.5rem;';
            document.body.appendChild(ticker);
        }
        
        const item = feed[Math.floor(Math.random() * feed.length)];
        const el = document.createElement('div');
        el.className = 'glass-panel d-flex align-center';
        el.style.cssText = 'padding: 0.5rem 1rem; font-size: 0.75rem; animation: slideUp 0.5s ease-out; border-radius: 50px; background: rgba(0,0,0,0.8);';
        el.innerHTML = `
            <span style="color:var(--accent-green);">🛒</span>
            <span>Someone just secured <b>${item.name}</b></span>
        `;
        ticker.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 500);
        }, 5000);
    } catch (e) { console.error(e); }
}

// submitPayment is now submitCheckoutPayment, removed old submitPayment

function toggleView(viewId) {
    document.getElementById('products-view').classList.add('hidden');
    document.getElementById('orders-view').classList.add('hidden');
    const targetView = document.getElementById(viewId);
    targetView.classList.remove('hidden');
    targetView.style.animation = 'slideUp 0.4s ease-out';
    
    if(viewId === 'products-view') loadProducts();
    if(viewId === 'orders-view') loadOrders();
}

// Initial load & Polling
loadProducts();

// V6.1 Buyer-side polling (5s)
setInterval(() => {
    const ordersView = document.getElementById('orders-view');
    if(ordersView && !ordersView.classList.contains('hidden')) {
        loadOrders();
    }
}, 5000);
