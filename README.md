# Daily Planner v0.2.0

A mobile-first daily dashboard. v0.2.0 adds the secure Cozi calendar proxy foundation.

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
