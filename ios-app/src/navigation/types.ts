import type { NativeGameConfig } from '../game/gameConfig';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  GameSetup: undefined;
  Game: { config?: NativeGameConfig };
  Multiplayer: undefined;
};
