import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchBookmarks,
  saveThread,
  unsaveThread,
} from '../services/bookmarkService';
import { upvoteThreadThunk, downvoteThreadThunk } from './threadSlice';
import { handleApiError } from '../utils/handleApiError';

// `savedThreads` is the single source of truth: the populated thread objects the
// user has saved, newest-saved first. The saved/unsaved indicator is derived from
// it (see SaveButton), so there is no separate id list to keep in sync.
const initialState = {
  savedThreads: [],
  loading: false,
  error: null,
};

export const fetchBookmarksThunk = createAsyncThunk(
  'bookmarks/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchBookmarks();
    } catch (err) {
      return rejectWithValue(handleApiError(err));
    }
  }
);

// Takes the full thread object so the saved list can update without a refetch.
export const saveThreadThunk = createAsyncThunk(
  'bookmarks/save',
  async (thread, { rejectWithValue }) => {
    try {
      await saveThread(thread._id);
      return thread;
    } catch (err) {
      return rejectWithValue(handleApiError(err));
    }
  }
);

export const unsaveThreadThunk = createAsyncThunk(
  'bookmarks/unsave',
  async (threadId, { rejectWithValue }) => {
    try {
      await unsaveThread(threadId);
      return threadId;
    } catch (err) {
      return rejectWithValue(handleApiError(err));
    }
  }
);

// Keep a saved thread's vote count current when it's voted on from anywhere
// (e.g. the feed or the thread page), since the saved list reads from here.
const syncVote = (state, action) => {
  const updated = action.payload;
  const thread = state.savedThreads.find((t) => t._id === updated._id);
  if (thread) {
    Object.assign(thread, updated);
  }
};

const bookmarkSlice = createSlice({
  name: 'bookmarks',
  initialState,
  reducers: {
    clearBookmarks: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // fetchBookmarksThunk
      .addCase(fetchBookmarksThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookmarksThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.savedThreads = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchBookmarksThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // saveThreadThunk
      .addCase(saveThreadThunk.fulfilled, (state, action) => {
        const thread = action.payload;
        if (!state.savedThreads.some((t) => t._id === thread._id)) {
          state.savedThreads.unshift(thread);
        }
      })
      .addCase(saveThreadThunk.rejected, (state, action) => {
        state.error = action.payload;
      })

      // unsaveThreadThunk
      .addCase(unsaveThreadThunk.fulfilled, (state, action) => {
        const threadId = action.payload;
        state.savedThreads = state.savedThreads.filter((t) => t._id !== threadId);
      })
      .addCase(unsaveThreadThunk.rejected, (state, action) => {
        state.error = action.payload;
      })

      // Keep saved-thread vote counts in sync with votes made elsewhere.
      .addCase(upvoteThreadThunk.fulfilled, syncVote)
      .addCase(downvoteThreadThunk.fulfilled, syncVote);
  },
});

export const { clearBookmarks } = bookmarkSlice.actions;
export default bookmarkSlice.reducer;
