# Camp Crawler

A Vercel-ready Next.js web app for checking Yosemite campground availability. It finds continuous open date windows, lets visitors filter them by campground and arrival month, and exports visible results as a plain-text file.

The app is read-only. It links to Recreation.gov for booking and never creates a reservation.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build for production

```bash
npm run build
npm run start
```

## Deploy to Vercel

Import this folder as a new Vercel project, or run the Vercel CLI from this directory. No environment variables are needed for the initial search experience.

The search route uses the Node.js runtime and a 60-second maximum duration, configured in `vercel.json`. This is intended for a maximum search of five campgrounds over six months. Add a durable rate limiter before broadly publishing the app.

## Notes

- Supported campgrounds are defined in `lib/campgrounds.ts`.
- Search logic lives in `lib/availability.ts`; it ports the behavior of the original Python crawler.
- The public endpoint accepts only the supported campground IDs and validates date range, nights, and party-size limits before contacting Recreation.gov.
- An upstream outage is returned as an error. Failed individual months are returned as warnings alongside partial results.
