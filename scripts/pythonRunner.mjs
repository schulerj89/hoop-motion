import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const venvPython = process.platform === "win32"
  ? path.resolve(".venv/Scripts/python.exe")
  : path.resolve(".venv/bin/python");

const executable = existsSync(venvPython)
  ? venvPython
  : process.platform === "win32"
    ? "python"
    : "python3";

const result = spawnSync(executable, process.argv.slice(2), {
  stdio: "inherit",
  shell: false
});

process.exit(result.status ?? 1);
