import express from "express";
import authHandler from "../middleware/authHandler.js";
import {
  saveBookmark,
  deleteBookmark,
  getBookmarks,
} from "../controllers/bookmarkController.js";

const router = express.Router();

router.get("/", authHandler, getBookmarks);
router.post("/:threadId", authHandler, saveBookmark);
router.delete("/:threadId", authHandler, deleteBookmark);

export default router;
