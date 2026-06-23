import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchBookmarks,
  saveThread,
  unsaveThread,
} from '../services/bookmarkService';
import { handleApiError } from '../utils/handleApiError';

const initialState = {
  savedThreads: [], // populated thread objects, newest-saved first
  savedIds: [], // thread _id strings, used for the saved/unsaved indicator
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

export const saveThreadThunk = createAsyncThunk(
  'bookmarks/save',
  async (threadId, { rejectWithValue }) => {
    try {
      await saveThread(threadId);
      return threadId;
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
        state.savedThreads = action.payload;
        state.savedIds = action.payload.map((thread) => thread._id);
      })
      .addCase(fetchBookmarksThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // saveThreadThunk
      .addCase(saveThreadThunk.fulfilled, (state, action) => {
        const threadId = action.payload;
        if (!state.savedIds.includes(threadId)) {
          state.savedIds.push(threadId);
        }
      })

      // unsaveThreadThunk
      .addCase(unsaveThreadThunk.fulfilled, (state, action) => {
        const threadId = action.payload;
        state.savedIds = state.savedIds.filter((id) => id !== threadId);
        state.savedThreads = state.savedThreads.filter(
          (thread) => thread._id !== threadId
        );
      });
  },
});

export const { clearBookmarks } = bookmarkSlice.actions;
export default bookmarkSlice.reducer;
