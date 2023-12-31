import { program } from "commander";
import fetch from "node-fetch";
import { readDatabase, suraCount, writeDatabase } from "./util.js";
import { load } from "cheerio";

program.requiredOption("-v, --version <version>").parse();

const version = program.opts().version;

function getFontName(script) {
  return script.name === "IndoPak"
    ? "_PDMS_Saleem_QuranFont"
    : "_PDMS_IslamicFont";
}

function getBaseData() {
  return fetch("https://read.quranexplorer.com/")
    .then((response) => {
      return response.text();
    })
    .then((text) => load(text))
    .then(($) => ({
      scripts: $("#cmbScript option")
        .map((i, el) => {
          const option = $(el);
          return {
            id: option.attr("value"),
            name: option.text(),
          };
        })
        .toArray(),
      suraList: $("#htdSurasTV")
        .attr("value")
        .split(";")
        .filter((v) => v)
        .map((val) => parseInt(val))
        .map((verseCount, index) => ({ sura: index + 1, verseCount })),
    }));
}

function getSuraVerseList(script, translation, sura, fromVerse, toVerse) {
  const url =
    "https://read.quranexplorer.com/Quran/GetVerseResources/" +
    sura +
    "/" +
    script.id +
    "/" +
    translation.id +
    "/" +
    fromVerse +
    "/" +
    toVerse +
    "/" +
    script.name +
    "/" +
    translation.name +
    "/Tajweed-OFF/24";
  const idPrefix = "sp_txt_Multi_Script_";
  return fetch(url)
    .then((resp) => resp.json())
    .then((data) =>
      data.Payload.FetchVerseResourcesMulti.map((obj) => obj.VerseText).join("")
    )
    .then((html) => load(html))
    .then(($) =>
      $("font")
        .map((i, el) => $(el))
        .toArray()
    )
    .then((elList) =>
      elList
        .map(($) => [$.attr("id"), $.text()])
        .filter(([id]) => id.startsWith(idPrefix))
        .map(([id, text]) => [id.substring(idPrefix.length), text])
        .map(([verseIndex, text]) => [
          Number(verseIndex),
          text.replace(
            /\s*(\u200F﴿\uFEFF.*\uFEFF﴾|\(\uFEFF.*\uFEFF\)\uFEFF)/g,
            ""
          ),
        ])
        .map(([verse, text]) => ({
          sura,
          verse,
          text,
        }))
    )
    .catch((e) => {
      console.error(e);
      console.log(
        `Cannot get verse for ${script.name}/${translation.name} sura ${sura} from verse ${fromVerse} to ${toVerse} url ${url}`
      );
      process.exit();
    });
}

function getQuranVerseList(script, translation, suraList) {
  return Promise.resolve(suraList)
    .then((suraList) =>
      suraList.map(({ sura, verseCount }) =>
        new Promise((resolve) => {
          setTimeout(resolve, 1000 * sura);
        })
          .then(() =>
            getSuraVerseList(script, translation, sura, 1, verseCount)
          )
          .then((result) => {
            console.log(
              `Download for ${script.name}/${translation.name} surah ${sura} success`
            );
            return result;
          })
      )
    )
    .then((list) => Promise.all(list))
    .then((list) => list.flat());
}

getBaseData().then(({ scripts, suraList }) =>
  scripts.map((script) =>
    getQuranVerseList(
      script,
      {
        id: "0",
        name: "Hide",
      },
      suraList
    )
      .then((verse) => ({
        version,
        name: script.name,
        font: getFontName(script),
        verse,
      }))
      .then((db) => {
        writeDatabase(db, `pakdata.text.${db.name.toLowerCase()}`);
        console.log("Success written for database " + db.name);
      })
  )
);
