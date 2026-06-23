import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchThreads } from "../../../src/controllers/searchController.js";
import * as searchService from "../../../src/services/searchService.js";

vi.mock("../../../src/services/searchService.js");

describe("searchController", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { query: {}, user: { userId: "user123" } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("returns 200 with results for a valid query", async () => {
    req.query.q = "react";
    const results = [{ _id: "t1" }];
    searchService.searchThreads = vi.fn().mockResolvedValue(results);

    await searchThreads(req, res);

    expect(searchService.searchThreads).toHaveBeenCalledWith("react");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Search results",
      data: results,
    });
  });

  it("trims the query before searching", async () => {
    req.query.q = "  react  ";
    searchService.searchThreads = vi.fn().mockResolvedValue([]);

    await searchThreads(req, res);

    expect(searchService.searchThreads).toHaveBeenCalledWith("react");
  });

  it("throws 400 when q is missing", async () => {
    searchService.searchThreads = vi.fn();

    await expect(searchThreads(req, res)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(searchService.searchThreads).not.toHaveBeenCalled();
  });

  it("throws 400 when q is blank/whitespace", async () => {
    req.query.q = "   ";
    searchService.searchThreads = vi.fn();

    await expect(searchThreads(req, res)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(searchService.searchThreads).not.toHaveBeenCalled();
  });
});
