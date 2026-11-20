// Reads settings from server/.env. Import `config` instead of using process.env directly.
import "dotenv/config";

export const config = {
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://bluebutton:bluebutton@localhost:5433/bluebutton",
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",

  /** How long a login lasts. */
  sessionDays: 7,
  /** FR-19: lock an account after this many wrong passwords in a row ... */
  maxFailedLogins: 5,
  /** ... for this many minutes. */
  lockMinutes: 15,
  /** FR-93 (TBD in the SRS, decision D3 in the SDD): chat becomes read-only this long after start. */
  chatLockHours: 24,
  /** Display time zone (NFR-10). */
  timeZone: "Asia/Seoul",
};
