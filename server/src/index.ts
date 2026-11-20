// Entry point: starts the HTTP server (REST API + Socket.IO chat on the same port).
import { createServer } from "node:http";
import { createApp } from "./app";
import { config } from "./config";
import { pool } from "./db";
import { initChatSocket } from "./modules/chat/socket";

async function main() {
  await pool.query("SELECT 1"); // fail fast with a clear message if the database is not running

  const httpServer = createServer(createApp());
  initChatSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`API ready on http://localhost:${config.port}  (health check: /api/health)`);
  });
}

main().catch((err) => {
  console.error("\nCould not start the server.");
  console.error("Is the database running? Try `npm run db:up` from the project root.\n");
  console.error(err);
  process.exit(1);
});
