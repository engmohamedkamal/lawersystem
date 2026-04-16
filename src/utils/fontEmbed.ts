import fs from "fs";
import path from "path";

let cairoFontCSS: string | null = null;
let amiriFontCSS: string | null = null;

const loadFontAsBase64 = (filePath: string, mimeType = "font/woff2"): string | null => {
    try {
        const buf = fs.readFileSync(filePath);
        return `data:${mimeType};base64,${buf.toString("base64")}`;
    } catch {
        return null;
    }
};

export const getCairoFontCSS = (): string => {
    if (cairoFontCSS) return cairoFontCSS;

    const fontsDir = path.join(__dirname, "../../node_modules/@fontsource/cairo/files");

    const weights = [
        { weight: 400, label: "normal" },
        { weight: 600, label: "semi-bold" },
        { weight: 700, label: "bold" },
    ];

    const faces: string[] = [];

    for (const { weight } of weights) {
        const arabicPath = path.join(fontsDir, `cairo-arabic-${weight}-normal.woff2`);
        const arabicSrc = loadFontAsBase64(arabicPath);

        const latinPath = path.join(fontsDir, `cairo-latin-${weight}-normal.woff2`);
        const latinSrc = loadFontAsBase64(latinPath);

        if (arabicSrc) {
            faces.push(`
                @font-face {
                    font-family: 'Cairo';
                    font-style: normal;
                    font-weight: ${weight};
                    font-display: swap;
                    src: url('${arabicSrc}') format('woff2');
                    unicode-range: U+0600-06FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE80-FEFC;
                }
            `);
        }

        if (latinSrc) {
            faces.push(`
                @font-face {
                    font-family: 'Cairo';
                    font-style: normal;
                    font-weight: ${weight};
                    font-display: swap;
                    src: url('${latinSrc}') format('woff2');
                    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
                }
            `);
        }
    }

    cairoFontCSS = faces.join("\n");
    return cairoFontCSS;
};


export const getAmiriFontCSS = (): string => {
    if (amiriFontCSS !== null) return amiriFontCSS;


    const amiriDir = path.join(__dirname, "../../node_modules/@fontsource/amiri/files");

    if (!fs.existsSync(amiriDir)) {
        amiriFontCSS = `/* Amiri not installed locally, using system serif fallback */`;
        return amiriFontCSS;
    }

    const weights = [
        { weight: 400, label: "normal" },
        { weight: 700, label: "bold" },
    ];

    const faces: string[] = [];
    for (const { weight } of weights) {
        const arabicPath = path.join(amiriDir, `amiri-arabic-${weight}-normal.woff2`);
        const arabicSrc = loadFontAsBase64(arabicPath);
        if (arabicSrc) {
            faces.push(`
                @font-face {
                    font-family: 'Amiri';
                    font-style: normal;
                    font-weight: ${weight};
                    font-display: swap;
                    src: url('${arabicSrc}') format('woff2');
                }
            `);
        }
    }

    amiriFontCSS = faces.join("\n");
    return amiriFontCSS;
};
