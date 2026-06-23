# Implementation Plan — 001 Bookmarks (Saved Threads)

_Plan for `specs/001-bookmarks.md` · 2026-06-22 · No code yet_

Bottom-up sequence: **model → service → controller → route → backend tests → Redux slice
→ frontend service → component → wire-up → frontend tests.** Each task names exact files
and key functions. File paths are relative to the repo root.

> **Dependency note:** the requested order lists the Redux slice (T6) before the frontend
> service (T7), but the slice imports the service and the `apiConfig` constant. In practice,
> scaffold **T7's `apiConfig` entry + `bookmarkService.js` first**, then implement the slice.
> Backend tasks (T1–T5) and frontend tasks (T6–T10) are otherwise independent and could be
> built by two people in parallel.

---

## T1 — Model

**Create** `threadhive-backend/src/models/Bookmark.js`
- `BookmarkSchema` with `user` (ObjectId → `User`, required), `thread` (ObjectId → `Thread`,
  required), `{ timestamps: true }`.
- Compound unique index: `BookmarkSchema.index({ user: 1, thread: 1 }, { unique: true })`
  — prevents duplicate saves and speeds per-user / "is-saved" lookups.
- `export default mongoose.model("Bookmark", BookmarkSchema)`.

_(The `app.js` side-effect import for this model is added in T4 to keep all `app.js` edits
in one place.)_

---

## T2 — Service (backend)

**Create** `threadhive-backend/src/services/bookmarkService.js` (mirror `threadService.js`
style; import `Bookmark`, `Thread`, `User`, `Subreddit`, `createAppError`).
- `createBookmark(userId, threadId)` — verify thread exists (`Thread.findById` → else
  `createAppError("Thread not found", 404)`); attempt `Bookmark.create({ user, thread })`;
  on duplicate-key (`E11000`) fetch and return the existing doc. Return
  `{ bookmark, created: boolean }` so the controller can choose 201 vs 200.
- `removeBookmark(userId, threadId)` — `Bookmark.findOneAndDelete({ user, thread })`;
  idempotent (returns whether a doc was removed; never throws on "not found").
- `fetchUserBookmarks(userId)` — `Bookmark.find({ user }).sort({ createdAt: -1 })`
  `.populate({ path: "thread", populate: [{ path: "author" }, { path: "subreddit" }] })`;
  **map to the populated thread and filter out entries whose thread is `null`** (deleted).

---

## T3 — Controller

**Create** `threadhive-backend/src/controllers/bookmarkController.js` (mirror
`voteController.js`/`threadController.js`; standard `{ success, message, data }` envelope).
- `saveBookmark(req, res)` — validate `req.params.threadId` with
  `mongoose.Types.ObjectId.isValid` (→ `createAppError(..., 400)`); call
  `createBookmark(req.user.userId, threadId)`; respond `201` ("Thread saved") when
  `created`, else `200` ("Thread already saved"), `data: bookmark`.
- `deleteBookmark(req, res)` — validate id; call `removeBookmark`; respond `200`
  ("Thread unsaved"), `data: { thread: threadId }`.
- `getBookmarks(req, res)` — call `fetchUserBookmarks(req.user.userId)`; respond `200`
  ("Bookmarks fetched successfully"), `data: threads`.

---

## T4 — Route + app wiring

**Create** `threadhive-backend/src/routes/bookmarks.js` (mirror `votes.js`):
- `router.get("/", authHandler, getBookmarks)`
- `router.post("/:threadId", authHandler, saveBookmark)`
- `router.delete("/:threadId", authHandler, deleteBookmark)`

**Edit** `threadhive-backend/src/app.js`:
- `import bookmarkRoutes from "./routes/bookmarks.js";`
- `import "./models/Bookmark.js";` (with the other model side-effect imports)
- `app.use("/api/bookmarks", bookmarkRoutes);` (before `app.use(errorHandler)`).

---

## T5 — Backend tests

**Create** `threadhive-backend/tests/unit/services/bookmarkService.test.js`
- `createBookmark`: creates once; idempotent on repeat (no duplicate; unique index/E11000);
  throws 404 for a missing thread.
