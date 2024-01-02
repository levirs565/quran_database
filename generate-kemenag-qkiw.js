import { program } from "commander";
import sqlite3 from "sqlite3";
import { join } from "path";
import { writeDatabase } from "./util.js";
import { globSync } from "glob";

program
  .requiredOption("-i, --input <directory>")
  .requiredOption("-v, --version <version>")
  .parse();

const options = program.opts();

const baseDataOpts = {
  version: options.version,
};

const idToPositionMap = new Map();

const importLajnah = () =>
  new Promise((resolve) => {
    const db = new sqlite3.Database(join(options.input, "kemenag.lajnah"));

    const verseTextData = {
      ...baseDataOpts,
      name: "Quran Hafs IndoPak",
      font: "LPMQ Isep Misbah",
      verse: [],
    };
    const verseGundulData = {
      ...baseDataOpts,
      name: "Plain Quran",
      font: "LPMQ Isep Misbah",
      verse: [],
    };
    const verseIsyaratData = {
      ...baseDataOpts,
      name: "Quran Isyarat",
      font: "LPMQ MSI ISYARAT",
      verse: [],
    };
    const surahData = {
      ...baseDataOpts,
      surah: [],
    };

    db.serialize(() => {
      db.each(
        "SELECT id, surah, ayat, teks, gundul, isyarat FROM quran",
        (err, row) => {
          // console.log(row);
          const pos = {
            sura: parseInt(row.surah),
            verse: parseInt(row.ayat),
          };
          verseTextData.verse.push({
            ...pos,
            text: row.teks,
          });
          verseGundulData.verse.push({
            ...pos,
            text: row.gundul,
          });
          verseIsyaratData.verse.push({
            ...pos,
            text: row.isyarat,
          });
          idToPositionMap.set(parseInt(row.id), pos);
        },
        () => {
          writeDatabase(verseTextData, "kemenag.text.hafs");
          writeDatabase(verseGundulData, "kemenag.text.plain");
          writeDatabase(verseIsyaratData, "kemenag.isyarat.isyarat");
        }
      );

      db.each(
        `SELECT id, namalatin, jumlahayat, namaarab, kategory,terjemah, posisi FROM namasurat`,
        (err, row) => {
          surahData.surah.push({
            index: parseInt(row.id),
            name: row.namalatin,
            verseCount: parseInt(row.jumlahayat),
            arabicName: row.namaarab,
            category: row.kategory,
            translation: row.terjemah,
            position: parseInt(row.posisi),
          });
        },
        () => {
          writeDatabase(surahData, "kemenag.extra.surah");
        }
      );
    });

    db.close(resolve);
  });

const timesNewRomanArabToNormalFont = {
  "\xa1": "ṣ",
  "\xa2": "Ṣ",
  "\xa3": "ṡ",
  "\xa4": "Ṡ",
  "\xa5": "ḥ",
  "\xa6": "Ḥ",
  "\xa7": "ẓ",
  "\xa8": "Ẓ",
  "\xa9": "ż",
  "\xaa": "Ż",
  "\xab": "ḍ",
  "\xac": "Ḍ",
  "\xae": "Ū",
  "\xaf": "ṭ",
  "\xb0": "Ṭ",
  "\xb1": "ā",
  "\xb2": "Ā",
  "\xb3": "ī",
  "\xb4": "Ī",
  "\xb5": "ū",
  "\xb8": "Ū",
};

function convertTimesNewRomanArabToNormalFont(text) {
  let result = text;
  for (const [key, value] of Object.entries(timesNewRomanArabToNormalFont)) {
    const regex = new RegExp(key, "g");
    result = result.replace(regex, value);
  }
  return result;
}

function importData() {
  const dataDir = join(options.input, "data");
  for (const name of globSync("*.ayt", {
    cwd: dataDir,
  })) {
    const baseName = name.substring(0, name.length - ".ayt".length);

    if (baseName === "en_sahih") {
      continue;
    }

    const db = new sqlite3.Database(join(dataDir, name));

    const data = {
      ...baseDataOpts,
      name: "",
      verse: [],
      footnote: [],
    };

    const isIndonesia2019 = baseName === "Indonesia2019";

    const type = ["ringkas_kemenag", "tahlili"].includes(baseName.toLowerCase())
      ? "tafsir"
      : "translation";

    db.serialize(() => {
      db.get("SELECT trans_name FROM trans", (err, row) => {
        data.name = row.trans_name;
      });
      db.each(
        `SELECT * FROM ${baseName}`,
        (err, row) => {
          const pos = idToPositionMap.get(parseInt(row.id));
          let text = row.text;
          if (baseName === "tahlili") {
            text = convertTimesNewRomanArabToNormalFont(text);
          }

          if (row.text_fn) {
            const fnList = row.text_fn.split("\n").reduce((acc, line) => {
              const current = line.trim();
              let match = current.match(/^(\d+)\)\s*(.*)$/);
              if (!match) {
                match = current.match(/^\((\d+)\s+(.*)$/);
                if (match) {
                  console.log(
                    `Warning: ${name} Improper footnote found at ${current}`
                  );
                }
              }
              if (acc.length == 0 && !match) {
                const prevFootnote = data.footnote[data.footnote.length - 1];
                console.log("----");
                console.log(
                  `Warning: ${name} Footnote maybe include previous footnote text`
                );
                console.log("Current row:", row);
                console.log("Previous footnote:", prevFootnote);
                console.log("Current text:", current);
                if (prevFootnote.text.endsWith(current))
                  console.log(
                    "Text not appended because previous footnote ends with current text"
                  );
                else {
                  console.log("Text appended to end previous footnote");
                  prevFootnote.text += " " + current;
                  console.log("Previous footnote text: ", prevFootnote.text);
                }
                console.log("----");
              } else if (acc.length == 0 || match) {
                acc.push({
                  index: parseInt(match[1]),
                  text: match[2],
                });
              } else {
                acc[acc.length - 1].text += "\n" + current;
              }
              return acc;
            }, []);
            const fnNoList = [];
            for (const { index, text } of fnList) {
              fnNoList.push(index);

              data.footnote.push({
                ...pos,
                index,
                text,
              });
            }

            for (const res of text.matchAll(/(?<!\([^)\sa-zA-Z]*)(\d+)\)/gm)) {
              const idx = parseInt(res[1]);
              if (!fnNoList.includes(idx)) {
                console.log(
                  `Warning: ${name} Verse have external foot note ${pos.sura}:${pos.verse} to ${idx}`
                );
              } else {
                fnNoList.splice(fnNoList.indexOf(idx), 1);
              }
            }

            if (fnNoList.length > 0) {
              console.log(
                `Warning: ${name} Verse have unused footnote ${pos.sura}:${pos.verse}`,
                fnNoList,
                row
              );
            }
          }

          data.verse.push({
            ...pos,
            text,
          });
        },
        () => {
          let dbName = baseName.toLowerCase();
          if (dbName === "ringkas_kemenag") dbName = "wajiz";
          writeDatabase(data, `kemenag.${type}.${dbName}`);
        }
      );

      if (isIndonesia2019) {
        const data = {
          ...baseDataOpts,
          theme: [],
        };
        db.each(
          "SELECT sura, mi, ma, tema FROM tema",
          (err, row) => {
            data.theme.push({
              sura: parseInt(row.sura),
              startVerse: parseInt(row.mi),
              endVerse: parseInt(row.ma),
              text: row.tema,
            });
          },
          () => {
            writeDatabase(data, `kemenag.extra.theme`);
          }
        );
      }
    });
    db.close();
  }
}

importLajnah().then(importData);
