import { getDb } from "@/db/database";
import { Locale } from "@/i18n/locale";

const LANGUAGE_KEY = "language";

const isValidLocale = (value: string | null): value is Locale => {
  return value === "ja" || value === "en";
};

export const settingsRepository = {
  async getLanguage(): Promise<Locale | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string | null }>(
      "SELECT value FROM app_settings WHERE key = ?",
      [LANGUAGE_KEY]
    );
    const value = row?.value ?? null;
    return isValidLocale(value) ? value : null;
  },

  async setLanguage(locale: Locale): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [LANGUAGE_KEY, locale]
    );
  },
};
