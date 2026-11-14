export type NotificationKind =
  | "daily" | "rank" | "invite" | "friend"
  | "promo-happy-hour-pre" | "promo-happy-hour-live" | "promo-happy-hour-last"
  | "promo-deals" | "promo-season-claim" | "promo" | "other";

export interface NotificationText {
  title: string;
  body: string;
}

export function notificationKind(payload: NotificationText): NotificationKind {
  // Normalize accents so Portuguese/French variants remain consistent.
  const text = `${payload.title} ${payload.body}`
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");

  if (/reto diario|daily stop challenge|today's stop challenge|desafio diario|defi quotidien|tu reto stop de hoy|te toca jugar|hora de tu stop|time to play|stop time|o teu desafio stop de hoje|hora de jogar|hora do teu stop|ton defi stop du jour|a toi de jouer|l'heure de ton stop/.test(text)) return "daily";
  if (/te han superado|you.?ve been overtaken|superaram|depasse/.test(text)) return "rank";
  if (/te invitan|you.?re invited|convidado|invite/.test(text)) return "invite";
  if (/amigo conectado|friend online|amigo online|ami connecte/.test(text)) return "friend";

  if (/happy hour en 15 min|happy hour in 15 min|happy hour em 15 min|happy hour dans 15 min/.test(text)) return "promo-happy-hour-pre";
  if (/quedan 10 min de happy hour|10 min of happy hour left|restam 10 min de happy hour|10 min restantes de happy hour/.test(text)) return "promo-happy-hour-last";
  if (/happy hour/.test(text)) return "promo-happy-hour-live";
  if (/ofertas hoy|new deals|novas ofertas|nouvelles offres/.test(text)) return "promo-deals";
  if (/misiones listas|missions ready|missoes prontas|missions pretes/.test(text)) return "promo-season-claim";
  return "other";
}
