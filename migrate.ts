import { documentToMdAst, mdastToMd, mdToMdast } from "./engine.ts";
import { parse, join, dirname } from "@std/path"
import { ensureDir } from "@std/fs"
import { Document, IsyaratMetadata, Metadata } from "./types.ts";
import { htmlToMdast } from "./engine.ts";
import { plainToMdast } from "./engine.ts";
import { Heading, Paragraph, PhrasingContent, Root, RootContent, Text } from "https://esm.sh/@types/mdast@4.0.4";
import { u } from 'https://esm.sh/unist-builder@4'
import 'https://esm.sh/remark-gfm@4'
import { paragraph } from "https://esm.sh/mdast-util-to-markdown@2.1.2/lib/handle/paragraph.js";

const databaseDir = join(import.meta.dirname!, "database")

const mapKemenagTranslationText = (text: Text): PhrasingContent[] => {
    let lastIndex = 0;

    const result: PhrasingContent[] = []
    for (const match of text.value.matchAll(/(\d+)\)/g)) {
        result.push(u("text", { value: text.value.substring(lastIndex, match.index) }));
        result.push(u('footnoteReference', {
            identifier: match[1],
        }))
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex != text.value.length) {
        result.push(u("text", { value: text.value.substring(lastIndex, text.value.length) }));
    }

    return result;
}

const mapKemenagTranslationParagraph = ({children, ...rest}: Paragraph): Paragraph => ({
    ...rest,
    children: children.flatMap((child) => child.type == "text" ? mapKemenagTranslationText(child) : [child])
}) 

const mapKemenagMdast = ({ children, ...rest }: Root): Root => ({
    ...rest,
    children: children.map((child) => child.type == "paragraph" ? mapKemenagTranslationParagraph(child) : child)
}) 

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
        verseList: [],
        footnoteList: []
    }
    const parseText = parsedName.name == "tanzil.latin.en" ? htmlToMdast
        : async (text: string) => plainToMdast(text);

    for (const { sura, verse, text } of data.verse) {
        let mdast = await parseText(text);
        if ( source == "kemenag" && type == "translation") {
            mdast = mapKemenagMdast(mdast);
        }
        document.verseList.push(
            {
                sura,
                verse,
                text: mdast,
            }
        )

    }

    if (data.footnote)
        for (const { index, text } of data.footnote) {
            document.footnoteList.push({
                index: index,
                text: await parseText(text)
            })
        }

    const targetFile = join(import.meta.dirname!, "data", source, `${name}.md`)

    const mdast = documentToMdAst(document)
    const text = mdastToMd(mdast);

    await ensureDir(dirname(targetFile));
    await Deno.writeTextFile(targetFile, text);
}

