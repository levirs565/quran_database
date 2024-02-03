import fs, { cpSync, mkdirSync, statSync } from "fs";
import { currentDir, dbDir, distDir, idFile, readDatabase } from "./util.js";
import path from "path";
import { globSync } from "glob";
import { createCanvas, registerFont } from "canvas";

if (fs.existsSync(distDir)) {
  globSync("*/*", { cwd: distDir, nodir: true }).forEach((name) => {
    fs.rmSync(path.join(distDir, name));
  });
  globSync("**/*", { cwd: distDir }).forEach((name) => {
    fs.rmdirSync(path.join(distDir, name));
  });
  fs.rmdirSync(distDir);
}

fs.mkdirSync(distDir);

const authorMap = {
  kemenag: "Indonesian Ministry of Religious Affairs",
  kfgqpc: "King Fahd Quran Complex",
  tanzil: "Tanzil",
};

const includedType = ["text", "isyarat", "latin", "translation", "tafsir"];
const excludedName = [
  "pakdata.text.indopak",
  "pakdata.text.usmani",
  "kemenag.text.plain",
];

const indexData = [];
const dbList = fs
  .readdirSync(dbDir)
  .map((fname) => ({
    name: path.parse(fname).name,
    source: fname.split(".")[0],
    type: fname.split(".")[1],
  }))
  .filter(({ type }) => includedType.includes(type))
  .filter(({ name }) => !excludedName.includes(name));

console.log("Copying font...");

const fontsDir = path.join(currentDir, "fonts");
const distFontDir = path.join(distDir, "fonts");

cpSync(fontsDir + "/", distFontDir, {
  recursive: true,
});

console.log("Registering all fonts");

globSync("*", { cwd: fontsDir }).forEach((name) => {
  const fontName = path.parse(name).name;
  registerFont(path.join(fontsDir, name), { family: fontName });
});

const measureCanvas = createCanvas(200, 200);
const measureContext = measureCanvas.getContext("2d");

console.log("Copying databases...");
const distDbDir = path.join(distDir, "datas");
mkdirSync(distDbDir);

for (const { name, source, type } of dbList) {
  const db = readDatabase(name);
  const dbSummary = {
    id: name,
    title: db.name,
    author: authorMap[source],
    type,
    font: db.font,
  };

  if (!dbSummary.author) {
    console.log("Author not found: " + name);
    process.exit(0);
  }

  fs.writeFileSync(
    path.join(distDbDir, name + ".json"),
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

    const previewName = `${name}.preview.png`;
    const previewFileStream = fs.createWriteStream(
      path.join(distDbDir, previewName)
    );
    const previewCanvasStream = previewCanvas.createPNGStream();
    previewCanvasStream.pipe(previewFileStream);
    dbSummary.previewImage = previewName;
  } else if (type === "latin") {
    dbSummary.previewText = db.verse[0].text;
  }

  indexData.push(dbSummary);
}

console.log("Writing database indexes...");

fs.writeFileSync(path.join(distDbDir, "index.json"), JSON.stringify(indexData));
