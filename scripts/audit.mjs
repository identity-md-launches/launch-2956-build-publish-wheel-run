import assert from "node:assert/strict";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, dirname, relative, sep } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { createHash } from "node:crypto";

const limit = 8_388_608;
const budgets = {
  source: 180_000,
  public: 300_000,
  dist: 500_000,
  tooling: 100_000,
  root: 50_000,
  artifacts: 2_500_000,
  ignore: 2_048,
};
const excluded = new Set([
  ".git",
  ".github",
  ".imd",
  ".agents",
  ".codex",
  "node_modules",
  ".cache",
  ".npm",
  ".vite",
  ".parcel-cache",
  ".turbo",
]);
async function walk(folder) {
  const files = [];
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const path = `${folder}/${item.name}`.replace(/^\.\//, "");
    if (
      excluded.has(item.name) ||
      path === "test/scratch" ||
      item.name.startsWith(".env") ||
      item.name.endsWith(".tsbuildinfo")
    )
      continue;
    assert.ok(!item.isSymbolicLink(), `Unexpected submitted symlink: ${path}`);
    if (item.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}
const required = [
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "README.md",
  "DESIGN.md",
  "dist/index.html",
  "dist/share.png",
  "artifacts/validation.md",
];
for (const file of required)
  assert.ok((await stat(file)).isFile(), `Required file missing: ${file}`);
const exportRoot = resolve("dist");
async function asset(source, url) {
  if (/^(?:https?:|data:|#)/.test(url)) return;
  assert.ok(!url.startsWith("/"), `Root-relative asset: ${url}`);
  const path = resolve(dirname(resolve(source)), url.split(/[?#]/)[0]);
  assert.ok(
    path === exportRoot || path.startsWith(exportRoot + sep),
    `Export escape: ${url}`,
  );
  const info = await stat(path).catch(() => null);
  assert.ok(info, `Missing asset referenced by ${source}: ${url}`);
  if (info.isDirectory())
    assert.ok((await stat(resolve(path, "index.html"))).isFile());
}
const html = await readFile("dist/index.html", "utf8");
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))
  await asset("dist/index.html", match[1]);
for (const file of await walk("dist")) {
  assert.ok(
    !/\.(?:tgz|zip|tar|gz|br|map)$/.test(file),
    `Unnecessary archive or map: ${file}`,
  );
  if (file.endsWith(".css")) {
    for (const match of (await readFile(file, "utf8")).matchAll(
      /url\(["']?([^"')]+)["']?\)/g,
    ))
      await asset(file, match[1]);
  }
  if (file.endsWith(".js")) {
    for (const match of (await readFile(file, "utf8")).matchAll(
      /from\s*["']([^"']+)["']/g,
    ))
      await asset(file, match[1]);
  }
}
assert.equal(await readFile("index.html", "utf8"), html);
assert.equal(
  await readFile("src/style.css", "utf8"),
  await readFile("dist/assets/style.css", "utf8"),
);
for (const file of await walk("public")) {
  assert.ok(
    (await readFile(file)).equals(
      await readFile(`dist/${relative("public", file)}`),
    ),
    `Asset copy differs: ${file}`,
  );
}
const modules = (await readdir("src"))
  .filter((name) => name.endsWith(".ts"))
  .sort();
for (const file of modules) {
  const expected = stripTypeScriptTypes(await readFile(`src/${file}`, "utf8"), {
    mode: "strip",
  });
  assert.equal(
    await readFile(`dist/assets/${file.replace(/\.ts$/, ".js")}`, "utf8"),
    expected,
    `Stale production module: ${file}`,
  );
}
const hash = createHash("sha256");
for (const file of [
  "index.html",
  "src/style.css",
  ...modules.map((file) => `src/${file}`),
])
  hash.update(await readFile(file));
assert.equal(
  JSON.parse(await readFile("dist/build.json", "utf8")).sourceHash,
  hash.digest("hex"),
);
const report = {
  checkedAt: new Date().toISOString(),
  limitBytes: limit,
  addedBytes: 0,
  fileCount: 0,
  remainingBytes: 0,
  groups: {},
  exportChecks:
    "All required files present; source/export match; all local asset/module/font references resolve inside dist; no root-relative assets, symlinks, dependency archives, or source maps in export.",
};
await writeFile(
  "artifacts/bundle-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
// Include this report itself in the byte count; iterate to settle its numeric fields.
for (let pass = 0; pass < 4; pass++) {
  const totals = Object.fromEntries(
    Object.keys(budgets).map((key) => [key, 0]),
  );
  const files = await walk(".");
  for (const file of files) {
    let group;
    if (file.startsWith("src/") || file === "index.html") group = "source";
    else if (file.startsWith("public/")) group = "public";
    else if (file.startsWith("dist/")) group = "dist";
    else if (file.startsWith("scripts/") || file.startsWith("tests/"))
      group = "tooling";
    else if (file.startsWith("artifacts/")) group = "artifacts";
    else if (file === ".gitignore") group = "ignore";
    else {
      assert.ok(!file.includes("/"), `Unbudgeted path: ${file}`);
      group = "root";
    }
    totals[group] += (await stat(file)).size;
  }
  for (const [group, bytes] of Object.entries(totals))
    assert.ok(
      bytes <= budgets[group],
      `${group} exceeds explicit path budget: ${bytes} > ${budgets[group]}`,
    );
  report.addedBytes = Object.values(totals).reduce(
    (sum, value) => sum + value,
    0,
  );
  assert.ok(report.addedBytes <= limit);
  report.fileCount = files.length;
  report.remainingBytes = limit - report.addedBytes;
  report.groups = Object.fromEntries(
    Object.entries(totals).map(([group, bytes]) => [
      group,
      { bytes, budgetBytes: budgets[group] },
    ]),
  );
  await writeFile(
    "artifacts/bundle-audit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(JSON.stringify(report, null, 2));
