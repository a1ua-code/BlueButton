// Creates server/.env from server/.env.example the first time you run `npm run setup`.
// Works the same on Windows, macOS and Linux. Never overwrites an existing .env.
import { copyFileSync, existsSync } from "node:fs";

const target = "server/.env";
const example = "server/.env.example";

if (existsSync(target)) {
  console.log(`${target} already exists - leaving it alone.`);
} else {
  copyFileSync(example, target);
  console.log(`Created ${target} from ${example}.`);
}
