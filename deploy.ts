import { expandGlob, ensureDir, copy } from "@std/fs";
import { join, dirname, basename, parse } from "@std/path";
import { AuthorMetadata, CompiledDocumentSummary } from "./types.ts";
import * as yaml from "@std/yaml";
import { mdastToHtmlSimple, mdToMdast } from "./engine.ts";
import { mdastToDocument } from "./engine.ts";
import { CompiledDocument } from "./types.ts";
import { createFontPreviewEngine, fontsDir } from "./font-engine.ts";

const dataDir = join(import.meta.dirname!, "data")
const distDir = join(import.meta.dirname!, "dist")

await Deno.remove(distDir, { recursive: true });
await ensureDir(distDir);
await copy(fontsDir, join(distDir, "fonts"));

const authors: Record<string, AuthorMetadata> = {};

for await (const entry of expandGlob("*/index.yaml", {
    root: dataDir
})) {
    const authorName = basename(dirname(entry.path));
    const metadata = yaml.parse(await Deno.readTextFile(entry.path)) as AuthorMetadata;
    authors[authorName] = metadata;
}

const compiledList: CompiledDocumentSummary[] = [];
const fontPreviewEngine = createFontPreviewEngine();

console.log("Compiling documents ...")

for await (const entry of expandGlob("*/*.md", {
    root: dataDir
})) {
    const authorName = basename(dirname(entry.path));
    const { name } = parse(entry.path);
    const mdAst = mdToMdast(await Deno.readTextFile(entry.path));
    const document = mdastToDocument(mdAst);

    const id = `${authorName}.${name}`

    if (authorName == "pakdata") continue;
    console.log(`Compiling ${id}`)

    const compiledSummary: CompiledDocumentSummary = {
        id,
        ...authors[authorName],
        ...document.metadata
    }

    if (compiledSummary.type == "text") {
        let fontSize = 24 * 2;
        if (compiledSummary.font === "LPMQ Isep Misbah") fontSize = 20 * 2;

        const previewName = `${id}.preview.png`;
        compiledSummary.previewImage = previewName;
        fontPreviewEngine.add(
            join(distDir, previewName),
            await mdastToHtmlSimple(document.verseList[0].text),
            compiledSummary.font,
            fontSize
        );
    }

    const compiledDocument: CompiledDocument = {
        ...compiledSummary,
        verseList: await Promise.all(document.verseList.map(async ({ text, ...rest }) => ({
            text: await mdastToHtmlSimple(text),
            ...rest
        }))),
        footnoteList: await Promise.all(document.footnoteList.map(async ({ text, ...rest }) => ({
            text: await mdastToHtmlSimple(text),
            ...rest
        })))
    }

    compiledList.push(compiledSummary);

    await Deno.writeTextFile(join(distDir, `${id}.json`), JSON.stringify(compiledDocument));
}

await Deno.writeTextFile(join(distDir, "index.json"), JSON.stringify(compiledList));

console.log("Generating preview images ...")
fontPreviewEngine.build()