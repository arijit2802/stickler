# Stickler

> An agentic learning platform that scans blogs across the web, builds your personalised reading calendar, and tracks your knowledge growth over time.

---

## What It Does

Stickler interviews you to understand your professional role, interests, and learning goals. It then finds the best blog posts for you every 3 days, summarises them into digestible shorts, quizzes you for retention, and benchmarks your knowledge growth month over month — all powered by Claude AI.

---

## Feature Roadmap

| # | Feature | Status |
|---|---|---|
| 1 | Agentic Onboarding Interview — builds your learning profile | **Done** |
| 2 | Blog Discovery & Reading Calendar | Planned |
| 3 | Blog Summarisation, Keywords & Learning Shorts | Planned |
| 4 | Blog Q&A and Feedback Loop | Planned |
| 5 | Recurring Learn Workflow (every 3 days) | Planned |
| 6 | Monthly Knowledge Assessment & Benchmarking | Planned |

---

## System Architecture

```mermaid
graph TD
    User["User (Browser)"]

    subgraph "Next.js 14 App — Vercel"
        MW["middleware.ts\nNextAuth route guard"]
        Pages["Pages\n/ → /sign-in\n/onboarding"]
        API["API Routes\n/api/onboarding/*\n/api/auth/*\n/api/health"]
        OC["OnboardingChat\nProfileSummaryCard\nProfileEditForm"]
    end

    subgraph "Service Layer"
        OAS["OnboardingAgentService\nonboarding-agent.ts"]
        Helpers["api-helpers.ts\nresolveDbUser · sanitise\nerrorResponse"]
        Logger["Pino Logger\n+ OTEL trace correlation"]
    end

    subgraph "AI — Anthropic"
        Claude["claude-sonnet-4-6\nConversational Interview\nProfile Extraction"]
    end

    subgraph "Data Layer"
        Models["Models\nusers.ts · onboarding.ts"]
        Drizzle["Drizzle ORM"]
        PG[("PostgreSQL\nNeon Cloud")]
    end

    subgraph "Observability — Grafana Cloud"
        OTEL["OpenTelemetry SDK\ninstrumentation.ts"]
        Tempo["Grafana Tempo\nDistributed Traces"]
        Loki["Grafana Loki\nStructured Logs"]
    end

    User --> MW --> Pages
    Pages --> OC
    OC --> API
    API --> Helpers --> OAS
    OAS --> Claude
    OAS --> Models --> Drizzle --> PG
    API --> Logger --> OTEL --> Tempo
    Logger --> Loki
```

---

## Onboarding Interview Flow

```mermaid
sequenceDiagram
    actor User
    participant Chat as OnboardingChat (UI)
    participant API as /api/onboarding/*
    participant Agent as OnboardingAgentService
    participant Claude as Claude API
    participant DB as PostgreSQL

    User->>Chat: Opens /onboarding
    Chat->>API: POST /start
    API->>Agent: startSession(userId)
    Agent->>DB: getActiveSession (resume?) or createSession
    Agent->>Claude: "Hi, I'm ready to start"
    Claude-->>Agent: Greeting + first question
    Agent->>DB: updateSession (messages)
    API-->>Chat: { sessionId, message }
    Chat-->>User: Displays greeting

    loop Interview turns (steps 1–9)
        User->>Chat: Types answer
        Chat->>API: POST /respond { sessionId, message }
        API->>Agent: processResponse(sessionId, sanitised message)

        alt Answer is vague (< 5 words or trigger phrases)
            Agent->>DB: clarificationCount[step]++
            Agent->>Claude: Include conversation history
            Claude-->>Agent: Offers 3 concrete examples
        else Clear answer
            Agent->>DB: step++, record answer
            Agent->>Claude: Continue interview
            Claude-->>Agent: Next question
        end

        alt Claude emits PROFILE_COMPLETE:{...}
            Agent->>Agent: parseProfileFromResponse()
            Agent->>DB: isComplete = true
            API-->>Chat: { message, isComplete: true, profileData }
            Chat-->>User: Shows ProfileSummaryCard
        end
    end

    User->>Chat: Confirms profile
    Chat->>API: POST /confirm { sessionId, profileData }
    API->>Agent: confirmProfile()
    Agent->>DB: saveProfile (learning_profiles table)
    API-->>Chat: { success: true }
    Chat-->>User: Redirects to /dashboard
```

---

## Data Model

```mermaid
erDiagram
    users {
        uuid id PK
        text email UK
        text passwordHash
        timestamptz createdAt
    }

    onboarding_sessions {
        uuid id PK
        uuid userId FK
        int step
        jsonb answers
        jsonb clarificationCount
        jsonb messages
        boolean isComplete
        timestamptz createdAt
        timestamptz updatedAt
    }

    learning_profiles {
        uuid id PK
        uuid userId FK
        text role
        jsonb interests
        jsonb aspirations
        jsonb knowledgeLevel
        text motivation
        boolean isConfirmed
        timestamptz createdAt
        timestamptz updatedAt
    }

    users ||--o{ onboarding_sessions : "has"
    users ||--o| learning_profiles : "has"
```

---

## Request Lifecycle

