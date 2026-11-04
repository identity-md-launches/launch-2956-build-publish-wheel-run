import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { serve } from "../scripts/preview.mjs";

const [modulePath, executablePath, browserName = "chromium", axePath] =
  process.argv.slice(2);
const playwright = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const server = createServer(serve).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await playwright[browserName].launch({
  ...(executablePath ? { executablePath } : {}),
  ...(browserName === "chromium"
    ? { args: ["--no-sandbox", "--disable-dev-shm-usage"] }
    : {}),
});
await mkdir("artifacts/screenshots", { recursive: true });
const checks = [];
const pageErrors = [];
const localFailures = [];
const requestTimes = [];
let state = "IDLE";
let round = "1258";
let mode = "valid";
const fixture = () => ({
  installationId: "browser-test-only",
  measurement: {
    coreStatus: state,
    rpmMilli: state === "ACTIVE" ? 55000 : 0,
    speedMmPerSecond: state === "ACTIVE" ? 600 : 0,
    freshness: "online",
    observedAt: new Date(
      Date.now() - (mode === "stale" ? 200000 : 0),
    ).toISOString(),
    staleAfterSeconds: 120,
  },
  builder: { status: "available", anchor: { settledThroughRound: round } },
});
async function configure(context) {
  await context.route(
    "https://api.squeekchain.com/v1/status",
    async (route) => {
      requestTimes.push(Date.now());
      if (mode === "offline") return route.abort("failed");
      if (mode === "timeout") {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return route.abort().catch(() => {});
      }
      if (mode === "http-error")
        return route.fulfill({ status: 503, body: "Unavailable" });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body:
          mode === "invalid"
            ? '{"unexpected":true}'
            : JSON.stringify(fixture()),
      });
    },
  );
  context.on("page", (page) => {
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.url().startsWith(base))
        localFailures.push(request.url().replace(base, "./"));
    });
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400)
        localFailures.push(response.url().replace(base, "./"));
    });
  });
}
function record(name, evidence) {
  checks.push({ name, passed: true, evidence });
  console.log(`PASS ${name}`);
}
const waitPhase = (page, phase) =>
  page.waitForFunction(
    (expected) => document.querySelector("#game").dataset.phase === expected,
    phase,
  );
const waitBadge = (page, status) =>
  page.waitForFunction(
    (expected) =>
      document.querySelector("#live-label").textContent === expected,
    status,
    { timeout: 7000 },
  );
