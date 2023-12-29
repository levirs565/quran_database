import { fileURLToPath } from "url";
import path from "path";
import { writeFileSync, readFileSync } from "fs";

export const currentDir = fileURLToPath(new URL("./", import.meta.url));
export const dbDir = path.join(currentDir, "database");
export const idFile = path.join(currentDir, "ids.json");
export const distDir = path.join(currentDir, "dist");

export function writeDatabase(data, name) {
  writeFileSync(
    path.join(dbDir, name + ".json"),
    JSON.stringify(data, undefined, 2)
  );
}

export function readDatabase(name) {
  return JSON.parse(readFileSync(path.join(dbDir, name + ".json")));
}

export const suraCount = 114;
