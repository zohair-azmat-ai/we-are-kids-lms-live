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
[![Agora RTC](https://img.shields.io/badge/Agora_RTC-099DFD?style=for-the-badge&logo=agora&logoColor=white)](https://www.agora.io)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Neon](https://img.shields.io/badge/Neon_Postgres-00E5A0?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Vercel-111111?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Hugging Face](https://img.shields.io/badge/Hugging_Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/spaces)

<br />

![Platform Hero](./frontend/public/images/hero.png)

<br />

*Built by [Zohair Azmat](https://github.com/zohair-azmat-ai) — Full Stack Developer · AI Systems Builder*

</div>

---

## 🚀 Live Demo

👉 **[https://we-are-kids-lms-live.vercel.app/](https://we-are-kids-lms-live.vercel.app/)**

Explore the full AI-powered LMS with live classrooms, SaaS billing, and analytics.

| Role | Email | Password |
|:---|:---|:---|
| Admin | `admin@wearekids.com` | `123456` |
| Teacher | `teacher1@wearekids.com` | `123456` |
| Student | `student1@wearekids.com` | `123456` |

---

## 💡 Why This Project Stands Out

| | What's Real |
|:---:|:---|
| 🎥 | **Live video classrooms** — in-app real-time calls via Agora RTC |
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

**Real-time in-app video classrooms powered by Agora RTC.**

| Step | |
|:---:|:---|
| **1** | Teacher clicks **Start Class** — LMS marks the session as LIVE |
| **2** | Both teacher and students join the same Agora channel inside the LMS |
| **3** | Video and audio stream directly in the browser — no external tab or app needed |
| **4** | Mute/unmute mic, hide/show camera controls are built in |
| **5** | Session ends → recording available for playback |

---

## ⚡ Features

### 🤖 AI
- Context-aware **AI assistant chat** for students and teachers
- **AI insights panel** — recommendations generated from class activity
- Graceful fallback if no OpenAI key is configured

### 🎥 Live Classes
- Teacher-initiated Agora RTC video rooms — in-app, no external tabs
- Students join with a single click from their dashboard
- Camera and microphone controls built into the LMS UI
- Works on desktop and mobile browsers
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
        STR_SVC["Stripe Service"]
        AI_SVC["AI Service"]
    end

    subgraph Infra
        DB[("🐘 Neon Postgres")]
        AGORA[("🎥 Agora RTC")]
        STRIPE[("💳 Stripe")]
        OPENAI[("🤖 OpenAI")]
    end

    A & T & S --> LOGIN --> JWT --> API
    API --> DB
    DASH --> API
    LIVE --> AGORA
    AI_UI --> AI_SVC --> OPENAI
    DASH --> STR_SVC --> STRIPE
```

---

## 📊 Project Metrics

| Metric | Detail |
|:---|:---|
| User Roles | Admin · Teacher · Student |
| Live Video | Agora RTC (in-app WebRTC) |
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
| Live Video | Agora RTC — in-app video |
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
STRIPE_SECRET_KEY=your_stripe_key
OPENAI_API_KEY=your_openai_key
SECRET_KEY=your_jwt_secret
CORS_ORIGINS=http://localhost:3000
```

Agora RTC (required for live classrooms):
```env
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
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
| 🔴 High | Agora cloud recording integration |
| 🟡 Medium | Parent portal with progress reports |
| 🟡 Medium | Real-time notifications |
| 🟡 Medium | AI auto-summaries for completed sessions |
| 🟢 Low | Mobile app (React Native) |
| 🟢 Low | Multi-tenant school isolation |

---

<div align="center">

## 🔥 Ready to Explore?

👉 **Live Demo: [https://we-are-kids-lms-live.vercel.app/](https://we-are-kids-lms-live.vercel.app/)**

**Built by Zohair Azmat** — Full Stack Developer · AI Systems Builder

*This project represents a transition from learning to building real AI-powered products.*

<br />

[![GitHub](https://img.shields.io/badge/GitHub-zohair--azmat--ai-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/zohair-azmat-ai)
[![Live Demo](https://img.shields.io/badge/Live_Demo-we--are--kids--lms-16A34A?style=for-the-badge&logo=vercel&logoColor=white)](https://we-are-kids-lms-live.vercel.app/)

</div>
