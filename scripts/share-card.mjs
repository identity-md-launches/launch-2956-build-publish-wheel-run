import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { serve } from "./preview.mjs";

// Optional artwork regeneration; the ready-to-publish PNG is already in public/.
const { chromium } = await import(
  process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright"
);
const server = createServer(serve).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const browser = await chromium.launch({
  ...(process.argv[3] ? { executablePath: process.argv[3] } : {}),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.route("https://api.squeekchain.com/**", (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/`);
  await page.evaluate(async () => {
    const { GameEngine } = await import("./assets/engine.js");
    const { Renderer } = await import("./assets/renderer.js");
    document.body.innerHTML = `<div style="position:relative;width:1200px;height:630px;overflow:hidden"><canvas id="share-canvas" style="position:absolute;inset:0;width:1200px;height:630px"></canvas><div style="position:absolute;left:60px;top:50px;display:flex;align-items:center;gap:16px;font-family:Bricolage,sans-serif;font-size:32px;font-weight:700"><img width="48" height="48" src="./favicon.svg" alt="">Wheel Run</div><div style="position:absolute;left:60px;top:210px"><h1 style="font-family:Bricolage,sans-serif;font-size:64px;font-weight:700;letter-spacing:-3px;line-height:1.04">Tiny paws.<br><span style="color:#f3bc66">Endless trouble.</span></h1><p style="font-family:'DM Sans',sans-serif;font-size:22px;color:#c2c7bf;margin-top:26px">A survival run powered by Squeekchain.</p></div><span style="position:absolute;left:60px;bottom:36px;color:#c2c7bf;font-size:16px">Squeekchain Genesis Code</span></div>`;
    const game = new GameEngine();
    const renderer = new Renderer(
      document.querySelector("#share-canvas"),
      game,
    );
    renderer.reducedMotion = true;
    renderer.resize();
    await document.fonts.ready;
  });
  await page.screenshot({ path: "public/share.png" });
  console.log("Generated public/share.png (1200 × 630).");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
