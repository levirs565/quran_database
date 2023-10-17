import fs from "fs";
import { dbDir, distDir, idFile } from "./util.js";
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
  const db = JSON.parse(fs.readFileSync(path.join(dbDir, name + ".json")));
  const [, type] = name.split(",");
  const dbSummary = {
    id,
    name: db.name,
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
