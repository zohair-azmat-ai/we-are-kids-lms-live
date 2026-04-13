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
[![Jitsi Meet](https://img.shields.io/badge/Jitsi_Meet-97979A?style=for-the-badge&logo=jitsi&logoColor=white)](https://meet.jit.si)
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
| 🎥 | **Live video classrooms** — real-time calls via Jitsi Meet WebRTC |
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

**Real-time video classrooms powered by Jitsi Meet WebRTC.**

| Step | |
|:---:|:---|
| **1** | Teacher clicks **Start Class** — LMS marks the session as LIVE |
| **2** | Students see the class go live and join with a single click |
| **3** | Desktop: Jitsi loads inside the LMS UI (iframe) |
| **4** | Mobile: Jitsi opens full-screen (redirect — iframe is not stable on mobile) |
| **5** | Teacher becomes moderator (may require Google login on public meet.jit.si) |
| **6** | Session ends → recording available for playback |

---

## ⚠️ Jitsi Limitation

- Free public Jitsi (`meet.jit.si`) may show a 5-minute demo warning on large calls
- Teacher may need to log in with Google to receive moderator (host) privileges
- Mobile devices are redirected to the Jitsi app instead of using an embedded iframe
- For full moderator control without login prompts, a private self-hosted Jitsi server with JWT enabled is needed (the backend endpoint `GET /api/v1/jitsi/token` is already implemented)

---

## ⚡ Features

### 🤖 AI
- Context-aware **AI assistant chat** for students and teachers
- **AI insights panel** — recommendations generated from class activity
- Graceful fallback if no OpenAI key is configured

### 🎥 Live Classes
- Teacher-initiated Jitsi Meet video rooms
- Students join with a single click from their dashboard
- Desktop: embedded iframe inside LMS UI
- Mobile: full-screen redirect for stable call experience
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
        JITSI[("🎥 Jitsi Meet")]
        STRIPE[("💳 Stripe")]
        OPENAI[("🤖 OpenAI")]
    end

    A & T & S --> LOGIN --> JWT --> API
    API --> DB
    DASH --> API
    LIVE --> JITSI
    AI_UI --> AI_SVC --> OPENAI
    DASH --> STR_SVC --> STRIPE
```

---

## 📊 Project Metrics

| Metric | Detail |
|:---|:---|
| User Roles | Admin · Teacher · Student |
| Live Video | Jitsi Meet (WebRTC, public) |
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
| Live Video | Jitsi Meet (meet.jit.si) — WebRTC |
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

Optional — for private self-hosted Jitsi with enforced moderator roles:
```env
JITSI_DOMAIN=jitsi.yourdomain.com
JITSI_APP_ID=your_app_id
JITSI_APP_SECRET=your_app_secret
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
| 🔴 High | Private self-hosted Jitsi for full moderator control |
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
