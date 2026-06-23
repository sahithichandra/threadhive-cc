import Thread from "../models/Thread.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";

// Cap the result set so a broad query can't return an unbounded payload.
export const SEARCH_RESULT_LIMIT = 50;

// Case-insensitive substring search over thread title and content.
// The query is escaped so regex metacharacters are treated literally.
export const searchThreads = async (query) => {
  const regex = new RegExp(escapeRegExp(query.trim()), "i");

  return Thread.find({ $or: [{ title: regex }, { content: regex }] })
    .populate({ path: "author" })
    .populate({ path: "subreddit" })
    .sort({ createdAt: -1 })
    .limit(SEARCH_RESULT_LIMIT);
};
