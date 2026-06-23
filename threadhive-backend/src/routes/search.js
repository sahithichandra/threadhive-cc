import express from "express";
import authHandler from "../middleware/authHandler.js";
import { searchThreads } from "../controllers/searchController.js";

const router = express.Router();

router.get("/threads", authHandler, searchThreads);

export default router;
