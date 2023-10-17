import fs from "fs";
import { currentDir, dbDir } from "./util.js";
import path from "path";

const idFile = path.join(currentDir, "ids.json");

const dbList = fs.readdirSync(dbDir);
const idMap = fs.existsSync(idFile)
  ? JSON.parse(fs.readFileSync(idFile).toString())
  : {};

function* generateId() {
  let id = -1;
  while (true) {
    id++;
    if (Object.hasOwn(idMap, id)) continue;
    yield id;
  }
}

const idGenerator = generateId();

for (const db of dbList) {
  const name = path.parse(db).name;
  if (Object.values(idMap).includes(name)) continue;

  const [, type] = name.split(".");
  if (!["text", "translation", "tafsir"].includes(type)) continue;

  idMap[idGenerator.next().value] = name;
}

fs.writeFileSync(idFile, JSON.stringify(idMap, undefined, 2));
