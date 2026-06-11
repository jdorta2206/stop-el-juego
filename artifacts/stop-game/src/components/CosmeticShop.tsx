import { useState, useEffect, useCallback } from "react";
import { Check, Coins, ShoppingBag, Tag } from "lucide-react";
import { usePaymentChannel } from "@/hooks/usePaymentChannel";
import { purchaseWorldCupPackOnPlay, isPlayPurchaseCancelled, isPlayBillingUnavailable } from "@/lib/playBilling";
import { startPackCheckout, WORLD_CUP_PACK_PRICE_LABEL } from "@/lib/worldCupPack";
import { isLegendaryFrame, formatCountdown } from "@/lib/cosmeticHelpers";
import { celebrateReward } from "@/lib/celebrate";
import type { InventorySnapshot, ShopItem, EquipKind } from "@/hooks/useInventory";

function CosmeticChip({
  glyph, label, equipped, busy, color, glowing, onClick,
}: {
  glyph: string;
  label: string;
  equipped: boolean;
  busy: boolean;
  color?: string;
  glowing?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || equipped}
      title={label}
      className="relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all disabled:opacity-90"
      style={{
        background: equipped ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
        border: equipped ? "1.5px solid rgba(34,197,94,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
        minWidth: 56,
      }}
    >
      <span className={`text-xl leading-none ${glowing ? "legendary-glyph" : ""}`} style={{ color }}>{glyph}</span>
      <span className="text-[9px] font-bold text-white/70 leading-tight text-center max-w-[60px] truncate">{label}</span>
      {equipped && (
        <span className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5">
          <Check className="w-2.5 h-2.5 text-white" />
        </span>
      )}
    </button>
  );
}

interface CosmeticShopProps {
  playerId: string;
  inventory: InventorySnapshot;
  refresh: () => Promise<void> | void;
  buy: (itemId: string) => Promise<{ error?: string } | void>;
  equip: (kind: EquipKind, value: string | null) => Promise<{ error?: string } | void>;
  /** Show the "Mi inventario" owned cosmetics + equip controls (own profile/shop). */
  showInventory?: boolean;
}

/**
 * Reusable coin shop + owned-cosmetics manager. Fed the inventory snapshot and
 * its mutators by the parent so a single source of truth stays in sync (the
 * player profile also reacts to prestige claims that grant coins/frames).
 */
