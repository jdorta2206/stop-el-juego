import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Edit3, Save, Crown, Sparkles } from "lucide-react";
import {
  useCustomPacks,
  createCustomPack,
  updateCustomPack,
  deleteCustomPack,
  type CustomPack,
} from "@/lib/useCustomPacks";
import { getLang } from "@/i18n";

interface CustomPacksManagerProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  isPremium: boolean;
  onPremiumClick?: () => void;
}

const ICON_CHOICES = [
  "✨", "🎮", "🍔", "🚀", "🎨", "🏖️", "🎭", "🎸", "📚", "🐉",
  "🍷", "⚔️", "🌋", "🎯", "🏰", "🦄", "🎪", "🪐", "🔮", "🧪",
];
const COLOR_CHOICES = [
  "#f9a825", "#dc2626", "#16a34a", "#0ea5e9", "#a855f7", "#ec4899",
  "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];
const CATEGORIES_COUNT = 7;
const EMPTY_CATEGORIES = Array(CATEGORIES_COUNT).fill("");

const T: Record<string, Record<string, string>> = {
  es: {
    title: "Mis categorías",
    subtitle: "Crea packs personalizados de 7 categorías",
    premiumRequired: "Función exclusiva Premium",
    premiumDesc: "Inventa tus propios packs de categorías y juega con ellos en modo solitario.",
    becomePremium: "Hacerme Premium",
    empty: "Aún no tienes packs personalizados",
    createFirst: "Crear mi primer pack",
    newPack: "Nuevo pack",
    editPack: "Editar pack",
    packName: "Nombre del pack",
    namePlaceholder: "Ej: Videojuegos",
    icon: "Icono",
    color: "Color",
    categories: "Categorías (7)",
    categoryPlaceholder: "Categoría",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    delete: "Borrar",
    confirmDelete: "¿Borrar este pack?",
    fillAll: "Rellena las 7 categorías",
    namedRequired: "Ponle un nombre al pack",
    maxReached: "Has llegado al máximo de packs",
    create: "Crear pack",
  },
  en: {
    title: "My categories",
    subtitle: "Create custom 7-category packs",
    premiumRequired: "Premium-only feature",
    premiumDesc: "Invent your own category packs and play them in solo mode.",
    becomePremium: "Get Premium",
    empty: "No custom packs yet",
    createFirst: "Create my first pack",
    newPack: "New pack",
    editPack: "Edit pack",
    packName: "Pack name",
    namePlaceholder: "e.g. Videogames",
    icon: "Icon",
    color: "Color",
    categories: "Categories (7)",
    categoryPlaceholder: "Category",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    delete: "Delete",
    confirmDelete: "Delete this pack?",
    fillAll: "Fill in all 7 categories",
    namedRequired: "Give the pack a name",
    maxReached: "Maximum packs reached",
    create: "Create pack",
  },
  pt: {
    title: "Minhas categorias",
    subtitle: "Crie packs personalizados de 7 categorias",
    premiumRequired: "Recurso exclusivo Premium",
    premiumDesc: "Invente seus próprios packs e jogue no modo solo.",
    becomePremium: "Quero Premium",
    empty: "Sem packs personalizados",
    createFirst: "Criar meu primeiro pack",
    newPack: "Novo pack",
    editPack: "Editar pack",
    packName: "Nome do pack",
    namePlaceholder: "Ex: Videogames",
    icon: "Ícone",
    color: "Cor",
    categories: "Categorias (7)",
    categoryPlaceholder: "Categoria",
    cancel: "Cancelar",
    save: "Salvar",
    saving: "Salvando…",
    delete: "Excluir",
    confirmDelete: "Excluir este pack?",
    fillAll: "Preencha as 7 categorias",
    namedRequired: "Dê um nome ao pack",
    maxReached: "Máximo de packs atingido",
    create: "Criar pack",
  },
  fr: {
    title: "Mes catégories",
    subtitle: "Créez des packs personnalisés de 7 catégories",
    premiumRequired: "Fonction Premium",
    premiumDesc: "Inventez vos propres packs et jouez en solo.",
    becomePremium: "Devenir Premium",
    empty: "Aucun pack personnalisé",
    createFirst: "Créer mon premier pack",
    newPack: "Nouveau pack",
    editPack: "Modifier le pack",
    packName: "Nom du pack",
    namePlaceholder: "Ex : Jeux vidéo",
    icon: "Icône",
    color: "Couleur",
    categories: "Catégories (7)",
    categoryPlaceholder: "Catégorie",
    cancel: "Annuler",
    save: "Enregistrer",
    saving: "Enregistrement…",
    delete: "Supprimer",
    confirmDelete: "Supprimer ce pack ?",
    fillAll: "Remplissez les 7 catégories",
    namedRequired: "Donnez un nom au pack",
    maxReached: "Nombre maximum atteint",
    create: "Créer le pack",
  },
};

export function CustomPacksManager({
  open,
  onClose,
  playerId,
  isPremium,
  onPremiumClick,
}: CustomPacksManagerProps) {
  const lang = getLang();
  const t = T[lang] ?? T.es;
  const { packs, loading } = useCustomPacks(isPremium ? playerId : null);
  const [editing, setEditing] = useState<CustomPack | "new" | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [categories, setCategories] = useState<string[]>([...EMPTY_CATEGORIES]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setErr(null);
      setConfirmDelete(null);
    }
  }, [open]);

  useEffect(() => {
    if (editing === "new") {
      setName("");
      setIcon(ICON_CHOICES[0]);
      setColor(COLOR_CHOICES[0]);
      setCategories([...EMPTY_CATEGORIES]);
      setErr(null);
    } else if (editing && typeof editing === "object") {
      setName(editing.name);
      setIcon(editing.icon);
      setColor(editing.color);
      const padded = [...editing.categories];
      while (padded.length < CATEGORIES_COUNT) padded.push("");
      setCategories(padded.slice(0, CATEGORIES_COUNT));
      setErr(null);
    }
  }, [editing]);

  const handleSave = async () => {
    if (!name.trim()) {
      setErr(t.namedRequired);
      return;
    }
    if (categories.some((c) => !c.trim())) {
      setErr(t.fillAll);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        name: name.trim(),
        icon,
        color,
        language: lang,
        categories: categories.map((c) => c.trim()),
      };
      if (editing === "new") {
        await createCustomPack(playerId, payload);
      } else if (editing) {
        await updateCustomPack(editing.id, playerId, payload);
      }
      setEditing(null);
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCustomPack(id, playerId);
      setConfirmDelete(null);
    } catch (e: any) {
      setErr(e.message || "Error");
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] flex items-center justify-center p-3"
        style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.45 }}
          className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
          style={{
            background: "hsl(222 47% 11%)",
            border: "2px solid rgba(249,168,37,0.3)",
          }}
        >
          {/* Header */}
          <div
            className="px-5 pt-5 pb-4 flex-shrink-0"
            style={{
              background:
                "linear-gradient(140deg, hsl(43 96% 50%) 0%, hsl(222 47% 15%) 100%)",
            }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-white/70 hover:text-white"
              aria-label="close"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-white" />
              <h2
                className="text-white font-black text-xl"
                style={{ fontFamily: "'Baloo 2', sans-serif" }}
              >
                {t.title}
              </h2>
              <Crown className="w-4 h-4 text-yellow-200 ml-auto" />
            </div>
            <p className="text-white/80 text-xs">{t.subtitle}</p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!isPremium ? (
              <div className="text-center py-6 space-y-4">
                <div className="text-5xl">👑</div>
                <p className="text-white font-bold">{t.premiumRequired}</p>
                <p className="text-white/60 text-sm">{t.premiumDesc}</p>
                <button
                  onClick={() => {
                    onClose();
                    onPremiumClick?.();
                  }}
                  className="px-6 py-3 rounded-xl font-black text-base"
                  style={{
                    background: "linear-gradient(135deg, #f9a825, #f57f17)",
                    color: "#0d1757",
                    fontFamily: "'Baloo 2', sans-serif",
                  }}
                >
                  {t.becomePremium}
                </button>
              </div>
            ) : editing !== null ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-black text-white/50 mb-1 block">
                    {t.packName}
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={30}
                    placeholder={t.namePlaceholder}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border-2 border-white/15 text-white font-bold focus:outline-none focus:border-[#f9a825]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-black text-white/50 mb-1 block">
                    {t.icon}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ICON_CHOICES.map((i) => (
                      <button
                        key={i}
                        onClick={() => setIcon(i)}
                        className="w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all"
                        style={{
                          background: icon === i ? color : "rgba(255,255,255,0.07)",
                          border: icon === i ? "2px solid white" : "2px solid transparent",
                          transform: icon === i ? "scale(1.1)" : undefined,
                        }}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-black text-white/50 mb-1 block">
                    {t.color}
                  </label>
                  <div className="flex gap-2">
                    {COLOR_CHOICES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className="w-8 h-8 rounded-full transition-all"
                        style={{
                          backgroundColor: c,
                          border: color === c ? "3px solid white" : "3px solid transparent",
                          transform: color === c ? "scale(1.15)" : undefined,
                          boxShadow: color === c ? `0 0 12px ${c}` : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-black text-white/50 mb-1 block">
                    {t.categories}
                  </label>
                  <div className="space-y-1.5">
                    {categories.map((c, i) => (
                      <input
                        key={i}
                        value={c}
                        onChange={(e) => {
                          const next = [...categories];
                          next[i] = e.target.value;
                          setCategories(next);
                        }}
                        maxLength={30}
                        placeholder={`${t.categoryPlaceholder} ${i + 1}`}
                        className="w-full px-3 py-2 rounded-lg bg-white/8 border border-white/12 text-white text-sm font-medium focus:outline-none focus:border-[#f9a825]"
                      />
                    ))}
                  </div>
                </div>
                {err && (
                  <p className="text-red-400 text-xs bg-red-900/25 rounded-lg px-3 py-2">
                    {err}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditing(null)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-white/80 bg-white/10"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #f9a825, #f57f17)",
                      color: "#0d1757",
                    }}
                  >
                    <Save size={14} />
                    {saving ? t.saving : t.save}
                  </button>
                </div>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="inline-block w-7 h-7 rounded-full border-2 border-[#f9a825] border-t-transparent animate-spin" />
              </div>
            ) : packs.length === 0 ? (
              <div className="text-center py-6 space-y-4">
                <div className="text-5xl">✨</div>
                <p className="text-white/70 font-medium">{t.empty}</p>
                <button
                  onClick={() => setEditing("new")}
                  className="px-5 py-2.5 rounded-xl font-black flex items-center gap-2 mx-auto"
                  style={{
                    background: "linear-gradient(135deg, #f9a825, #f57f17)",
                    color: "#0d1757",
                  }}
                >
                  <Plus size={16} /> {t.createFirst}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {packs.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${p.color}33`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: p.color }}
                    >
                      {p.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{p.name}</p>
                      <p className="text-white/40 text-xs truncate">
                        {p.categories.join(" · ")}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditing(p)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                      aria-label="edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="p-2 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-900/20"
                      aria-label="delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setEditing("new")}
                  className="w-full py-3 rounded-xl font-black flex items-center justify-center gap-2 mt-2"
                  style={{
                    background: "linear-gradient(135deg, #f9a825, #f57f17)",
                    color: "#0d1757",
                  }}
                >
                  <Plus size={16} /> {t.newPack}
                </button>
              </div>
            )}

            {confirmDelete !== null && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center p-4 rounded-3xl"
                style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(2px)" }}
              >
                <div
                  className="rounded-2xl p-5 max-w-xs space-y-3 text-center"
                  style={{ background: "hsl(222 47% 14%)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <p className="text-white font-bold">{t.confirmDelete}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 py-2 rounded-lg font-bold text-white/80 bg-white/10"
                    >
                      {t.cancel}
                    </button>
                    <button
                      onClick={() => handleDelete(confirmDelete)}
                      className="flex-1 py-2 rounded-lg font-black bg-red-600 text-white"
                    >
                      {t.delete}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