- `removeBookmark`: removes; idempotent when nothing to remove.
- `fetchUserBookmarks`: returns populated threads, newest-saved first; **filters dangling**
  (thread deleted) entries. _(Covers AC9 + the model's unique constraint.)_

**Create** `threadhive-backend/tests/unit/controllers/bookmarkController.test.js`
- Status-code mapping with the service mocked: 201 new vs 200 existing, 400 invalid id,
  404 missing thread; correct envelope shape.

**Create** `threadhive-backend/tests/integration/bookmark.test.js` (supertest +
mongodb-memory-server; mirror `tests/integration/thread.test.js` for register/login → token)
- Save → `201`; save again → `200`; `GET /api/bookmarks` has exactly one (AC1, AC2).
- `GET` returns thread populated with `author` + `subreddit`, newest first (AC4).
- Unsave → `200`; `GET` no longer lists it (AC3).
- No token on each endpoint → `401` (AC5).
- Invalid `threadId` → `400`; valid-but-missing → `404` (AC6).
- User isolation: user A's bookmark absent from user B's list.
- Save → delete the thread → `GET` returns `[]` (AC9).

_No change needed to `tests/setup.js` (shared in-memory DB)._

---

## T6 — Redux slice + store

**Create** `threadhive-frontend/src/reducers/bookmarkSlice.js` (mirror `threadSlice.js`)
- State: `{ savedThreads: [], savedIds: [], loading: false, error: null }`.
- Thunks (wrap with `handleApiError`): `fetchBookmarksThunk`, `saveThreadThunk(threadId)`,
  `unsaveThreadThunk(threadId)` — calling the T7 service; the save/unsave thunks return the
  `threadId` so reducers can update `savedIds`.
- `extraReducers`: `fetchBookmarksThunk.fulfilled` → set `savedThreads`, derive `savedIds`;
  `saveThreadThunk.fulfilled` → add id to `savedIds`; `unsaveThreadThunk.fulfilled` →
  remove id from `savedIds` and the thread from `savedThreads`; pending/rejected → loading/error.

**Edit** `threadhive-frontend/src/store/store.js`
- Import `bookmarkReducer`; add `bookmarks: bookmarkReducer` to the `reducer` map.

---

## T7 — Frontend service + API config _(scaffold before T6)_

**Edit** `threadhive-frontend/src/config/apiConfig.js`
- Add `BOOKMARK_API = { GET_ALL: "/bookmarks", SAVE: (id) => \`/bookmarks/${id}\`,
  UNSAVE: (id) => \`/bookmarks/${id}\` }`.

**Create** `threadhive-frontend/src/services/bookmarkService.js` (mirror `threadService.js`;
`getAuthHeaders()`, return `res.data.data`)
- `fetchBookmarks()` → `GET BOOKMARK_API.GET_ALL`.
- `saveThread(threadId)` → `POST BOOKMARK_API.SAVE(threadId)`.
- `unsaveThread(threadId)` → `DELETE BOOKMARK_API.UNSAVE(threadId)`.

---

## T8 — Components

**Edit** `threadhive-frontend/src/components/ThreadList/ThreadCard.jsx`
- Add a save/unsave toggle button: `useSelector(s => s.bookmarks.savedIds.includes(thread._id))`;
  click dispatches `saveThreadThunk(thread._id)` / `unsaveThreadThunk(thread._id)`; icon
  `bi-bookmark` (outline) vs `bi-bookmark-fill` (saved). Keep it visually distinct from the
  existing decorative `bi-bookmark` on the subreddit badge (e.g., place in the vote column or
  the card header). Satisfies AC7 in both feed and thread-page contexts (shared component).

**Edit** `threadhive-frontend/src/pages/User/Profile.jsx`
- Add a "Saved" tab/section (React-Bootstrap `Tabs`/`Nav` or a simple toggle). On mount,
  `dispatch(fetchBookmarksThunk())`; read `savedThreads`/`loading` via `useSelector`; render
  with the existing `ThreadList`; loading + empty states ("You haven't saved any threads yet").
  Satisfies AC8.

---

## T9 — Wire-up

**Edit** `threadhive-frontend/src/pages/User/Home.jsx`
- In the initial-load effect (alongside `fetchThreads`), `dispatch(fetchBookmarksThunk())`
  once so `savedIds` is hydrated and feed cards show the correct saved state before the user
  visits their profile.
- Confirm no new route is needed (Saved lives in `/profile`); `App.jsx` unchanged.
- Verify store registration from T6 is wired.

---

## T10 — Frontend tests

**Create** `threadhive-frontend/tests/unit/reducers/bookmarkSlice.test.js`
- `savedIds` add on save / remove on unsave; `fetchBookmarksThunk.fulfilled` sets
  `savedThreads` and derives `savedIds`.

**Edit** `threadhive-frontend/tests/unit/components/ThreadCard.test.jsx`
- Renders outline when not in `savedIds`, filled when in it; click dispatches the right thunk
  and flips the icon (AC7).

**Edit** `threadhive-frontend/tests/unit/pages/Profile.test.jsx`
- "Saved" section renders saved threads from the store and shows the empty state (AC8).

**Create** `threadhive-frontend/tests/integration/bookmarkFlow.test.jsx`
- Save from the feed → it appears in the Profile "Saved" section (MSW-backed flow).

**Edit** `threadhive-frontend/tests/mocks/handlers.js`
- Add MSW handlers for `POST`/`DELETE /bookmarks/:id` and `GET /bookmarks`.

**Edit** `threadhive-frontend/tests/mocks/mockData.js`
- Add mock saved-thread fixtures as needed.

**Edit** `threadhive-frontend/tests/unit/store/store.test.js`
- Assert the `bookmarks` slice is registered in the store.

---

## Task checklist

### Backend
- [ ] **T1** Create `src/models/Bookmark.js` (schema + unique `{user,thread}` index)
- [ ] **T2** Create `src/services/bookmarkService.js` (`createBookmark`, `removeBookmark`, `fetchUserBookmarks`)
- [ ] **T3** Create `src/controllers/bookmarkController.js` (`saveBookmark`, `deleteBookmark`, `getBookmarks`)
- [ ] **T4** Create `src/routes/bookmarks.js`; wire route + model import + mount in `src/app.js`
- [ ] **T5** Backend tests: service unit, controller unit, `tests/integration/bookmark.test.js`

### Frontend
- [ ] **T7** Add `BOOKMARK_API` to `config/apiConfig.js`; create `services/bookmarkService.js` _(do before T6)_
- [ ] **T6** Create `reducers/bookmarkSlice.js`; register `bookmarks` in `store/store.js`
- [ ] **T8** Edit `components/ThreadList/ThreadCard.jsx` (save toggle) + `pages/User/Profile.jsx` (Saved section)
- [ ] **T9** Edit `pages/User/Home.jsx` to hydrate `savedIds` on load; verify routing/store wiring
- [ ] **T10** Frontend tests: `bookmarkSlice` unit, extend `ThreadCard`/`Profile` tests, `bookmarkFlow` integration, MSW handlers + mock data, store test

### Verification
- [ ] `npm test` passes in `threadhive-backend`
- [ ] `npm test` passes in `threadhive-frontend`
- [ ] All acceptance criteria AC1–AC9 covered by tests
