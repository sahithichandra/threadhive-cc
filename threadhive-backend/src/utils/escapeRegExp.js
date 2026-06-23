// Escape regex metacharacters so user input is matched literally.
// Prevents invalid-regex errors and catastrophic backtracking (ReDoS).
export const escapeRegExp = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
