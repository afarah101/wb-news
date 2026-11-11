# Match Centre (`/match/`)

Thursday night teams, live scores, the table (W/D/L, 3 points a win) and who still owes subs.

- **Page:** `match/index.html`, `match/match.css`, `match/match.js`. Linked from the menu under THE TEAM.
- **Players:** everyone in `data/players.json` shows up automatically, with their Squad photo. Guests and new faces are added in the Match Centre itself (photo + name or nickname).
- **Data:** match nights, scores, payments and the extra players are kept in Upstash Redis through two Vercel functions: `api/match.js` (read and change) and `api/photo.js` (photos of players added in the app).
- **Who can change things:** anyone can watch. Picking teams, scores and marking subs need the admin PIN (*Admin sign in* at the bottom of the page). Viewers' pages refresh every 3 seconds while a game is live.

## One-time setup in Vercel (about 5 minutes)

1. Open the **wb-news** project in Vercel → **Storage** → **Create Database** → **Upstash for Redis** (free plan) → connect it to this project for all environments. Vercel adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` settings by itself.
2. **Settings → Environment Variables** → add `ADMIN_PIN` with a PIN of your choice, for all environments.
3. **Deployments** → redeploy the latest deployment so it picks up the new settings.

Until this is done the page says *Not connected yet*.

## On a Thursday

1. Open `/match/`, tap **Admin sign in**, enter the PIN.
2. **Set up** the night: date, cost per player, team names and colours (Bibs and Shirts by default).
3. **Pick teams:** put each player in a team or leave them Out.
4. **Kick off**, tap **+** for each goal, then **Full time**. Add another game if you play more than one.
5. Tap a player's **Owes £…** chip once they've paid.

To change the PIN, edit `ADMIN_PIN` in Vercel and redeploy; anyone signed in with the old PIN is signed out on their next change.
