import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { server } from "../mocks/server";

import Home from "../../src/pages/User/Home";
import Profile from "../../src/pages/User/Profile";
import threadReducer from "../../src/reducers/threadSlice";
import subredditReducer from "../../src/reducers/subredditSlice";
import bookmarkReducer from "../../src/reducers/bookmarkSlice";
import selectedThreadReducer from "../../src/reducers/selectedThreadSlice";
import commentReducer from "../../src/reducers/commentSlice";
import themeReducer from "../../src/reducers/themeSlice";

const BASE_URL = "http://localhost:3000/api";

const mockThread = {
  _id: "thread-1",
  title: "Bookmarkable Thread",
  content: "Save me from the feed",
  author: { _id: "u1", name: "Alice" },
  subreddit: { _id: "s1", name: "react" },
  voteCount: 3,
  createdAt: "2024-01-10T10:00:00.000Z",
};

const makeStore = () =>
  configureStore({
    reducer: {
      auth: () => ({ token: "test-token", user: { name: "Alice" }, loading: false, error: null }),
      threads: threadReducer,
      subreddits: subredditReducer,
      bookmarks: bookmarkReducer,
      selectedThread: selectedThreadReducer,
      comments: commentReducer,
      theme: themeReducer,
    },
  });

describe("Bookmark flow", () => {
  let saved;

  beforeEach(() => {
    // Stateful mock: POST adds to the saved list, GET returns it.
    saved = [];
    server.use(
      http.get(`${BASE_URL}/threads`, () =>
        HttpResponse.json({ data: [mockThread] })
      ),
      http.get(`${BASE_URL}/bookmarks`, () => HttpResponse.json({ data: saved })),
      http.post(`${BASE_URL}/bookmarks/:threadId`, ({ params }) => {
        if (
          params.threadId === mockThread._id &&
          !saved.find((t) => t._id === params.threadId)
        ) {
          saved.push(mockThread);
        }
        return HttpResponse.json(
          { data: { _id: "bm1", thread: params.threadId } },
          { status: 201 }
        );
      })
    );
  });

  it("saves a thread from the feed and shows it on the profile Bookmarks tab", async () => {
    const store = makeStore();

    const { unmount } = render(
      <Provider store={store}>
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      </Provider>
    );

    // Feed loads the thread.
    await waitFor(() =>
      expect(screen.getByText("Bookmarkable Thread")).toBeInTheDocument()
    );

    // Save it from the feed; the button flips to "Unsave".
    await userEvent.click(screen.getByLabelText("Save thread"));
    await waitFor(() =>
      expect(screen.getByLabelText("Unsave thread")).toBeInTheDocument()
    );

    unmount();

    // The profile Bookmarks tab (re-fetched on mount) now lists the thread.
    render(
      <Provider store={store}>
        <BrowserRouter>
          <Profile />
        </BrowserRouter>
      </Provider>
    );

    await userEvent.click(screen.getByText(/Bookmarks/));
    await waitFor(() =>
      expect(screen.getByText("Bookmarkable Thread")).toBeInTheDocument()
    );
  });
});
