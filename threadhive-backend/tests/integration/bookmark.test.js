import { beforeEach, beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
// Import setup to initialize MongoDB
import "../setup.js";
import app from "../../src/app.js";
import Thread from "../../src/models/Thread.js";
import Subreddit from "../../src/models/Subreddit.js";
import Bookmark from "../../src/models/Bookmark.js";

const FAKE_ID = "507f1f77bcf86cd799439011"; // valid ObjectId, never created

let userA;
let userB;

async function createUserAndLogin() {
  const email = `bookmark+${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "password123";

  const userRes = await request(app)
    .post("/api/auth/register")
    .send({ name: "Bookmark User", email, password });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return {
    user: userRes.body.data,
    token: loginRes.body.data.token,
  };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  userA = await createUserAndLogin();
  userB = await createUserAndLogin();
});

describe("Bookmarks API", () => {
  let subreddit;
  let thread;

  beforeEach(async () => {
    await Promise.all([
      Bookmark.deleteMany({}),
      Thread.deleteMany({}),
      Subreddit.deleteMany({}),
    ]);

    subreddit = await Subreddit.create({
      name: "test-subreddit-bookmarks",
      description: "Subreddit for bookmark tests",
      author: userA.user._id,
    });

    thread = await Thread.create({
      title: "Bookmarkable thread",
      content: "Save me",
      author: userA.user._id,
      subreddit: subreddit._id,
    });
  });

  // AC1 + AC2
  it("saves a thread (201), is idempotent on repeat (200), and lists exactly one", async () => {
    const first = await request(app)
      .post(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);
    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(first.body.message).toBe("Thread saved");

    const second = await request(app)
      .post(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);
    expect(second.status).toBe(200);
    expect(second.body.message).toBe("Thread already saved");

    const list = await request(app)
      .get("/api/bookmarks")
      .set("Authorization", `Bearer ${userA.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]._id).toBe(thread._id.toString());
  });

  // AC4
  it("returns saved threads populated and newest-saved first", async () => {
    const thread2 = await Thread.create({
      title: "Second thread",
      content: "Also save me",
      author: userA.user._id,
      subreddit: subreddit._id,
    });

    await request(app)
      .post(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);
    await delay(10); // ensure distinct createdAt ordering
    await request(app)
      .post(`/api/bookmarks/${thread2._id}`)
      .set("Authorization", `Bearer ${userA.token}`);

    const list = await request(app)
      .get("/api/bookmarks")
      .set("Authorization", `Bearer ${userA.token}`);

    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0]._id).toBe(thread2._id.toString()); // most recent first
    expect(list.body.data[0].author).toHaveProperty("name");
    expect(list.body.data[0].subreddit).toHaveProperty("name");
  });

  // AC3
  it("unsaves a thread (200) so it no longer appears in the list", async () => {
    await request(app)
      .post(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);

    const del = await request(app)
      .delete(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);
    expect(del.status).toBe(200);
    expect(del.body.message).toBe("Thread unsaved");

    const list = await request(app)
      .get("/api/bookmarks")
      .set("Authorization", `Bearer ${userA.token}`);
    expect(list.body.data).toHaveLength(0);
  });

  // AC3 (idempotent delete)
  it("unsave is idempotent when nothing was saved", async () => {
    const del = await request(app)
      .delete(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);
    expect(del.status).toBe(200);
  });

  // AC5
  it("requires authentication on every endpoint", async () => {
    const get = await request(app).get("/api/bookmarks");
    const post = await request(app).post(`/api/bookmarks/${thread._id}`);
    const del = await request(app).delete(`/api/bookmarks/${thread._id}`);

    expect(get.status).toBe(401);
    expect(post.status).toBe(401);
    expect(del.status).toBe(401);
  });

  // AC6
  it("returns 400 for an invalid thread id and 404 for a missing thread", async () => {
    const invalid = await request(app)
      .post("/api/bookmarks/not-an-id")
      .set("Authorization", `Bearer ${userA.token}`);
    expect(invalid.status).toBe(400);

    // A 12-char non-hex string passes mongoose's loose isValid but must be rejected.
    const twelveChars = await request(app)
      .post("/api/bookmarks/threadIDxyz1")
      .set("Authorization", `Bearer ${userA.token}`);
    expect(twelveChars.status).toBe(400);

    const missing = await request(app)
      .post(`/api/bookmarks/${FAKE_ID}`)
      .set("Authorization", `Bearer ${userA.token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Thread not found");
  });

  // Isolation
  it("only returns the requesting user's bookmarks", async () => {
    await request(app)
      .post(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);

    const listB = await request(app)
      .get("/api/bookmarks")
      .set("Authorization", `Bearer ${userB.token}`);

    expect(listB.status).toBe(200);
    expect(listB.body.data).toHaveLength(0);
  });

  // AC9
  it("omits bookmarks whose thread was deleted", async () => {
    await request(app)
      .post(`/api/bookmarks/${thread._id}`)
      .set("Authorization", `Bearer ${userA.token}`);

    await Thread.findByIdAndDelete(thread._id);

    const list = await request(app)
      .get("/api/bookmarks")
      .set("Authorization", `Bearer ${userA.token}`);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);
  });
});
