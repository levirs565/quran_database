import { expandGlob , ensureDir, } from "@std/fs";
import { join, dirname, basename, parse } from "@std/path";
import { AuthorMetadata, CompiledDocumentSummary } from "./types.ts";
import * as yaml from "@std/yaml";
import { mdastToHtmlSimple, mdToMdast } from "./engine.ts";
import { mdastToDocument } from "./engine.ts";
import { CompiledDocument } from "./types.ts";

const dataDir = join(import.meta.dirname!, "data")
const distDir = join(import.meta.dirname!, "dist")

await ensureDir(distDir)

const authors: Record<string, AuthorMetadata> = {};

for await (const entry of expandGlob("*/index.yaml", {
    root: dataDir
})) {
    const authorName = basename(dirname(entry.path));
    const metadata = yaml.parse(await Deno.readTextFile(entry.path)) as AuthorMetadata;
    authors[authorName] = metadata;
}

const compiledList: CompiledDocumentSummary[] = [];

for await (const entry of expandGlob("*/*.md", {
    root: dataDir
})) {
    const authorName = basename(dirname(entry.path));
    const { name } = parse(entry.path);
    const mdAst = mdToMdast(await Deno.readTextFile(entry.path));
    const document = mdastToDocument(mdAst);

    const id = `${authorName}.${name}`

    const compiledSummary: CompiledDocumentSummary = {
        id,
        ...authors[authorName],
        ...document.metadata
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

    await Deno.writeTextFile(join(distDir, `${id}.json`),JSON.stringify(compiledDocument));
}
