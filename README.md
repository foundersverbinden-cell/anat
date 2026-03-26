# Aivore - The Intent-Driven Vibe Marketplace
**"From screen to real time"**

Aivore is a modern, ultra-fast marketplace platform designed for discovery and seamless festival shopping. Built with a focus on "Vibes", the platform uses intelligent intent parsing to help users find exactly what they need instantly.

## 🚀 Key Features
- **Intent-First UI**: Discovery chips (Healthy, Budget, Fast, etc.) with glassmorphism design.
- **AI Decision Assistant**: A natural language assistant that parses queries like "cheap spicy snacks" and renders direct product recommendations.
- **Intelligent Ranking**: Backend recommendation engine sorting by relevance, price, and popularity.
- **Vibe Tracking**: Social proof ticker and verified seller badges for enhanced trust.
- **Secure UPI Flow**: Instant checkout with QR-based settlement and status tracking.

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+).
- **Backend**: Python (Flask), SQLite, Gunicorn.
- **Security**: JWT-based Authentication, AES-256 simulation, Audit Logging.
- **Deployment**: Render (Backend), Vercel (Frontend).

## 📂 Architecture
```text
├── app.py              # Main Flask entry point
├── routes/             # API blueprints (auth, customer, seller)
├── models/             # Database schema and utilities
├── frontend/           # Glassmorphism UI components
│   ├── css/            # Vibe-driven styling
│   └── js/             # Intent parser and API integration
└── uploads/            # Cloud-ready product media storage
```

## ⚡ Quick Start
1. **Clone & Setup**:
   ```bash
   pip install -r requirements.txt
   ./venv/bin/python3 app.py
   ```
2. **Access**: Open `http://localhost:5000` in your browser.

---
*Created for the Aivore Network.*
