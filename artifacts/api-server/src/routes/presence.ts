import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { challengesTable, playerPresenceTable, playerScoresTable, roomsTable } from "@workspace/db";
import { and, eq, gt, inArray } from "drizzle-orm";
import { sendPushToPlayer, notifyFollowersPlayerOnline } from "../lib/pushHelper";
import { presenceLimiter } from "../middlewares/rateLimit";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

// Presence and challenges are persisted in PostgreSQL so all Railway replicas
// observe the same state.
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/presence/ping
router.post("/ping", presenceLimiter, async (req, res) => {
  const { playerId, name, picture, avatarColor, provider, roomCode, language } = req.body as {
    playerId: string; name: string; picture?: string | null; avatarColor?: string;
    provider?: string | null; roomCode?: string | null; language?: string;
  };
  if (!playerId || !name) return res.status(400).json({ error: "playerId and name required" });
  if (!verifyClaimedIdentity(req, playerId)) return res.status(403).json({ error: "Invalid player identity" });
  const old = await db.select({ lastSeen: playerPresenceTable.lastSeen })
    .from(playerPresenceTable).where(eq(playerPresenceTable.playerId, playerId)).limit(1);
  const now = new Date();
  await db.insert(playerPresenceTable).values({
    playerId, name, picture: picture || null, avatarColor: avatarColor || "#e53e3e",
    provider: provider || null, roomCode: roomCode || null, lastSeen: now,
  }).onConflictDoUpdate({
    target: playerPresenceTable.playerId,
    set: { name, picture: picture || null, avatarColor: avatarColor || "#e53e3e", provider: provider || null, roomCode: roomCode || null, lastSeen: now },
  });
  if ((!old[0] || old[0].lastSeen.getTime() < Date.now() - 180000) && provider && provider !== "guest")
    notifyFollowersPlayerOnline(playerId, name, language || "es").catch(() => {});
  return res.json({ ok: true });
});

// GET /api/presence/online
router.get("/online", async (_req, res) => {
  const online: Array<any> = await db.select().from(playerPresenceTable)
    .where(gt(playerPresenceTable.lastSeen, new Date(Date.now() - 90000)))
    .then(rows => rows.map(data => ({
      playerId: data.playerId, name: data.name, picture: data.picture, avatarColor: data.avatarColor,
      provider: data.provider, roomCode: data.roomCode, lastSeen: data.lastSeen.getTime(),
    })));
  const ids = online.map(p => p.playerId);
  if (ids.length > 0) {
    try {
      const cosmetics = await db.select({
        playerId: playerScoresTable.playerId, profilePicture: playerScoresTable.profilePicture,
        equippedAvatar: playerScoresTable.equippedAvatar, equippedFrame: playerScoresTable.equippedFrame,
        equippedTitle: playerScoresTable.equippedTitle,
      }).from(playerScoresTable).where(inArray(playerScoresTable.playerId, ids));
      const byId = new Map(cosmetics.map(c => [c.playerId, c]));
      for (const p of online) {
        const c = byId.get(p.playerId);
        if (c) Object.assign(p, {
          picture: c.profilePicture ?? p.picture ?? null,
          equippedAvatar: c.equippedAvatar ?? null,
          equippedFrame: c.equippedFrame ?? null,
          equippedTitle: c.equippedTitle ?? null,
        });
      }
    } catch {}
  }
  online.sort((a, b) => b.lastSeen - a.lastSeen);
  return res.json({ online });
});

// POST /api/presence/challenge — send a challenge to another player
router.post("/challenge", async (req, res) => {
  const { fromPlayerId, fromName, fromPicture, fromAvatarColor, toPlayerId } = req.body as any;
  if (!fromPlayerId || !toPlayerId || !fromName) return res.status(400).json({ error: "fromPlayerId, fromName and toPlayerId required" });
  if (!verifyClaimedIdentity(req, fromPlayerId)) return res.status(403).json({ error: "Invalid player identity" });
  const target = await db.select({ lastSeen: playerPresenceTable.lastSeen }).from(playerPresenceTable)
    .where(eq(playerPresenceTable.playerId, toPlayerId)).limit(1);
  if (!target[0] || target[0].lastSeen.getTime() < Date.now() - 90000) return res.status(404).json({ error: "Player is not online" });

  const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  let roomCode = "";
  try {
    await db.transaction(async tx => {
      await tx.delete(challengesTable).where(and(eq(challengesTable.fromPlayerId, fromPlayerId), eq(challengesTable.toPlayerId, toPlayerId), eq(challengesTable.status, "pending"), eq(challengesTable.isRoomInvite, false)));
      const players = [{ playerId: fromPlayerId, playerName: fromName, avatarColor: fromAvatarColor ?? "#e53e3e", loginMethod: null, score: 0, roundScore: 0, isHost: true, isReady: false }];
      let made = false;
      for (let i=0; i<5 && !made; i++) {
        const candidate=generateRoomCode();
        try {
          await tx.insert(roomsTable).values({ roomCode:candidate, hostId:fromPlayerId, hostName:fromName, status:"waiting", currentRound:0, maxRounds:3, language:"es", playersJson:JSON.stringify(players), stopperJson:null, isPublic:false });
          roomCode=candidate; made=true;
        } catch(e:any) { if (!/unique|duplicate/i.test(String(e?.message||""))) throw e; }
      }
      if (!made) throw new Error("Challenge room code allocation failed");
      await tx.insert(challengesTable).values({ challengeId, fromPlayerId, fromName, fromPicture:fromPicture||null, fromAvatarColor:fromAvatarColor||"#e53e3e", toPlayerId, roomCode, status:"pending", isRoomInvite:false });
    });
  } catch(e) { console.error("Challenge creation failed:",e); return res.status(503).json({error:"Could not create challenge"}); }
  sendPushToPlayer(toPlayerId,{title:"⚔️ ¡Nuevo reto!",body:`${fromName} te desafía a una partida de STOP. ¡Acepta si te atreves!`,url:"/multiplayer"}).catch(()=>{});
  return res.json({challengeId,roomCode});
});

