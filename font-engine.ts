import { createCanvas, Fonts } from "@gfx/canvas";
import { join } from "@std/path";
import { expandGlob } from "@std/fs/expand-glob";

export const fontsDir = join(import.meta.dirname!, "fonts");

for await (const entry of expandGlob("*.ttf", {
    root: fontsDir
})) {
    Fonts.register(entry.path)
}

interface FontPreviewData {
    dist: string,
    contentWidth: number,
    contentHeight: number,
    font: string,
    text: string,
    deltaY: number,
}

export function createFontPreviewEngine() {
    const measureCanvas = createCanvas(200, 200);
    const measureContext = measureCanvas.getContext("2d");

    const list: FontPreviewData[] = [];
    function add(dist: string, text: string, font: string, fontSizePt: number) {
        measureContext.font = `${fontSizePt}pt ${font}`;
        const textMetric = measureContext.measureText(text);
        const textHeight =
            textMetric.actualBoundingBoxAscent + textMetric.actualBoundingBoxDescent;

        list.push({
            dist,
            contentWidth: textMetric.width,
            contentHeight: textHeight,
            font: measureContext.font,
            text: text,
            deltaY: textMetric.actualBoundingBoxAscent,
        });
    }

    function build() {
        const maxContentWidth = Math.max(
            ...list.map((x) => x.contentWidth)
        );
        const maxContentHeight = Math.max(
            ...list.map((x) => x.contentHeight)
        );
        const previewWidth = Math.floor(maxContentWidth * 1.1);
        const previewPaddingRight = maxContentWidth * 0.05;
        const previewHeight = Math.floor(maxContentHeight * 1.1);

        for (const {
            dist,
            font,
            text,
            contentWidth,
            contentHeight,
            deltaY,
        } of list) {
            const previewCanvas = createCanvas(previewWidth, previewHeight);
            const previewContext = previewCanvas.getContext("2d");
            previewContext.font = font;
            previewContext.fillStyle = "black";
            previewContext.fillText(
                text,
                previewWidth - contentWidth - previewPaddingRight,
                deltaY + (previewHeight - contentHeight) / 2
            );

            previewCanvas.save(dist, "png", 100);
        }
    }

    return {
        add,
        build
    }
}