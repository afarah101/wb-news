# Match Centre (`/match/`)

Thursday night teams, live scores, every goal and assist, the table (one W/D/L per night, 3 points a night won, goals, assists) and who still owes subs.

- **Page:** `match/index.html`, `match/match.css`, `match/match.js`, plus `match/ops.js` (how each change is worked out, shared with the server). Linked from the menu under THE TEAM.
- **Players:** everyone in `data/players.json` shows up automatically, with their Squad photo. Guests and new faces are added in the Match Centre itself (photo + name or nickname).
- **Data:** match nights, scores, payments and the extra players are kept in Upstash Redis through two Vercel functions: `api/match.js` (read and change) and `api/photo.js` (photos of players added in the app).
- **Who can change things:** anyone can watch. Picking teams, scores and marking subs need the admin PIN (*Admin sign in* at the bottom of the page). Viewers' pages refresh every 3 seconds while a game is live.
- **Use a PIN of 6 digits or more.** Ten wrong PINs from one place locks it out for 15 minutes, so a long PIN can't realistically be guessed.

## One-time setup in Vercel (about 5 minutes)

1. Open the **wb-news** project in Vercel → **Storage** → **Create Database** → **Upstash for Redis** (free plan) → connect it to this project for all environments. Vercel adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` settings by itself.
2. **Settings → Environment Variables** → add `ADMIN_PIN` with a PIN of your choice, for all environments.
3. **Deployments** → redeploy the latest deployment so it picks up the new settings.

Until this is done the page says *Not connected yet*.

## Saving, signal and two admins

- Each change (a goal, an edit, marking subs…) is sent to the server as a small step, which it applies to the latest data. Two admins can score at the same time and both goals are kept. A goal scored during play always lands in the game that's live, even if the other admin's goal has just finished the previous one.
- Changes show straight away and are kept on the phone until the server confirms them. With no signal, a red bar at the top says how many are waiting; they're sent as soon as the connection's back, even if the page was closed in between. The page also opens with the last scores it saw when there's no signal.
- A change that's sent twice (for example a retry after the reply got lost) only counts once.

## Backups

- The server keeps a copy of everything every 10 minutes while things are changing, and before anything is deleted (up to 60 copies).
- Admins: **Backups** at the bottom of the page lists them. **Go back to this** restores one; what's there now is kept as a backup first, so it can be undone.

## On a Thursday

1. Open `/match/`, tap **Admin sign in**, enter the PIN.
2. **Set up** the night: date, cost per player, *First to* (goals that win a game, 3 by default), team names and colours (Bibs and Non Bibs by default).
3. **Pick teams:** put each player in a team or leave them Out.
4. **Kick off**. For each goal tap **+**, pick **who scored** (or *Own goal*), then **who set it up** (or *No assist*). The goal only goes on the scoreboard once both are picked, so every goal has its scorer and assist.
   - **First to 3:** when a team scores its 3rd goal the game ends and the next game kicks off by itself. Take the winning goal off by mistake and the game reopens. Set *First to* to 0 in Edit night to play on until you tap **Full time**.
   - **Fixing a mistake:** tap any goal on the scoreboard (marked *Edit*) to change just the scorer, just the assist, or delete it. Older games are under the Game buttons, older nights in the date menu. **−** takes off that team's most recent goal.
5. Tap a player's **Owes £…** chip once they've paid.
6. **End night** (under the scoreboard) when you're done. It removes the empty game that kicked off after the last win, finishes any game still live, and opens Send to WhatsApp. Nights from before yesterday count as over anyway.
7. **Send to WhatsApp** (next to the date, and under the scoreboard once no game is in progress) makes a results card: the night's result, both line-ups with photos and each player's goals and assists, then every game's score. On a phone tap **Share**, pick WhatsApp and the group; the written results go with it. **Copy stats** copies the same results as text.

## Who wins the night

- Each game is first to 3 (or whatever *First to* says). A game that ends level counts for neither team.
- The night goes to the team that wins the most games. It shows under the scoreboard, in History, on the results card and in the copied text.
- Deleted players (and anyone taken off the Squad page) keep their name, so their goals and nights still count.
- The **Table** gives each player one result per night: W if their team won the night, D if level, L if not. 3 points for a night won, 1 for a draw. P is nights played.

## Goals and assists

- Each game keeps a list of its goals: the team, the scorer and the assist. The score can never be lower than the number of goals recorded.
- **Table** shows the top scorers and most assists, plus G and A columns. **History** shows each night's scorers and assists. A player's profile shows their goals and assists and how many they got each night.
- Games scored before goal tracking started only have a score. Their goals show as *Add scorer*, so they can be filled in later if anyone remembers.

To change the PIN, edit `ADMIN_PIN` in Vercel and redeploy; anyone signed in with the old PIN is signed out on their next change.
