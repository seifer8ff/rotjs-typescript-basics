export interface GlyphColor {
    // currently only really useful in ascii mode
    // should repurpose for overlays or something like that
    // could add highlight colors and such?
    foregroundColor?: string;
    backgroundColor?: string;
}

export class Glyph {
    constructor(public character: string, public glyphColor?: GlyphColor) { }
}