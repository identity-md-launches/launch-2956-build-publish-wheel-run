import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist");
const port = Number(process.argv[2] || 4173);
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
export function serve(request, response) {
  void (async () => {
    try {
      const url = new URL(request.url || "/", "http://localhost");
      const pathname = decodeURIComponent(url.pathname).replace(
        /^\/preview\//,
        "/",
      );
      let file = resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
      const body = await readFile(file);
      response.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  })();
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/preview.mjs")
) {
  const server = createServer(serve).listen(port, "127.0.0.1", () =>
    console.log(`Wheel Run: http://127.0.0.1:${port}/preview/`),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => server.close());
}
