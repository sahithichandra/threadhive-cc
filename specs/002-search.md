# 002 — Thread Search (header search bar)

_Spec for ThreadHive · Status: Draft · 2026-06-22_

> Epic: Content Discovery & Engagement (`docs/epic-discover-engage.md`, Feature 2).
> Build follows the project vertical-slice convention (`CLAUDE.md`):
> model → service → controller → route → tests → Redux slice → frontend service → component.

## Problem / motivation

ThreadHive has no way to find a thread by keyword. The Home feed returns every thread
(`fetchAllThreads`) and the only narrowing is client-side sorting/pagination in
`pages/User/Home.jsx`. As the number of threads grows, users cannot locate a discussion
they remember. A header search bar that matches thread titles and content turns the app
from "browse only" into "find what I want," directly supporting content discovery.

## User stories

1. As a logged-in user, I can type a query into a search bar in the header and submit it.
2. As a logged-in user, I land on a results page listing threads whose title or content
   matches my query.
3. As a logged-in user, I get partial, case-insensitive matches (e.g. "script" finds
   "JavaScript").
4. As a logged-in user, I see a clear empty state when nothing matches.
5. As a user, I can share/bookmark a results URL (the query lives in the URL).

## Acceptance criteria

Each criterion is independently testable.

- **AC1** — `GET /api/search/threads?q=react` returns threads whose **title or content**
  contains the query.
- **AC2** — Matching is **case-insensitive** ("REACT" and "react" return the same results).
- **AC3** — Matching is **substring/partial** ("script" matches a thread titled "JavaScript").
- **AC4** — A query with no matches returns `200` and an **empty array**.
- **AC5** — Each result is **populated** with `author` and `subreddit` and results are sorted
  **newest-first** (`createdAt` desc).
- **AC6** — A **missing or blank** `q` (empty or whitespace only) returns `400`.
- **AC7** — A query containing **regex metacharacters** (e.g. `c++`, `(`, `.*`) is treated as
  a literal string — it returns `200` and never errors (no ReDoS / 500).
- **AC8** — The endpoint **requires authentication**; a request with no token returns `401`.
- **AC9** — The header shows a search bar when logged in; submitting it navigates to
  `/search?q=<encoded>` and the results page lists the matches (or the empty state).
- **AC10** — Results are **capped** at a configured maximum (`SEARCH_RESULT_LIMIT`, default 50).

## API contract

New, isolated route file `src/routes/search.js` mounted in `src/app.js` via
`app.use("/api/search", searchRoutes)` — deliberately separate from the thread CRUD files so
it doesn't collide with the tag/related features in the same epic. Auth uses the existing
`authHandler` (sets `req.user.userId`). Standard response envelope `{ success, message, data }`.

### `GET /api/search/threads?q=<query>`

