import { Document, Metadata, Verse } from "./types.ts"
import * as yaml from "@std/yaml";
import { Heading, Root, RootContent } from "https://esm.sh/@types/mdast@4.0.4";
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
        u("paragraph", [
            u("text", {
                value: text
            })
        ])
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
        ...document.verseList.flatMap((verse) => {
            const heading = u("heading", {
                depth: 2
            }, [
                u("text", { value: `${verse.sura}:${verse.verse}` })
            ])
            const footnotes = verse.footnotes.map((footnote) =>
                u("footnoteDefinition", {
                    identifier: `${footnote.index}`,
                }, footnote.text.children
                )
            )
            return [
                heading,
                ...verse.text.children,
                ...footnotes
            ] as RootContent[]
        })
    ]);
}

export function mdastToMd(ast: Root) {
    return mdastStringifyProcessor.stringify(ast);
}

export function mdastToDocument(root: Root): Document {
    let currentIndex = -1
    let current: RootContent | undefined = undefined;

    function next() {
        if (currentIndex + 1 >= root.children.length) {
            current = undefined;
        } else {
            currentIndex++;
            current = root.children[currentIndex];
        }
    }

    function parseFrontmatter(): any {
        if (!current || current.type != "yaml") {
            console.log(JSON.stringify(current))
            throw new Error("Expected YAML frontmatter");
        }

        const frontmatter = yaml.parse(current.value);
        next()
        return frontmatter;
    }

    function parseMetadata() {
        const frontmatter = parseFrontmatter();

        if (!current || current.type != "heading" || current.depth != 1) {
            throw new Error("Expected heading with depth 1")
        }
        const title = toString(current);
        next();

        return {
            ...frontmatter,
            title,
        } as Metadata
    }

    function parseVerseList() {
        const verseList: Verse[] = [];
        while (current) {
            const headerText = toString(current);
            const [sura, verseNumber] = headerText.split(":", 2).map(text => Number.parseInt(text))
            const verse: Verse = {
                sura,
                verse: verseNumber,
                text: u("root", []),
                footnotes: []
            }

            next();
            while (current && current.type != "heading") {
                if (current.type != "footnoteDefinition") {
                    verse.text.children.push(current)
                } else {
                    verse.footnotes.push({
                        index: Number.parseInt(current.identifier),
                        text: u("root", [...current.children])
                    })
                }
                next();
            }
            verseList.push(verse)
        }
        return verseList;
    }

    next();
    const metadata = parseMetadata()
    const verseList = parseVerseList();

    return {
        metadata,
        verseList
    }
}