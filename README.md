<div align="center">

<img src="./frontend/public/images/logo.png" alt="We Are Kids Nursery Logo" width="160" />

# We Are Kids Nursery
## AI LMS + Live Class SaaS Platform

**A production-ready AI-powered school LMS with live video classes, SaaS billing, analytics, and smart automation.**

<br />

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[![Neon Postgres](https://img.shields.io/badge/Neon_Postgres-Database-00E5A0?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![JWT Auth](https://img.shields.io/badge/JWT-Auth_Secured-F59E0B?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![LiveKit](https://img.shields.io/badge/LiveKit-Live_Video-E11D48?style=for-the-badge&logo=webrtc&logoColor=white)](https://livekit.io)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)

[![OpenAI](https://img.shields.io/badge/OpenAI-AI_Assistant-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Vercel](https://img.shields.io/badge/Vercel-Frontend-111111?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Hugging Face](https://img.shields.io/badge/Hugging_Face-Backend-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/spaces)

[![AI Powered](https://img.shields.io/badge/AI-Powered-8B5CF6?style=for-the-badge&logo=sparkles&logoColor=white)](#ai-features)
[![Live Classes](https://img.shields.io/badge/Live-Classes-DC2626?style=for-the-badge&logo=videocamera&logoColor=white)](#live-video-class-system)
[![SaaS](https://img.shields.io/badge/SaaS-Platform-0EA5E9?style=for-the-badge&logo=cloud&logoColor=white)](#saas--billing)
[![Production Ready](https://img.shields.io/badge/Production-Ready-16A34A?style=for-the-badge&logo=checkmarx&logoColor=white)](#production-readiness)

</div>

---

<div align="center">

### Built by [Zohair Azmat](https://github.com/zohair-azmat-ai)
**Full Stack Developer · AI Systems Builder**

*Designed and built as a production-style AI SaaS platform for modern schools and nurseries.*

</div>

---

## What's New

> Latest upgrades across Phases 14–17 — this is no longer a demo.

| Phase | Upgrade |
|---|---|
| Phase 14 | JWT authentication + role-based route protection |
| Phase 15 | SaaS plan limits and usage enforcement |
| Phase 16 | AI assistant chat + AI-powered classroom insights |
| Phase 17 | Analytics dashboards, final polish, production-ready UI |
| Ongoing | Neon Postgres integration · LiveKit live classrooms · Stripe subscriptions |

---

## Overview

**We Are Kids Nursery** is a full-stack, AI-powered LMS SaaS platform built for modern schools and nurseries. It delivers everything a real school software product needs: role-based access control, live video classrooms, AI-driven recommendations, subscription billing, usage enforcement, and analytics dashboards — all wrapped in a polished, production-grade interface.

The platform supports three core user roles — **Admin**, **Teacher**, and **Student** — each with dedicated dashboards, workflows, and permissions. Administrators manage the entire institution. Teachers run live classrooms and upload recordings. Students join live sessions, access recordings, and interact with the AI assistant.

This project is built from the ground up as a serious SaaS product, not a prototype.

---

## Key Features

### AI Features
- **AI Assistant Chat** — students and teachers interact with a context-aware AI assistant
- **AI Insights Panel** — smart recommendations based on class activity and performance
- **Intelligent Automation** — AI-driven nudges for engagement and learning gaps

### LMS Features
- Role-based dashboards for Admin, Teacher, and Student
- Class management: create, schedule, and manage courses
- Recording upload, playback, rename, delete, and 5-day auto-expiry
- Admin control panel for users, classes, sessions, and recordings
- Mobile-responsive nursery-branded UI with polished empty, loading, and error states

### Live Video Class Features
- **LiveKit-powered real-time video classrooms**
- Teacher-initiated live sessions with direct student join
- Live classroom room with multi-participant video tiles
- Post-session recording upload and automatic expiry
- Production-grade WebRTC infrastructure via LiveKit SDK

### SaaS / Billing Features
- Stripe-powered subscription billing
- Tiered SaaS plans with usage limits per tier
- Plan enforcement across routes and API endpoints
- Admin billing management dashboard
- Pricing page with plan comparison

### Analytics / Insights
- Class activity analytics with bar charts
- Session and recording usage tracking
- Role-specific metrics per dashboard
- System status monitoring card

### Admin Controls
- Full user management (add/edit/remove teachers and students)
- Class and live session oversight
- Recording library management
- System status visibility
- Billing tier management

---

## Live Video Class System

One of the platform's most significant features is its **real-time live classroom system**, built on top of [LiveKit](https://livekit.io) — a production-grade WebRTC video infrastructure.

```
Teacher starts session  →  LiveKit room created  →  Students join via token
       ↓                                                     ↓
Live video + audio stream  ←————————————————→  Multi-participant classroom
       ↓
Session ends  →  Recording uploaded  →  Available for playback (5-day expiry)
```

**How it works:**
1. A teacher navigates to their class and starts a live session
2. LiveKit generates a secure room token via the backend
3. Students join the live classroom using their own session token
4. All participants see video tiles in the classroom UI
5. After the session, the recording can be uploaded to the platform
6. Recordings are accessible for 5 days before automatic expiry

**Key components:**
- `frontend/components/live-classroom-room.tsx` — main classroom UI with video tiles
- `frontend/components/video-tile.tsx` — individual participant video component
- `backend/app/api/routes.py` — LiveKit token generation and session orchestration
- `livekit-api==0.8.2` (Python) + `livekit-client@2.15.6` (TypeScript)

---

## Project Metrics

<div align="center">

| Metric | Detail |
|:---|:---|
| User Roles | Admin · Teacher · Student (3 core roles) |
| Live Video | LiveKit-powered real-time classrooms |
| Authentication | JWT tokens + bcrypt password hashing |
| Database | Neon Postgres via SQLAlchemy 2.0 ORM |
| Billing | Stripe subscriptions with tiered plan limits |
| AI System | AI assistant chat + AI insights panel |
| Analytics | Bar chart dashboards per role |
| Deployment | Vercel (frontend) + Hugging Face Spaces (backend) |
| Recording System | Upload · Playback · Auto-expiry (5 days) |
| Plan Enforcement | Usage limits enforced per SaaS tier |
| Dashboards | Admin · Teacher · Student (3 dedicated views) |
| API Routes | REST + LiveKit room management |

</div>

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  We Are Kids LMS Platform                │
├────────────────┬────────────────────┬───────────────────┤
│   Admin Panel  │  Teacher Dashboard │ Student Dashboard │
└────────┬───────┴──────────┬─────────┴────────┬──────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js 14 Frontend (Vercel)                │
│         TypeScript · Tailwind CSS · App Router           │
└─────────────────────────┬───────────────────────────────┘
                          │ REST API + LiveKit Tokens
                          ▼
┌─────────────────────────────────────────────────────────┐
│         FastAPI Backend (Hugging Face Spaces)            │
│    JWT Auth · LiveKit SDK · Stripe SDK · AI Service      │
└──┬───────────┬──────────────┬──────────┬────────────────┘
   │           │              │          │
   ▼           ▼              ▼          ▼
Neon DB    LiveKit.io    Stripe API   OpenAI API
Postgres   Live Video    Billing      AI Assistant
SQLAlchemy WebRTC Infra  SaaS Tiers   Insights
```

**Layer breakdown:**

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | UI, routing, auth state |
| Styling | Tailwind CSS 3.4 | Responsive nursery-branded design |
| Backend | FastAPI 0.115 | REST API, business logic |
| Database | Neon Postgres + SQLAlchemy | Persistent data storage |
| Auth | JWT + Passlib + bcrypt | Secure session management |
| Live Video | LiveKit (WebRTC) | Real-time classrooms |
| Billing | Stripe | Subscriptions + plan enforcement |
| AI | OpenAI via ai_service.py | Assistant + insights |
| Frontend Deploy | Vercel | CDN + edge functions |
| Backend Deploy | Hugging Face Spaces | Docker-based container |

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Roles["User Roles"]
        ADM[("👤 Admin")]
        TCH[("👩‍🏫 Teacher")]
        STU[("👧 Student")]
    end

    subgraph FE["Next.js Frontend · Vercel"]
        LP["Landing & Login"]
        AD_DB["Admin Dashboard"]
        TCH_DB["Teacher Dashboard"]
        STU_DB["Student Dashboard"]
        BILLING["Billing & Pricing"]
        CL_UI["Live Classroom UI"]
        REC_UI["Recordings Viewer"]
        AI_UI["AI Assistant & Insights"]
    end

    subgraph AUTH["Security Layer"]
        JWT["JWT Auth Middleware"]
        RBAC["Role-Based Access Control"]
    end

    subgraph BE["FastAPI Backend · Hugging Face Spaces"]
        API["REST API Layer"]
        LK_SVC["LiveKit Token Service"]
        STR_SVC["Stripe Billing Service"]
        AI_SVC["AI Service (OpenAI)"]
        REC_SVC["Recording Service"]
    end

    subgraph INFRA["Infrastructure"]
        NEON[("🐘 Neon Postgres")]
        LK[("🎥 LiveKit.io")]
        STRIPE[("💳 Stripe")]
        OPENAI[("🤖 OpenAI")]
        STORAGE[("📁 Recording Storage")]
    end

    ADM --> LP
    TCH --> LP
    STU --> LP

    LP --> JWT
    JWT --> RBAC
    RBAC --> AD_DB
    RBAC --> TCH_DB
    RBAC --> STU_DB

    AD_DB --> BILLING
    TCH_DB --> CL_UI
    TCH_DB --> REC_UI
    STU_DB --> CL_UI
    STU_DB --> REC_UI
    STU_DB --> AI_UI
    TCH_DB --> AI_UI

    CL_UI --> LK_SVC
    AI_UI --> AI_SVC
    BILLING --> STR_SVC
    REC_UI --> REC_SVC

    LK_SVC --> API
    STR_SVC --> API
    AI_SVC --> API
    REC_SVC --> API

    API --> NEON
    LK_SVC --> LK
    STR_SVC --> STRIPE
    AI_SVC --> OPENAI
    REC_SVC --> STORAGE
```

---

## User Flow Diagram

```mermaid
flowchart TD
    OPEN["🌐 Open Platform"] --> LOGIN["🔐 Login with JWT"]
    LOGIN --> ROLE{"Role Check"}

    ROLE -->|Admin| A_DASH["Admin Dashboard"]
    ROLE -->|Teacher| T_DASH["Teacher Dashboard"]
    ROLE -->|Student| S_DASH["Student Dashboard"]

    A_DASH --> A_USERS["Manage Teachers & Students"]
    A_DASH --> A_CLASSES["Manage Classes"]
    A_DASH --> A_SESSIONS["Monitor Live Sessions"]
    A_DASH --> A_RECS["Manage Recordings"]
    A_DASH --> A_BILLING["Billing Management"]

    T_DASH --> T_START["Start Live Class"]
    T_DASH --> T_AI["AI Insights Panel"]
    T_DASH --> T_RECS["Manage Recordings"]

    T_START --> LK_ROOM["LiveKit Room Created"]
    LK_ROOM --> LIVE["🎥 Live Classroom Session"]
    LIVE --> END_SESSION["End Session"]
    END_SESSION --> UPLOAD["Upload Recording"]
    UPLOAD --> EXPIRY["Auto-Expiry in 5 Days"]

    S_DASH --> S_JOIN["Join Live Class"]
    S_JOIN --> LK_ROOM
    S_DASH --> S_RECS["Watch Recordings"]
    S_DASH --> S_AI["AI Assistant Chat"]

    ROLE --> PLAN_CHECK["SaaS Plan Check"]
    PLAN_CHECK -->|Over Limit| UPGRADE["Upgrade Plan (Stripe)"]
    PLAN_CHECK -->|Within Limit| ROLE
```

---

## Product Screenshots

> Screenshots can be added to `frontend/public/images/` and referenced here.

### Landing Page
![Landing Page](./frontend/public/images/hero.png)

### Live Classroom
![Live Classroom](./frontend/public/images/live-class.png)

### Admin Dashboard
<!-- Add: frontend/public/images/screenshots/admin-dashboard.png -->
*Admin dashboard with full user and session management.*

### Teacher Dashboard
<!-- Add: frontend/public/images/screenshots/teacher-dashboard.png -->
*Teacher view with live class controls, recordings, and AI insights.*

### Student Dashboard
<!-- Add: frontend/public/images/screenshots/student-dashboard.png -->
*Student view with class join, recordings, and AI assistant.*

### Billing & Pricing
<!-- Add: frontend/public/images/screenshots/billing.png -->
*Stripe-powered subscription tiers with usage enforcement.*

### AI Assistant
<!-- Add: frontend/public/images/screenshots/ai-assistant.png -->
*Contextual AI chat and AI-powered classroom insights.*

---

## Demo

### Live Demo

Deploy the frontend to Vercel and backend to Hugging Face Spaces using the setup instructions below.

### Demo Credentials

| Role | Email | Password |
|:---|:---|:---|
| Admin | `admin@wearekids.com` | `123456` |
| Teacher 1 | `teacher1@wearekids.com` | `123456` |
| Teacher 2 | `teacher2@wearekids.com` | `123456` |
| Student 1 | `student1@wearekids.com` | `123456` |
| Student 2 | `student2@wearekids.com` | `123456` |
| Student 3 | `student3@wearekids.com` | `123456` |
| Student 4 | `student4@wearekids.com` | `123456` |

### Suggested Walkthrough

1. **Login as Admin** — explore the full management dashboard and billing overview
2. **Login as Teacher** — start a live class, explore AI insights, manage recordings
3. **Login as Student (second tab)** — join the live class the teacher started
4. **Test AI Assistant** — ask the assistant questions from the student dashboard
5. **Test SaaS Limits** — observe plan enforcement when usage thresholds are reached
6. **Review Analytics** — check dashboards for session and engagement data

---

## Production Readiness

| Capability | Status |
|:---|:---|
| Database Persistence | Neon Postgres via SQLAlchemy ORM |
| Authentication | JWT tokens with bcrypt password hashing |
| Role-Based Access | Admin / Teacher / Student route protection |
| Live Video | LiveKit WebRTC infrastructure |
| SaaS Subscriptions | Stripe billing integration |
| Plan Enforcement | Usage limits enforced per tier |
| AI Assistant | OpenAI-powered chat with graceful fallback |
| AI Insights | Context-aware recommendations panel |
| Analytics | Activity dashboards per role |
| Frontend Deploy | Vercel (CDN, edge-ready) |
| Backend Deploy | Hugging Face Spaces (Docker container) |
| Recording Lifecycle | Upload · Playback · Auto-expiry (5 days) |
| Mobile Responsive | Full Tailwind responsive design |

---

## Tech Stack

| Layer | Technology | Version |
|:---|:---|:---|
| Frontend | Next.js (App Router) | 14.2.24 |
| Language | TypeScript | 5.8.3 |
| Styling | Tailwind CSS | 3.4.17 |
| UI Library | React | 18.3.1 |
| Backend | FastAPI | 0.115.12 |
| Server | Uvicorn | 0.34.0 |
| Database | Neon Postgres (SQLAlchemy) | 2.0.39 |
| Auth | python-jose + passlib + bcrypt | JWT |
| Live Video | LiveKit Client + API SDK | 2.15.6 / 0.8.2 |
| Billing | Stripe | 12.0.0 |
| AI | OpenAI (via ai_service.py) | Latest |
| Frontend Deploy | Vercel | — |
| Backend Deploy | Hugging Face Spaces (Docker) | — |

---

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # Windows: copy .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
cp .env.example .env.local  # Windows: copy .env.example .env.local
npm install
npm run dev
```

---

## Environment Variables

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Backend `.env`

```env
PORT=8000
UPLOAD_DIR=uploads
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=postgresql+psycopg2://user:password@your-neon-host/dbname
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
STRIPE_SECRET_KEY=your_stripe_secret_key
OPENAI_API_KEY=your_openai_api_key
SECRET_KEY=your_jwt_secret_key
```

---

## Deployment

### Frontend on Vercel

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Set root directory to `frontend/`.
4. Set `NEXT_PUBLIC_API_BASE_URL` to your deployed backend URL.
5. Deploy.

### Backend on Hugging Face Spaces

1. Create a new Space using the **Docker** SDK.
2. Upload the contents of `hf-space-backend/`.
3. The included `Dockerfile` handles everything.
4. Set all required environment variables in the Space settings.
5. Copy the public Space URL into Vercel as `NEXT_PUBLIC_API_BASE_URL`.

### Production Commands

```bash
# Backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
npm run build
```

---

## API Highlights

```http
# Health
GET    /health

# Auth
POST   /api/v1/auth/login
GET    /api/v1/auth/me

# Live Classes
GET    /api/v1/classes/live
POST   /api/v1/classes/start
GET    /api/v1/livekit/token

# Recordings
POST   /api/v1/recordings/upload
GET    /api/v1/recordings
GET    /api/v1/recordings/{recording_id}
PATCH  /api/v1/recordings/{recording_id}
DELETE /api/v1/recordings/{recording_id}

# Admin
GET    /api/v1/admin/teachers
GET    /api/v1/admin/students
GET    /api/v1/admin/classes
GET    /api/v1/admin/live-sessions

# AI
POST   /api/v1/ai/chat
GET    /api/v1/ai/insights

# Billing
GET    /api/v1/billing/plans
POST   /api/v1/billing/subscribe
GET    /api/v1/billing/usage
```

---

## Build Validation

```bash
# Backend syntax check
python -m compileall backend

# Frontend type check + build
cd frontend
npm run type-check
npm run build
```

---

## Roadmap

| Priority | Feature |
|:---|:---|
| High | Attendance tracking per live session |
| High | Cloud recording storage (S3 / Cloudflare R2) |
| Medium | Parent portal with progress reports |
| Medium | Real-time notifications (email + in-app) |
| Medium | Deeper AI classroom intelligence (auto-summaries) |
| Low | Mobile companion app (React Native) |
| Low | Calendar and scheduling integration |
| Low | Multi-tenant school isolation |

---

<div align="center">

---

**We Are Kids Nursery LMS** — AI-powered. Production-ready. Built by Zohair Azmat.

[![GitHub](https://img.shields.io/badge/GitHub-zohair--azmat--ai-181717?style=flat-square&logo=github)](https://github.com/zohair-azmat-ai)

*Designed and built as a serious full-stack SaaS product for modern schools and nurseries.*

</div>
