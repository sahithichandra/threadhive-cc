# Implementation Plan — 002 Thread Search

_Plan for `specs/002-search.md` · 2026-06-22 · No code yet_

Bottom-up sequence: **model → service → controller → route → backend tests → Redux slice
→ frontend service → component → wire-up → frontend tests**, executed **tests-first** inside
an **isolated git worktree**, then **reviewed**, **verified**, and shipped as a **PR**. File
paths are relative to the repo root.

> Decisions from the spec that shape this plan: case-insensitive **regex substring** match
> (so **no Mongoose schema change**), a **dedicated `/search` page**, **on-submit** trigger,
> and an **isolated `/api/search` route file** (kept off the thread-CRUD files).

---

## Workflow & process

### Step 0 — Worktree (do first)
Create a dedicated branch + worktree so this feature is isolated from `main`:
```
git worktree add ../WK11-search -b feat/002-search
```
All work happens in `../WK11-search`. (The harness can manage this via its worktree tooling;
the effect is the same — an isolated checkout on `feat/002-search`.)

### Tests-first (TDD) methodology
For every implementation task below: **write the test first, run it red, then implement to
green.** The numbered "backend tests" (T6) and "frontend tests" (T11) steps are where the
cross-cutting integration tests land and where the full suites are run green; the per-unit
tests (service, controller, util, slice, Header) are authored immediately before their
implementation task.

### Step R — Review (after green)
Run `/code-review` on the diff (focus: the regex-escaping safety, auth, response envelope
consistency). Address findings.

### Step V — Verify
- `cd threadhive-backend && npm test`
- `cd threadhive-frontend && npm test && npm run lint`
- Manual smoke: run both servers (`npm run dev` in each), log in, search from the header,
  confirm the `/search?q=` page lists matches, empty state, and a metacharacter query (`c++`).

### Step PR — Pull request
Open a PR from `feat/002-search` (use the `/open-pr` skill or `gh pr create`), linking
`specs/002-search.md` and this plan; include the test summary.

---

## T1 — Model

**No change.** A non-anchored `$regex` cannot use a B-tree index, so `Thread.js` gets no
schema/index delta. (Documented here to keep the bottom-up sequence explicit.)

## T2 — Regex-escape util (prerequisite of the service)

