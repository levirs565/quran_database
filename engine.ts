import { Document, Metadata, Verse, VerseFootnote } from "./types.ts"
import * as yaml from "@std/yaml";
import { FootnoteDefinition, Heading, Root, RootContent, Yaml } from "https://esm.sh/@types/mdast@4.0.4";
import remarkParse from 'https://esm.sh/remark-parse@11'
import rehypeParse from 'https://esm.sh/rehype-parse@9';
import rehypeRemark from 'https://esm.sh/rehype-remark@10';
import remarkFrontmatter from 'https://esm.sh/remark-frontmatter@5'
import remarkGfm from 'https://esm.sh/remark-gfm@4'
import remarkStringify from 'https://esm.sh/remark-stringify@11'
import { toString } from 'https://esm.sh/mdast-util-to-string@4'
import { unified } from 'https://esm.sh/unified@11'
import { u } from 'https://esm.sh/unist-builder@4'

const htmlToMdastProcessor = unified().use(rehypeParse).use(rehypeRemark);
const mdastParseProcessor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
const mdastStringifyProcessor = unified().use(remarkFrontmatter, ["yaml"]).use(remarkGfm).use(remarkStringify);

export function htmlToMdast(text: string) {
    const ast = htmlToMdastProcessor.parse(text);
    return htmlToMdastProcessor.run(ast);
}

export function mdToMdast(text: string): Root {
    return mdastParseProcessor.parse(text) as Root;
}

export function plainToMdast(text: string) {
    return u("root", [
        ...text.split("\n").map((line) => u("paragraph", [
            u("text", {
                value: line.trimEnd()
            })
        ]))
    ]);
}

export function documentToMdAst(document: Document): Root {
    const { title, ...frontmatter } = document.metadata;
    return u("root", [
        u("yaml", {
            value: yaml.stringify(frontmatter)
        }),
        u("heading", {
            depth: 1
        }, [
            u("text", { value: title })
        ]) as Heading,
        ...document.verseList.flatMap((verse) => [
            u("heading", {
                depth: 2
            }, [
                u("text", { value: `${verse.sura}:${verse.verse}` })
            ]),
            ...verse.text.children,
        ] as RootContent[]
        ),
        ...document.footnoteList.map(
            (footnote) => u("footnoteDefinition", {
                identifier: `${footnote.index}`,
            }, footnote.text.children
            ) as FootnoteDefinition
        )
    ]);
}


export function mdastToMd(ast: Root) {
    return mdastStringifyProcessor.stringify(ast);
}

export function mdastToDocument(root: Root): Document {
    let frontmatter: any;
    let title: string = "";

    const footnoteList: VerseFootnote[] = [];
    const verseList: Verse[] = []

    let lastVerse: Verse | undefined = undefined;

    for (const node of root.children) {
        if (node.type == "yaml") {
            frontmatter = yaml.parse(node.value);
        }
        else if (node.type == "footnoteDefinition") {
            footnoteList.push({
                index: Number.parseInt(node.identifier),
                text: u("root", [...node.children])
            })
        }
        else if (node.type == "heading") {
            if (node.depth == 1) {
                title = toString(node)
            } else if (node.depth == 2) {
                const headerText = toString(node);
                const [sura, verseNumber] = headerText.split(":", 2).map(text => Number.parseInt(text))
                lastVerse = {
                    sura,
                    verse: verseNumber,
                    text: u("root", []),
                }
                verseList.push(lastVerse)
            }
        } else if (lastVerse) {
            lastVerse.text.children.push(node)
        }
    }

    return {
        metadata: {
            title,
            ...frontmatter
        },
        verseList,
        footnoteList
    }
}