// Compile TypeScript to dist/ and publish the stylesheets next to it.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(join(root, "dist"), { recursive: true, force: true });
execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: root, stdio: "inherit" });
mkdirSync(join(root, "dist/styles"), { recursive: true });
cpSync(join(root, "src/styles"), join(root, "dist/styles"), { recursive: true });
const css = (f) => readFileSync(join(root, "src/styles", f), "utf8");
// styles.css = tokens + kit + workspace. base.css (a minimal reset) stays separate: apps with their own preflight skip it.
writeFileSync(join(root, "dist/styles.css"), `${css("tokens.css")}\n${css("kit.css")}\n${css("workspace.css")}`);
console.log("built dist/");
