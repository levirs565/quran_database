import { fileURLToPath } from "url";
import path from "path";

export const currentDir = fileURLToPath(new URL("./", import.meta.url));
export const dbDir = path.join(currentDir, "database");
export const idFile = path.join(currentDir, "ids.json");
export const distDir = path.join(currentDir, "dist");
