import Bookmark from "../models/Bookmark.js";
import Thread from "../models/Thread.js";
import { createAppError } from "../utils/createAppError.js";

// Save a thread for a user. Idempotent: saving an already-saved thread
// returns the existing bookmark instead of erroring.
export const createBookmark = async (userId, threadId) => {
  const thread = await Thread.findById(threadId);
  if (!thread) {
    throw createAppError("Thread not found", 404);
  }

  const existing = await Bookmark.findOne({ user: userId, thread: threadId });
  if (existing) {
    return { bookmark: existing, created: false };
  }

  try {
    const bookmark = await Bookmark.create({ user: userId, thread: threadId });
    return { bookmark, created: true };
  } catch (err) {
    // Race: the unique { user, thread } index rejected a concurrent duplicate.
    if (err && err.code === 11000) {
      const bookmark = await Bookmark.findOne({ user: userId, thread: threadId });
      return { bookmark, created: false };
    }
    throw err;
  }
};

// Unsave a thread. Idempotent: succeeds even if nothing was saved.
export const removeBookmark = async (userId, threadId) => {
  const removed = await Bookmark.findOneAndDelete({
    user: userId,
    thread: threadId,
  });
  return { removed: !!removed };
};

// Return the threads a user has saved, newest-saved first, fully populated.
// Bookmarks whose thread was deleted are filtered out.
export const fetchUserBookmarks = async (userId) => {
  const bookmarks = await Bookmark.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "thread",
      populate: [{ path: "author" }, { path: "subreddit" }],
    });

  return bookmarks.map((b) => b.thread).filter((thread) => thread != null);
};
