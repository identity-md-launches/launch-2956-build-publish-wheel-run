import { createServer } from "node:http";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { serve } from "../scripts/preview.mjs";
const [modulePath, executablePath, axePath] = process.argv.slice(2);
const { chromium } = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const server = createServer(serve).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox"],
});
const measurements = {
  canvasContrast: [],
  states: [],
  fonts: null,
  textEnlargement: null,
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  await page.route("https://api.squeekchain.com/**", (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/`);
  await page.evaluate(() => document.fonts.ready);
  measurements.fonts = await page.evaluate(() => ({
    bricolage: document.fonts.check("700 40px Bricolage"),
    dmSans: document.fonts.check('400 14px "DM Sans"'),
  }));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.waitForTimeout(100);
    const pairs = await page.evaluate(() => {
      const canvas = document.querySelector("#burrow");
      const cbox = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      const luminance = (rgb) =>
        rgb
          .map((value) => value / 255)
          .map((value) =>
            value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
          )
          .reduce(
            (sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
            0,
          );
      const contrast = (a, b) =>
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const result = [];
      for (const element of document.querySelectorAll(
        ".hud span, .hud strong, .intro h1, .intro h1 span, .intro p, .character-note, .scene-bottom span",
      )) {
        const style = getComputedStyle(element);
        if (!element.checkVisibility()) continue;
        for (const child of element.childNodes) {
          if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim())
            continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          for (const box of range.getClientRects()) {
            if (!box.width || !box.height) continue;
            const fg = style.color
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number);
            let minimum = 100;
            let background = [];
            // Sample actual opaque canvas pixels under each DOM text line.
            for (let x = box.left; x < box.right; x += 3)
              for (let y = box.top; y < box.bottom; y += 3) {
                const px = Math.max(
                  0,
                  Math.min(
                    canvas.width - 1,
                    Math.floor(((x - cbox.left) * canvas.width) / cbox.width),
                  ),
                );
                const py = Math.max(
                  0,
                  Math.min(
                    canvas.height - 1,
                    Math.floor(((y - cbox.top) * canvas.height) / cbox.height),
                  ),
                );
                const rgb = [...ctx.getImageData(px, py, 1, 1).data].slice(
                  0,
                  3,
                );
                const ratio = contrast(luminance(fg), luminance(rgb));
                if (ratio < minimum) {
                  minimum = ratio;
                  background = rgb;
                }
              }
            const large =
              parseFloat(style.fontSize) >= 24 ||
              (parseFloat(style.fontSize) >= 18.66 &&
                Number(style.fontWeight) >= 700);
            result.push({
              text: child.textContent.trim(),
              foreground: fg,
              worstSampledBackground: background,
              ratio: Number(minimum.toFixed(2)),
              required: large ? 3 : 4.5,
              passed: minimum >= (large ? 3 : 4.5),
            });
          }
        }
      }
      return result;
    });
    measurements.canvasContrast.push({ width, pairs });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.waitForTimeout(100);
  measurements.textEnlargement = await page.evaluate(() => {
    const action = document
      .querySelector("#start-button")
      .getBoundingClientRect();
    const stage = document.querySelector(".game-stage").getBoundingClientRect();
    return {
      method: "Root text size 200%; not native browser zoom",
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      actionInsideStage: action.bottom <= stage.bottom,
      actionBottom: action.bottom,
      stageBottom: stage.bottom,
    };
  });
  await page.screenshot({
    path: "artifacts/screenshots/chromium-text-200.png",
    fullPage: true,
  });
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("font-size"),
  );
  await page.locator("#start-button").focus();
  await page.screenshot({
    path: "artifacts/screenshots/chromium-focus-390.png",
    fullPage: true,
  });
  if (axePath) await page.addScriptTag({ path: axePath });
  await page.locator("#help-button").click();
  if (axePath)
    measurements.states.push({
      state: "help",
      ...(await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return {
          passes: result.passes.length,
          violations: result.violations.map(({ id, nodes }) => ({
            id,
            elements: nodes.map((node) => node.target),
          })),
        };
      })),
    });
  await page.screenshot({
    path: "artifacts/screenshots/chromium-help-390.png",
    fullPage: true,
  });
  await page.locator("#close-help-primary").click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator("#start-button").click();
  await page.waitForTimeout(3300);
  await page.screenshot({
    path: "artifacts/screenshots/chromium-running-1440.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  if (axePath)
    measurements.states.push({
      state: "paused",
      ...(await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return {
          passes: result.passes.length,
          violations: result.violations.map(({ id, nodes }) => ({
            id,
            elements: nodes.map((node) => node.target),
          })),
        };
      })),
    });
  await page.locator("#continue-button").click();
  await page.waitForFunction(
    () => document.querySelector("#game").dataset.phase === "over",
    null,
    { timeout: 10000 },
  );
  if (axePath)
    measurements.states.push({
      state: "game over",
      ...(await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return {
          passes: result.passes.length,
          violations: result.violations.map(({ id, nodes }) => ({
            id,
            elements: nodes.map((node) => node.target),
          })),
        };
      })),
    });
  console.log(
    JSON.stringify(
      {
        fonts: measurements.fonts,
        textEnlargement: measurements.textEnlargement,
        states: measurements.states,
        failedCanvasPairs: measurements.canvasContrast.flatMap((view) =>
          view.pairs
            .filter((pair) => !pair.passed)
            .map((pair) => ({ width: view.width, ...pair })),
        ),
      },
      null,
      2,
    ),
  );
  assert.equal(
    measurements.textEnlargement.clientWidth,
    measurements.textEnlargement.scrollWidth,
    "Text enlargement must not cause horizontal overflow.",
  );
  assert.equal(
    measurements.textEnlargement.actionInsideStage,
    true,
    "The start action must stay within the game at 200% text size.",
  );
  assert.ok(
    measurements.canvasContrast.every((view) =>
      view.pairs.every((pair) => pair.passed),
    ),
    "Canvas text contrast must meet its threshold.",
  );
  assert.ok(
    measurements.states.every((state) => state.violations.length === 0),
    "Axe found a violation in a game state.",
  );
} finally {
  await writeFile(
    "artifacts/visual-measurements.json",
    JSON.stringify(measurements, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