export function CosmeticShop({
  playerId, inventory, refresh, buy, equip, showInventory = true,
}: CosmeticShopProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { channel } = usePaymentChannel();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const handleEquip = useCallback(async (kind: EquipKind, value: string | null) => {
    setBusyAction(`equip:${kind}:${value ?? ""}`);
    try { await equip(kind, value); } finally { setBusyAction(null); }
  }, [equip]);

  const handleBuy = useCallback(async (item: ShopItem) => {
    setBusyAction(`buy:${item.id}`);
    const r = await buy(item.id);
    setBusyAction(null);
    if (r && "error" in r && r.error) {
      window.alert(r.error === "Insufficient coins" ? "No tienes suficientes monedas" : r.error);
    }
  }, [buy]);

  // Channel-aware "Pack Mundial" one-time purchase. On the Play TWA we run
  // Google Play Billing and verify server-side; on the web we redirect to a
  // Stripe one-time checkout. Both grant the same cosmetics; the server grant
  // is idempotent.
  const handleBuyPack = useCallback(async () => {
    // Wait until channel detection settles — a too-fast tap inside the TWA
    // must not fall through to the Stripe web path before "play" is resolved.
    if (channel === "loading") return;
    setBusyAction("buy:pack");

    const goStripe = async () => {
      const { url } = await startPackCheckout({ playerId });
      window.location.href = url;
    };

    try {
      if (channel === "play") {
        try {
          const r = await purchaseWorldCupPackOnPlay();
          if (r.granted) {
            await refresh();
            celebrateReward();
            window.alert("¡Pack Mundial desbloqueado! Ya tienes todos los cosméticos del Mundial. ⚽");
          }
        } catch (e) {
          // User closed the Google Play sheet — abort quietly, no error popup.
          if (isPlayPurchaseCancelled(e)) return;
          // The Digital Goods service resolved (so we picked "play") but this
          // build/device can't actually run Play Billing — instead of showing
          // "payment method not supported", fall back to Stripe checkout so the
          // purchase still completes.
          if (isPlayBillingUnavailable(e)) { await goStripe(); return; }
          throw e;
        }
      } else {
        await goStripe();
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "No se pudo completar la compra");
    } finally {
      setBusyAction(null);
    }
  }, [channel, playerId, refresh]);

  const deals = inventory.dailyDeals ?? [];
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const isWcItem = (id: string) => id.includes("_wc_");
  // Items on offer first, then the rest — at full price.
  const ordered = [...inventory.shop].sort((a, b) => {
    const da = dealById.has(a.id) ? 0 : 1;
    const db = dealById.has(b.id) ? 0 : 1;
    return da - db;
  });
  const wcOrdered = ordered.filter((i) => isWcItem(i.id));
  const restOrdered = ordered.filter((i) => !isWcItem(i.id));
  const resetIn = inventory.dealsResetAt ? inventory.dealsResetAt - now : 0;

  const renderRow = (item: ShopItem) => {
    const owned =
      item.kind === "avatar"
        ? inventory.owned.avatars.some((a) => a.id === item.id)
        : item.kind === "frame"
        ? inventory.owned.frames.some((f) => f.id === item.id)
        : inventory.owned.backgrounds.some((b) => b.id === item.id);
    const deal = dealById.get(item.id);
    const price = deal ? deal.price : item.price;
    const canAfford = inventory.coins >= price;
    return (
      <div
        key={item.id}
        className="flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border"
        style={{ borderColor: deal ? "rgba(249,168,37,0.45)" : "rgba(255,255,255,0.1)" }}
      >
        <span className={`text-2xl w-8 text-center ${isLegendaryFrame(item.id) ? "legendary-glyph" : ""}`} style={{ color: item.color }}>{item.glyph}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold truncate">{item.label}</p>
            {deal && (
              <span className="text-[9px] font-black text-amber-400 bg-amber-400/15 border border-amber-400/40 rounded px-1 py-0.5 leading-none">
                −{deal.discountPct}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-amber-400 flex items-center gap-1">
            <Coins className="w-3 h-3" /> {price}
            {deal && (
              <span className="text-white/30 line-through">{deal.originalPrice}</span>
            )}
          </p>
        </div>
        {owned ? (
          <span className="text-[10px] font-black text-emerald-400 uppercase">Comprado</span>
        ) : (
          <button
            onClick={() => handleBuy(item)}
            disabled={!canAfford || busyAction === `buy:${item.id}`}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all disabled:opacity-40"
            style={{
              background: canAfford ? "rgba(249,168,37,0.2)" : "rgba(255,255,255,0.05)",
              border: canAfford ? "1px solid rgba(249,168,37,0.5)" : "1px solid rgba(255,255,255,0.1)",
              color: canAfford ? "#f9a825" : "rgba(255,255,255,0.4)",
            }}
          >
            {busyAction === `buy:${item.id}` ? "…" : "Comprar"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-black text-lg flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-secondary" /> {showInventory ? "Mi inventario" : "Tienda"}
        </h2>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-black text-amber-400 text-sm">{inventory.coins}</span>
        </span>
      </div>

      {showInventory && (
        <>
          {/* Avatares poseídos */}
          <div>
            <p className="text-xs font-bold text-white/50 mb-1.5">Avatares</p>
            <div className="flex gap-2 flex-wrap">
              <CosmeticChip
                glyph="—" label="Por defecto"
                equipped={inventory.equipped.avatar === null}
                busy={busyAction === "equip:avatar:"}
                onClick={() => handleEquip("avatar", null)}
              />
              {inventory.owned.avatars.map((c) => (
                <CosmeticChip
                  key={c.id} glyph={c.glyph} label={c.label}
                  equipped={inventory.equipped.avatar === c.id}
                  busy={busyAction === `equip:avatar:${c.id}`}
                  onClick={() => handleEquip("avatar", c.id)}
                />
              ))}
              {inventory.owned.avatars.length === 0 && (
                <p className="text-[11px] text-white/30 italic">Reclama niveles del Pase para conseguirlos.</p>
              )}
            </div>
          </div>

          {/* Marcos poseídos */}
          <div>
            <p className="text-xs font-bold text-white/50 mb-1.5">Marcos</p>
            <div className="flex gap-2 flex-wrap">
              <CosmeticChip
                glyph="—" label="Sin marco"
                equipped={inventory.equipped.frame === null}
                busy={busyAction === "equip:frame:"}
                onClick={() => handleEquip("frame", null)}
              />
              {inventory.owned.frames.map((c) => (
                <CosmeticChip
                  key={c.id} glyph={c.glyph} label={c.label} color={c.color}
                  glowing={isLegendaryFrame(c.id)}
                  equipped={inventory.equipped.frame === c.id}
                  busy={busyAction === `equip:frame:${c.id}`}
                  onClick={() => handleEquip("frame", c.id)}
                />
              ))}
              {inventory.owned.frames.length === 0 && (
                <p className="text-[11px] text-white/30 italic">Reclama niveles del Pase para conseguirlos.</p>
              )}
            </div>
          </div>

          {/* Fondos poseídos */}
          <div>
            <p className="text-xs font-bold text-white/50 mb-1.5">Fondos</p>
            <div className="flex gap-2 flex-wrap">
              <CosmeticChip
                glyph="—" label="Sin fondo"
                equipped={(inventory.equipped.background ?? null) === null}
                busy={busyAction === "equip:background:"}
                onClick={() => handleEquip("background", null)}
              />
              {inventory.owned.backgrounds.map((c) => (
                <CosmeticChip
                  key={c.id} glyph={c.glyph} label={c.label} color={c.color}
                  equipped={inventory.equipped.background === c.id}
                  busy={busyAction === `equip:background:${c.id}`}
                  onClick={() => handleEquip("background", c.id)}
                />
              ))}
              {inventory.owned.backgrounds.length === 0 && (
                <p className="text-[11px] text-white/30 italic">Cómpralos en la tienda para personalizar tu perfil.</p>
              )}
            </div>
          </div>

          {/* Títulos — se ganan jugando, no se compran */}
          <div>
            <p className="text-xs font-bold text-white/50 mb-1.5">Títulos <span className="text-white/30 font-normal">(se ganan jugando)</span></p>
            <div className="flex gap-2 flex-wrap">
              <CosmeticChip
                glyph="—" label="Sin título"
                equipped={(inventory.equipped.title ?? null) === null}
                busy={busyAction === "equip:title:"}
                onClick={() => handleEquip("title", null)}
              />
              {(inventory.titles ?? []).filter((t) => t.unlocked).map((t) => (
                <CosmeticChip
                  key={t.id} glyph={t.icon} label={t.label} color={t.color}
                  equipped={inventory.equipped.title === t.id}
                  busy={busyAction === `equip:title:${t.id}`}
                  onClick={() => handleEquip("title", t.id)}
                />
              ))}
            </div>
            {(inventory.titles ?? []).some((t) => !t.unlocked) && (
              <>
                <p className="text-[10px] font-bold text-white/30 mt-2 mb-1.5 uppercase">Por desbloquear</p>
                <div className="flex gap-2 flex-wrap">
                  {(inventory.titles ?? []).filter((t) => !t.unlocked).map((t) => (
                    <div
                      key={t.id}
                      title={t.desc}
                      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg opacity-40"
                      style={{ border: "1.5px dashed rgba(255,255,255,0.15)", minWidth: 56 }}
                    >
                      <span className="text-xl leading-none grayscale">🔒</span>
                      <span className="text-[9px] font-bold text-white/60 leading-tight text-center max-w-[60px] truncate">{t.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Tienda de monedas — con ofertas rotatorias del día + Especial Mundial */}
      <div id="tienda" className="scroll-mt-24">
        {wcOrdered.length > 0 && (
          <div
            className="mb-4 p-3 rounded-2xl border"
            style={{
              borderColor: "rgba(249,168,37,0.4)",
              background: "linear-gradient(135deg, rgba(22,163,74,0.14), rgba(220,38,38,0.12))",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-white flex items-center gap-1.5">⚽ Especial Mundial</p>
              <span className="text-[9px] font-black text-amber-300 bg-amber-400/15 border border-amber-400/40 rounded px-1.5 py-0.5 uppercase">Evento</span>
            </div>
            <button
              onClick={handleBuyPack}
              disabled={busyAction === "buy:pack" || channel === "loading"}
              className="w-full mb-2.5 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #16a34a, #dc2626)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <span className="text-left">
                <span className="block text-[13px] font-black text-white leading-tight">
                  🏆 Pack Mundial — todo desbloqueado
                </span>
                <span className="block text-[10px] font-bold text-white/80 leading-tight">
                  Consigue TODOS los cosméticos del Mundial de una vez
                </span>
              </span>
              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white/95 text-[12px] font-black text-emerald-700">
                {busyAction === "buy:pack" ? "…" : WORLD_CUP_PACK_PRICE_LABEL}
              </span>
            </button>
            <div className="space-y-1.5">
              {wcOrdered.map((item) => renderRow(item))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-1.5 mt-1">
          <p className="text-xs font-bold text-white/50">Tienda</p>
          {deals.length > 0 && inventory.dealsResetAt && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400/80">
              <Tag className="w-3 h-3" /> Ofertas nuevas en {formatCountdown(resetIn)}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {restOrdered.map((item) => renderRow(item))}
        </div>
      </div>
    </div>
  );
}
