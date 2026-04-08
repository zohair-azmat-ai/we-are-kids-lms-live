<div align="center">

<img src="./frontend/public/images/logo.png" alt="We Are Kids Nursery" width="100" />

<br />

# We Are Kids Nursery

### AI-powered LMS with real-time classrooms, SaaS billing, and intelligent insights.

<br />

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![LiveKit](https://img.shields.io/badge/LiveKit-E11D48?style=for-the-badge&logo=webrtc&logoColor=white)](https://livekit.io)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Neon](https://img.shields.io/badge/Neon_Postgres-00E5A0?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Vercel-111111?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Hugging Face](https://img.shields.io/badge/Hugging_Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/spaces)

<br />

![Platform Hero](./frontend/public/images/hero.png)

<br />

### 🌐 [Explore the live AI LMS platform →](https://we-are-kids-lms-live.vercel.app/)

*Built by [Zohair Azmat](https://github.com/zohair-azmat-ai) — Full Stack Developer · AI Systems Builder*

</div>

---

## 💡 Why This Project Stands Out

> Every feature is implemented end-to-end. No mocks. No placeholders. No tutorials.

| | What's Real |
|:---:|:---|
| 🎥 | **Live WebRTC classrooms** — multi-participant video via LiveKit, not an iframe |
| 💳 | **SaaS billing** — Stripe subscriptions with plan limits enforced at the API layer |
| 🤖 | **AI assistant + insights** — OpenAI-powered chat and classroom recommendations |
| 🔐 | **JWT auth** — bcrypt passwords, role-protected routes, token-based sessions |
| 🐘 | **Cloud database** — Neon Postgres via SQLAlchemy, persistent across deploys |
| 🚀 | **Production deployed** — Vercel frontend + Hugging Face Spaces backend (Docker) |

---

## 🎥 Live Classroom Experience

<div align="center">

![Live Classroom](./frontend/public/images/live-class.png)

</div>

<br />

**Real-time video classrooms powered by LiveKit WebRTC — not a demo.**

| Step | |
|:---:|:---|
| **1** | Teacher clicks **Start Live Session** — a LiveKit room is created instantly |
| **2** | Students see the class go live and join with a single click |
| **3** | All participants appear in a real-time video grid |
| **4** | Session ends → recording uploaded → available for 5 days |

---

## ⚡ Features

### 🤖 AI
- Context-aware **AI assistant chat** for students and teachers
- **AI insights panel** — recommendations generated from class activity
- Graceful fallback if no OpenAI key is configured

### 🎥 Live Classes
- Teacher-initiated LiveKit video rooms
- Secure student join via session token
- Multi-participant real-time video grid
- Post-session recording with 5-day auto-expiry

### 🏫 LMS Core
- Role dashboards: **Admin · Teacher · Student**
- Class scheduling and management
- Recording library: upload · playback · rename · delete

### 💳 SaaS Billing
- Stripe subscription billing
- Tiered plans with **API-layer usage enforcement**
- Admin billing dashboard + pricing page

### 📊 Analytics
- Bar chart dashboards per user role
- Session and recording usage tracking
- System status monitoring

### 🛡️ Admin
- Full user management (teachers + students)
- Live session monitoring
- Billing tier control

---

## 📸 Product Screens

### 🏠 Landing Page
![Landing Page](./frontend/public/images/hero.png)

<br />

### 🎥 Live Classroom
![Live Classroom](./frontend/public/images/live-class.png)

<br />

### 🛡️ Admin Dashboard
*Full management — users, classes, sessions, recordings, billing.*
<!-- Add: frontend/public/images/screenshots/admin-dashboard.png -->

<br />

### 👩‍🏫 Teacher Dashboard
*Live class controls, recording management, AI insights.*
<!-- Add: frontend/public/images/screenshots/teacher-dashboard.png -->

<br />

### 👧 Student Dashboard
*Class join, recordings, AI assistant chat.*
<!-- Add: frontend/public/images/screenshots/student-dashboard.png -->

<br />

### 🤖 AI Assistant
*Contextual AI chat and insight recommendations.*
<!-- Add: frontend/public/images/screenshots/ai-assistant.png -->

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Users
        A["👤 Admin"]
        T["👩‍🏫 Teacher"]
        S["👧 Student"]
    end

    subgraph FE["Next.js 14 · Vercel"]
        LOGIN["Login & JWT"]
        DASH["Dashboards"]
        LIVE["Live Classroom UI"]
        AI_UI["AI Assistant UI"]
    end

    subgraph BE["FastAPI · Hugging Face Spaces"]
        JWT["JWT Auth"]
        API["REST API"]
        LK_SVC["LiveKit Service"]
        STR_SVC["Stripe Service"]
        AI_SVC["AI Service"]
    end

    subgraph Infra
        DB[("🐘 Neon Postgres")]
        LK[("🎥 LiveKit.io")]
        STRIPE[("💳 Stripe")]
        OPENAI[("🤖 OpenAI")]
    end

    A & T & S --> LOGIN --> JWT --> API
    API --> DB
    DASH --> API
    LIVE --> LK_SVC --> LK
    AI_UI --> AI_SVC --> OPENAI
    DASH --> STR_SVC --> STRIPE
```

---

## 📊 Project Metrics

| Metric | Detail |
|:---|:---|
| User Roles | Admin · Teacher · Student |
| Live Video | LiveKit WebRTC — multi-participant |
| Authentication | JWT + bcrypt |
| Database | Neon Postgres · SQLAlchemy 2.0 |
| Billing | Stripe — tiered plan enforcement |
| AI | OpenAI assistant + insights panel |
| Analytics | Bar chart dashboards per role |
| Deployment | Vercel + Hugging Face Spaces |
| Recordings | Upload · Playback · 5-day auto-expiry |

---

## 🛠️ Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | Next.js 14 · TypeScript · Tailwind CSS · React 18 |
| Backend | FastAPI 0.115 · Uvicorn |
| Database | Neon Postgres · SQLAlchemy 2.0 |
| Auth | JWT · python-jose · bcrypt |
| Live Video | LiveKit Client 2.15.6 · livekit-api 0.8.2 |
| Billing | Stripe 12.0 |
| AI | OpenAI via ai_service.py |
| Deployment | Vercel + Hugging Face Spaces (Docker) |

---

## 🚀 Local Setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
cp .env.example .env.local
npm install && npm run dev
```

---

## 🔑 Environment Variables

**Frontend** `.env.local`
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Backend** `.env`
```env
DATABASE_URL=postgresql+psycopg2://user:password@your-neon-host/dbname
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
LIVEKIT_URL=wss://your-server.livekit.cloud
STRIPE_SECRET_KEY=your_stripe_key
OPENAI_API_KEY=your_openai_key
SECRET_KEY=your_jwt_secret
CORS_ORIGINS=http://localhost:3000
```

---

## ☁️ Deployment

**Frontend → Vercel**
1. Import repo → set root to `frontend/`
2. Set `NEXT_PUBLIC_API_BASE_URL` to backend URL → deploy

**Backend → Hugging Face Spaces**
1. New Space (Docker) → upload `hf-space-backend/`
2. Set all env vars in Space settings
3. Copy Space URL → use as `NEXT_PUBLIC_API_BASE_URL`

---

## 🗺️ Roadmap

| Priority | Feature |
|:---|:---|
| 🔴 High | Attendance tracking per live session |
| 🔴 High | Cloud recording storage (S3 / R2) |
| 🟡 Medium | Parent portal with progress reports |
| 🟡 Medium | Real-time notifications |
| 🟡 Medium | AI auto-summaries for completed sessions |
| 🟢 Low | Mobile app (React Native) |
| 🟢 Low | Multi-tenant school isolation |

---

<div align="center">

## 🚀 Ready to Explore?

### 🌐 [we-are-kids-lms-live.vercel.app](https://we-are-kids-lms-live.vercel.app/)

| Role | Email | Password |
|:---|:---|:---|
| Admin | `admin@wearekids.com` | `123456` |
| Teacher | `teacher1@wearekids.com` | `123456` |
| Student | `student1@wearekids.com` | `123456` |

<br />

**Built by Zohair Azmat** — Full Stack Developer · AI Systems Builder

*This project represents a transition from learning to building real AI-powered products.*

<br />

[![GitHub](https://img.shields.io/badge/GitHub-zohair--azmat--ai-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/zohair-azmat-ai)
[![Live Demo](https://img.shields.io/badge/Live_Demo-we--are--kids--lms-16A34A?style=for-the-badge&logo=vercel&logoColor=white)](https://we-are-kids-lms-live.vercel.app/)

</div>
