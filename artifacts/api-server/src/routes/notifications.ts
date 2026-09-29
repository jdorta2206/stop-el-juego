
  const result = await sendPushToAllSubscribers(
    { ...msg, icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: "/reto" },
    lang
  );

  res.json(result);
});

// POST /api/notifications/send-invite — notify a specific player (room invite)
router.post("/send-invite", inviteLimiter, async (req, res) => {
  const { senderPlayerId, targetPlayerId, fromName, roomCode, language } = req.body;
  if (!senderPlayerId || !targetPlayerId || !fromName || !roomCode) {
    res.status(400).json({ error: "Missing fields" }); return;
  }

  // An invite is only valid when it originates from the player who currently
  // owns the room. Without this check, anyone could use a public target id as a
  // notification relay and make arbitrary players receive fake room invites.
  if (!verifyClaimedIdentity(req, String(senderPlayerId))) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    res.status(503).json({ error: "VAPID not configured" }); return;
  }

  // The sender name is client-supplied (guests have no server-side name to look
  // up), so we can't fully prevent a spoofed display name — but we DO neutralise
  // it as an abuse vector: strip control chars/newlines and cap the length so it
  // can't be used to inject misleading multi-line content into the push payload.
  const safeFromName = String(fromName).replace(/[\r\n\u0000-\u001F\u007F]/g, " ").trim().slice(0, 40) || "Alguien";
  const safeRoomCode = String(roomCode).replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();
  if (!safeRoomCode) { res.status(400).json({ error: "Invalid roomCode" }); return; }

  const roomRows = await db
    .select({ hostId: roomsTable.hostId })
    .from(roomsTable)
    .where(eq(roomsTable.roomCode, safeRoomCode))
    .limit(1);

  if (!roomRows.length || roomRows[0].hostId !== String(senderPlayerId)) {
    res.status(403).json({ error: "Not authorized to invite from this room" });
    return;
  }

  const lang = language || "es";
  const INVITE_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "🎮 ¡Te invitan a jugar STOP!", body: `${safeFromName} quiere jugar contigo. Sala: ${safeRoomCode}` },
    en: { title: "🎮 You're invited to STOP!", body: `${safeFromName} wants to play with you. Room: ${safeRoomCode}` },
    pt: { title: "🎮 Convidado para jogar STOP!", body: `${safeFromName} quer jogar contigo. Sala: ${safeRoomCode}` },
    fr: { title: "🎮 Invité à jouer à STOP !", body: `${safeFromName} veut jouer avec toi. Salle : ${safeRoomCode}` },
  };
  const msg = INVITE_MSGS[lang] || INVITE_MSGS.es;

  // Filtra suscripciones del dominio replit.app: solo enviamos invitaciones a
  // las del dominio canónico (stopjuegodepalabras.com) o a las legacy sin origin.
  const rows = await db.select().from(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.playerId, targetPlayerId),
      or(
        isNull(pushSubscriptionsTable.origin),
        not(like(pushSubscriptionsTable.origin, '%replit.app%')),
      ),
    ));

  let sent = 0;
  const toDelete: string[] = [];
  await Promise.allSettled(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({ ...msg, icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: `/multijugador?room=${safeRoomCode}` })
      );
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 403 || e?.statusCode === 404 || e?.statusCode === 410) {
        toDelete.push(row.endpoint);
      } else {
        console.error(`[push] invite failed status=${e?.statusCode ?? "unknown"} target=${targetPlayerId}`);
      }
    }
  }));

  for (const endpoint of toDelete) {
    await db.delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.endpoint, endpoint))
      .catch(() => {});
  }

  res.json({ sent });
});

export default router;