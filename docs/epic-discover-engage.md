# Epic: Content Discovery & Engagement

_Proposed: 2026-06-22 · Target app: ThreadHive (threadhive-backend + threadhive-frontend)_

## Goal

Help users **find** relevant content (discovery) and **come back / interact more** (engagement). The five features below are each a full vertical slice that follows the existing convention documented in `CLAUDE.md`:

> model → service → controller → route → tests → Redux slice → frontend service → component

### Architectural facts these proposals build on

- Auth middleware sets `req.user = { userId }` (`src/middleware/authHandler.js`); reuse it for any per-user feature.
- Errors are thrown via `createAppError(message, status)` and caught centrally.
- Backend routes are mounted in `src/app.js`; each new route file must be registered there.
- Frontend pattern: endpoint constants in `src/config/apiConfig.js` → axios wrapper in `src/services/*` → `createAsyncThunk` slice in `src/reducers/*` → slice registered in `src/store/store.js` → consumed by a page/component.
- **No server-side search or filtering exists yet.** `fetchAllThreads` returns every thread; sorting + pagination are done client-side in `pages/User/Home.jsx`. Discovery features here add the missing server-side capability rather than extending the client-only approach.

Complexity scale (rough): **S** ≈ 0.5–1 day · **M** ≈ 1–3 days · **L** ≈ 3–5 days.

---

## Feature 1 — Saved Threads (Bookmarks)

**Value proposition:** Let users bookmark threads to a personal "Saved" list so they can return to content that mattered to them.

**Data-model changes**
- New model `src/models/Bookmark.js`: `{ user: ObjectId→User, thread: ObjectId→Thread }` + `timestamps`, with a **compound unique index** `{ user, thread }` to prevent duplicates.
- No changes to existing models (deliberately a separate collection to stay independent of `User.js` / `Thread.js`).

**Endpoints** (new route file `src/routes/bookmarks.js`, mounted at `/api/bookmarks` in `app.js`)
- `POST   /api/bookmarks/:threadId` — save (auth)
- `DELETE /api/bookmarks/:threadId` — unsave (auth)
- `GET    /api/bookmarks` — list current user's saved threads, populated with author + subreddit (auth)

**Frontend touch points**
- `config/apiConfig.js` — add `BOOKMARK_API`
- `services/bookmarkService.js` (new)
- `reducers/bookmarkSlice.js` (new) + register in `store/store.js`
- `components/ThreadList/ThreadCard.jsx` — add a save/unsave (🔖) toggle button
- New page `pages/User/Saved.jsx` + route in `App.jsx`; nav link in `components/Header/Header.jsx`

**Complexity: M**

---

## Feature 2 — Full-Text Thread Search

**Value proposition:** A search bar that finds threads by keywords in title and content, turning the app from "browse only" into "find what I want."

**Data-model changes**
- `src/models/Thread.js` — add a **text index**: `ThreadSchema.index({ title: "text", content: "text" })`. (No new fields; index only.)

**Endpoints** (isolated new route file `src/routes/search.js`, mounted at `/api/search` in `app.js`, to keep it off the thread CRUD files)
- `GET /api/search/threads?q=<query>&page=<n>` — text search with pagination, returns populated threads + total count (auth)

**Frontend touch points**
- `config/apiConfig.js` — add `SEARCH_API`
- `services/searchService.js` (new)
- `reducers/searchSlice.js` (new) + register in `store/store.js`
- `components/Header/Header.jsx` — add the search input
- New page `pages/User/SearchResults.jsx` + route in `App.jsx`; **reuses** `ThreadList`/`ThreadCard` to render results

**Complexity: M**

---

## Feature 3 — Thread Tags & Topic Browsing

**Value proposition:** Authors tag threads with topics, and readers browse all threads under a tag — a lightweight, cross-subreddit discovery axis.

**Data-model changes**
- `src/models/Thread.js` — add `tags: [String]` (lowercased, indexed for filtering).

**Endpoints** (extends existing thread slice — `routes/threads.js`, `controllers/threadController.js`, `services/threadService.js`)
- Extend `POST /api/threads` and `PUT /api/threads/:id` to accept/persist `tags`
- `GET /api/threads?tag=<tag>` — filter threads by tag (extend `getAllThreads`)
- `GET /api/threads/tags/popular` — distinct/most-used tags for a browse UI

**Frontend touch points**
- `config/apiConfig.js` — extend `THREAD_API`
- `services/threadService.js` + `reducers/threadSlice.js` — add tag fetch/filter (or a small `tagSlice.js`)
- `components/Forms/CreateThreadForm.jsx` — tag input
- `components/ThreadList/ThreadCard.jsx` — render clickable tag chips
- New page `pages/User/TagPage.jsx` (or a `?tag=` mode of `Home.jsx`) + route in `App.jsx`

**Complexity: M**

---

## Feature 4 — Subreddit Subscriptions & Personalized Feed

**Value proposition:** Users subscribe to subreddits and get a personalized "My Feed" of only the communities they follow — the core re-engagement loop.

**Data-model changes**
- New model `src/models/Subscription.js`: `{ user: ObjectId→User, subreddit: ObjectId→Subreddit }` + `timestamps`, compound unique index `{ user, subreddit }`. (Separate collection to avoid editing `User.js` / `Subreddit.js`.)

