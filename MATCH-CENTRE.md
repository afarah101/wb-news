# Match Centre (`/match/`)

Thursday night teams, live scores, every goal and assist, the table (W/D/L, 3 points a win, goals, assists) and who still owes subs.

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
4. **Kick off**. For each goal tap **+**, then pick **who scored** (or *Own goal*) and **who set it up** (or *No assist*). Tap **Full time** at the end. Add another game if you play more than one.
   - In a rush? Tap **Add later**. The goal counts straight away and shows *Add scorer* on the scoreboard until you tap it and fill it in.
   - Tap any goal on the scoreboard to change the scorer or assist, or to delete it. **−** takes off that team's most recent goal.
5. Tap a player's **Owes £…** chip once they've paid.
6. **Copy stats** (next to the date) copies the night's results, scorers and assists as plain text, ready to paste into the group chat or the week's news issue.

## Goals and assists

- Each game keeps a list of its goals: the team, the scorer and the assist. The score can never be lower than the number of goals recorded.
- **Table** shows the top scorers and most assists, plus G and A columns. **History** shows each night's scorers and assists. A player's profile shows their goals and assists and how many they got each night.
- Games scored before goal tracking started only have a score. Their goals show as *Add scorer*, so they can be filled in later if anyone remembers.

To change the PIN, edit `ADMIN_PIN` in Vercel and redeploy; anyone signed in with the old PIN is signed out on their next change.
