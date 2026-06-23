import { describe, it, expect } from "vitest";
import searchReducer, {
  searchThreadsThunk,
  clearSearch,
} from "../../../src/reducers/searchSlice";

const initialState = {
  results: [],
  query: "",
  loading: false,
  error: null,
};

describe("searchSlice", () => {
  it("returns the initial state", () => {
    expect(searchReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("sets loading and stores the query on pending", () => {
    const state = searchReducer(
      initialState,
      searchThreadsThunk.pending("", "react"),
    );
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
    expect(state.query).toBe("react");
  });

  it("stores results on fulfilled", () => {
    const results = [{ _id: "t1" }, { _id: "t2" }];
    const state = searchReducer(
      { ...initialState, loading: true },
      searchThreadsThunk.fulfilled(results, "", "react"),
    );
    expect(state.loading).toBe(false);
    expect(state.results).toEqual(results);
  });

  it("guards against a non-array payload on fulfilled", () => {
    const state = searchReducer(
      initialState,
      searchThreadsThunk.fulfilled(null, "", "react"),
    );
    expect(state.results).toEqual([]);
  });

  it("sets error on rejected", () => {
    const state = searchReducer(
      { ...initialState, loading: true },
      searchThreadsThunk.rejected(null, "", "react", "Search failed"),
    );
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Search failed");
  });

  it("clearSearch resets to the initial state", () => {
    const previousState = {
      results: [{ _id: "t1" }],
      query: "react",
      loading: false,
      error: null,
    };
    expect(searchReducer(previousState, clearSearch())).toEqual(initialState);
  });
});
