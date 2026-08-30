import type { GameMode } from './gameEngine';
import { getPackCategories, type StopLanguage } from './categoryPacks';

export type CategoryPackId = 'classic' | 'football' | 'cinema' | 'food' | 'music' | 'geography' | 'science' | 'history';
export type SupportedGameLanguage = StopLanguage;

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
  return getPackCategories(config.categoryPack, config.language).map((name, index) => ({
    id: `${config.categoryPack}-${index}`,
    name,
  }));
}

export function normalizeGameConfig(config?: Partial<NativeGameConfig>): NativeGameConfig {
  const categoryPack = config?.categoryPack;
  return {
    mode: config?.mode === 'quick' ? 'quick' : 'normal',
    language: config?.language === 'en' || config?.language === 'pt' || config?.language === 'fr' ? config.language : 'es',
    categoryPack: categoryPack === 'football' || categoryPack === 'cinema' || categoryPack === 'food' || categoryPack === 'music' || categoryPack === 'geography' || categoryPack === 'science' || categoryPack === 'history' ? categoryPack : 'classic',
  };
}
