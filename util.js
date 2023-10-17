import { fileURLToPath } from "url";

export const currentDir = fileURLToPath(new URL("./", import.meta.url));
export const dbDir = fileURLToPath(new URL("./database", import.meta.url));
