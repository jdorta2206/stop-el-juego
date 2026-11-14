import { notificationKind } from "./notificationKind";
import { describe, expect, it } from "vitest";
import { isStalePushEndpointStatus } from "./pushStatus";

describe("push subscription stale endpoint detection", () => {
  it.each([404, 410])("treats HTTP %i as an expired endpoint", (status) => {
    expect(isStalePushEndpointStatus(status)).toBe(true);
  });

  it.each([400, 401, 403, 408, 429, 500, undefined, null])(
    "preserves subscriptions for non-expiry status %s",
    (status) => {
      expect(isStalePushEndpointStatus(status)).toBe(false);
    },
  );
});


describe("daily push classification across supported locales", () => {
  it.each([
    ["es", "Tu reto STOP de hoy", "Misión nueva disponible."],
    ["es", "Te toca jugar", "Una partida rápida."],
    ["es", "Hora de tu STOP", "Tu racha sigue viva."],
    ["en", "Today's STOP challenge", "New mission ready."],
    ["en", "Time to play", "One quick game."],
    ["en", "STOP time", "Your streak stays alive."],
    ["pt", "O teu desafio STOP de hoje", "Missão nova disponível."],
    ["pt", "Hora de jogar", "Um jogo rápido."],
    ["pt", "Hora do teu STOP", "A tua sequência continua."],
    ["fr", "Ton défi STOP du jour", "Nouvelle mission."],
    ["fr", "À toi de jouer", "Une partie rapide."],
    ["fr", "L'heure de ton STOP", "Ta série reste en vie."],
  ])("classifies %s daily variant: %s", (_language, title, body) => {
    expect(notificationKind({ title, body })).toBe("daily");
  });

  it("recognizes the scheduled daily challenge titles in all four languages", () => {
    for (const title of [
      "🎯 Reto Diario STOP",
      "🎯 Daily STOP Challenge",
      "🎯 Desafio Diário STOP",
      "🎯 Défi Quotidien STOP",
    ]) {
      expect(notificationKind({ title, body: "The challenge is ready." })).toBe("daily");
    }
  });
});
