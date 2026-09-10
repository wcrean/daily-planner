# Daily Planner v0.5.2

A mobile-first daily dashboard. v0.3.0 adds the secure Cozi calendar proxy foundation.

## Front end

The static front end remains deployable through GitHub Pages.

## Secure Cozi proxy

The `worker/` directory contains a Cloudflare Worker. It stores the private Cozi iCal URL as the encrypted secret `COZI_ICAL_URL`; the feed URL is never committed to GitHub or sent to the browser.

The Worker exposes:

- `/health` — confirms the Worker is running.
- `/agenda` — fetches Cozi and returns sanitized nearby calendar events as JSON.

### Deploy using Cloudflare

1. Create a Cloudflare account if needed and open **Workers & Pages**.
2. Create a new Worker named `daily-planner-calendar`.
3. Deploy the code from `worker/src/index.js` (or deploy the `worker/` project with Wrangler).
4. In the Worker **Settings → Variables and Secrets**, add a **Secret** named `COZI_ICAL_URL` and use your private Cozi iCalendar feed URL as the value.
5. Deploy the secret/change.
6. Open `https://<your-worker>.workers.dev/health` and confirm you get an `ok: true` response.
7. Open `/agenda` and confirm JSON events are returned.
8. In the root `app.js`, set `CALENDAR_API_URL` to the Worker's full `/agenda` URL.
9. Commit and push the updated front end to GitHub Pages.

### Wrangler option

From the `worker/` directory:

```bash
npm install
npx wrangler login
npx wrangler secret put COZI_ICAL_URL
npm run deploy
```

When Wrangler prompts for the secret, paste the private Cozi feed URL there. Do not put it in source code or `wrangler.jsonc`.

## Privacy note

This setup protects the private Cozi feed URL. The `/agenda` endpoint returns only sanitized event fields, not the feed URL. Because the GitHub Pages app is public, this initial version is not strong authentication for the event data itself. If full privacy is desired, add an authenticated access layer before treating the app as private.


## v0.3.0

The front end now reads the live Cozi agenda from:

`https://daily-planner-calendar.bill-crean.workers.dev/agenda`

It shows only events that occur today, handles the exclusive end date used by all-day iCalendar events, separates a leading `Person:` prefix into a badge, marks recurring events, and refreshes the agenda automatically every five minutes and whenever the page becomes visible again.

The weather panel intentionally remains sample data until the weather integration step.


## v0.4.0

Adds live weather using Open-Meteo. On startup the browser requests location permission. When granted, weather follows the device's current latitude/longitude; if permission is denied, unavailable, or times out, the app falls back to Morristown, NJ.

The weather panel now shows current temperature and conditions, today's high and low, maximum precipitation probability, and a compact set of upcoming hourly temperatures. Weather refreshes every 15 minutes and whenever the app becomes visible again. The location button can be used to retry/refresh the device location.


## v0.5.0

Location-label patch. When browser geolocation succeeds, the app reverse-geocodes the coordinates into a readable place label such as `Morristown, NJ`. The weather request begins immediately and does not wait on the location-name lookup. If reverse geocoding fails, the label falls back to `Current location`; if browser geolocation itself fails or is denied, the existing `Morristown, NJ` fallback remains in place.


## v0.5.0 — Sports

Adds a bottom-of-page Sports section. It checks today’s MLB, NBA, NFL, college-football and men’s-college-basketball schedules and filters them to Bill’s favorite teams:

- Boston Red Sox
- Arizona Diamondbacks
- Boston Celtics
- Phoenix Suns
- New England Patriots
- Arizona Cardinals
- SMU Mustangs Football
- SMU Mustangs Basketball
- Notre Dame Football
- Boston College Football
- Arizona State Football

Games are shown in Eastern Time (America/New_York) order with opponent and home/away indicator. The Sports heading explicitly notes “All times ET.” If none of those teams play today, the card says so. Sports data is loaded from ESPN’s public scoreboard endpoints when the app opens and when the page becomes visible again; there is no repeating sports refresh timer.


## v0.5.1

Sports timing/efficiency patch:

- All game times are explicitly formatted in Eastern Time (`America/New_York`).
- The Sports card displays `All times ET`.
- The sports schedule date is based on the Eastern calendar day.
- Removed the 15-minute repeating sports refresh. Sports loads on initial app open and when the page becomes visible again.
- Weather keeps its existing 15-minute refresh because conditions can change during the day.


## v0.5.2

Adds visual identity for the installed web app and browser tab:

- Custom Daily Planner calendar/weather app icon
- Browser favicon in ICO and PNG sizes
- iPhone/iPad Apple touch icon
- Web app manifest for supported mobile/desktop installation
- No functional changes to agenda, weather, or sports behavior
