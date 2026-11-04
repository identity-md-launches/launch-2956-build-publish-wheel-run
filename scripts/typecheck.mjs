import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// An explicit alternate compiler supports restricted contributors without modifying node_modules.
const compiler = process.argv[2] || require.resolve("typescript/lib/tsc.js");
const result = spawnSync(
  process.execPath,
  [compiler, "--noEmit", "--project", "tsconfig.json"],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
