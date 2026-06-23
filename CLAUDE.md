# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ThreadHive is a full-stack Reddit-like forum application with two separate packages:
- `threadhive-backend/` — Node.js/Express REST API with MongoDB
- `threadhive-frontend/` — React 19 + Redux Toolkit SPA built with Vite

## Commands

### Backend (`cd threadhive-backend`)
```bash
npm run dev          # Start with nodemon (auto-reload)
npm start            # Production start
npm test             # Run all tests (Vitest)
npm run populate     # Seed the database
npm run format       # Prettier formatting
```

### Frontend (`cd threadhive-frontend`)
```bash
npm run dev          # Vite dev server (connects to localhost:3000/api)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests (Vitest)
npm run test:ui      # Vitest with browser UI
npm run test:coverage # Coverage report
```

To run a single test file:
```bash
npx vitest run tests/unit/authHandler.test.js   # backend
npx vitest run tests/ComponentName.test.jsx      # frontend
```

## Architecture

### Backend

**Entry point**: `main.js` → connects MongoDB (`db.js`) → starts server (`server.js`) → Express app (`src/app.js`)

**Layer structure**:
- `src/routes/` — Express routers, define URL structure
- `src/controllers/` — Route handlers, parse req/res, call services
- `src/services/` — Business logic + Mongoose queries
- `src/models/` — Mongoose schemas (Thread, Comment, User, Subreddit)
- `src/middleware/` — `authHandler.js` (JWT verification), `errorHandler.js` (centralized)
- `src/utils/aiProvider.js` — Abstraction over OpenAI/Gemini; switch providers by editing this file

**Auth flow**: `POST /api/auth/login` returns a JWT → stored in localStorage on the frontend → sent as `Authorization: Bearer <token>` header → verified by `authHandler.js` middleware on protected routes.

**AI features**: Thread summarization (`GET /api/threads/:id/summary`) and text rephrasing (`POST /api/threads/rephrase`) both go through `aiProvider.js`. Current default is Google Gemini (`gemini-2.5-flash`). API keys are in `.env`.

**Error handling**: Throw `createAppError(message, statusCode)` from anywhere; `errorHandler.js` middleware catches it and formats the response.

**Tests**: Integration tests use `mongodb-memory-server` (60s timeout configured in `vitest.config.js`). Unit tests cover middleware and utilities.

### Frontend

**Entry point**: `main.jsx` → Redux `<Provider>` wraps `<App>` → React Router handles navigation

**Key wiring**:
- `src/api/axiosInstance.js` — Axios client pointed at `localhost:3000/api`; reads token from Redux store and injects `Authorization` header
- `src/config/apiConfig.js` — All endpoint strings in one place
- `src/store/store.js` — Redux store combining all slices
- `src/reducers/` — One slice per domain: `authSlice`, `threadSlice`, `selectedThreadSlice`, `commentSlice`, `subredditSlice`, `themeSlice`
- `src/services/` — Thin wrappers around axiosInstance calls, imported by Redux async thunks

**Route guard**: `components/PrivateRoute/` checks for a valid token in Redux state before rendering protected pages.

**Data flow example**: User upvotes → component dispatches `upvoteThreadThunk` (defined in `threadSlice`) → calls `threadService.upvoteThread()` → hits `POST /api/votes/thread/:id/upvote` → response updates Redux state → component re-renders with new `voteCount`.

## Adding a Feature

A new feature is a **vertical slice** through the whole stack. Build it in this order — each step depends on the one before it:

| # | Layer | Location | What to do |
|---|-------|----------|------------|
| 1 | Model | `threadhive-backend/src/models/` | Define/extend the Mongoose schema |
| 2 | Service | `threadhive-backend/src/services/` | Add business logic + Mongoose queries |
| 3 | Controller | `threadhive-backend/src/controllers/` | Parse req/res, call the service, throw `createAppError` on failure |
| 4 | Route | `threadhive-backend/src/routes/` | Wire the URL to the controller; add `authHandler` for protected routes; register the router in `src/app.js` |
| 5 | Tests | `threadhive-backend/tests/integration/` (+ `unit/`) | Cover the new endpoint end-to-end against `mongodb-memory-server` |
| 6 | Redux slice | `threadhive-frontend/src/reducers/` | Add state + an async thunk that calls the frontend service |
| 7 | Frontend service | `threadhive-frontend/src/services/` | Add the axios call; add the endpoint string to `src/config/apiConfig.js` |
| 8 | Component | `threadhive-frontend/src/pages/` or `src/components/` | Dispatch the thunk, render the result |

Steps 1–5 are the backend slice (model → service → controller → route → tests); steps 6–8 are the frontend slice (slice → service → component). Keep the slice thin: ship one complete path through all layers rather than building out a single layer broadly.

## Environment Setup

Backend requires a `.env` file (see `.env.example`):
```
MONGODB_URI=
JWT_SECRET=
OPENAI_API_KEY=      # if using OpenAI
GEMINI_API_KEY=      # if using Gemini (current default)
```

The `.claude/settings.json` intentionally blocks reading `.env` files — do not attempt to read them.
