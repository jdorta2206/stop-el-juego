import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Zap, ShieldOff, Crown } from "lucide-react";
import { fetchPremiumProducts, startCheckout, openCustomerPortal } from "@/lib/usePremium";

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  email?: string;
  isPremium: boolean;
}

const FEATURES = [
  { icon: ShieldOff, label: "Sin anuncios — juega sin interrupciones" },
  { icon: Zap, label: "Acceso anticipado a nuevas funciones" },
  { icon: Crown, label: "Insignia premium en el ranking global" },
  { icon: Star, label: "Apoya el desarrollo del juego" },
];

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export function PremiumModal({
  open,
  onClose,
  playerId,
  playerName,
  email,
  isPremium,
}: PremiumModalProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!open || isPremium) return;
    setLoadingProducts(true);
    fetchPremiumProducts()
      .then((res) => {
        setProducts(res.data || []);
        // Pre-select the first price found
        const firstPrice = res.data?.[0]?.prices?.[0]?.id;
        if (firstPrice) setSelectedPrice(firstPrice);
      })
      .catch(() => setError("No se pudieron cargar los planes. Inténtalo de nuevo."))
      .finally(() => setLoadingProducts(false));
  }, [open, isPremium]);

  const handleSubscribe = async () => {
    if (!selectedPrice) return;
    setLoading(true);
    setError(null);
    try {
      const { url } = await startCheckout({ playerId, playerName, email, priceId: selectedPrice });
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Error al iniciar el pago. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await openCustomerPortal(playerId);
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Error al abrir el portal. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "hsl(222 47% 11%)", border: "2px solid rgba(249,168,37,0.3)" }}
          >
            {/* Header */}
            <div
              className="relative px-6 pt-8 pb-6 text-center"
              style={{
                background: "linear-gradient(160deg, hsl(6 90% 45%) 0%, hsl(222 47% 15%) 100%)",
              }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="text-5xl mb-3"
              >
                ⭐
              </motion.div>

              {isPremium ? (
                <>
                  <h2 className="text-white font-black text-2xl mb-1" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
                    ¡Ya eres Premium!
                  </h2>
                  <p className="text-white/75 text-sm">Gracias por apoyar STOP</p>
                </>
              ) : (
                <>
                  <h2 className="text-white font-black text-2xl mb-1" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
                    STOP Premium
                  </h2>
                  <p className="text-white/75 text-sm">Juega sin límites</p>
                </>
              )}
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Features list */}
              <ul className="space-y-3">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(249,168,37,0.15)" }}
                    >
                      <Icon size={16} className="text-[#f9a825]" />
                    </div>
                    <span className="text-white/90 text-sm font-medium">{label}</span>
                  </li>
                ))}
              </ul>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-xs text-center bg-red-900/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {isPremium ? (
                <>
                  <div
                    className="rounded-xl px-4 py-3 text-center"
                    style={{ background: "rgba(249,168,37,0.1)", border: "1px solid rgba(249,168,37,0.3)" }}
                  >
                    <p className="text-[#f9a825] font-bold text-sm">✓ Suscripción activa</p>
                  </div>
                  <button
                    onClick={handleManage}
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    {loading ? "Cargando..." : "Gestionar suscripción"}
                  </button>
                </>
              ) : loadingProducts ? (
                <div className="text-center py-4">
                  <div
                    className="inline-block w-6 h-6 rounded-full border-2 border-[#f9a825] border-t-transparent animate-spin"
                  />
                </div>
              ) : products.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-2">
                  No hay planes disponibles por el momento.
                </p>
              ) : (
                <>
                  {/* Price selector */}
                  <div className="space-y-2">
                    {products.map((product) =>
                      product.prices.map((price: any) => (
                        <button
                          key={price.id}
                          onClick={() => setSelectedPrice(price.id)}
                          className="w-full rounded-xl px-4 py-3 text-left transition-all flex items-center justify-between"
                          style={{
                            background:
                              selectedPrice === price.id
                                ? "rgba(249,168,37,0.15)"
                                : "rgba(255,255,255,0.05)",
                            border:
                              selectedPrice === price.id
                                ? "2px solid #f9a825"
                                : "2px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <div>
                            <p className="text-white font-bold text-sm">{product.name}</p>
                            {price.recurring && (
                              <p className="text-white/60 text-xs capitalize">
                                {price.recurring.interval === "month" ? "Mensual" : "Anual"}
                              </p>
                            )}
                          </div>
                          <p className="text-[#f9a825] font-black text-lg">
                            {formatPrice(price.unit_amount, price.currency)}
                            <span className="text-white/50 text-xs font-normal ml-1">
                              /{price.recurring?.interval === "month" ? "mes" : "año"}
                            </span>
                          </p>
                        </button>
                      ))
                    )}
                  </div>

                  {/* CTA */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubscribe}
                    disabled={loading || !selectedPrice}
                    className="w-full py-4 rounded-xl font-black text-lg tracking-wide transition-all disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #f9a825, #f57f17)",
                      color: "#0d1757",
                      boxShadow: "0 4px 20px rgba(249,168,37,0.4)",
                      fontFamily: "'Baloo 2', sans-serif",
                    }}
                  >
                    {loading ? "Redirigiendo..." : "¡Activar Premium!"}
                  </motion.button>

                  <p className="text-white/40 text-xs text-center">
                    Pago seguro con Stripe · Cancela cuando quieras
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
