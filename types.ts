import { Root } from "https://esm.sh/@types/mdast@4.0.4";

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
    footnotes: VerseFootnote[]
}

export interface Document {
    metadata: Metadata;
    verseList: Verse[]
}