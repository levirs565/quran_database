import { Document, Metadata, Verse, VerseFootnote } from "./types.ts"
import * as yaml from "@std/yaml";
import { FootnoteDefinition, Heading, Root, RootContent, Yaml } from "mdast";
import { Element, Text } from "https://esm.sh/@types/hast@3.0.4/index.d.ts";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { toString } from "mdast-util-to-string"
import { unified } from "unified"
import { u } from "unist-builder";
import { FootnoteReference } from "mdast";

const htmlToMdastProcessor = unified()
    .use(rehypeParse)
    .use(rehypeRemark);
const mdastToHtmlSimpleProcessor = unified()
    .use(remarkRehype, {
        handlers: {
            footnoteReference(state, node: FootnoteReference, parent) {
                return u(
                    "element",
                    {
                        tagName: "footnote-ref",
                        properties: {
                            to: node.identifier
                        },
                    },
                    [
                        u(
                            "text",
                            {
                                value: node.label,
                            }
                        ) as Text
                    ]
                ) as Element;
            }
        }
    })
    .use(rehypeStringify);
const mdastParseProcessor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm);
const mdastStringifyProcessor = unified()
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkStringify);

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

export async function mdastToHtmlSimple(root: Root) {
    const hast = await mdastToHtmlSimpleProcessor.run(root);
    if (hast.children.length == 1 && 
        hast.children[0].type == "element" && 
        hast.children[0].tagName == "p") {
        return mdastToHtmlSimpleProcessor.stringify({
            type: "root",
            children: hast.children[0].children
        })
    }

    return mdastToHtmlSimpleProcessor.stringify(hast);
}