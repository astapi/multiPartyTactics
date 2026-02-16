import { useEffect, useState } from "react";
import { initializeDatabase, resetDatabase } from "@/db/database";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { detectLocale } from "@/i18n/locale";
import { useLocaleStore } from "@/stores/localeStore";

export const useDatabaseInit = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (isActive: () => boolean = () => true): Promise<void> => {
    try {
      if (!isActive()) return;
      setError(null);
      setReady(false);
      await initializeDatabase();
      const savedLocale = await settingsRepository.getLanguage();
      const nextLocale = savedLocale ?? detectLocale();
      if (!savedLocale) {
        await settingsRepository.setLanguage(nextLocale);
      }
      useLocaleStore.getState().setLocale(nextLocale);
      if (!isActive()) return;
      setReady(true);
    } catch (e) {
      if (!isActive()) return;
      setError(e instanceof Error ? e.message : "Database init failed");
    }
  };

  useEffect(() => {
    let active = true;
    void run(() => active);
    return () => {
      active = false;
    };
  }, []);

  const resetAndReinitialize = async (): Promise<void> => {
    await resetDatabase();
    await run();
  };

  return { ready, error, resetAndReinitialize };
};