```mermaid
flowchart LR
    Req["Incoming Request"] --> MW["middleware.ts\nNextAuth guard"]
    MW -- "unauthenticated" --> SignIn["/sign-in"]
    MW -- "authenticated" --> Route["API Route Handler"]
    Route --> Valid["Zod validation"]
    Valid -- "invalid" --> Err400["400 errorResponse"]
    Valid -- "valid" --> Helper["resolveDbUser()"]
    Helper -- "no session" --> Err401["401 Unauthorized"]
    Helper -- "DB user" --> Service["Service Layer"]
    Service --> DB[(PostgreSQL)]
    Service --> AI[Claude API]
    AI --> Service
    DB --> Service
    Service --> Res["JSON Response"]
```

---

## Observability Architecture

```mermaid
graph LR
    App["Next.js App\n(instrumentation.ts)"]

    subgraph "OpenTelemetry SDK"
        AutoInstr["Auto-instrumentation\nHTTP · PostgreSQL · fetch"]
        PinoOTEL["Pino Logger\n+ traceId / spanId"]
    end

    subgraph "Grafana Cloud"
        Tempo["Tempo\nDistributed Traces"]
        Loki["Loki\nCorrelated Logs"]
        Dashboard["Grafana Dashboard\nExplore · Alerts"]
    end

    App --> AutoInstr
    App --> PinoOTEL
    AutoInstr -->|OTLP HTTP| Tempo
    PinoOTEL --> Loki
    Tempo --> Dashboard
    Loki --> Dashboard
```

---

## Project Structure

```
stickler_app/
├── app/
│   ├── api/
│   │   ├── auth/           → register, NextAuth handlers
│   │   ├── health/         → liveness + DB readiness
│   │   └── onboarding/     → start · respond · confirm · profile
│   ├── onboarding/         → interview page (server + client)
│   ├── sign-in/            → auth pages
│   └── sign-up/
├── src/
│   ├── services/
│   │   └── onboarding-agent.ts   → Claude state machine
│   ├── models/
│   │   ├── users.ts              → user DB queries
│   │   └── onboarding.ts         → session + profile DB queries
│   ├── components/
│   │   ├── OnboardingChat.tsx
│   │   ├── ProfileSummaryCard.tsx
│   │   └── ProfileEditForm.tsx
│   ├── utils/
│   │   ├── api-helpers.ts        → resolveDbUser, sanitise, errorResponse
│   │   ├── logger.ts             → Pino + OTEL correlation
│   │   ├── telemetry.ts          → OpenTelemetry SDK boot
│   │   └── password.ts           → bcrypt helpers
│   └── types/
│       └── onboarding.ts         → shared TypeScript types
├── db/
│   ├── schema.ts                 → Drizzle schema (3 tables)
│   └── index.ts                  → postgres client
├── SPECS/
│   ├── active/                   → feature being built now
│   ├── planned/                  → specs 2–6
│   └── done/                     → completed specs
├── instrumentation.ts            → Next.js OTEL hook
├── middleware.ts                 → NextAuth route protection
└── CLAUDE.md                     → AI coding instructions
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14, Tailwind CSS | App Router, server components |
| Auth | NextAuth.js v5 | Open source, credentials + JWT |
| AI | Anthropic Claude (`claude-sonnet-4-6`) | Agentic interview + profile extraction |
| Database | PostgreSQL via Neon | Serverless, free tier |
| ORM | Drizzle ORM | Type-safe, lightweight |
| Validation | Zod | Runtime schema validation |
| Logging | Pino | Structured JSON, fast |
| Observability | OpenTelemetry + Grafana Cloud | Open source, vendor-neutral |
| Testing | Vitest + Playwright | Unit + E2E |
| Package manager | npm | Default |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon free tier works)
- Anthropic API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values
cp .env.example .env.local

# 3. Run database migrations
npm run db:generate
npm run db:migrate

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to sign up and through the onboarding interview.

### Environment Variables

```bash
# Required
DATABASE_URL=             # PostgreSQL connection string
NEXTAUTH_SECRET=          # Random secret (openssl rand -base64 32)
NEXTAUTH_URL=             # http://localhost:3000 in dev
ANTHROPIC_API_KEY=        # From console.anthropic.com

# Optional — OpenTelemetry (Grafana Cloud / SigNoz / Jaeger)
OTEL_SERVICE_NAME=stickler
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
```

### Commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run lint          # ESLint
npm run test          # Vitest unit tests
npm run test:watch    # Vitest watch mode
npm run test:e2e      # Playwright E2E tests
npm run db:generate   # Generate migration from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio (DB GUI)
```

Run a single unit test:
```bash
npx vitest run tests/unit/onboarding-agent.test.ts
```

---

## Health Check

```bash
curl http://localhost:3000/api/health
# { "status": "ok", "db": "ok", "ts": "2026-03-25T..." }
```

Returns `503` if the database is unreachable.

---

## Security

- All routes protected by NextAuth middleware — unauthenticated requests redirect to `/sign-in`
- All API inputs validated with Zod before reaching service layer
- Free-text inputs sanitised (HTML stripped) before passing to Claude
- Passwords hashed with bcrypt (12 salt rounds)
- No PII written to OpenTelemetry spans
- OTEL endpoint and auth headers configured via env vars only
