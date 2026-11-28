// Optional daily maintenance task for production scheduling (never delete unexpired metadata).
import { pool } from "../src/db";
import { pruneExpiredVideoMetadata } from "../src/modules/videos/service";

try {
  await pruneExpiredVideoMetadata();
  console.log("Expired YouTube video metadata pruned (older than 30 days).");
} finally {
  await pool.end();
}