**Endpoints** (new route file `src/routes/subscriptions.js`, mounted at `/api/subscriptions` in `app.js`)
- `POST   /api/subscriptions/:subredditId` — subscribe (auth)
- `DELETE /api/subscriptions/:subredditId` — unsubscribe (auth)
- `GET    /api/subscriptions` — list current user's subscriptions (auth)
- `GET    /api/subscriptions/feed?page=<n>` — paginated threads from subscribed subreddits, newest first (auth)

**Frontend touch points**
- `config/apiConfig.js` — add `SUBSCRIPTION_API`
- `services/subscriptionService.js` (new)
- `reducers/subscriptionSlice.js` (new) + register in `store/store.js`
- `components/Sidebar/Sidebar.jsx` — subscribe/unsubscribe buttons next to each subreddit
- New page `pages/User/MyFeed.jsx` + route in `App.jsx`; nav link in `components/Header/Header.jsx`

**Complexity: L** (feed aggregation + subscribe state wired across the sidebar)

---

## Feature 5 — AI "Related Threads" Recommendations

**Value proposition:** On a thread page, surface a "Related discussions" panel so readers keep discovering relevant content instead of bouncing.

**Data-model changes**
- None required (stateless). Builds on the existing `utils/aiProvider.js` (`generateAIContent`) the same way thread summaries do. Optional later optimization: cache related IDs on the thread.

**Endpoints** (extends the thread slice)
- `GET /api/threads/:id/related` — returns a short list of related threads. Implementation can be AI-assisted (prompt with title/tags/top threads, parse returned ids) or a cheaper heuristic (same subreddit / shared tags / top-voted) as a fallback.

**Frontend touch points**
- `config/apiConfig.js` — extend `THREAD_API` with `RELATED`
- `services/threadService.js` — add `fetchRelated`
- `reducers/selectedThreadSlice.js` (or `threadSlice.js`) — add a `relatedThreads` thunk
- `pages/User/ThreadPage.jsx` or `components/RightSidebar/RightSidebar.jsx` — render the related panel (reuse a compact `ThreadCard`)

**Complexity: M** (S if shipped with the heuristic fallback only)

---

## Shared-file conflict matrix

These features are independent in **intent**, but several share files. Plan ordering/branching around the ⚠️ rows.

| File | F1 Bookmarks | F2 Search | F3 Tags | F4 Subscriptions | F5 Related | Notes |
|------|:---:|:---:|:---:|:---:|:---:|------|
| `src/app.js` (route registration) | ✏️ | ✏️ | — | ✏️ | — | Append-only mounts; low-risk but a true shared edit |
| `src/models/Thread.js` | — | ✏️ | ✏️ | — | — | ⚠️ **F2 (text index) + F3 (`tags` field)** both edit the schema |
| `src/routes/threads.js` | — | — | ✏️ | — | ✏️ | ⚠️ thread-route cluster |
| `src/controllers/threadController.js` | — | — | ✏️ | — | ✏️ | ⚠️ thread-controller cluster |
| `src/services/threadService.js` | — | — | ✏️ | — | ✏️ | ⚠️ **F3 + F5** both edit `getAllThreads`/add handlers here |
| `config/apiConfig.js` | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | All five append endpoints (distinct exports → easy merges) |
| `store/store.js` | ✏️ | ✏️ | (✏️) | ✏️ | — | New slices registered here; F3 only if it adds `tagSlice` |
| `services/threadService.js` (FE) | — | — | ✏️ | — | ✏️ | ⚠️ **F3 + F5** |
| `reducers/threadSlice.js` (FE) | — | — | (✏️) | — | (✏️) | Avoidable if F3/F5 use their own slices |
| `App.jsx` (routes) | ✏️ | ✏️ | ✏️ | ✏️ | — | Four features add a route/page |
| `components/Header/Header.jsx` | ✏️ | ✏️ | — | ✏️ | — | ⚠️ **F1 + F2 + F4** all add nav/search to the header |
| `components/ThreadList/ThreadCard.jsx` | ✏️ | — | ✏️ | — | — | ⚠️ **F1 (save btn) + F3 (tag chips)** both edit the card |

✏️ = edits the file · (✏️) = edits only if you choose the shared-slice option · — = no change

### Conflict hotspots to watch
1. **Thread CRUD cluster (F3 + F5):** `routes/threads.js`, `threadController.js`, `threadService.js` (back) and `threadService.js`, `threadSlice.js` (front). Build F3 and F5 on separate branches and merge sequentially, or give F5 its own slice/service to reduce overlap.
2. **`Thread.js` schema (F2 + F3):** trivial but real — both add to the schema; land one, rebase the other.
3. **`ThreadCard.jsx` (F1 + F3):** both add UI to the same card; coordinate layout.
4. **`Header.jsx` (F1 + F2 + F4):** three features add header elements; consider doing the header changes together.

### Maximally-independent subset
If you want features that can be built fully in parallel with near-zero merge friction, pick **F1 (Bookmarks)** and **F4 (Subscriptions)**: both use brand-new models, new route files, new slices, and mostly new pages — their only overlaps are append-only edits to `app.js`, `apiConfig.js`, `store.js`, `App.jsx`, and `Header.jsx`.

### Suggested build order
1. **F2 Search** then **F3 Tags** — get discovery primitives in; land Search's `Thread.js` index first.
2. **F1 Bookmarks** and **F4 Subscriptions** — parallelizable engagement features on new collections.
3. **F5 Related** last — benefits from tags (F3) existing and touches the already-modified thread cluster.
