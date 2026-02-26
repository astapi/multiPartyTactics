import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { BattleAttackStyle } from "../animation/types";

const SE_MAP: Record<string, number> = {
  slash: require("@/assets/sounds/battle/slash.mp3"),
  heavy_slash: require("@/assets/sounds/battle/heavy_slash.mp3"),
  lightning: require("@/assets/sounds/battle/lightning.mp3"),
  fireball: require("@/assets/sounds/battle/fireball.mp3"),
};

const STYLE_TO_SE: Record<BattleAttackStyle, string> = {
  sword: "slash",
  dagger: "slash",
  generic: "slash",
  axe2h: "heavy_slash",
  cleave: "heavy_slash",
  lightning: "lightning",
  fireball: "fireball",
};

let playerCache = new Map<string, AudioPlayer>();

/** バトル開始時にオーディオモード設定+全SEをプリロード */
export async function preloadBattleSounds(): Promise<void> {
  await setAudioModeAsync({ playsInSilentMode: true });
  for (const [key, source] of Object.entries(SE_MAP)) {
    if (playerCache.has(key)) continue;
    try {
      const player = createAudioPlayer(source);
      playerCache.set(key, player);
    } catch (e) {
      console.warn("[battleSounds] preload failed:", key, e);
    }
  }
}

/** attackStyleに対応するSEを再生 */
export function playAttackSE(style: BattleAttackStyle): void {
  const seKey = STYLE_TO_SE[style];
  if (!seKey) return;
  const player = playerCache.get(seKey);
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // SE再生失敗はゲーム進行に影響しないため無視
  }
}

/** バトル終了時にキャッシュを解放 */
export function unloadBattleSounds(): void {
  const players = Array.from(playerCache.values());
  playerCache = new Map();
  for (const p of players) {
    try {
      p.remove();
    } catch {
      // 解放失敗は無視
    }
  }
}
