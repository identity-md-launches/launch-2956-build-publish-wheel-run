# Wheel Run

An original endless survival race for **Squeekchain Genesis Code**. Guide a scarf-wearing hamster through a dark, illustrated burrow while the real Squeekchain wheel changes the pace.

**Delivery status:** the complete source, lockfile, documentation, and production export are included here. Public GitHub publication and IPFS hosting were **not completed**: no authenticated publishing integration was available, and GitHub repository creation redirected to sign-in. There is no claimed public repository URL, IPFS CID, or live deployment. See [publication status](artifacts/publication.json).

## Play

Select **Start running**. Jump over rocks, slide under hanging roots, and survive as long as possible.

| Action | Desktop | Touch |
| --- | --- | --- |
| Jump | Space or ↑ | Tap the burrow or select Jump |
| Slide | ↓ | Select Slide |
| Pause / resume | Esc | Pause button / Resume run |
| Try again | Run again | Run again |

Opening help, hiding the page, or leaving the window pauses an active run. Resume is explicit. Sound starts muted and can be enabled from the header. The help dialog includes **Reduce effects**, initially following the system motion preference. This removes parallax, screen shake, and falling debris; the user-started game still scrolls.

Best scores are stored only in this browser. When storage is unavailable, the game keeps the best for the current visit and says so. This is not a shared leaderboard. There is no wallet connection, payment, token reward, or SQK airdrop claim.

## Install, build, and preview

Use **Node.js 24 or later** and npm.

```sh
npm ci
npm run typecheck
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/preview/`. To use a different port, run `npm run preview -- 4174`. The preview serves only `dist/`; rebuild after changing source. `npm run dev` performs one build and starts the preview, without a file watcher. Serve the export over HTTP rather than opening `index.html` as a local file, because the game uses JavaScript modules.

The build deliberately uses native ES modules and Canvas rather than a framework. There are **zero runtime package dependencies**; TypeScript is the only development dependency. `scripts/build.mjs` uses Node's type-stripping API, copies local assets, and creates a deterministic static export. Node may print an experimental API warning for type stripping. The separate strict TypeScript check must pass before release; stripping types is not a typecheck.

## What the live wheel changes

`src/feed.ts` polls `https://api.squeekchain.com/v1/status` immediately, then on a 1,500 ms interval. Requests do not overlap, have a 4-second timeout, omit credentials, and stop when the page is hidden. Returning to the page requests a fresh reading. The game has no proxy or backend.

| API field | Interpretation |
| --- | --- |
| `measurement.coreStatus` | `ACTIVE` or `IDLE` |
| `measurement.rpmMilli` | Divided by 1,000 to display RPM |
| `measurement.speedMmPerSecond` | Also raises game intensity while ACTIVE |
| `measurement.freshness`, `observedAt`, `staleAfterSeconds` | Reject offline, malformed, future-dated, or stale readings |
| `builder.anchor.settledThroughRound` | Confirmed settlement round, parsed as a `bigint` |
| `installationId` | Resets the settlement baseline when the installation changes |

While ACTIVE, intensity is `min(1, max(0.12, rpm / 110, speedMmPerSecond / 900))`. That raises logical scroll speed from 205 to 360 pixels/second, shortens hazard spacing from 2.25 to 1.40 seconds plus up to 0.45 seconds of variation, and raises the score multiplier from ×1.0 to ×3.0. Speed eases toward its target. IDLE and an unavailable feed use the gentle baseline. Displayed distance is virtual game distance.

The first confirmed round establishes a baseline. Each subsequent increase creates one soft, 1.2-second quake with decorative debris and a text notice. Duplicate or lower rounds cannot retrigger it; optimistic/queued submissions do not count. Debris never participates in collision detection. Round gaps produce one quake per observed increase, since the status endpoint does not provide every intervening event.

On failed, stale, or invalid readings, the badge says **Offline**, unknown values become dashes, and the run remains playable at ×1.0. Automatic polling restores live control when a valid reading returns. Production contains no synthetic live readings.

## Source map

| Path | Purpose |
| --- | --- |
| `index.html` | Accessible interface, help dialog, metadata |
| `src/app.ts` | Input, lifecycle, HUD, feed and game integration |
| `src/engine.ts` | Frame-rate-independent physics, scoring, hazard generation, collisions |
| `src/renderer.ts` | Original Canvas cave, hamster, wheel, obstacles, and debris |
| `src/feed.ts` | Validated status polling and monotonic settlement tracking |
| `src/audio.ts`, `src/storage.ts` | Opt-in sound and resilient local best score |
| `src/style.css` | Design tokens and responsive component styles |
| `public/` | Local fonts/licenses, SVG favicon, 1200×630 PNG share card |
| `scripts/` | Build, typecheck, preview, optional share-card regeneration |
| `tests/` | Gameplay tests and browser/visual validation harnesses |
| `dist/` | Complete, directly publishable static export |
| `DESIGN.md` | Design system extracted from the final implementation |
| `artifacts/validation.md` | Actual checks, fixes, six-domain review, and limitations |

## Validation

Run `npm test` for the gameplay/feed/storage tests. The browser suite uses Playwright as optional validation tooling:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/browser.mjs
node tests/visual.mjs
```

Each browser harness accepts an optional Playwright module path and browser executable path. The interaction harness also accepts a browser name and optional local axe-core bundle; the visual harness accepts an optional axe-core bundle as its third argument. Test fixtures exist only in the test harness. Browser reports and screenshots are written to `artifacts/`.

The worker ran the production build, strict typecheck, 19 gameplay/feed/storage tests, Chromium keyboard and touch interactions, and the pinned design probe. The final results, exact coverage and remaining limits are in [validation.md](artifacts/validation.md). This is worker-side evidence, not independent certification.

The live API responded successfully through a command-line HTTPS request, but direct Chromium requests returned `ERR_EMPTY_RESPONSE` in the validation environment. Controlled API fixtures verified ACTIVE, IDLE, settlement changes, bad payloads, timeouts/failures, and recovery; no direct live-browser connectivity pass is claimed. WebKit could not start because required shared libraries were unavailable. Physical devices, screen-reader operation, and native browser zoom were not tested.

## Static publication

`dist/index.html` uses `./assets/...`, `./fonts/...`, `./favicon.svg`, and `./share.png`. JavaScript module imports and CSS font URLs are also relative. All required assets are local. After the static files load, only the live status feed makes external requests; if that feed is unavailable, the game stays playable. There are no server-side routes or environment secrets.

To finish the requested publication, an authorized publisher must create a **public GitHub repository containing this source, README, lockfile, and complete `dist/`**, then pin **the contents of `dist/` as an IPFS directory**. Verify the returned gateway URL under its actual `/ipfs/` subpath, including assets and gameplay. Record the genuine repository URL, CID, and gateway URL in `artifacts/publication.json`. Local preview URLs and the design reference's repository are not delivery URLs.

The submission budget and the exact exclusions are documented in [path-budget.md](artifacts/path-budget.md). No `node_modules`, package caches, dependency archives, vendored registry, or submodule is part of this deliverable.

## Credits

Original game implementation, cave/character artwork, and icons are included as source. Bricolage Grotesque and DM Sans are bundled locally under their SIL Open Font Licenses. Design intent references supplied with the task were [cc86418/super](https://github.com/cc86418/super) and [the earlier Wheel Run site](https://wheel-run-genesis-19080c.deed.page/); this implementation was built independently.

The review used the pinned Better Interface and design-critic guides. See [NOTICE.md](NOTICE.md) for design-guide and font attribution.
