# Match Centre (`/match/`)

Thursday night teams, live scores, every goal and assist, the table (one W/D/L per night, 3 points a night won, goals, assists) and who still owes subs.

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
2. **Set up** the night: date, cost per player, *First to* (goals that win a game, 3 by default), team names and colours (Bibs and Non Bibs by default).
3. **Pick teams:** put each player in a team or leave them Out.
4. **Kick off**. For each goal tap **+**, pick **who scored** (or *Own goal*), then **who set it up** (or *No assist*). The goal only goes on the scoreboard once both are picked, so every goal has its scorer and assist.
   - **First to 3:** when a team scores its 3rd goal the game ends and the next game kicks off by itself. Take the winning goal off by mistake and the game reopens. Set *First to* to 0 in Edit night to play on until you tap **Full time**.
   - **Fixing a mistake:** tap any goal on the scoreboard (marked *Edit*) to change just the scorer, just the assist, or delete it. Older games are under the Game buttons, older nights in the date menu. **−** takes off that team's most recent goal.
5. Tap a player's **Owes £…** chip once they've paid.
6. **Send to WhatsApp** (next to the date, and under the scoreboard once no game is in progress) makes a results card: the night's result, both line-ups with photos and each player's goals and assists, then every game's score. On a phone tap **Share**, pick WhatsApp and the group; the written results go with it. **Copy stats** copies the same results as text.

## Who wins the night

- Each game is first to 3 (or whatever *First to* says). A game that ends level counts for neither team.
- The night goes to the team that wins the most games. It shows under the scoreboard, in History, on the results card and in the copied text.
- The **Table** gives each player one result per night: W if their team won the night, D if level, L if not. 3 points for a night won, 1 for a draw. P is nights played.

## Goals and assists

- Each game keeps a list of its goals: the team, the scorer and the assist. The score can never be lower than the number of goals recorded.
- **Table** shows the top scorers and most assists, plus G and A columns. **History** shows each night's scorers and assists. A player's profile shows their goals and assists and how many they got each night.
- Games scored before goal tracking started only have a score. Their goals show as *Add scorer*, so they can be filled in later if anyone remembers.

To change the PIN, edit `ADMIN_PIN` in Vercel and redeploy; anyone signed in with the old PIN is signed out on their next change.
