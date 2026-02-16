import { useEffect, useState } from "react";
import { initializeDatabase } from "@/db/database";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { detectLocale } from "@/i18n/locale";
import { useLocaleStore } from "@/stores/localeStore";

export const useDatabaseInit = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await initializeDatabase();
        const savedLocale = await settingsRepository.getLanguage();
        const nextLocale = savedLocale ?? detectLocale();
        if (!savedLocale) {
          await settingsRepository.setLanguage(nextLocale);
        }
        useLocaleStore.getState().setLocale(nextLocale);
        if (active) setReady(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Database init failed");
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  return { ready, error };
};
