import { getDb } from "@/db/database";
import {
  BattleSpeedMultiplier,
  ExplorationSpeedMultiplier,
  isBattleSpeedMultiplier,
  isExplorationSpeedMultiplier,
} from "@/constants/battleSpeed";
import { Locale } from "@/i18n/locale";

const LANGUAGE_KEY = "language";
const BATTLE_SPEED_MULTIPLIER_KEY = "battle_speed_multiplier";
const EXPLORATION_SPEED_MULTIPLIER_KEY = "exploration_speed_multiplier";

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

  async getBattleSpeedMultiplier(): Promise<BattleSpeedMultiplier> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string | null }>(
      "SELECT value FROM app_settings WHERE key = ?",
      [BATTLE_SPEED_MULTIPLIER_KEY]
    );
    const parsed = Number.parseFloat(row?.value ?? "");
    return isBattleSpeedMultiplier(parsed) ? parsed : 1;
  },

  async setBattleSpeedMultiplier(speed: BattleSpeedMultiplier): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [BATTLE_SPEED_MULTIPLIER_KEY, String(speed)]
    );
  },

  async getExplorationSpeedMultiplier(): Promise<ExplorationSpeedMultiplier> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string | null }>(
      "SELECT value FROM app_settings WHERE key = ?",
      [EXPLORATION_SPEED_MULTIPLIER_KEY]
    );
    const parsed = Number.parseFloat(row?.value ?? "");
    return isExplorationSpeedMultiplier(parsed) ? parsed : 1;
  },

  async setExplorationSpeedMultiplier(speed: ExplorationSpeedMultiplier): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [EXPLORATION_SPEED_MULTIPLIER_KEY, String(speed)]
    );
  },
};
