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

  it("does not let player-controlled body text reclassify rank or invite pushes as daily", () => {
    expect(notificationKind({
      title: "Te han superado",
      body: "Tu reto STOP de hoy: Alex",
    })).toBe("rank");
    expect(notificationKind({
      title: "Te invitan a jugar",
      body: "Te toca jugar, dice Daily STOP Challenge",
    })).toBe("invite");
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

describe("notification classification preserves existing categories", () => {
  it.each([
    ["rank", "Te han superado", "Un jugador superó tu puntuación."],
    ["rank", "You've been overtaken", "A player passed your score."],
    ["rank", "Superaram a tua pontuação", "Um jogador passou-te."],
    ["rank", "Tu as été dépassé", "Un joueur a dépassé ton score."],
    ["invite", "Te invitan a jugar", "Acepta la invitación."],
    ["invite", "You're invited to play", "Accept the invitation."],
    ["invite", "Foste convidado a jogar", "Aceita o convite."],
    ["invite", "Tu es invité à jouer", "Accepte l'invitation."],
    ["friend", "Amigo conectado", "Tu amigo está jugando."],
    ["friend", "Friend online", "Your friend is playing."],
    ["friend", "Amigo online", "O teu amigo está a jogar."],
    ["friend", "Ami connecté", "Ton ami joue."],
    ["promo-happy-hour-pre", "Happy hour en 15 min", "Prepárate."],
    ["promo-happy-hour-pre", "Happy hour in 15 min", "Get ready."],
    ["promo-happy-hour-pre", "Happy hour em 15 min", "Prepara-te."],
    ["promo-happy-hour-pre", "Happy hour dans 15 min", "Prépare-toi."],
    ["promo-happy-hour-last", "Quedan 10 min de happy hour", "Aprovecha."],
    ["promo-happy-hour-last", "10 min of happy hour left", "Enjoy it."],
    ["promo-happy-hour-last", "Restam 10 min de happy hour", "Aproveita."],
    ["promo-happy-hour-last", "10 min restantes de happy hour", "Profites-en."],
    ["promo-happy-hour-live", "Happy hour STOP", "¡Ya está activa!"],
    ["promo-deals", "Nuevas ofertas hoy", "Mira la tienda."],
    ["promo-deals", "New deals today", "Visit the shop."],
    ["promo-deals", "Novas ofertas hoje", "Vê a loja."],
    ["promo-deals", "Nouvelles offres aujourd'hui", "Voir la boutique."],
    ["promo-season-claim", "Misiones listas para reclamar", "Reclama tus premios."],
    ["promo-season-claim", "Missions ready to claim", "Claim your rewards."],
    ["promo-season-claim", "Missões prontas para reclamar", "Resgata os prémios."],
    ["promo-season-claim", "Missions prêtes à réclamer", "Réclame tes récompenses."],
  ])("keeps %s classification for: %s", (expected, title, body) => {
    expect(notificationKind({ title, body })).toBe(expected);
  });
});
