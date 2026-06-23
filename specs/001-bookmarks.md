# 001 — Bookmarks (Saved Threads)

_Spec for ThreadHive · Status: Draft · 2026-06-22_

> Epic: Content Discovery & Engagement (`docs/epic-discover-engage.md`, Feature 1).
> Build follows the project vertical-slice convention (`CLAUDE.md`):
> model → service → controller → route → tests → Redux slice → frontend service → component.

## Problem / motivation

ThreadHive users can read, vote on, and comment on threads, but there is no way to
keep a thread for later. Anything interesting is lost as soon as it scrolls out of the
feed (the Home feed has no persistent "read it later" affordance). Bookmarks let a
logged-in user save threads and revisit them from their profile — a low-cost
engagement/discovery loop that encourages return visits.

## User stories

1. As a logged-in user, I can **save** a thread so I can find it again later.
2. As a logged-in user, I can **unsave** a thread I previously saved.
3. As a logged-in user, I can **see at a glance** whether a thread is already saved
   anywhere it appears (Home feed and the single-thread page).
4. As a logged-in user, I can **view all my saved threads** in a "Saved" section on my
   profile, and open any of them.
5. As a user, my saved list is **private to me** — it reflects only threads I saved.

## Acceptance criteria

Each criterion is independently testable.

- **AC1** — A logged-in user can save a thread; it then appears in `GET /api/bookmarks`.
- **AC2** — Saving an already-saved thread creates **no duplicate** and returns a success
  response (not an error).
- **AC3** — A logged-in user can unsave a saved thread; afterwards it no longer appears in
  `GET /api/bookmarks`.
- **AC4** — `GET /api/bookmarks` returns **only the requesting user's** saved threads,
  ordered **most-recently-saved first**, each populated with `author` and `subreddit`.
- **AC5** — Every bookmark endpoint requires authentication; an unauthenticated request
  returns **401**.
- **AC6** — Saving a non-existent thread returns **404**; an invalid (non-ObjectId)
  `threadId` returns **400**.
- **AC7** — The save control on every `ThreadCard` (Home feed + thread page) reflects the
  current saved state (filled icon when saved, outline when not) and toggles on click,
  with the icon updating to match the new state.
- **AC8** — The Profile page shows a "Saved" section listing the user's saved threads
  (reusing `ThreadList`), with an empty state when there are none.
- **AC9** — A bookmark whose thread was deleted is **omitted** from `GET /api/bookmarks`
  and from the Saved list (no crash, no null entries).

## API contract

All endpoints sit under `/api/bookmarks`, require a valid JWT (the existing `authHandler`
middleware, which sets `req.user.userId`), and use the project's standard response
envelope: `{ success, message, data }`. New route file `src/routes/bookmarks.js` mounted
in `src/app.js` via `app.use("/api/bookmarks", bookmarkRoutes)`.

### `POST /api/bookmarks/:threadId` — save a thread

- **Auth:** required.
- **Request body:** none.
- **Behavior:** idempotent — saving an already-saved thread is not an error.
- **Responses:**
  - `201 Created` — newly saved:
    ```json
    {
      "success": true,
      "message": "Thread saved",
      "data": { "_id": "<bookmarkId>", "user": "<userId>", "thread": "<threadId>",
                "createdAt": "...", "updatedAt": "..." }
    }
    ```
  - `200 OK` — already saved (same `data` shape, `message: "Thread already saved"`).
  - `400 Bad Request` — `threadId` is not a valid ObjectId.
  - `401 Unauthorized` — missing/invalid token.
  - `404 Not Found` — no thread with that id (`createAppError("Thread not found", 404)`).

### `DELETE /api/bookmarks/:threadId` — unsave a thread

- **Auth:** required.
- **Behavior:** idempotent — unsaving a thread that wasn't saved still returns success.
- **Responses:**
  - `200 OK`:
    ```json
    { "success": true, "message": "Thread unsaved", "data": { "thread": "<threadId>" } }
    ```
  - `400 Bad Request` — invalid `threadId`.
  - `401 Unauthorized`.

### `GET /api/bookmarks` — list the current user's saved threads

