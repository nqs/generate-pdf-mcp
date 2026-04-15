import { StandardFonts } from "pdf-lib";
import type { PageSize, ThemeName } from "./types";

export interface ThemeConfig {
  name: ThemeName;
  fontFamily: StandardFonts;
  boldFontFamily: StandardFonts;
  fontSize: {
    title: number;
    h1: number;
    h2: number;
    h3: number;
    body: number;
  };
  colors: {
    title: string;
    heading: string;
    body: string;
    accent: string;
  };
  margins: { top: number; right: number; bottom: number; left: number };
  lineHeight: number;
}

const professional: ThemeConfig = {
  name: "professional",
  fontFamily: StandardFonts.Helvetica,
  boldFontFamily: StandardFonts.HelveticaBold,
  fontSize: { title: 28, h1: 22, h2: 18, h3: 15, body: 11 },
  colors: {
    title: "#1a1a2e",
    heading: "#1a1a2e",
    body: "#333333",
    accent: "#2563eb",
  },
  margins: { top: 60, right: 60, bottom: 60, left: 60 },
  lineHeight: 1.4,
};

const minimal: ThemeConfig = {
  name: "minimal",
  fontFamily: StandardFonts.Helvetica,
  boldFontFamily: StandardFonts.HelveticaBold,
  fontSize: { title: 24, h1: 20, h2: 16, h3: 13, body: 10 },
  colors: {
    title: "#000000",
    heading: "#000000",
    body: "#444444",
    accent: "#666666",
  },
  margins: { top: 50, right: 50, bottom: 50, left: 50 },
  lineHeight: 1.3,
};

const academic: ThemeConfig = {
  name: "academic",
  fontFamily: StandardFonts.TimesRoman,
  boldFontFamily: StandardFonts.TimesRomanBold,
  fontSize: { title: 26, h1: 20, h2: 16, h3: 14, body: 12 },
  colors: {
    title: "#000000",
    heading: "#000000",
    body: "#000000",
    accent: "#000000",
  },
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
  lineHeight: 1.5,
};

const themes: Record<ThemeName, ThemeConfig> = {
  professional,
  minimal,
  academic,
};

export function getTheme(name: string): ThemeConfig {
  const theme = themes[name as ThemeName];
  if (!theme) {
    return professional;
  }
  return theme;
}

const pageDimensions: Record<PageSize, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
};

export function getPageDimensions(size: string): [number, number] {
  const dims = pageDimensions[size as PageSize];
  if (!dims) {
    return pageDimensions.Letter;
  }
  return dims;
}

