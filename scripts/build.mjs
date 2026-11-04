import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { createHash } from "node:crypto";

// A small native-ESM export: no CDN, runtime package, or hidden build service.
await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await cp("public", "dist", { recursive: true });
const files = (await readdir("src"))
  .filter((name) => name.endsWith(".ts"))
  .sort();
for (const file of files) {
  const source = await readFile(`src/${file}`, "utf8");
  const js = stripTypeScriptTypes(source, { mode: "strip" });
  await writeFile(`dist/assets/${file.replace(/\.ts$/, ".js")}`, js);
}
await cp("src/style.css", "dist/assets/style.css");
await cp("index.html", "dist/index.html");
const hash = createHash("sha256");
for (const file of [
  "index.html",
  "src/style.css",
  ...files.map((file) => `src/${file}`),
]) {
  hash.update(await readFile(file));
}
await writeFile(
  "dist/build.json",
  JSON.stringify(
    { name: "wheel-run", version: "1.0.0", sourceHash: hash.digest("hex") },
    null,
    2,
  ) + "\n",
);
console.log(
  `Built dist/: ${files.length} native JavaScript modules, local artwork, styles and fonts.`,
);