_Test first:_ **create** `threadhive-backend/tests/unit/utils/escapeRegExp.test.js` — asserts
metacharacters (`.`, `*`, `+`, `(`, `[`, `\`, etc.) are escaped so the result matches them
literally.

**Create** `threadhive-backend/src/utils/escapeRegExp.js`
- `escapeRegExp(str)` → returns `str` with regex metacharacters backslash-escaped.

## T3 — Service

_Test first:_ **create** `threadhive-backend/tests/unit/services/searchService.test.js` — the
query is built as a case-insensitive `$or` over `title`/`content`; input is escaped (a `.*`
query does not match everything); `.sort({ createdAt: -1 })` and `.limit(SEARCH_RESULT_LIMIT)`
applied.

**Create** `threadhive-backend/src/services/searchService.js`
- `export const SEARCH_RESULT_LIMIT = 50;`
- `searchThreads(query)` — `const regex = new RegExp(escapeRegExp(query.trim()), "i")`;
  `Thread.find({ $or: [{ title: regex }, { content: regex }] })`
  `.populate({ path: "author" }).populate({ path: "subreddit" })`
  `.sort({ createdAt: -1 }).limit(SEARCH_RESULT_LIMIT)`.

## T4 — Controller

_Test first:_ **create** `threadhive-backend/tests/unit/controllers/searchController.test.js`
(mirror `voteController.test.js`/`bookmarkController.test.js`) — `200` + envelope on a valid
query; throws `400` for missing/blank `q` (service not called).

**Create** `threadhive-backend/src/controllers/searchController.js`
- `searchThreads(req, res)` — `const q = (req.query.q || "").trim()`; if empty →
  `throw createAppError("Search query is required", 400)`; else
  `res.status(200).json({ success: true, message: "Search results", data: await searchThreads(q) })`.

## T5 — Route + app wiring

**Create** `threadhive-backend/src/routes/search.js` (mirror `bookmarks.js`)
- `router.get("/threads", authHandler, searchThreads)`.

**Edit** `threadhive-backend/src/app.js`
- `import searchRoutes from "./routes/search.js";`
- `app.use("/api/search", searchRoutes);` (before `app.use(errorHandler)`).

## T6 — Backend tests (integration + suite green)

**Create** `threadhive-backend/tests/integration/search.test.js` (supertest +
mongodb-memory-server; reuse the register/login token helper from `bookmark.test.js`)
- title match + content match (AC1); case-insensitive (AC2); substring/partial (AC3);
  no-match → `200` `[]` (AC4); populated + newest-first (AC5); blank `?q=` / `?q=%20` →
  `400` (AC6); metacharacter `?q=c%2B%2B` → `200` (AC7); no token → `401` (AC8);
  >50 matches → 50 returned (AC10).
- Run `npm test` in `threadhive-backend` → all green.

## T7 — Redux slice + store

_Test first:_ **create** `threadhive-frontend/tests/unit/reducers/searchSlice.test.js` —
pending sets `loading`/`query`; fulfilled sets `results`; rejected sets `error`.

**Create** `threadhive-frontend/src/reducers/searchSlice.js`
- State `{ results: [], query: "", loading: false, error: null }`; thunk
  `searchThreadsThunk(query)` (wrap `handleApiError`); pending/fulfilled/rejected reducers;
  optional `clearSearch`.

**Edit** `threadhive-frontend/src/store/store.js` — register `search: searchReducer`.

## T8 — Frontend service + API config _(scaffold before T7's thunk)_

**Edit** `threadhive-frontend/src/config/apiConfig.js`
- `export const SEARCH_API = { THREADS: (q) => \`/search/threads?q=${encodeURIComponent(q)}\` };`

**Create** `threadhive-frontend/src/services/searchService.js`
- `searchThreads(query)` → `GET SEARCH_API.THREADS(query)` with `getAuthHeaders()`, returns
  `res.data.data`.

## T9 — Components

**Edit** `threadhive-frontend/src/components/Header/Header.jsx`
- Add a search `form` (text input + submit button) rendered **only when `token`**, between the
  logo and the right-side controls. Local `useState` for the input; on submit, trim and if
  non-empty `navigate(\`/search?q=${encodeURIComponent(value)}\`)`. No fetch in the header.

**Create** `threadhive-frontend/src/pages/User/SearchResults.jsx`
- Read `q` via `useSearchParams`; `useEffect` → `dispatch(searchThreadsThunk(q))` when `q`
  changes; render `state.search.results` via **`ThreadList`**; loading spinner; heading +
  result count; empty state ("No threads found for ‘q’"); prompt when `q` absent.

## T10 — Wire-up (routing)

**Edit** `threadhive-frontend/src/App.jsx`
- Import `SearchResults`; add
  `<Route path="/search" element={<PrivateRoute><SearchResults /></PrivateRoute>} />`.

## T11 — Frontend tests (component/integration + suite green)

**Edit** `threadhive-frontend/tests/mocks/handlers.js`
- Add `GET /search/threads` returning mock threads filtered by the `q` query param.

**Edit** `threadhive-frontend/tests/unit/components/Header.test.jsx`
- Search input shows when authenticated; submitting a non-empty query navigates to
  `/search?q=...` (mock `useNavigate`); blank submit does not navigate.

**Create** `threadhive-frontend/tests/unit/pages/SearchResults.test.jsx`
- `/search?q=react` dispatches the thunk and lists matches (MSW); no-result query shows the
  empty state; absent `q` shows the prompt.

**(Optional) Create** `threadhive-frontend/tests/integration/searchFlow.test.jsx`
- Type in the header → submit → results page lists matches (stateful MSW).

- Run `npm test` + `npm run lint` in `threadhive-frontend` → green.

---

## Task checklist

### Process
- [ ] **Step 0** Create worktree + branch `feat/002-search` (`git worktree add ../WK11-search -b feat/002-search`)

### Backend (tests-first)
- [ ] **T1** Model — confirm no `Thread.js` change needed
- [ ] **T2** `escapeRegExp` util + test
- [ ] **T3** `searchService.js` (`searchThreads`, `SEARCH_RESULT_LIMIT`) + test
- [ ] **T4** `searchController.js` (`searchThreads`, 400 on blank) + test
- [ ] **T5** `routes/search.js` + mount in `app.js`
- [ ] **T6** `tests/integration/search.test.js`; backend `npm test` green (AC1–AC8, AC10)

### Frontend (tests-first)
- [ ] **T8** `SEARCH_API` in `apiConfig.js`; `services/searchService.js` _(before T7 thunk)_
- [ ] **T7** `reducers/searchSlice.js` + test; register `search` in `store/store.js`
- [ ] **T9** `Header.jsx` search form; new `pages/User/SearchResults.jsx`
- [ ] **T10** `/search` route in `App.jsx`
- [ ] **T11** MSW handler; extend `Header.test.jsx`; `SearchResults.test.jsx`; (optional) `searchFlow.test.jsx`; frontend `npm test` + `npm run lint` green (AC9)

### Ship
- [ ] **Step R** `/code-review` the diff (regex-escape safety, auth, envelope) and address findings
- [ ] **Step V** Verify: both suites + lint green; manual smoke (search, empty state, `c++` query)
- [ ] **Step PR** Open PR from `feat/002-search` linking the spec + plan with the test summary
- [ ] Remove the worktree after merge (`git worktree remove ../WK11-search`)
