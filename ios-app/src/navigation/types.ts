import type { NativeGameConfig } from '../game/gameConfig';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Profile: undefined;
  Ranking: undefined;
  Collection: undefined;
  Prestige: undefined;
  GameSetup: undefined;
  Game: { config?: NativeGameConfig };
  Multiplayer: undefined;
};