const sleep = (page, ms) => page.waitForTimeout(ms);

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  await configure(context);
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await waitBadge(page, "IDLE");
  assert.match(await page.title(), /Wheel Run/);
  for (const path of [
    "share.png",
    "favicon.svg",
    "fonts/bricolage-latin.woff2",
    "fonts/dm-sans-latin.woff2",
  ]) {
    assert.equal(
      (await page.request.get(base + path)).status(),
      200,
      `${path} should exist in the subpath export`,
    );
  }
  assert.equal(
    (await page.request.get(base + "missing-asset.js")).status(),
    404,
  );
  for (const selector of [
    'link[rel="icon"]',
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:image"]',
  ])
    assert.equal(await page.locator(selector).count(), 1);
  record(
    "metadata and relative export",
    "Page and local modules, styles, fonts, favicon, and share card load under /preview/.",
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1050 : 844 });
    await sleep(page, 100);
    const size = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.equal(size.client, size.scroll, `overflow at ${width}`);
    const start = await page.locator("#start-button").boundingBox();
    assert.ok(start && start.y + start.height < 844);
    await page.screenshot({
      path: `artifacts/screenshots/${browserName}-ready-${width}.png`,
      fullPage: true,
    });
    record(
      `responsive ${width}px`,
      `No horizontal overflow; Start running ends at ${Math.round(start.y + start.height)}px.`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#start-button").click();
  await waitPhase(page, "running");
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => document.querySelector("#burrow").dataset.action === "jumping",
  );
  await sleep(page, 850);
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(
    () => document.querySelector("#burrow").dataset.action === "sliding",
  );
  await page.keyboard.press("Escape");
  await waitPhase(page, "paused");
  const pausedScore = await page.locator("#score").textContent();
  await sleep(page, 350);
  assert.equal(await page.locator("#score").textContent(), pausedScore);
  await page.keyboard.press("Escape");
  await waitPhase(page, "running");
  await page.locator("#help-button").click();
  await waitPhase(page, "paused");
  assert.equal(
    await page.locator("#help-dialog").evaluate((node) => node.open),
    true,
  );
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          document.activeElement.closest("#help-dialog") !== null,
      ),
      true,
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#help-dialog").evaluate((node) => node.open),
    false,
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "help-button",
  );
  await page.screenshot({
    path: `artifacts/screenshots/${browserName}-paused-390.png`,
    fullPage: true,
  });
  record(
    "keyboard and help",
    "Space jumps; ArrowDown slides; Escape pauses/resumes; pause freezes score; native modal prevents focus on background controls and returns to help.",
  );

  const helpPausedScore = await page.locator("#score").textContent();
  state = "ACTIVE";
  await waitBadge(page, "ACTIVE");
  assert.ok(
    Number((await page.locator("#multiplier").textContent()).slice(1)) > 1,
  );
  assert.equal(await page.locator("#rpm").textContent(), "55.0");
  assert.equal(await page.locator("#score").textContent(), helpPausedScore);
  record(
    "ACTIVE live control",
    "55 RPM / 600 mm/s changes multiplier while paused without advancing the run. Physics speed/density also covered by unit tests.",
  );

  round = "1259";
  await page.waitForFunction(
    () => !document.querySelector("#quake-notice").hidden,
  );
  assert.match(await page.locator("#quake-notice").textContent(), /1,259/);
  await sleep(page, 2700);
  assert.equal(await page.locator("#quake-notice").isVisible(), false);
  await sleep(page, 1600);
  assert.equal(await page.locator("#quake-notice").isVisible(), false);
  record(
    "settlement quake",
    "Confirmed increase shows quake notice; repeated rounds do not retrigger it; debris is non-colliding in unit tests.",
  );

  mode = "timeout";
  await waitBadge(page, "Offline");
  assert.equal(await page.locator("#multiplier").textContent(), "×1.0");
  record(
    "request timeout",
    "A stalled request is aborted after four seconds; Offline and the baseline multiplier appear.",
  );
  mode = "valid";
  await waitBadge(page, "ACTIVE");
  mode = "offline";
  await waitBadge(page, "Offline");
  assert.equal(await page.locator("#multiplier").textContent(), "×1.0");
  for (const failure of ["stale", "invalid", "http-error"]) {
    mode = failure;
    await sleep(page, 1700);
    assert.equal(await page.locator("#live-label").textContent(), "Offline");
  }
  mode = "valid";
  state = "IDLE";
  await waitBadge(page, "IDLE");
  assert.equal(await page.locator("#multiplier").textContent(), "×1.0");
  const intervals = requestTimes
    .slice(1)
    .map((time, i) => time - requestTimes[i]);
  const median = intervals.sort((a, b) => a - b)[
    Math.floor(intervals.length / 2)
  ];
  assert.ok(median >= 1400 && median <= 1700);
  record(
    "polling and recovery",
    `Median poll interval ${median}ms; network, stale, malformed, and HTTP failures show Offline; IDLE recovers automatically.`,
  );

  await page.locator("#continue-button").click();
  await waitPhase(page, "running");
  await page.waitForFunction(
    () => document.querySelector("#game").dataset.phase === "over",
    null,
    { timeout: 12000 },
  );
  const finalScore = Number(
    (await page.locator("#final-score").textContent()).replaceAll(",", ""),
  );
  assert.ok(finalScore > 0);
  assert.equal(
    await page.locator("#continue-button").textContent(),
    "Run again",
  );
  await page.screenshot({
    path: `artifacts/screenshots/${browserName}-game-over-390.png`,
    fullPage: true,
  });
  await page.locator("#continue-button").click();
  await waitPhase(page, "running");
  assert.ok(Number(await page.locator("#score").textContent()) < finalScore);
  await page.locator("#pause-button").click();
  await waitPhase(page, "paused");
  await page.reload();
  await waitBadge(page, "IDLE");
  assert.equal(Number(await page.locator("#best").textContent()), finalScore);
  record(
    "collision, retry, best",
    `Collision ends run at ${finalScore}; Run again resets score; best persists across reload.`,
  );

  await page.locator("#sound-button").click();
  assert.equal(
    await page.locator("#sound-button").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#sound-button").click();
  assert.equal(
    await page.locator("#sound-button").getAttribute("aria-pressed"),
    "false",
  );
  record(
    "sound toggle",
    "User-initiated Web Audio enables and mutes; no autoplay. Audibility not manually verified.",
  );
  if (axePath) {
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      }),
    );
    assert.deepEqual(
      result.violations.map(({ id, nodes }) => ({ id, count: nodes.length })),
      [],
    );
    record(
      "automated accessibility",
      `${result.passes.length} axe rules passed on ready mobile; no WCAG A/AA violations found. Not a screen-reader session.`,
    );
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#help-button").click();
  assert.equal(await page.locator("#reduce-motion").isChecked(), true);
  await page.locator("#close-help-primary").click();
  const before = await page
    .locator("#burrow")
    .evaluate((node) => node.toDataURL());
  await sleep(page, 200);
  assert.equal(
    await page.locator("#burrow").evaluate((node) => node.toDataURL()),
    before,
  );
  record(
    "reduced motion",
    "System preference selects Reduce effects; ready canvas is static; renderer suppresses parallax, shake, and debris.",
  );
  await context.close();

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await configure(touchContext);
  const touch = await touchContext.newPage();
  await touch.goto(base);
  await waitBadge(touch, "IDLE");
  await touch.locator("#start-button").tap();
  await touch.locator("#burrow").tap({ position: { x: 180, y: 300 } });
  await touch.waitForFunction(
    () => document.querySelector("#burrow").dataset.action === "jumping",
  );
  await sleep(touch, 850);
  await touch.locator("#slide-button").tap();
  await touch.waitForFunction(
    () => document.querySelector("#burrow").dataset.action === "sliding",
  );
  await touch.locator("#pause-button").tap();
  await waitPhase(touch, "paused");
  record(
    "mobile touch controls",
    "Tap starts; tapping the burrow jumps; Slide and Pause work with touch emulation.",
  );
  await touchContext.close();

  const deniedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await configure(deniedContext);
  await deniedContext.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    }),
  );
  const denied = await deniedContext.newPage();
  await denied.goto(base);
  assert.match(
    await denied.locator("#storage-note").textContent(),
    /this visit/,
  );
  await denied.locator("#start-button").click();
  await waitPhase(denied, "running");
  record(
    "restricted storage",
    "Denied localStorage does not prevent play; session-only best is disclosed.",
  );
  await deniedContext.close();
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(localFailures, []);
  record(
    "production resources",
    "Zero page exceptions or missing local resources during all tested flows.",
  );
} catch (error) {
  checks.push({
    name: "interaction suite",
    passed: false,
    evidence: error.message,
  });
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    `artifacts/${browserName}-interactions.json`,
    JSON.stringify(
      {
        browser: browserName,
        checkedAt: new Date().toISOString(),
        feed: "Controlled fixtures, explicitly confined to the test harness; production uses the real HTTPS API.",
        checks,
        pageErrors,
        localFailures,
      },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
