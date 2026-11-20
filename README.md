# B&B (BlueButton)

A web service for finding people to play board games with: create a party, let others join, chat, and split costs.
KAIST CS350 team project. Requirements: see the SRS; design: see the SDD.

**Stack:** React + TypeScript + Tailwind (client) · Node.js + Express + TypeScript (server) · PostgreSQL + Drizzle ORM (database) · Socket.IO (live chat).
Everything is free and open source.

---

## 1. First-time setup (about 10 minutes)

You need two free programs installed:

| Program                       | Why                                  | Download                                       |
| ----------------------------- | ------------------------------------ | ---------------------------------------------- |
| **Node.js 20 or newer** (LTS) | runs the code                        | https://nodejs.org                             |
| **Docker Desktop**            | runs the PostgreSQL database for you | https://www.docker.com/products/docker-desktop |

Check they work: open a terminal (on Windows: _PowerShell_ or the VS Code terminal) and run `node -v` and `docker -v`.

Then, in the project folder:

```bash
npm install        # downloads all libraries (first time takes a minute)
npm run setup      # creates server/.env, starts the database, creates tables, adds sample data
npm run dev        # starts the app
```

Open **http://localhost:5173** in your browser. Done! 🎲

**Test accounts** (password `password123` for all):
`alice@kaist.ac.kr`, `bob@kaist.ac.kr`, `chris@kaist.ac.kr`, and `admin@bluebutton.dev` (admin).
The party "Wingspan Pro" has the party password `1234`.

