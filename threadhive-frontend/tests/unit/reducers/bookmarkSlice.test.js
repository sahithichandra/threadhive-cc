import { describe, it, expect } from "vitest";
import bookmarkReducer, {
  fetchBookmarksThunk,
  saveThreadThunk,
  unsaveThreadThunk,
  clearBookmarks,
} from "../../../src/reducers/bookmarkSlice";
import { upvoteThreadThunk, downvoteThreadThunk } from "../../../src/reducers/threadSlice";

const initialState = {
  savedThreads: [],
  loading: false,
  error: null,
};

describe("bookmarkSlice", () => {
  it("returns the initial state", () => {
    expect(bookmarkReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  describe("fetchBookmarksThunk", () => {
    it("sets loading on pending", () => {
      const state = bookmarkReducer(initialState, fetchBookmarksThunk.pending());
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it("stores savedThreads on fulfilled", () => {
      const threads = [{ _id: "t1" }, { _id: "t2" }];
      const state = bookmarkReducer(
        initialState,
        fetchBookmarksThunk.fulfilled(threads, ""),
      );
      expect(state.loading).toBe(false);
      expect(state.savedThreads).toEqual(threads);
    });

    it("guards against a non-array payload on fulfilled", () => {
      const state = bookmarkReducer(
        initialState,
        fetchBookmarksThunk.fulfilled(null, ""),
      );
      expect(state.savedThreads).toEqual([]);
    });

    it("sets error on rejected", () => {
      const state = bookmarkReducer(
        initialState,
        fetchBookmarksThunk.rejected(null, "", undefined, "Failed to load"),
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe("Failed to load");
    });
  });

  describe("saveThreadThunk", () => {
    it("adds the thread to savedThreads on fulfilled", () => {
      const thread = { _id: "t1", title: "Saved" };
      const state = bookmarkReducer(
        initialState,
        saveThreadThunk.fulfilled(thread, "", thread),
      );
      expect(state.savedThreads).toEqual([thread]);
    });

    it("does not duplicate an already-saved thread", () => {
      const thread = { _id: "t1", title: "Saved" };
      const previousState = { ...initialState, savedThreads: [thread] };
      const state = bookmarkReducer(
        previousState,
        saveThreadThunk.fulfilled(thread, "", thread),
      );
      expect(state.savedThreads).toHaveLength(1);
    });

    it("sets error on rejected", () => {
      const state = bookmarkReducer(
        initialState,
        saveThreadThunk.rejected(null, "", {}, "save failed"),
      );
      expect(state.error).toBe("save failed");
    });
  });

  describe("unsaveThreadThunk", () => {
    it("removes the thread on fulfilled", () => {
      const previousState = {
        savedThreads: [{ _id: "t1" }, { _id: "t2" }],
        loading: false,
        error: null,
      };
      const state = bookmarkReducer(
        previousState,
        unsaveThreadThunk.fulfilled("t1", "", "t1"),
      );
      expect(state.savedThreads).toEqual([{ _id: "t2" }]);
    });

    it("sets error on rejected", () => {
      const state = bookmarkReducer(
        initialState,
        unsaveThreadThunk.rejected(null, "", "t1", "unsave failed"),
      );
      expect(state.error).toBe("unsave failed");
    });
  });

  describe("vote sync", () => {
    it("updates a saved thread's vote count when it is upvoted", () => {
      const previousState = {
        savedThreads: [{ _id: "t1", voteCount: 5 }],
        loading: false,
        error: null,
      };
      const updated = { _id: "t1", voteCount: 6 };
      const state = bookmarkReducer(
        previousState,
        upvoteThreadThunk.fulfilled(updated, "", "t1"),
      );
      expect(state.savedThreads[0].voteCount).toBe(6);
    });

    it("ignores a vote for a thread that isn't saved", () => {
      const previousState = {
        savedThreads: [{ _id: "t1", voteCount: 5 }],
        loading: false,
        error: null,
      };
      const updated = { _id: "other", voteCount: 99 };
      const state = bookmarkReducer(
        previousState,
        downvoteThreadThunk.fulfilled(updated, "", "other"),
      );
      expect(state.savedThreads[0].voteCount).toBe(5);
    });
  });

  it("clearBookmarks resets to the initial state", () => {
    const previousState = {
      savedThreads: [{ _id: "t1" }],
      loading: false,
      error: null,
    };
    expect(bookmarkReducer(previousState, clearBookmarks())).toEqual(initialState);
  });
});
