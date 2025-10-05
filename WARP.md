# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project summary
- Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma (PostgreSQL) + Clerk auth + UploadThing
- Monolith app with server and client co-located in app/. Database schema and migrations under prisma/

Essential commands
- Install deps: npm install
- Dev server (http://localhost:3000): npm run dev
- Build: npm run build
- Start (production): npm start
- Lint (ESLint): npm run lint
- Generate Prisma client: npx prisma generate
- Apply DB migrations locally: npx prisma migrate dev
- Start PostgreSQL locally (Docker): docker compose up -d postgres

Environment and setup
- Copy .env.example to .env.local and fill values. Keys used by the app include:
  - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, DATABASE_URL, UPLOADTHING_TOKEN, MUX_TOKEN_ID, MUX_TOKEN_SECRET, STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
- Post-install runs Prisma generate automatically (see package.json: postinstall). If needed, you can re-run npx prisma generate.
- Images are allowed from utfs.io and img.clerk.com (see next.config.js).

Testing
- No test script is currently defined in package.json.

Architecture overview
- App Router structure (app/): route groups for auth, course, and dashboard
  - (auth)/(routes): sign-in and sign-up pages (Clerk)
  - (course)/courses/[courseId]/...: learner views with nested UI components
  - (dashboard)/(routes): admin/trainer UX (courses, teams, badges, analytics, library, live sessions)
  - API routes under app/api/... handle CRUD and actions for courses, chapters, modules, lessons, blocks, enrollments, teams, badges, achievements, leaderboards, quests, live-sessions, and uploads
- Server actions (actions/): data fetching and analytics helpers used by pages and API routes
- Core libraries (lib/):
  - db.ts: Prisma client singleton
  - current-profile.ts: resolves per-request AuthContext (Clerk user/org → Company/UserProfile), enforces roles, and syncs Clerk org/user metadata into Company/UserProfile
  - utilities: formatting, logger, uploadthing config
- UI components (components/): shared UI (shadcn/ui + Radix) and providers (toasts, confetti, dashboard context)
- Auth and middleware (middleware.ts): protects all routes except sign-in/sign-up using Clerk; applies to app and API matchers
- Styling: Tailwind with uploadthing plugin and tailwindcss-animate; theme tokens via CSS variables
- TypeScript config (tsconfig.json): path alias @/* → project root

Data model highlights (prisma/schema.prisma)
- Multi-tenant via Company (clerkOrgId) and UserProfile (linked to Clerk user and Company) with roles: HR_ADMIN, TRAINER, LEARNER
- Course content systems:
  1) Legacy: Course → Chapter
  2) New builder: Course → CourseModule → Lesson → LessonBlock (VIDEO_LESSON, RESOURCES, LIVE_SESSION) with attachments
- Assignments and progress: CourseEnrollment (status and due dates), UserProgress and UserLessonProgress
- Teams and org: CompanyTeam, TeamMembership, CourseTeamAssignment
- Gamification: Badge/UserBadge, UserPoints, Leaderboard/LeaderboardEntry
- Quests: Quest, QuestMission (COURSE/CHAPTER/CUSTOM), QuestAssignment (USER/TEAM)
- Live sessions: LiveSession with optional linkage from LessonBlock

Local database
- Docker Compose provides a Postgres service on 5432 (docker-compose.yml). Update DATABASE_URL in .env.local to point to your local DB and run migrations.

Linting and formatting
- ESLint: extends next/core-web-vitals and next/typescript with additional rules (no-console, object-shorthand, enforce self-closing)
- Prettier with Tailwind plugin (.prettierrc present). Use your preferred Prettier invocation as needed.

Notes from CLAUDE.md (important excerpts)
- Development commands: npm run dev, npm run build, npm start, npm run lint; Prisma client generation happens on postinstall
- Tech stack as above; UI built on Radix + shadcn/ui; forms via React Hook Form with Zod; state via Zustand; uploads via UploadThing; auth via Clerk
- Multi-tenant behavior is central: content, users, teams, badges, leaderboards are company-scoped; role-based permissions enforced in server code
