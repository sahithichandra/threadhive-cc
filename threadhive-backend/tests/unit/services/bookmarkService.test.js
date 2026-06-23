import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createBookmark,
  removeBookmark,
} from "../../../src/services/bookmarkService.js";
import Bookmark from "../../../src/models/Bookmark.js";
import Thread from "../../../src/models/Thread.js";

// Mock the models
vi.mock("../../../src/models/Bookmark.js");
vi.mock("../../../src/models/Thread.js");

describe("bookmarkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBookmark", () => {
    it("creates a bookmark when none exists", async () => {
      Thread.findById = vi.fn().mockResolvedValue({ _id: "thread123" });
      Bookmark.findOne = vi.fn().mockResolvedValue(null);
      const created = { _id: "bm1", user: "user123", thread: "thread123" };
      Bookmark.create = vi.fn().mockResolvedValue(created);

      const result = await createBookmark("user123", "thread123");

      expect(Bookmark.create).toHaveBeenCalledWith({
        user: "user123",
        thread: "thread123",
      });
      expect(result).toEqual({ bookmark: created, created: true });
    });

    it("is idempotent when the thread is already saved", async () => {
      Thread.findById = vi.fn().mockResolvedValue({ _id: "thread123" });
      const existing = { _id: "bm1", user: "user123", thread: "thread123" };
      Bookmark.findOne = vi.fn().mockResolvedValue(existing);
      Bookmark.create = vi.fn();

      const result = await createBookmark("user123", "thread123");

      expect(Bookmark.create).not.toHaveBeenCalled();
      expect(result).toEqual({ bookmark: existing, created: false });
    });

    it("throws 404 when the thread does not exist", async () => {
      Thread.findById = vi.fn().mockResolvedValue(null);

      await expect(createBookmark("user123", "missing")).rejects.toMatchObject({
        message: "Thread not found",
        statusCode: 404,
      });
    });

    it("treats a duplicate-key race as already saved", async () => {
      Thread.findById = vi.fn().mockResolvedValue({ _id: "thread123" });
      const existing = { _id: "bm1", user: "user123", thread: "thread123" };
      // First findOne (pre-check) misses, create races and fails, second findOne hits.
      Bookmark.findOne = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      Bookmark.create = vi.fn().mockRejectedValue({ code: 11000 });

      const result = await createBookmark("user123", "thread123");

      expect(result).toEqual({ bookmark: existing, created: false });
    });
  });

  describe("removeBookmark", () => {
    it("reports removed=true when a bookmark was deleted", async () => {
      Bookmark.findOneAndDelete = vi.fn().mockResolvedValue({ _id: "bm1" });

      const result = await removeBookmark("user123", "thread123");

      expect(Bookmark.findOneAndDelete).toHaveBeenCalledWith({
        user: "user123",
        thread: "thread123",
      });
      expect(result).toEqual({ removed: true });
    });

    it("is idempotent when nothing was saved", async () => {
      Bookmark.findOneAndDelete = vi.fn().mockResolvedValue(null);

      const result = await removeBookmark("user123", "thread123");

      expect(result).toEqual({ removed: false });
    });
  });
});
