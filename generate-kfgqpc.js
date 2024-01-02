import { program } from "commander";
import { copyFileSync, readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";
import * as fontkit from "fontkit";
import { currentDir, writeDatabase } from "./util.js";

program.requiredOption("-d, --directory <source directory>").parse();

const opts = program.opts();

function globData(glob) {
  return globSync(glob, {
    cwd: opts.directory,
  });
}

const readmeFiles = globData("*/read.me");

if (readmeFiles.length == 0) throw new Error("Readme files not found");

const nameRegex = /^--\s+KFGQPC\s([\w\s]+)\s+Data$/gm;
const versionRegex = /^--\s+Version:\s+(.+)$/gm;
const readmeData = readFileSync(
  join(opts.directory, readmeFiles[0])
).toString();
const version = versionRegex.exec(readmeData)[1];
const name = nameRegex.exec(readmeData)[1];
const dbName = "kfgqpc.text." + name.toLowerCase().replace(/\s+/g, "-");

console.log("Found name: " + name);
console.log("Found version: " + version);
console.log("Database name: " + dbName);

const dataFiles = globData("*/*.json");

if (dataFiles.length == 0) throw new Error("Data file not found");

const data = JSON.parse(
  readFileSync(join(opts.directory, dataFiles[0])).toString()
);

const fontFiles = globData("*/*.ttf");

if (fontFiles.length == 0) throw new Error("Font file not found");
if (fontFiles.length > 1)
  console.log("Warning: Too mant font file. Using first file");

const fontFile = join(opts.directory, fontFiles[0]);
const font = fontkit.openSync(fontFile).familyName;

copyFileSync(fontFile, join(currentDir, "fonts", font + ".ttf"));

const breakRelativeIndexCount = new Map();

function processVerseText(verse) {
  let breakIndex = verse.lastIndexOf("\xa0");
  if (breakIndex == -1) breakIndex = verse.lastIndexOf("\u0020");
  if (breakIndex == -1)
    throw Error("Cannot find verse index separator in " + verse);
  const relativeIndex = breakIndex - verse.length;
  if (!breakRelativeIndexCount.has(relativeIndex))
    breakRelativeIndexCount.set(relativeIndex, 0);
  breakRelativeIndexCount.set(
    relativeIndex,
    breakRelativeIndexCount.get(relativeIndex) + 1
  );
  return verse.substring(0, breakIndex);
}

writeDatabase(
  {
    version,
    name,
    font,
    verse: data.map((item) => ({
      sura: item.sura_no,
      verse: item.aya_no,
      text: processVerseText(item.aya_text),
    })),
  },
  dbName
);

console.log("Break Relative Index:");
console.log(breakRelativeIndexCount);

if (Array.from(breakRelativeIndexCount.keys()).length > 1)
  console.log("Warning: Removing verse index maybe fail");
