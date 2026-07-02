// Minimal bilingual system. Every generated sentence in the engine is an
// {en, zh} pair; UI strings are inline l() pairs. Language is a cookie
// ("lang", default "en") so server components can render either language.
export type Lang = "en" | "zh";

export interface L {
  en: string;
  zh: string;
}

export const l = (en: string, zh: string): L => ({ en, zh });

export function pick(t: L | string | undefined, lang: Lang): string {
  if (t === undefined) return "";
  return typeof t === "string" ? t : t[lang];
}

export function langFromCookie(value: string | undefined): Lang {
  return value === "zh" ? "zh" : "en";
}
