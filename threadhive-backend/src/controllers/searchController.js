import { searchThreads as searchThreadsService } from "../services/searchService.js";
import { createAppError } from "../utils/createAppError.js";

// GET /api/search/threads?q=<query>
export const searchThreads = async (req, res) => {
  // Coerce to a string: a repeated ?q=a&q=b makes req.query.q an array.
  const q = String(req.query.q ?? "").trim();

  if (!q) {
    throw createAppError("Search query is required", 400);
  }

  const results = await searchThreadsService(q);

  res.status(200).json({
    success: true,
    message: "Search results",
    data: results,
  });
};
