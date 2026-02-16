import { create } from "zustand";
import { detectLocale, Locale } from "@/i18n/locale";

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => set({ locale }),
}));
