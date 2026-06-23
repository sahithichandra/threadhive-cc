import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { searchThreads } from '../services/searchService';
import { handleApiError } from '../utils/handleApiError';

const initialState = {
  results: [],
  query: '',
  loading: false,
  error: null,
};

export const searchThreadsThunk = createAsyncThunk(
  'search/threads',
  async (query, { rejectWithValue }) => {
    try {
      return await searchThreads(query);
    } catch (err) {
      return rejectWithValue(handleApiError(err));
    }
  }
);

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    clearSearch: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchThreadsThunk.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.query = action.meta.arg;
      })
      .addCase(searchThreadsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.results = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(searchThreadsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSearch } = searchSlice.actions;
export default searchSlice.reducer;
