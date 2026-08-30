import type { GameMode } from './gameEngine';
import { getCategoryPack, type CategoryPackId, type SupportedGameLanguage } from './categoryPacks';

export type NativeGameConfig = {
  mode: GameMode;
  language: SupportedGameLanguage;
  categoryPack: CategoryPackId;
};

export const DEFAULT_GAME_CONFIG: NativeGameConfig = {
  mode: 'normal',
  language: 'es',
  categoryPack: 'classic',
};

export const GAME_MODES: Array<{ id: GameMode; label: string; seconds: number }> = [
  { id: 'normal', label: 'Normal', seconds: 60 },
  { id: 'quick', label: 'Rápido', seconds: 30 },
];

export function getCategoriesForConfig(config: NativeGameConfig) {
  return getCategoryPack(config.categoryPack, config.language);
}

export function normalizeGameConfig(config?: Partial<NativeGameConfig>): NativeGameConfig {
  return {
    mode: config?.mode === 'quick' ? 'quick' : 'normal',
    language: config?.language === 'es' || config?.language === 'en' || config?.language === 'pt' || config?.language === 'fr' ? config.language : 'es',
    categoryPack: config?.categoryPack === 'classic' || config?.categoryPack === 'football' || config?.categoryPack === 'cinema-tv' || config?.categoryPack === 'food' || config?.categoryPack === 'music' || config?.categoryPack === 'geography' || config?.categoryPack === 'science' || config?.categoryPack === 'history' ? config.categoryPack : 'classic',
  };
}
