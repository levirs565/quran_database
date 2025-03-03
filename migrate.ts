import { documentToMdAst, mdastToMd, mdToMdast } from "./engine.ts";
import { parse, join, dirname } from "@std/path"
import { ensureDir } from "@std/fs"
import { Document, IsyaratMetadata, Metadata } from "./types.ts";
import { htmlToMdast } from "./engine.ts";
import { plainToMdast } from "./engine.ts";
import { Heading, Paragraph, Root, RootContent } from "https://esm.sh/@types/mdast@4.0.4";
import { u } from 'https://esm.sh/unist-builder@4'
import 'https://esm.sh/remark-gfm@4'

const databaseDir = join(import.meta.dirname!, "database")

const parseKemenag = async (text: string): Promise<Root> => {
    let lastIndex = 0;

    const paragraph: Paragraph = u("paragraph", []);
    for (const match of text.matchAll(/(\d+)\)/g)) {
        paragraph.children.push(u("text", {value: text.substring(lastIndex, match.index)}));
        paragraph.children.push(u('footnoteReference', {
            identifier: match[1],
        }))
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex != text.length) {
        paragraph.children.push(u("text", {value: text.substring(lastIndex, text.length)}));
    }

    return u("root", [paragraph]);
}

for await (const child of Deno.readDir(databaseDir)) {
    if (!child.isFile) continue;

    const parsedName = parse(child.name);
    if (parsedName.ext != '.json') continue;

    const [source, type, name] = parsedName.name.split(".");

    if (type == "extra") continue;

    console.log(`Migrating ${child.name}`)
    const data = JSON.parse((await Deno.readTextFile(join(databaseDir, child.name))))

    let metadata: Metadata;
    if (type == "isyarat" || type == "latin" || type == "translation" || type == "tafsir") {
        metadata = {
            type,
            title: data.name,
        } as IsyaratMetadata;
    } else {
        metadata = {
            type: "text",
            title: data.name,
            font: data.font
        }
    }

    const document: Document = {
        metadata,
        verseList: []
    }
    const parser = parsedName.name == "tanzil.latin.en" ? htmlToMdast
        : source == "kemenag" && type == "translation" ? parseKemenag
            : async (text: string) => plainToMdast(text);

    for (const { sura, verse, text } of data.verse) {
        document.verseList.push(
            {
                sura,
                verse,
                text: await parser(text),
                footnotes: []
            }
        )
    }

    if (data.footnote)
        for (const { sura, verse, index, text } of data.footnote) {
            const verseObj = document.verseList.find((val) => val.sura == sura && val.verse == verse)
            verseObj?.footnotes.push({
                index: index,
                text: await parser(text)
            })
        }

    const targetFile = join(import.meta.dirname!, "data", source, `${name}.md`)

    const mdast = documentToMdAst(document)
    const text = mdastToMd(mdast);

    await ensureDir(dirname(targetFile));
    await Deno.writeTextFile(targetFile, text);
}

