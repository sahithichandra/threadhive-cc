import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  searchThreads,
  SEARCH_RESULT_LIMIT,
} from "../../../src/services/searchService.js";
import Thread from "../../../src/models/Thread.js";

vi.mock("../../../src/models/Thread.js");

describe("searchService", () => {
  let queryChain;

  beforeEach(() => {
    vi.clearAllMocks();
    queryChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ _id: "t1" }]),
    };
    Thread.find = vi.fn().mockReturnValue(queryChain);
  });

  it("searches title and content with a case-insensitive regex", async () => {
    await searchThreads("react");

    const filter = Thread.find.mock.calls[0][0];
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].title).toBeInstanceOf(RegExp);
    expect(filter.$or[1].content).toBeInstanceOf(RegExp);
    expect(filter.$or[0].title.flags).toContain("i");
  });

  it("escapes regex metacharacters in the query", async () => {
    await searchThreads("a.b");
    const filter = Thread.find.mock.calls[0][0];
    expect(filter.$or[0].title.source).toBe("a\\.b");
  });

  it("trims the query before building the pattern", async () => {
    await searchThreads("  hi  ");
    const filter = Thread.find.mock.calls[0][0];
    expect(filter.$or[0].title.source).toBe("hi");
  });

  it("sorts newest-first and caps the result count", async () => {
    const result = await searchThreads("react");
    expect(queryChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(queryChain.limit).toHaveBeenCalledWith(SEARCH_RESULT_LIMIT);
    expect(result).toEqual([{ _id: "t1" }]);
  });
});
