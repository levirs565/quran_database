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

const imagePreviewList = [];

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
    let fontSize = 24 * 2;
    if (db.font === "LPMQ Isep Misbah") fontSize = 20 * 2;
    measureContext.font = `${fontSize}pt ${db.font}`;
    const textMetric = measureContext.measureText(db.verse[0].text);

    const textHeight =
      textMetric.actualBoundingBoxAscent + textMetric.actualBoundingBoxDescent;

    const previewName = `${name}.preview.png`;
    dbSummary.previewImage = previewName;
    imagePreviewList.push({
      fileName: previewName,
      contentWidth: textMetric.width,
      contentHeight: textHeight,
      font: measureContext.font,
      text: db.verse[0].text,
      deltaY: textMetric.actualBoundingBoxAscent,
    });
  } else if (type === "latin") {
    dbSummary.previewText = db.verse[0].text;
  }

  indexData.push(dbSummary);
}

console.log("Generating preview image...");

const maxContentWidth = Math.max(
  ...imagePreviewList.map((x) => x.contentWidth)
);
const maxContentHeight = Math.max(
  ...imagePreviewList.map((x) => x.contentHeight)
);
const previewWidth = maxContentWidth * 1.1;
const previewPaddingRight = maxContentWidth * 0.05;
const previewHeight = maxContentHeight * 1.1;

for (const {
  fileName,
  font,
  text,
  contentWidth,
  contentHeight,
  deltaY,
} of imagePreviewList) {
  const previewCanvas = createCanvas(previewWidth, previewHeight);
  const previewContext = previewCanvas.getContext("2d");
  previewContext.font = font;
  previewContext.fillStyle = "black";
  previewContext.fillText(
    text,
    previewWidth - contentWidth - previewPaddingRight,
    deltaY + (previewHeight - contentHeight) / 2
  );

  const previewFileStream = fs.createWriteStream(
    path.join(distDbDir, fileName)
  );
  const previewCanvasStream = previewCanvas.createPNGStream();
  previewCanvasStream.pipe(previewFileStream);
}

console.log("Writing database indexes...");
fs.writeFileSync(path.join(distDbDir, "index.json"), JSON.stringify(indexData));
