import { describe, it, expect } from "vitest";
import bookmarkReducer, {
  fetchBookmarksThunk,
  saveThreadThunk,
  unsaveThreadThunk,
  clearBookmarks,
} from "../../../src/reducers/bookmarkSlice";

const initialState = {
  savedThreads: [],
  savedIds: [],
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

    it("stores savedThreads and derives savedIds on fulfilled", () => {
      const threads = [{ _id: "t1" }, { _id: "t2" }];
      const state = bookmarkReducer(
        initialState,
        fetchBookmarksThunk.fulfilled(threads, ""),
      );
      expect(state.loading).toBe(false);
      expect(state.savedThreads).toEqual(threads);
      expect(state.savedIds).toEqual(["t1", "t2"]);
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
    it("adds the thread id on fulfilled", () => {
      const state = bookmarkReducer(
        initialState,
        saveThreadThunk.fulfilled("t1", "", "t1"),
      );
      expect(state.savedIds).toContain("t1");
    });

    it("does not duplicate an already-saved id", () => {
      const previousState = { ...initialState, savedIds: ["t1"] };
      const state = bookmarkReducer(
        previousState,
        saveThreadThunk.fulfilled("t1", "", "t1"),
      );
      expect(state.savedIds).toEqual(["t1"]);
    });
  });

  describe("unsaveThreadThunk", () => {
    it("removes the id and the thread on fulfilled", () => {
      const previousState = {
        savedThreads: [{ _id: "t1" }, { _id: "t2" }],
        savedIds: ["t1", "t2"],
        loading: false,
        error: null,
      };
      const state = bookmarkReducer(
        previousState,
        unsaveThreadThunk.fulfilled("t1", "", "t1"),
      );
      expect(state.savedIds).toEqual(["t2"]);
      expect(state.savedThreads).toEqual([{ _id: "t2" }]);
    });
  });

  it("clearBookmarks resets to the initial state", () => {
    const previousState = {
      savedThreads: [{ _id: "t1" }],
      savedIds: ["t1"],
      loading: false,
      error: null,
    };
    expect(bookmarkReducer(previousState, clearBookmarks())).toEqual(initialState);
  });
});
