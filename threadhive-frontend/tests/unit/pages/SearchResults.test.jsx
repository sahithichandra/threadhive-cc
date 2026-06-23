import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import SearchResults from "../../../src/pages/User/SearchResults";
import searchReducer from "../../../src/reducers/searchSlice";

const renderAt = (entry) => {
  const store = configureStore({ reducer: { search: searchReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <SearchResults />
      </MemoryRouter>
    </Provider>
  );
};

describe("SearchResults page", () => {
  it("lists threads matching the query", async () => {
    renderAt("/search?q=react");
    await waitFor(() =>
      expect(screen.getByText("Getting Started with React")).toBeInTheDocument()
    );
  });

  it("shows an empty state when nothing matches", async () => {
    renderAt("/search?q=zzznomatch");
    await waitFor(() =>
      expect(screen.getByText(/no threads found/i)).toBeInTheDocument()
    );
  });

  it("prompts for a term when there is no query", () => {
    renderAt("/search");
    expect(screen.getByText(/enter a search term/i)).toBeInTheDocument();
  });
});
