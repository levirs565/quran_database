import { program } from "commander";
import fetch from "node-fetch";
import { readDatabase, writeDatabase } from "./util.js";

program.requiredOption("-v, --version <version>").parse();

const rootUrl = "https://web-api.qurankemenag.net/quran-tafsir";

const textDatabase = readDatabase("kemenag.text.hafs");

const database = {
  version: program.opts().version,
  name: "Quran Latin",
  verse: [],
  contentType: "plain"
};

console.log("Downloading latin text ...");

Promise.all(
  textDatabase.verse.map((_, index) =>
    new Promise((resolve) => setTimeout(resolve, index * 100)).then(() =>
      fetch(`${rootUrl}/${index + 1}`).then((response) => {
        console.log(`Download success for ${response.url}`);
        return response;
      })
    )
  )
)
  .then((list) => {
    return Promise.all(list.map((response) => response.json()));
  })
  .then((list) => {
    return list.map(({ data }) => ({
      sura: data.surah_id,
      verse: data.ayah,
      text: data.latin,
    }));
  })
  .then((list) => {
    console.log("Checking indexes...");

    if (
      !list.every(({ sura, verse }, index) => {
        const textVerse = textDatabase.verse[index];
        return sura === textVerse.sura && verse === textVerse.verse;
      })
    ) {
      console.log("Database indexes wrong");
      console.log("Write database aborted");
      process.exit(1);
    }

    console.log("Writing database...");
    database.verse = list;
    writeDatabase(database, "kemenag.latin.latin");
  });