> **No Docker?** Install PostgreSQL directly (https://www.postgresql.org/download/), create a database,
> and put its address in `server/.env` as `DATABASE_URL` (usually port 5432). Then run
> `npm run db:migrate` and `npm run db:seed` instead of `npm run setup`.

## 2. Everyday commands

Run these from the project root folder.

| Command                       | What it does                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`                 | Start the app (client on :5173, server on :4000). Code changes reload automatically.      |
| `npm run db:up`               | Start the database (Docker Desktop must be open). Do this after restarting your computer. |
| `npm run db:migrate`          | Apply new database changes. **Run after every `git pull`.**                               |
| `npm run db:seed`             | Reset all data to the sample data.                                                        |
| `npm run db:reset`            | Wipe the database completely and rebuild it. Use when things are badly broken.            |
| `npm run db:studio`           | Look at and edit the data in your browser.                                                |
| `npm run typecheck`           | Check the whole project for type errors.                                                  |
| `npm test`                    | Run the unit tests.                                                                       |
| `npm run test:race -w server` | Check that 30 simultaneous joins never overbook a party.                                  |
| `npm run format`              | Auto-format all code with Prettier.                                                       |

## 3. How the project is organised

```
BlueButton/
├── client/                    React app (what you see in the browser)
│   └── src/
│       ├── api/               functions that call the server - one file per area
│       ├── auth/              who is logged in (useAuth, RequireAuth)
│       ├── components/
│       │   ├── ui/            ★ shared UI kit: Button, Card, TextField, StatusBadge, ConfirmDialog, Toast...
│       │   ├── layout/        top bar + phone bottom bar
│       │   └── party/         PartyCard (used on several pages)
│       ├── lib/               date formatting, shared labels
│       ├── pages/             one file per page
│       └── App.tsx            list of all pages (routes)
├── server/                    API server
│   ├── drizzle/               database migrations (generated - commit them, don't edit)
│   ├── scripts/               extra checks (join race test)
│   └── src/
│       ├── db/                ★ schema.ts (all tables), seed.ts (sample data)
│       ├── modules/           one folder per feature area - see the ownership table
│       ├── middleware/        login checks (requireUser, requireAdmin), error handling
│       ├── lib/               helpers: errors, input validation
│       ├── events.ts          how modules notify each other ("member.joined" ...)
│       └── app.ts             where every module's routes are plugged in
└── docker-compose.yml         the local database
```

### Who owns what

Each person owns their folders end to end (database tables, server code, pages). Only edit someone else's files after talking to them.

|         | Area                         | Server (`server/src/modules/`)      | Client (`client/src/`)                                                 | SRS                           |
| ------- | ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------- | ----------------------------- |
| **A**   | Accounts, admin, stats       | `auth/`, `admin/` (+ `middleware/`) | `pages/Login`, `Register`, `Admin`, `auth/`, `components/layout/`      | FR-01-26, 80, 103, 135-146    |
| **B**   | Hosting parties, map, videos | `parties/`                          | `pages/CreateParty`, host controls in `PartyDetail`                    | FR-27-39, 54, 61-70, 123-134  |
| **C**   | Finding & joining parties    | `participation/`                    | `pages/PartyList`, `PartyDetail`, `MyParties`, `components/party/`     | FR-40-53, 55-60, 71-79, 81-86 |
| **D**   | Chat, settlements, help      | `chat/`, `settlements/`             | `pages/ChatPage`, `api/chat.ts`                                        | FR-87-122, 147-149            |
| **All** | Shared UI kit                | –                                   | `components/ui/` (ask the group before changing how a component looks) | IR-01-36                      |

Search the code for `TODO (A)`, `TODO (B)`, ... to find your next tasks. Pages that don't exist yet show a "🚧 not built yet" placeholder (`client/src/pages/placeholders.tsx`), and planned API routes answer `501 Not implemented`.

## 4. What already works

- Sign up (with 14+ and terms checkboxes), log in, log out, account lock after 5 wrong passwords
- Party list with search and filters, party detail page, guest browsing
- Create a party in 3 steps with validation, optional party password
- Join with confirmation dialog, password check, **no overbooking even with simultaneous joins**, leave
- Party status rules: Recruiting ⇄ Full automatically, host can Close/Reopen and Cancel
- My Parties (upcoming / past)
- Real-time chat for members only, with system messages ("Bob joined the party")
- Admin page with user list and counts
- Cost-splitting calculation (with unit tests), ready for the settlements feature

## 5. How-to recipes

### Add a database column or table

1. Edit `server/src/db/schema.ts`.
2. `npm run db:generate -w server` → creates a new SQL file in `server/drizzle/`.
3. `npm run db:migrate` → applies it to your database.
4. Commit `schema.ts` **and** the new `drizzle/` files together. Teammates run `npm run db:migrate` after pulling.

### Add an API endpoint

In your module's `routes.ts` (copy an existing route):

```ts
router.post("/:id/bookmark", requireUser, async (req, res) => {
  const body = parse(mySchema, req.body); // validate input (zod)
  const result = await myService(param(req, "id"), currentUser(req));
  res.json(result);
});
```

Put the logic in `service.ts`; throw `notFound()`, `forbidden()`, `conflict(...)` from `lib/errors.ts` for errors. Then add a matching function in `client/src/api/`.

### Add a page

1. Create `client/src/pages/MyPage.tsx` using components from `components/ui`.
2. Add a `<Route>` in `client/src/App.tsx` (wrap in `<RequireAuth>` if login is required).
3. Add it to `NAV_ITEMS` in `components/layout/AppLayout.tsx` if it belongs in the menu.

### React to something another module does

Listen to an event instead of editing their code (see `server/src/events.ts`):

```ts
events.on("member.joined", async ({ partyId, nickname }) => {
  /* send an email, update stats... */
});
```

## 6. Troubleshooting

| Problem                                                    | Fix                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Could not start the server ... Is the database running?`  | Open Docker Desktop, then `npm run db:up`.                                                       |
| `relation "..." does not exist`                            | `npm run db:migrate`                                                                             |
| Port 5173 / 4000 / 5433 already in use                     | Close the other terminal running the app, or restart your computer.                              |
| Login works but pages act strange after switching branches | `npm run db:reset`                                                                               |
| `npm install` errors                                       | Delete `node_modules` and `package-lock.json`, then `npm install` again. Check `node -v` is 20+. |

## Learning links

- React: https://react.dev/learn · Tailwind classes: https://tailwindcss.com/docs
- Express: https://expressjs.com · Drizzle ORM: https://orm.drizzle.team/docs/overview
- Socket.IO: https://socket.io/docs/v4/ · TanStack Query: https://tanstack.com/query/latest/docs
