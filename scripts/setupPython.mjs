import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const systemPython = process.platform === "win32" ? "python" : "python3";
const venvPython = process.platform === "win32"
  ? path.resolve(".venv/Scripts/python.exe")
  : path.resolve(".venv/bin/python");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(venvPython)) {
  run(systemPython, ["-m", "venv", ".venv"]);
}

run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"]);