- **Auth:** required.
- **Query params:** `q` (string, required, non-blank). Leading/trailing whitespace is trimmed.
- **Behavior:** case-insensitive substring match against `title` **or** `content`; results
  sorted newest-first; capped at `SEARCH_RESULT_LIMIT` (50).
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Search results",
      "data": [
        { "_id": "...", "title": "...", "content": "...", "voteCount": 3,
          "author": { "_id": "...", "name": "..." },
          "subreddit": { "_id": "...", "name": "...", "description": "..." },
          "createdAt": "...", "updatedAt": "..." }
      ]
    }
    ```
  - `400 Bad Request` — `q` missing or blank: `{ "success": false, "message": "Search query is required" }`.
  - `401 Unauthorized` — missing/invalid token.

## Data model changes

**None.** Case-insensitive substring matching uses a runtime `$regex`; a non-anchored regex
cannot use a standard B-tree index, so no Mongoose schema/index delta is added to
`Thread.js`. (If search is later switched to MongoDB full-text, that would add a `$text`
index — explicitly out of scope here.)

## UI changes

### API config — `src/config/apiConfig.js`
Add:
```js
export const SEARCH_API = {
  THREADS: (q) => `/search/threads?q=${encodeURIComponent(q)}`,
};
```

### Service — `src/services/searchService.js` (new)
Axios wrapper mirroring `threadService.js` (`getAuthHeaders()`, returns `res.data.data`):
`searchThreads(query)` → `GET SEARCH_API.THREADS(query)`.

### Redux slice — `src/reducers/searchSlice.js` (new); register in `src/store/store.js`
- **State:** `{ results: [], query: "", loading: false, error: null }`.
- **Thunk:** `searchThreadsThunk(query)` (wrap with `handleApiError`).
- **Reducers:** pending → `loading=true`, store `query`; fulfilled → `loading=false`,
  `results=payload`; rejected → `loading=false`, `error=payload`. Optional `clearSearch` action.

### Component — `src/components/Header/Header.jsx` (edit)
- Add a search `form` with a text input + submit button, rendered **only when `token`**
  (between the logo and the right-side controls). On submit: trim the value, and if non-empty
  `navigate(\`/search?q=${encodeURIComponent(value)}\`)`. The header does **not** fetch — it
  only navigates, so the URL is the source of truth (shareable, matches how `Home.jsx` reads
  `useSearchParams`).

### Page — `src/pages/User/SearchResults.jsx` (new)
- Read `q` via `useSearchParams`; on `q` change, `dispatch(searchThreadsThunk(q))`.
- Render `state.search.results` via the existing **`ThreadList`** component (each card already
  shows votes + the bookmark SaveButton from feature 001).
- States: loading spinner; a heading/result count ("Results for ‘q’ — N threads"); empty state
  ("No threads found for ‘q’"); a prompt when `q` is absent ("Enter a search term").

### Route — `src/App.jsx` (edit)
- Add `<Route path="/search" element={<PrivateRoute><SearchResults /></PrivateRoute>} />`.

## Edge cases & error handling

- **Blank / missing `q`:** the header won't submit an empty value; the API returns `400` for
  a blank/whitespace `q`; the results page shows the "Enter a search term" prompt when `q` is
  absent.
- **Regex metacharacters in `q`:** the service **escapes** the query before constructing the
  `RegExp` (e.g. via a `escapeRegExp` helper) so input like `c++`, `(`, or `.*` is matched
  literally — prevents invalid-regex 500s and catastrophic backtracking (ReDoS). (AC7)
- **No matches:** `200` with `data: []`; UI shows the empty state. (AC4)
- **Whitespace:** `q` is trimmed before matching.
- **Overly long query:** trimmed; matching still works. (A max length cap is optional and noted
  as out of scope.)
- **Result volume:** capped at `SEARCH_RESULT_LIMIT` (50); matches beyond the cap are not
  returned (server-side pagination is out of scope).
- **Deleted/missing references:** populated `author`/`subreddit` may be null for orphaned data;
  the UI already uses optional chaining (`subreddit?.name`) so it renders safely.
- **Auth:** missing/invalid/expired token → `401` via `authHandler`.

## Out of scope

- Searching **comments, users, or subreddits** (threads only).
- **Relevance ranking**, fuzzy matching, typo tolerance, or stemming (substring regex only).
- **MongoDB `$text` full-text index** (the alternative matching strategy that was not chosen).
- **Server-side pagination / infinite scroll** of results (capped result set; the existing
  `PaginationComponent` may paginate the returned list client-side as a later enhancement).
- **Search-as-you-type / autocomplete dropdown** (search runs on submit only).
- **Highlighting** matched terms in results.
- **Filters** (by subreddit, author, date) and **search history / saved searches**.

## Test plan

Backend uses **Vitest + supertest + mongodb-memory-server** (`tests/integration/*`,
`tests/unit/*`). Frontend uses **Vitest + jsdom + Testing Library + MSW** (`tests/setup.js`,
`tests/mocks/handlers.js`).

### Unit (backend)
- **searchService:** builds a case-insensitive `$or` regex over `title`/`content`; **escapes**
  regex metacharacters (assert a query like `.*` does not match everything / is literal);
  applies `.limit(SEARCH_RESULT_LIMIT)` and `sort({ createdAt: -1 })`. (Mock the `Thread` model
  to assert the query shape, or run against the in-memory DB.)
- **searchController:** returns `200` with `{ success, message, data }` on a valid query;
  throws `400` for a missing/blank `q` (assert it does not call the service).

### Integration (backend, supertest, real in-memory DB)
- Seed threads, then `GET /api/search/threads?q=...`:
  - matches in **title** and in **content** are returned (AC1).
  - case-insensitive (AC2) and substring/partial (AC3).
  - no-match query → `200` and `[]` (AC4).
  - results populated with `author` + `subreddit`, newest-first (AC5).
  - blank `q` (`?q=` and `?q=%20`) → `400` (AC6).
  - metacharacter query (e.g. `?q=c%2B%2B`) → `200`, no error (AC7).
  - no token → `401` (AC8).
  - more than 50 matches → exactly 50 returned (AC10).

### Unit (frontend)
- **searchSlice reducers:** pending sets `loading`/`query`; fulfilled sets `results`; rejected
  sets `error`.
- **Header:** renders the search input when authenticated; submitting a non-empty query calls
  `navigate("/search?q=...")` (mock `useNavigate`); submitting blank does not navigate.

### Integration / component (frontend, MSW)
- **SearchResults page:** with a mocked `GET /search/threads` handler, rendering `/search?q=react`
  dispatches the thunk and lists the matching threads; a query with no results shows the empty
  state; absent `q` shows the prompt. Add MSW handlers for `GET /search/threads` in
  `tests/mocks/handlers.js`.
