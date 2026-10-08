import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const folder = resolve(
  "backups",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
mkdirSync(folder, { recursive: true });
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
function run(args, capture = false) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error("Backup incompleto. Nenhum arquivo existente foi removido.");
    process.exit(1);
  }
  return result.stdout;
}
run([
  "d1",
  "export",
  "DB",
  "--remote",
  "--output",
  resolve(folder, "database.sql"),
]);
let cursor;
const keys = [];
do {
  const output = run(
    [
      "kv",
      "key",
      "list",
      "--binding",
      "MEDIA",
      "--remote",
      ...(cursor ? ["--cursor", cursor] : []),
    ],
    true,
  );
  const result = JSON.parse(output);
  // Wrangler versions may return a plain list or an API envelope.
  keys.push(
    ...(Array.isArray(result) ? result : result.result || result.keys || []),
  );
  cursor =
    Array.isArray(result) || result.list_complete ? undefined : result.cursor;
} while (cursor);
mkdirSync(resolve(folder, "media"));
for (const key of keys) {
  if (!/^[a-f0-9-]{36}\/(image|thumbnail)$/.test(key.name))
    throw new Error("Chave de imagem inesperada.");
  run([
    "kv",
    "key",
    "get",
    key.name,
    "--binding",
    "MEDIA",
    "--remote",
    "--path",
    resolve(folder, "media", key.name.replace("/", "_") + ".webp"),
  ]);
}
writeFileSync(
  resolve(folder, "manifest.json"),
  JSON.stringify({ exportedAt: new Date().toISOString(), keys }, null, 2),
);
console.log(
  `Backup concluído: ${folder}. Guarde esta pasta em armazenamento privado. Não a envie ao GitHub.`,
);
