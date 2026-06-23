import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveBookmark,
  deleteBookmark,
  getBookmarks,
} from "../../../src/controllers/bookmarkController.js";
import * as bookmarkService from "../../../src/services/bookmarkService.js";

// Mock the bookmark service
vi.mock("../../../src/services/bookmarkService.js");

const VALID_ID = "507f1f77bcf86cd799439011";

describe("bookmarkController", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      user: { userId: "user123" },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe("saveBookmark", () => {
    it("responds 201 when a bookmark is newly created", async () => {
      req.params.threadId = VALID_ID;
      const bookmark = { _id: "bm1", user: "user123", thread: VALID_ID };
      bookmarkService.createBookmark = vi
        .fn()
        .mockResolvedValue({ bookmark, created: true });

      await saveBookmark(req, res);

      expect(bookmarkService.createBookmark).toHaveBeenCalledWith("user123", VALID_ID);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Thread saved",
        data: bookmark,
      });
    });

    it("responds 200 when the thread was already saved", async () => {
      req.params.threadId = VALID_ID;
      const bookmark = { _id: "bm1", user: "user123", thread: VALID_ID };
      bookmarkService.createBookmark = vi
        .fn()
        .mockResolvedValue({ bookmark, created: false });

      await saveBookmark(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Thread already saved",
        data: bookmark,
      });
    });

    it("throws 400 for an invalid thread id", async () => {
      req.params.threadId = "not-an-id";

      await expect(saveBookmark(req, res)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(bookmarkService.createBookmark).not.toHaveBeenCalled();
    });

    it("propagates 404 from the service", async () => {
      req.params.threadId = VALID_ID;
      const error = new Error("Thread not found");
      error.statusCode = 404;
      bookmarkService.createBookmark = vi.fn().mockRejectedValue(error);

      await expect(saveBookmark(req, res)).rejects.toMatchObject({
        message: "Thread not found",
        statusCode: 404,
      });
    });
  });

  describe("deleteBookmark", () => {
    it("responds 200 with the thread id", async () => {
      req.params.threadId = VALID_ID;
      bookmarkService.removeBookmark = vi.fn().mockResolvedValue({ removed: true });

      await deleteBookmark(req, res);

      expect(bookmarkService.removeBookmark).toHaveBeenCalledWith("user123", VALID_ID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Thread unsaved",
        data: { thread: VALID_ID },
      });
    });

    it("throws 400 for an invalid thread id", async () => {
      req.params.threadId = "not-an-id";

      await expect(deleteBookmark(req, res)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(bookmarkService.removeBookmark).not.toHaveBeenCalled();
    });
  });

  describe("getBookmarks", () => {
    it("responds 200 with the saved threads", async () => {
      const threads = [{ _id: "t1" }, { _id: "t2" }];
      bookmarkService.fetchUserBookmarks = vi.fn().mockResolvedValue(threads);

      await getBookmarks(req, res);

      expect(bookmarkService.fetchUserBookmarks).toHaveBeenCalledWith("user123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Bookmarks fetched successfully",
        data: threads,
      });
    });
  });
});
