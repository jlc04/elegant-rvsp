# EleganteRSVP on Cloudflare Pages + D1

This is a real, working RSVP app: multiple events, a drag-and-drop
questionnaire builder, a live dashboard, shareable guest links, email-gated
dashboard sharing, and an optional Google Sheets mirror — backed by a real
database (Cloudflare D1), not local browser storage. That's the fix for the
bug you hit: responses now write to one shared database that every visitor
reads from, instead of each browser's own local copy.

---

## What's in this folder

```
index.html                          <- the whole app (one file, no build step)
functions/api/events/index.js       <- list + create events
functions/api/events/[slug].js      <- get / update / delete one event
functions/api/events/[slug]/responses.js   <- list + submit RSVP responses
functions/api/events/[slug]/access.js      <- manage dashboard-access emails
functions/lib/sheets.js             <- Google Sheets mirror (optional)
functions/lib/util.js               <- small shared helpers
schema.sql                          <- the database structure
wrangler.toml                       <- local dev config
```

Cloudflare Pages Functions turn the `functions/` folder into an API
automatically — no separate backend to run.

---

## 1. Prerequisites

- A free Cloudflare account: https://dash.cloudflare.com/sign-up
- Node.js installed (18+): https://nodejs.org
- A terminal

Install Wrangler, Cloudflare's CLI, and log in:

```bash
npm install -g wrangler
wrangler login
```

A browser tab opens — approve access, then come back to the terminal.

---

## 2. Create the database

```bash
cd elegantrsvp-cloudflare        # this folder
wrangler d1 create elegantrsvp-db
```

This prints something like:

```
[[d1_databases]]
binding = "DB"
database_name = "elegantrsvp-db"
database_id = "a1b2c3d4-...."
```

Copy that `database_id` value into `wrangler.toml` in this folder, replacing
`REPLACE_WITH_YOUR_DATABASE_ID`.

Now create the tables:

```bash
wrangler d1 execute elegantrsvp-db --file=./schema.sql --remote
```

(`--remote` runs it against the real cloud database — you'll also want a
local copy for testing, see step 3.)

---

## 3. Run it locally first

```bash
wrangler d1 execute elegantrsvp-db --file=./schema.sql --local
wrangler pages dev . --d1=DB=elegantrsvp-db
```

Open the URL it prints (usually `http://localhost:8788`). You should see
an empty "Your events" screen. Click **+ New Event**, fill in the Details
tab, build a few questions, hit **Publish**, then **Preview** to see the
guest view. Submit a test RSVP, go back to the **Dashboard** tab, and it
should show up — that's the local database working end to end before you
deploy anything.

---

## 4. Deploy to Cloudflare Pages

The easiest path is connecting a GitHub repo, so future edits just need a
`git push`:

1. Push this folder to a new GitHub repository.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
   Connect to Git** → pick the repo.
3. Build settings: leave the build command **empty** and set the output
   directory to `/` (this is a static file + Functions, nothing to build).
4. Deploy.
5. Go to your new Pages project → **Settings → Functions → D1 database
   bindings** → add a binding named `DB` pointing at `elegantrsvp-db`.
   (This is the same binding as `wrangler.toml`, but the live site needs
   it configured in the dashboard too.)
6. Redeploy once (Settings → Deployments → Retry deployment) so the new
   binding takes effect.

No Git? You can also deploy directly:

```bash
wrangler pages deploy .
```

Either way, you'll get a `https://elegantrsvp.pages.dev` URL. You can
attach a custom domain later under **Custom domains** in the Pages
project settings.

---

## 5. Using it

- **Home** (`https://your-site.pages.dev/`) — your events list. Anyone who
  has this URL can create/edit/delete events, since there's no login yet
  (see "Security" below).
- **Editing an event** — `?event=<slug>`. Details / Theme / Questionnaire
  tabs, **Save Draft** vs **Publish**, and **Preview** to see exactly what
  a guest will see.
- **Guest link** — from the **Share** tab, or `?guest=<slug>` directly.
  This is the link you actually send to guests. It only shows the
  invitation once the event is **Published**.
- **Dashboard-access link** — also from **Share**, `?dash=<slug>`. Add an
  email under "Dashboard Access" first, then send that person the link —
  they type their email and see a read-only dashboard (no editing).

Each event has its own slug, so each event really does get its own guest
link, exactly as you asked — a wedding and a birthday party hosted on the
same site get two different links, two different dashboards.

---

## 6. Connecting Google Sheets (optional)

This mirrors every new RSVP into a Google Sheet as it comes in.

1. In Google Cloud Console, create a project (or use an existing one):
   https://console.cloud.google.com
2. Enable the **Google Sheets API** for that project.
3. Create a **Service Account** (IAM & Admin → Service Accounts → Create),
   then create a JSON key for it and download the file.
4. Open the JSON file, copy its entire contents.
5. Set it as a secret on your Pages project:
   ```bash
   wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_JSON
   ```
   Paste the full JSON when prompted.
6. Create a Google Sheet, then **share it** with the service account's
   email address (it looks like
   `something@your-project.iam.gserviceaccount.com` — find it in the JSON
   as `client_email`), giving it **Editor** access.
7. Copy the Sheet's ID from its URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
8. In the app, open the event's **Share** tab → paste it into
   **Google Sheet ID** → **Save Sheet ID**.

From then on, every submitted RSVP also appends a row to that sheet. If
the sync fails for any reason, it fails silently in the background — it
will never block or break someone's RSVP.

---

## 7. Security, honestly

This MVP intentionally skips real accounts to keep it simple to stand up.
That means right now:

- **Anyone with the home URL can create, edit, or delete any event.**
- **Dashboard-access emails are an allow-list, not a password.** Someone
  who guesses or is told an approved email can type it in and get in.

For a solo user or a small team this is usually fine day-to-day, but
don't rely on it for anything sensitive. The straightforward next step is
putting **Cloudflare Access** (free for small teams) in front of the
`?event=` editor URLs, so only people you approve (by their real Google/
Microsoft/email login) can reach the builder at all — that's a dashboard
setting, no code changes needed, and I'm happy to walk through it whenever
you're ready.

---

## 8. Mobile

The invitation, dashboard, and builder are all responsive — test it by
opening your `?guest=<slug>` link on your own phone once it's live.
The one place that's genuinely easier on a larger screen is the drag-and-
drop question builder itself; guests never see that screen, only you do.