router.post("/room-invite", async (req,res)=>{
  const {fromPlayerId,fromName,fromPicture,fromAvatarColor,toPlayerId,roomCode}=req.body as any;
  if(!fromPlayerId||!toPlayerId||!fromName||!roomCode)return res.status(400).json({error:"fromPlayerId, fromName, toPlayerId and roomCode required"});
  if(!verifyClaimedIdentity(req,fromPlayerId))return res.status(403).json({error:"Invalid player identity"});
  const code=String(roomCode).replace(/[^A-Za-z0-9]/g,"").slice(0,12).toUpperCase();
  const room=(await db.select({playersJson:roomsTable.playersJson}).from(roomsTable).where(eq(roomsTable.roomCode,code)).limit(1))[0];
  if(!room)return res.status(404).json({error:"Room not found"});
  let players:any[]=[]; try { const p=JSON.parse(room.playersJson||"[]"); players=Array.isArray(p)?p:[]; } catch { return res.status(500).json({error:"Invalid room state"}); }
  if(!players.some(p=>p?.playerId===fromPlayerId))return res.status(403).json({error:"You are not a member of this room"});
  const challengeId=`ri_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  await db.delete(challengesTable).where(and(eq(challengesTable.fromPlayerId,fromPlayerId),eq(challengesTable.toPlayerId,toPlayerId),eq(challengesTable.status,"pending"),eq(challengesTable.isRoomInvite,true)));
  await db.insert(challengesTable).values({challengeId,fromPlayerId,fromName,fromPicture:fromPicture||null,fromAvatarColor:fromAvatarColor||"#e53e3e",toPlayerId,roomCode:code,status:"pending",isRoomInvite:true});
  sendPushToPlayer(toPlayerId,{title:"🎮 ¡Te invitan a tu sala!",body:`${fromName} te invita a unirte a la sala ${code}`,url:`/multiplayer?room=${code}`}).catch(()=>{});
  return res.json({ok:true,challengeId});
});

router.get("/challenges/:playerId",async(req,res)=>{
  const {playerId}=req.params;
  if(!verifyClaimedIdentity(req,playerId))return res.status(403).json({error:"Invalid player identity"});
  const rows=await db.select().from(challengesTable).where(and(eq(challengesTable.toPlayerId,playerId),eq(challengesTable.status,"pending"),gt(challengesTable.createdAt,new Date(Date.now()-60000))));
  return res.json({challenges:rows.map(c=>({...c,createdAt:c.createdAt.getTime()}))});
});

router.post("/challenge/:challengeId/respond",async(req,res)=>{
  const c=(await db.select().from(challengesTable).where(eq(challengesTable.challengeId,req.params.challengeId)).limit(1))[0];
  if(!c||c.createdAt.getTime()<Date.now()-120000)return res.status(404).json({error:"Challenge not found or expired"});
  if(!verifyClaimedIdentity(req,c.toPlayerId))return res.status(403).json({error:"Invalid player identity"});
  const accepted=Boolean((req.body as any).accepted);
  const upd=await db.update(challengesTable).set({status:accepted?"accepted":"declined"}).where(and(eq(challengesTable.challengeId,c.challengeId),eq(challengesTable.status,"pending"))).returning({status:challengesTable.status});
  if(!upd.length)return res.status(409).json({error:"Challenge already resolved"});
  return res.json({ok:true,roomCode:accepted?c.roomCode:null});
});

router.get("/challenge/:challengeId/status",async(req,res)=>{
  const c=(await db.select().from(challengesTable).where(eq(challengesTable.challengeId,req.params.challengeId)).limit(1))[0];
  if(!c)return res.json({status:"expired"});
  if(!verifyClaimedIdentity(req,c.fromPlayerId))return res.status(403).json({error:"Invalid player identity"});
  if(c.status==="pending"&&c.createdAt.getTime()<Date.now()-120000)return res.json({status:"expired",roomCode:""});
  return res.json({status:c.status,roomCode:c.roomCode});
});

export default router;
