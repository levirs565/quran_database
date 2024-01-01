import { program } from "commander";
import { readFileSync } from "fs";
import { writeDatabase } from "./util.js";

program
  .requiredOption("-i, --id <id>")
  .requiredOption("-f, --file <source file>")
  .parse();

const { id, file } = program.opts();

const dataRegex = /(?<sura>^\d+)\|(?<verse>\d+)\|(?<text>.+)$/gm;
const translatorRegex = /^#\s+Translator:\s+(.*)$/gm;
const lastUpdateRegex = /^#\s+Last Update:\s+(.*)$/gm;
const data = readFileSync(file).toString();
const translator = translatorRegex.exec(data)[1];
const lastUpdate = lastUpdateRegex.exec(data)[1];
const processedData = Array.from(data.matchAll(dataRegex), (match) => ({
  sura: match.groups.sura,
  verse: match.groups.verse,
  text: match.groups.text,
}));

const version = Date.parse(lastUpdate + " UTC") / 1000 / 60 / 60 / 24;
writeDatabase(
  {
    version: version.toString(),
    name: translator,
    verse: processedData,
  },
  "tanzil." + id
);
