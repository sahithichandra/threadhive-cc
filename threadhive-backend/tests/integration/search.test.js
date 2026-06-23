import { beforeEach, beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import "../setup.js";
import app from "../../src/app.js";
import Thread from "../../src/models/Thread.js";
import Subreddit from "../../src/models/Subreddit.js";

let user;

async function createUserAndLogin() {
  const email = `search+${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "password123";

  const userRes = await request(app)
    .post("/api/auth/register")
    .send({ name: "Search User", email, password });
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return { user: userRes.body.data, token: loginRes.body.data.token };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  user = await createUserAndLogin();
});

describe("Search API", () => {
  let subreddit;

  beforeEach(async () => {
    await Promise.all([Thread.deleteMany({}), Subreddit.deleteMany({})]);
    subreddit = await Subreddit.create({
      name: "test-subreddit-search",
      description: "Subreddit for search tests",
      author: user.user._id,
    });
  });

  const makeThread = (title, content) =>
    Thread.create({
      title,
      content,
      author: user.user._id,
      subreddit: subreddit._id,
    });

  it("matches the query in the title", async () => {
    await makeThread("Learning React", "A guide");
    await makeThread("Python basics", "Snakes");

    const res = await request(app)
      .get("/api/search/threads?q=react")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("Learning React");
  });

  it("matches the query in the content", async () => {
    await makeThread("Random", "All about hooks and state");

    const res = await request(app)
      .get("/api/search/threads?q=hooks")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.body.data).toHaveLength(1);
  });

  it("is case-insensitive and matches substrings", async () => {
    await makeThread("JavaScript Tips", "Useful stuff");

    const res = await request(app)
      .get("/api/search/threads?q=script")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("JavaScript Tips");
  });

  it("returns an empty array when nothing matches", async () => {
    await makeThread("React", "Content");

    const res = await request(app)
      .get("/api/search/threads?q=nomatchxyz")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("populates author and subreddit and sorts newest-first", async () => {
    await makeThread("React one", "x");
    await delay(10);
    await makeThread("React two", "y");

    const res = await request(app)
      .get("/api/search/threads?q=react")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].title).toBe("React two"); // most recent first
    expect(res.body.data[0].author).toHaveProperty("name");
    expect(res.body.data[0].subreddit).toHaveProperty("name");
  });

  it("returns 400 for a blank or missing query", async () => {
    const missing = await request(app)
      .get("/api/search/threads")
      .set("Authorization", `Bearer ${user.token}`);
    expect(missing.status).toBe(400);

    const blank = await request(app)
      .get("/api/search/threads?q=%20%20")
      .set("Authorization", `Bearer ${user.token}`);
    expect(blank.status).toBe(400);
  });

  it("treats regex metacharacters literally (no error)", async () => {
    await makeThread("C++ guide", "for beginners");

    const res = await request(app)
      .get("/api/search/threads?q=" + encodeURIComponent("c++"))
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/search/threads?q=react");
    expect(res.status).toBe(401);
  });

  it("caps the number of results at the configured limit", async () => {
    for (let i = 0; i < 55; i++) {
      await makeThread(`React item ${i}`, "content");
    }

    const res = await request(app)
      .get("/api/search/threads?q=react")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.body.data).toHaveLength(50);
  });
});
