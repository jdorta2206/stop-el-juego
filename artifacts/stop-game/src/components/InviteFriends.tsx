import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Copy, Check, Phone, Facebook, Instagram, MessageSquare, Share2, UserPlus, Link2
} from "lucide-react";
import type { PlayerProfile } from "@/hooks/use-player";

interface InviteFriendsProps {
  player: PlayerProfile;
  onClose: () => void;
}

function buildInviteLink(player: PlayerProfile) {
  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams({ ref: player.id, from: player.name });
  return `${base}?${params}`;
}

function buildWhatsAppMsg(player: PlayerProfile, url: string) {
  return `¡Hola! ${player.name} te invita a jugar a STOP 🎮\nEl clásico juego de palabras.\n¡Únete aquí: ${url}`;
}

type ContactItem = { name: string[]; tel?: string[] };

function hasContactPicker(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    "ContactsManager" in window
  );
}

async function pickContacts(): Promise<ContactItem[]> {
  try {
    const contacts = await (navigator as any).contacts.select(["name", "tel"], {
      multiple: true,
    });
    return contacts as ContactItem[];
  } catch {
    return [];
  }
}

// Single share method button
function ShareBtn({
  icon,
  label,
  sub,
  bg,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  bg: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.03, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
      style={{
        background: bg,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <span className="text-white">{icon}</span>
      <span className="text-white font-black text-xs leading-tight text-center">{label}</span>
      {sub && <span className="text-white/50 text-[10px]">{sub}</span>}
    </motion.button>
  );
}

export function InviteFriends({ player, onClose }: InviteFriendsProps) {
  const [copied, setCopied] = useState(false);
  const [pickedContacts, setPickedContacts] = useState<ContactItem[]>([]);
  const [contactSupported] = useState(hasContactPicker());

  const url = buildInviteLink(player);
  const waMsg = buildWhatsAppMsg(player, url);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(`¡${player.name} te invita a jugar a STOP!`)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handlePickContacts = async () => {
    const contacts = await pickContacts();
    setPickedContacts(contacts);
  };

  const handleContactWhatsApp = (contact: ContactItem) => {
    const phone = (contact.tel?.[0] || "").replace(/\D/g, "");
    if (!phone) return;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`, "_blank");
  };

  const handleContactSMS = (contact: ContactItem) => {
    const phone = (contact.tel?.[0] || "").replace(/\D/g, "");
    if (!phone) return;
    window.location.href = `sms:${phone}&body=${encodeURIComponent(waMsg)}`;
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: "STOP — El Juego de Palabras",
        text: `¡${player.name} te invita a jugar a STOP!`,
        url,
      });
    } catch {
      handleCopy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", bounce: 0.3 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, hsl(222 47% 13%) 0%, hsl(222 47% 9%) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#f9a825]" />
            <h2 className="text-white font-black text-lg">Invitar amigos</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-5">

          {/* Personal invite link */}
          <div>
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Link2 size={11} /> Tu link personal
            </p>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="flex-1 text-white/60 text-xs truncate font-mono">{url}</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black flex-shrink-0 transition-all"
                style={{
                  background: copied ? "rgba(74,222,128,0.2)" : "rgba(249,168,37,0.2)",
                  border: copied ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(249,168,37,0.4)",
                  color: copied ? "#4ade80" : "#f9a825",
                }}
              >
                {copied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
              </motion.button>
            </div>
            <p className="text-white/30 text-[10px] mt-1 px-1">
              Cuando alguien lo abra verá tu nombre y una bienvenida personalizada
            </p>
          </div>

          {/* Share channels */}
          <div>
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Compartir por</p>
            <div className="grid grid-cols-4 gap-2">
              {/* WhatsApp */}
              <ShareBtn
                icon={
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                }
                label="WhatsApp"
                bg="#25D366"
                onClick={() => window.open(waUrl, "_blank")}
              />

              {/* Facebook */}
              <ShareBtn
                icon={<Facebook className="w-6 h-6 fill-white text-white" />}
                label="Facebook"
                bg="#1877F2"
                onClick={() => window.open(fbUrl, "_blank")}
              />

              {/* Instagram — DM share */}
              <ShareBtn
                icon={
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                }
                label="Instagram"
                sub="Copiar + DM"
                bg="linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  window.open("https://www.instagram.com/direct/inbox/", "_blank");
                }}
              />

              {/* Native / more */}
              <ShareBtn
                icon={<Share2 className="w-6 h-6 text-white" />}
                label="Más"
                bg="rgba(255,255,255,0.1)"
                onClick={handleNativeShare}
              />
            </div>
          </div>

          {/* Contact Picker — mobile Chrome only */}
          <div>
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone size={11} /> Desde tus contactos
            </p>

            {contactSupported ? (
              <div className="space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePickContacts}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: "rgba(249,168,37,0.12)",
                    border: "1px solid rgba(249,168,37,0.3)",
                    color: "#f9a825",
                  }}
                >
                  <Phone size={15} />
                  Elegir contactos del móvil
                </motion.button>

                {pickedContacts.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                    {pickedContacts.map((c, i) => {
                      const name = c.name?.[0] || "Contacto";
                      const hasTel = !!c.tel?.[0];
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2.5"
                          style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                            style={{ background: "rgba(249,168,37,0.2)" }}
                          >
                            {name[0]?.toUpperCase() || "?"}
                          </div>
                          <span className="flex-1 text-white font-bold text-sm truncate">{name}</span>
                          {hasTel && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleContactWhatsApp(c)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                                style={{ background: "#25D366", color: "white" }}
                              >
                                WA
                              </button>
                              <button
                                onClick={() => handleContactSMS(c)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}
                              >
                                SMS
                              </button>
                            </div>
                          )}
                          {!hasTel && (
                            <span className="text-white/25 text-[11px]">Sin teléfono</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <MessageSquare size={14} className="text-white/30 mt-0.5 flex-shrink-0" />
                <p className="text-white/35 text-xs leading-relaxed">
                  El acceso a contactos está disponible en Chrome para Android.
                  Usa WhatsApp o copia el link para invitar a amigos.
                </p>
              </div>
            )}
          </div>

          {/* SMS link — universal fallback */}
          <a
            href={`sms:?body=${encodeURIComponent(waMsg)}`}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all w-full"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <MessageSquare size={15} />
            Enviar SMS de invitación
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
