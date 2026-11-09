import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(root, "tooling/boundary-fixtures");
const tsc = path.join(root, "node_modules/typescript/bin/tsc");

const names = (await readdir(fixturesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (names.length === 0) {
  console.error("no boundary fixtures");
  process.exit(1);
}

let failed = false;

for (const name of names) {
  const directory = path.join(fixturesDir, name);
  const expected = JSON.parse(await readFile(path.join(directory, "expect.json"), "utf8"));
  const code = expected.code;
  const result = spawnSync(process.execPath, [tsc, "-p", directory, "--pretty", "false", "--noEmit"], {
    encoding: "utf8",
    cwd: root,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status === 0) {
    console.error(`${name}: compiled, expected ${code}`);
    failed = true;
    continue;
  }
  if (!new RegExp(`\\b${code}\\b`).test(output)) {
    console.error(`${name}: missing ${code}`);
    console.error(output.trim());
    failed = true;
    continue;
  }
  console.log(`${name}: ${code}`);
}

if (failed) {
  process.exit(1);
}
