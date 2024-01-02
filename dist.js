import fs from "fs";
import { currentDir, distDir, idFile, readDatabase } from "./util.js";
import path from "path";
import { globSync } from "glob";
import { createCanvas, registerFont } from "canvas";

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

console.log("Registering all fonts");

const fontsDir = path.join(currentDir, "fonts");
globSync("*", { cwd: fontsDir }).forEach((name) => {
  const fontName = path.parse(name).name;
  registerFont(path.join(fontsDir, name), { family: fontName });
});

const measureCanvas = createCanvas(200, 200);
const measureContext = measureCanvas.getContext("2d");

for (const id in idMap) {
  const name = idMap[id];
  const db = readDatabase(name);
  const [source, type] = name.split(".");
  const dbSummary = {
    id: Number(id),
    title: db.name,
    source,
    type,
    font: db.font,
  };
  fs.writeFileSync(
    path.join(distDir, id + ".json"),
    JSON.stringify({
      ...dbSummary,
      ...db,
    })
  );

  if (type === "text") {
    measureContext.font = `24pt ${db.font}`;
    const textMetric = measureContext.measureText(db.verse[0].text);

    const textHeight =
      textMetric.actualBoundingBoxAscent + textMetric.actualBoundingBoxDescent;
    const paddingVertical = textHeight * 0.05;
    const paddingHorizontal = textMetric.width * 0.05;

    const previewCanvas = createCanvas(
      textMetric.width + 2 * paddingHorizontal,
      textHeight + 2 * paddingVertical
    );
    const previewContext = previewCanvas.getContext("2d");

    previewContext.font = measureContext.font;
    previewContext.fillStyle = "black";
    previewContext.fillText(
      db.verse[0].text,
      paddingHorizontal,
      textMetric.actualBoundingBoxAscent + paddingVertical
    );

    const previewName = `${id}.preview.png`;
    const previewFileStream = fs.createWriteStream(
      path.join(distDir, previewName)
    );
    const previewCanvasStream = previewCanvas.createPNGStream();
    previewCanvasStream.pipe(previewFileStream);
    dbSummary.previewImage = previewName;
  } else if (type === "latin") {
    dbSummary.previewText = db.verse[0].text;
  }

  indexData.push(dbSummary);
}

fs.writeFileSync(path.join(distDir, "index.json"), JSON.stringify(indexData));