- **Auth:** required.
- **Behavior:** returns the **threads** the user has saved (not the bookmark wrappers),
  newest-saved first, each populated with `author` and `subreddit`. Bookmarks whose
  thread no longer exists are filtered out (AC9).
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Bookmarks fetched successfully",
      "data": [
        { "_id": "<threadId>", "title": "...", "content": "...", "voteCount": 3,
          "author": { "_id": "...", "name": "..." },
          "subreddit": { "_id": "...", "name": "...", "description": "..." },
          "createdAt": "...", "updatedAt": "..." }
      ]
    }
    ```
  - `401 Unauthorized`.

> Note: the frontend derives the set of saved thread ids from this list, so no separate
> "ids only" endpoint is added (see Out of scope for the optimization).

## Data model changes

**New model — `threadhive-backend/src/models/Bookmark.js`** (mirrors existing Mongoose
style with `timestamps`):

```js
const BookmarkSchema = new mongoose.Schema(
  {
    user:   { type: mongoose.Schema.Types.ObjectId, ref: "User",   required: true },
    thread: { type: mongoose.Schema.Types.ObjectId, ref: "Thread", required: true },
  },
  { timestamps: true },
);

// Prevent duplicate saves and make "is this saved?" / per-user lookups fast.
BookmarkSchema.index({ user: 1, thread: 1 }, { unique: true });
```

- **No changes** to `User.js`, `Thread.js`, `Comment.js`, or `Subreddit.js`.
- Add `import "./models/Bookmark.js";` alongside the other model imports in `app.js`
  (consistent with how `Thread`/`Subreddit`/`User` are registered there).

## UI changes

### API config — `src/config/apiConfig.js`
Add:
```js
export const BOOKMARK_API = {
  GET_ALL: "/bookmarks",
  SAVE:   (threadId) => `/bookmarks/${threadId}`,
  UNSAVE: (threadId) => `/bookmarks/${threadId}`,
};
```

### Service — `src/services/bookmarkService.js` (new)
Axios wrappers mirroring `threadService.js` (return `res.data.data`):
`fetchBookmarks()`, `saveThread(threadId)`, `unsaveThread(threadId)`.

### Redux slice — `src/reducers/bookmarkSlice.js` (new); register in `src/store/store.js`
- **State:** `{ savedThreads: [], savedIds: [], loading: false, error: null }`
  (`savedIds` is the array of saved thread `_id` strings used for the indicator).
- **Thunks:** `fetchBookmarksThunk`, `saveThreadThunk(threadId)`, `unsaveThreadThunk(threadId)`
  (each wrapped with `handleApiError`, matching `threadSlice.js`).
- **Reducers:**
  - `fetchBookmarksThunk.fulfilled` → set `savedThreads`, derive `savedIds`.
  - `saveThreadThunk.fulfilled` → add `threadId` to `savedIds`.
  - `unsaveThreadThunk.fulfilled` → remove `threadId` from `savedIds` and from `savedThreads`.

### Component — `src/components/ThreadList/ThreadCard.jsx` (edit)
- Add a save/unsave toggle button (Bootstrap Icons `bi-bookmark` outline / `bi-bookmark-fill`).
- `const isSaved = useSelector(s => s.bookmarks.savedIds.includes(thread._id))`.
- Click dispatches `saveThreadThunk(thread._id)` or `unsaveThreadThunk(thread._id)`.
- Because `ThreadCard` renders in both the Home feed and the single-thread page, this one
  change satisfies AC7 in both places.

### Page — `src/pages/User/Profile.jsx` (edit)
- Add a **"Saved" tab/section** to the existing `/profile` page (no new route).
- On mount, `dispatch(fetchBookmarksThunk())`; render `state.bookmarks.savedThreads` via the
  existing `ThreadList` component, with a loading state and an empty state
  ("You haven't saved any threads yet").

### Saved-state hydration
So indicators are correct before the user visits their profile, dispatch
`fetchBookmarksThunk()` once when the authenticated app loads the feed (in
`pages/User/Home.jsx`'s initial-load effect, alongside `fetchThreads`). This populates
`savedIds` for the feed.

### Routes
- **No new route.** Saved threads live inside `/profile` (which is already wrapped in
  `PrivateRoute`).

## Edge cases & error handling

- **Duplicate save (race or double-click):** the unique compound index guarantees no
  duplicate row; the service catches the Mongo duplicate-key error (`E11000`) and responds
  as "already saved" (`200`) rather than erroring.
- **Save non-existent thread:** validate existence in the service → `404`.
- **Invalid `threadId` (bad ObjectId):** validate/cast → `400` (avoid a 500 CastError).
- **Unsave a thread that isn't saved:** idempotent `200` (delete affects 0 docs, still success).
- **Bookmarked thread later deleted:** there is currently no cascade on thread deletion, so
  a bookmark can dangle. `GET /api/bookmarks` populates `thread` and **filters out** entries
  whose populated thread is `null` (AC9). The frontend never receives null threads.
- **Unauthenticated / invalid / expired token:** handled by `authHandler` → `401`.
- **Token valid but user deleted:** already handled by `authHandler` → `401`.
- **Toggle while a request is in flight:** the slice should ignore/guard against issuing a
  conflicting toggle until the prior thunk settles (or rely on idempotent endpoints so the
  final state is still correct).

## Out of scope

- Bookmark folders, collections, tags, or notes on a saved thread.
- Bookmarking **comments** (threads only).
- Cascade-deleting bookmarks when a thread is deleted (dangling bookmarks are handled by
  filtering on read; a cleanup/cascade can be a later task).
- Viewing **another user's** saved threads (bookmarks are private).
- Pagination/sorting controls on the Saved list (return the full list, newest-saved first).
- A dedicated `/saved` route or header shortcut (decided: section on `/profile`).
- A separate "ids only" endpoint (`GET /api/bookmarks/ids`) as a feed-load optimization —
  noted as a possible later improvement if the full-thread payload becomes too heavy.
- Persisting the existing client-only Profile fields (bio/location/website) — a pre-existing
  gap unrelated to this feature.

## Test plan

Backend uses **Vitest + supertest + mongodb-memory-server** (see `tests/integration/*`,
`tests/unit/*`, `vitest.config.js`'s 60s timeout). Frontend uses **Vitest + jsdom +
Testing Library + MSW** (see `tests/setup.js`, `tests/mocks/handlers.js`).

### Unit (backend)
- **Bookmark model:** required fields enforced; the `{ user, thread }` compound index is
  unique (second identical insert rejects with `E11000`).
- **bookmarkService:** `createBookmark` creates once and is idempotent on repeat;
  `removeBookmark` is idempotent; `fetchUserBookmarks` returns populated threads sorted by
  `createdAt` desc and filters out bookmarks with a null/deleted thread.

### Unit (frontend)
- **bookmarkSlice reducers:** `fetchBookmarksThunk.fulfilled` sets `savedThreads` and
  derives `savedIds`; `saveThreadThunk.fulfilled` adds the id; `unsaveThreadThunk.fulfilled`
  removes the id and the thread.

### Integration (backend, supertest)
- Save → `201`; save again → `200`, and `GET /api/bookmarks` contains exactly one entry (AC1, AC2).
- `GET` after save lists the thread populated with `author` + `subreddit`, newest first (AC4).
- Unsave → `200`; subsequent `GET` no longer contains it (AC3).
- All three endpoints without a token → `401` (AC5).
- `POST` with an invalid `threadId` → `400`; with a valid-but-missing id → `404` (AC6).
- **User isolation:** user A's bookmark does not appear in user B's `GET /api/bookmarks`.
- **Dangling thread:** save a thread, delete the thread, then `GET /api/bookmarks` returns
  `[]` (AC9).

### Component (frontend, Testing Library + MSW)
- `ThreadCard` renders an **outline** bookmark when `savedIds` excludes the thread and a
  **filled** bookmark when it includes it; clicking dispatches the correct thunk and flips
  the icon (AC7). Add MSW handlers for the bookmark endpoints in `tests/mocks/handlers.js`.
- `Profile` "Saved" section renders the saved threads from the store and shows the empty
  state when there are none (AC8).
