import fs from "fs";
import { dbDir, distDir, idFile, readDatabase } from "./util.js";
import path from "path";
import { glob, globSync } from "glob";

console.log("Only export database registered in ids.json");

if (fs.existsSync(distDir)) {
  globSync("*", { cwd: distDir }).forEach((name) => {
    fs.rmSync(path.join(distDir, name));
  });
  fs.rmdirSync(distDir);
}

fs.mkdirSync(distDir);

const indexData = [];
const idMap = JSON.parse(fs.readFileSync(idFile));

for (const id in idMap) {
  const name = idMap[id];
  const db = readDatabase(name);
  const [, type] = name.split(".");
  const dbSummary = {
    id: Number(id),
    name: name,
    title: db.name,
    type,
    font: db.font,
  };
  fs.writeFileSync(
    path.join(distDir, name + ".json"),
    JSON.stringify({
      ...dbSummary,
      ...db,
    })
  );
  indexData.push(dbSummary);
}

fs.writeFileSync(path.join(distDir, "index.json"), JSON.stringify(indexData));
