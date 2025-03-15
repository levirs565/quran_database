import { Root } from "mdast";

export interface BaseMetadata {
    title: string;
}

export interface TextMetadata extends BaseMetadata {
    type: "text";
    font: string;
    previewImage?: string;
}

export interface IsyaratMetadata extends BaseMetadata {
    type: "isyarat";
}

export interface LatinMetadata extends BaseMetadata {
    type: "latin";
}

export interface TranslationMetadata extends BaseMetadata {
    type: "translation";
}

export interface TafsirMetadata extends BaseMetadata {
    type: "tafsir";
}

export type Metadata = TextMetadata | IsyaratMetadata | LatinMetadata | TranslationMetadata | TafsirMetadata;


export interface VerseFootnote {
    index: number;
    text: Root;
}

export interface Verse {
    sura: number;
    verse: number;
    text: Root;
}

export interface Document {
    verseList: Verse[],
    footnoteList: VerseFootnote[]
    metadata: Metadata;
}

export interface AuthorMetadata {
    author: string;
}

export interface CompiledVerseFootnote {
    index: number;
    text: string;
}

export interface CompiledVerse {
    sura: number;
    verse: number;
    text: string;
}

export type CompiledDocumentSummary = Metadata & AuthorMetadata & {
    id: string;
}

export type CompiledDocument = CompiledDocumentSummary & {
    verseList: CompiledVerse[];
    footnoteList: CompiledVerseFootnote[]
};