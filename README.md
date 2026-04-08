<div align="center">

<img src="./frontend/public/images/logo.png" alt="We Are Kids Nursery" width="120" />

# We Are Kids Nursery
### AI-Powered LMS · Live Video Classrooms · SaaS Billing

**From demo to real AI-powered SaaS platform.**

<br />

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Neon Postgres](https://img.shields.io/badge/Neon_Postgres-00E5A0?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![JWT Auth](https://img.shields.io/badge/JWT_Auth-F59E0B?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![LiveKit](https://img.shields.io/badge/LiveKit-E11D48?style=for-the-badge&logo=webrtc&logoColor=white)](https://livekit.io)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Vercel](https://img.shields.io/badge/Vercel-111111?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Hugging Face](https://img.shields.io/badge/Hugging_Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/spaces)

<br />

![Platform Banner](./frontend/public/images/hero.png)

</div>

---

## 🚀 Live Classroom Experience

> The most production-ready feature of this platform — real-time video classrooms powered by LiveKit WebRTC.

**How it works in 4 steps:**

| Step | What Happens |
|:---:|:---|
| 1 | Teacher opens their class and clicks **Start Live Session** |
| 2 | LiveKit creates a secure room — students see it go live instantly |
| 3 | All participants join a **real-time video grid** — audio, video, multi-tile |
| 4 | Session ends → recording uploaded → available for 5 days |

This is not a mock or embedded iframe. It is a full WebRTC classroom built on production-grade LiveKit infrastructure.

![Live Classroom](./frontend/public/images/live-class.png)

---

## 💡 Why This Project Stands Out

This is not a tutorial project. Every feature below is implemented end-to-end.

|  | Feature | What makes it real |
|:---:|:---|:---|
| 🎥 | **Real-time video classrooms** | LiveKit WebRTC SDK — multi-participant, production-grade |
| 💳 | **Full SaaS billing** | Stripe subscriptions with tiered plan enforcement per route |
| 🤖 | **AI assistant + insights** | OpenAI-powered chat and classroom recommendations |
| 🔐 | **JWT authentication** | Token-based auth with bcrypt, role-protected routes |
| 🐘 | **Cloud database** | Neon Postgres via SQLAlchemy — persistent, not in-memory |
| 🚀 | **Deployed to production** | Vercel (frontend) + Hugging Face Spaces (backend) |

---

## Features

### 🤖 AI Features

- **AI Assistant Chat** — context-aware chat for students and teachers
- **AI Insights Panel** — smart recommendations from class activity
- **Graceful fallback** — works with or without an OpenAI key

### 🎥 Live Classes

- Teacher-initiated LiveKit video rooms
- Student join via secure session token
- Multi-participant video grid in the classroom UI
- Post-session recording upload with 5-day auto-expiry

### 🏫 LMS Core

- Role-based dashboards: Admin · Teacher · Student
- Class creation, scheduling, and management
- Recording library: upload · playback · rename · delete
- Mobile-responsive, nursery-branded design

### 💳 SaaS Billing

- Stripe subscription billing
- Tiered plans with usage limits enforced per API route
- Admin billing management dashboard
- Pricing page with plan comparison

### 📊 Analytics

- Bar chart dashboards per user role
- Session and recording usage tracking
- System status monitoring
- Role-specific metrics

### 🛡️ Admin Controls

- Full user management (teachers + students)
- Live session monitoring
- Recording library oversight
- Billing tier management

---

## 📸 Product Screens

> Screenshots from the live platform.

### Landing Page
![Landing Page](./frontend/public/images/hero.png)

### Live Classroom
![Live Classroom](./frontend/public/images/live-class.png)

### Admin Dashboard
<!-- frontend/public/images/screenshots/admin-dashboard.png -->
*Full management panel — users, classes, sessions, recordings, billing.*

### Teacher Dashboard
<!-- frontend/public/images/screenshots/teacher-dashboard.png -->
*Live class controls, recording management, AI insights.*

### Student Dashboard
<!-- frontend/public/images/screenshots/student-dashboard.png -->
*Class join, recordings, AI assistant chat.*

### Billing & Pricing
<!-- frontend/public/images/screenshots/billing.png -->
*Stripe-powered plan tiers with live usage enforcement.*

### AI Assistant
<!-- frontend/public/images/screenshots/ai-assistant.png -->
*Contextual AI chat and insight recommendations.*

---

## Architecture

```mermaid
flowchart TD
    subgraph Users
        A["👤 Admin"]
        T["👩‍🏫 Teacher"]
        S["👧 Student"]
    end

    subgraph Frontend["Next.js 14 · Vercel"]
        UI["App UI + Routing"]
        AUTH_UI["Login / JWT State"]
    end

    subgraph Backend["FastAPI · Hugging Face Spaces"]
        API["REST API"]
        JWT["JWT Auth"]
        LK["LiveKit Service"]
        STR["Stripe Service"]
        AI["AI Service"]
    end

    subgraph Data
        DB[("🐘 Neon Postgres")]
        LK_IO[("🎥 LiveKit.io")]
        STRIPE_IO[("💳 Stripe")]
        OPENAI_IO[("🤖 OpenAI")]
    end

    A & T & S --> AUTH_UI --> JWT
    JWT --> UI --> API
    API --> DB
    LK --> LK_IO
    STR --> STRIPE_IO
    AI --> OPENAI_IO
```

---

## Demo

### Credentials

| Role | Email | Password |
|:---|:---|:---|
| Admin | `admin@wearekids.com` | `123456` |
| Teacher | `teacher1@wearekids.com` | `123456` |
| Student | `student1@wearekids.com` | `123456` |

### Suggested Walkthrough

1. **Admin** — explore user management, billing, and session oversight
2. **Teacher** — start a live class, check AI insights, manage recordings
3. **Student (second tab)** — join the live class, use AI assistant
4. **Billing** — observe plan enforcement when usage limits are hit

---

## Tech Stack

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

## Local Setup

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

### Environment Variables

**Frontend** `.env.local`
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Backend** `.env`
```env
DATABASE_URL=postgresql+psycopg2://user:password@your-neon-host/dbname
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
STRIPE_SECRET_KEY=your_stripe_secret_key
OPENAI_API_KEY=your_openai_api_key
SECRET_KEY=your_jwt_secret_key
CORS_ORIGINS=http://localhost:3000
```

---

## Deployment

**Frontend → Vercel**
1. Import repo → set root to `frontend/`
2. Add `NEXT_PUBLIC_API_BASE_URL` → deploy

**Backend → Hugging Face Spaces**
1. New Space (Docker SDK) → upload `hf-space-backend/`
2. Set all env vars in Space settings
3. Copy Space URL → paste into Vercel as `NEXT_PUBLIC_API_BASE_URL`

---

## Roadmap

| Priority | Feature |
|:---|:---|
| High | Attendance tracking per live session |
| High | Cloud recording storage (S3 / Cloudflare R2) |
| Medium | Parent portal with progress reports |
| Medium | Real-time notifications (email + in-app) |
| Medium | AI auto-summaries for completed sessions |
| Low | Mobile app (React Native) |
| Low | Multi-tenant school isolation |

---

<div align="center">

---

## 🚀 Built by

**Zohair Azmat**
Full Stack Developer · AI Systems Builder

*This project represents a transition from learning to building real AI-powered products.*

[![GitHub](https://img.shields.io/badge/GitHub-zohair--azmat--ai-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/zohair-azmat-ai)

</div>
