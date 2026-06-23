import mongoose from "mongoose";

const BookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Thread",
      required: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate saves and speed up per-user / "is this saved?" lookups.
BookmarkSchema.index({ user: 1, thread: 1 }, { unique: true });

const Bookmark = mongoose.model("Bookmark", BookmarkSchema);

export default Bookmark;
