# Working together on B&B

Short rules so four people can work in parallel without breaking each other's code.

## Git workflow

1. **Never commit directly to `main`.** Start every task on a new branch:
   ```bash
   git checkout main
   git pull
   git checkout -b c/bookmarks        # <your letter>/<short-name>
   ```
2. Commit small steps with clear messages: `git commit -m "Add bookmark button to party card"`.
3. Push and open a Pull Request on GitHub:
   ```bash
   git push -u origin c/bookmarks
   ```
4. Ask **one teammate from another area** to review. Merge with "Squash and merge" when approved.
5. After merging (or pulling someone else's work): `npm install` and `npm run db:migrate`.

## Before you open a Pull Request

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] You tried your feature in the browser, on a narrow (phone) window too
- [ ] The PR description lists the SRS requirement IDs it covers (e.g. "FR-74, FR-75")
- [ ] Database change? The new files in `server/drizzle/` are included

## Rules that keep us independent

- **Stay in your folders** (see the ownership table in README.md). Need a change in someone else's module? Ask them, or open a small PR and tag them.
- **Talk through functions and events, not tables.** If chat needs to know whether someone is a member, it calls `isMember()` from participation; it does not query `party_members` itself.
- **Use the shared UI kit** (`client/src/components/ui`). Don't style your own buttons or cards. If a component is missing, add it to the kit so everyone gets it.
- **Validate on the server.** Client checks are for convenience; the server must reject bad input with `parse(schema, req.body)`.
- **Never commit secrets.** API keys go in `server/.env` (ignored by git). Add the variable name, without the value, to `server/.env.example`.

## Code style

- Prettier formats the code: run `npm run format` (or enable "Format on save" in VS Code).
- TypeScript everywhere; avoid `any`.
- Names: `camelCase` for variables/functions, `PascalCase` for components and types.
- Write user-facing text in plain English; keep shared wording in `client/src/lib/constants.ts`.
