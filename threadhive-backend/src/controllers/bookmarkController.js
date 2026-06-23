import {
  createBookmark,
  removeBookmark,
  fetchUserBookmarks,
} from "../services/bookmarkService.js";
import { createAppError } from "../utils/createAppError.js";

// mongoose.Types.ObjectId.isValid() also accepts any 12-character string, which
// would let a malformed id fall through to a 404. Require a real 24-char hex id.
const assertValidThreadId = (threadId) => {
  if (typeof threadId !== "string" || !/^[a-f\d]{24}$/i.test(threadId)) {
    throw createAppError("Invalid thread id", 400);
  }
};

// POST /api/bookmarks/:threadId
export const saveBookmark = async (req, res) => {
  const { threadId } = req.params;
  assertValidThreadId(threadId);

  const { bookmark, created } = await createBookmark(req.user.userId, threadId);

  res.status(created ? 201 : 200).json({
    success: true,
    message: created ? "Thread saved" : "Thread already saved",
    data: bookmark,
  });
};

// DELETE /api/bookmarks/:threadId
export const deleteBookmark = async (req, res) => {
  const { threadId } = req.params;
  assertValidThreadId(threadId);

  await removeBookmark(req.user.userId, threadId);

  res.status(200).json({
    success: true,
    message: "Thread unsaved",
    data: { thread: threadId },
  });
};

// GET /api/bookmarks
export const getBookmarks = async (req, res) => {
  const threads = await fetchUserBookmarks(req.user.userId);

  res.status(200).json({
    success: true,
    message: "Bookmarks fetched successfully",
    data: threads,
  });
};
