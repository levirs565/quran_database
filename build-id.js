import fs from "fs";
import { dbDir, idFile } from "./util.js";
import path from "path";

const includedType = ["text", "isyarat", "latin", "translation", "tafsir"];
const excludedName = ["pakdata.text.indopak", "pakdata.text.usmani"];

const dbList = fs
  .readdirSync(dbDir)
  .map((fname) => ({
    name: path.parse(fname).name,
    type: fname.split(".")[1],
  }))
  .filter(({ type }) => includedType.includes(type))
  .filter(({ name }) => !excludedName.includes(name))
  .sort((a, b) => {
    if (a.type != b.type) {
      return includedType.indexOf(a.type) - includedType.indexOf(b.type);
    } else if (a.name > b.name) return 1;
    else if (b.name < a.name) return -1;
    return 0;
  });

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

for (const { name } of dbList) {
  if (Object.values(idMap).includes(name)) continue;
  idMap[idGenerator.next().value] = name;
}

fs.writeFileSync(idFile, JSON.stringify(idMap, undefined, 2));
