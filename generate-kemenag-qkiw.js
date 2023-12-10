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

function importLajnah() {
  const db = new sqlite3.Database(join(options.input, "kemenag.lajnah"));

  const verseTextData = {
    ...baseDataOpts,
    name: "Quran Hafs oleh Kemenag",
    font: "LPMQ Isep Misbah",
    verse: [],
  };
  const verseGundulData = {
    ...baseDataOpts,
    name: "Quran Gundul oleh Kemenag",
    font: "LPMQ Isep Misbah",
    verse: [],
  };
  const verseIsyaratData = {
    ...baseDataOpts,
    name: "Quran Isyarat oleh Kemenag",
    font: "LPMQ MSI ISYARAT",
    verse: [],
  };
  const surahData = {
    ...baseDataOpts,
    surah: [],
  };

  db.serialize(() => {
    db.each(
      "SELECT surah, ayat, teks, gundul, isyarat FROM quran",
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
      },
      () => {
        writeDatabase(verseTextData, "kemenag.text.hafs");
        writeDatabase(verseGundulData, "kemenag.text.gundul");
        writeDatabase(verseIsyaratData, "kemenag.text.isyarat");
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

  db.close();
}

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

    const type = ["indonesia", "indonesia2019", "mandar"].includes(
      baseName.toLowerCase()
    )
      ? "translation"
      : "tafsir";

    db.serialize(() => {
      db.get("SELECT trans_name FROM trans", (err, row) => {
        data.name = row.trans_name;
      });
      let suraColumn = "sura";
      let verseColumn = "aya";
      if (baseName === "tahlili") {
        suraColumn = "aya";
        verseColumn = "juz";
      }
      db.each(
        `SELECT ${suraColumn}, ${verseColumn}, text ${
          isIndonesia2019 ? ",no_fn,text_fn" : ""
        } FROM ${baseName}`,
        (err, row) => {
          const pos = {
            sura: parseInt(row[suraColumn]),
            verse: parseInt(row[verseColumn]),
          };
          let text = row.text;
          if (baseName === "tahlili") {
            text = convertTimesNewRomanArabToNormalFont(text);
          }
          if (isIndonesia2019 && row.no_fn) {
            const noList =
              row.no_fn === "620621"
                ? ["620", "621"]
                : row.no_fn === "696697"
                ? ["696", "697"]
                : row.no_fn.split(",");
            const textList = row.text_fn.split("\n").reduce((acc, line) => {
              const current = line.trim();
              if (acc.length == 0 || /^\d+\)/.test(current)) {
                acc.push(current);
              } else {
                acc[acc.length - 1] += "\n" + current;
              }
              return acc;
            }, []);
            if (noList.length != textList.length) {
              console.log(
                `Warning footnote index and text list not match (${pos.sura}:${pos.verse})`
              );
              console.log(row.no_fn);
              console.log(row.text_fn);
            }
            for (let i = 0; i < noList.length; i++) {
              let index = parseInt(noList[i]);
              let text = textList[i];

              if (index == 28 && text.startsWith("280)")) {
                index = 280;
              }

              if (text.startsWith(`${index})`)) {
                text = text.replace(/^\d+\)\s*/, "");
              }

              if (index == 672 && text.startsWith("(672")) {
                text = text.replace(/^\(672\s*/, "");
              }

              noList[i] = index;

              data.footnote.push({
                ...pos,
                index,
                text,
              });
            }

            for (const res of text.matchAll(/(\d+)\)/g)) {
              const idx = parseInt(res[1]);
              if (!noList.includes(idx)) {
                console.log(
                  `Verse have external foot note ${pos.sura}:${pos.verse} to ${idx}`
                );
              }
            }
          }

          data.verse.push({
            ...pos,
            text,
          });
        },
        () => {
          writeDatabase(data, `kemenag.${type}.${baseName.toLowerCase()}`);
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

importLajnah();

importData();
