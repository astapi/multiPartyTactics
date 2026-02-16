export type Locale = "ja" | "en";

export const detectLocale = (): Locale => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith("ja") ? "ja" : "en";
};
