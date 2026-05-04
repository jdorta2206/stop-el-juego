export interface CategoryPack {
  id: string;
  icon: string;
  premium?: boolean;
  categories: {
    es: string[];
    en: string[];
    pt: string[];
    fr: string[];
  };
  name: {
    es: string;
    en: string;
    pt: string;
    fr: string;
  };
  color: string;
  gradient: string;
}

export const CATEGORY_PACKS: CategoryPack[] = [
  {
    id: "classic",
    icon: "📝",
    categories: {
      es: ["Nombre", "Lugar", "Animal", "Objeto", "Color", "Fruta", "Marca"],
      en: ["Name", "Place", "Animal", "Object", "Color", "Fruit", "Brand"],
      pt: ["Nome", "Lugar", "Animal", "Objeto", "Cor", "Fruta", "Marca"],
      fr: ["Prénom", "Lieu", "Animal", "Objet", "Couleur", "Fruit", "Marque"],
    },
    name: { es: "Clásico", en: "Classic", pt: "Clássico", fr: "Classique" },
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  },
  {
    id: "football",
    icon: "⚽",
    categories: {
      es: ["Futbolista", "Equipo", "Estadio", "Entrenador", "Competición", "País futbolero", "Jugada"],
      en: ["Player", "Team", "Stadium", "Coach", "Competition", "Football country", "Move"],
      pt: ["Jogador", "Time", "Estádio", "Treinador", "Competição", "País do futebol", "Jogada"],
      fr: ["Joueur", "Équipe", "Stade", "Entraîneur", "Compétition", "Pays foot", "Action"],
    },
    name: { es: "Fútbol", en: "Football", pt: "Futebol", fr: "Football" },
    color: "#16a34a",
    gradient: "linear-gradient(135deg, #16a34a, #15803d)",
  },
  {
    id: "cinema",
    icon: "🎬",
    categories: {
      es: ["Actor/Actriz", "Película", "Serie", "Director/a", "Personaje", "Género", "Canción de peli"],
      en: ["Actor/Actress", "Movie", "TV Show", "Director", "Character", "Genre", "Movie song"],
      pt: ["Ator/Atriz", "Filme", "Série", "Diretor/a", "Personagem", "Gênero", "Música de filme"],
      fr: ["Acteur/Actrice", "Film", "Série", "Réalisateur", "Personnage", "Genre", "Chanson de film"],
    },
    name: { es: "Cine y TV", en: "Movies & TV", pt: "Cinema e TV", fr: "Ciné & TV" },
    color: "#eab308",
    gradient: "linear-gradient(135deg, #eab308, #ca8a04)",
  },
  {
    id: "food",
    icon: "🍕",
    categories: {
      es: ["Plato", "Ingrediente", "Restaurante", "Postre", "Bebida", "Especia", "Cocina del mundo"],
      en: ["Dish", "Ingredient", "Restaurant", "Dessert", "Drink", "Spice", "World cuisine"],
      pt: ["Prato", "Ingrediente", "Restaurante", "Sobremesa", "Bebida", "Tempero", "Culinária"],
      fr: ["Plat", "Ingrédient", "Restaurant", "Dessert", "Boisson", "Épice", "Cuisine du monde"],
    },
    name: { es: "Comida", en: "Food", pt: "Comida", fr: "Cuisine" },
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
  },
  {
    id: "music",
    icon: "🎵",
    categories: {
      es: ["Artista", "Canción", "Banda", "Género", "Instrumento", "Álbum", "Sello discográfico"],
      en: ["Artist", "Song", "Band", "Genre", "Instrument", "Album", "Record label"],
      pt: ["Artista", "Música", "Banda", "Gênero", "Instrumento", "Álbum", "Gravadora"],
      fr: ["Artiste", "Chanson", "Groupe", "Genre", "Instrument", "Album", "Label"],
    },
    name: { es: "Música", en: "Music", pt: "Música", fr: "Musique" },
    color: "#a855f7",
    gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
  },
  {
    id: "geography",
    icon: "🌍",
    categories: {
      es: ["País", "Capital", "Río", "Montaña", "Idioma", "Monumento", "Mar/Océano"],
      en: ["Country", "Capital", "River", "Mountain", "Language", "Monument", "Sea/Ocean"],
      pt: ["País", "Capital", "Rio", "Montanha", "Idioma", "Monumento", "Mar/Oceano"],
      fr: ["Pays", "Capitale", "Fleuve", "Montagne", "Langue", "Monument", "Mer/Océan"],
    },
    name: { es: "Geografía", en: "Geography", pt: "Geografia", fr: "Géographie" },
    color: "#0ea5e9",
    gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)",
  },
  {
    id: "science",
    icon: "🔬",
    premium: true,
    categories: {
      es: ["Elemento químico", "Científico/a", "Invento", "Planeta/Astro", "Enfermedad", "Órgano", "Fórmula"],
      en: ["Chemical element", "Scientist", "Invention", "Planet/Star", "Disease", "Organ", "Formula"],
      pt: ["Elemento químico", "Cientista", "Invenção", "Planeta/Astro", "Doença", "Órgão", "Fórmula"],
      fr: ["Élément chimique", "Scientifique", "Invention", "Planète/Astre", "Maladie", "Organe", "Formule"],
    },
    name: { es: "Ciencia", en: "Science", pt: "Ciência", fr: "Sciences" },
    color: "#14b8a6",
    gradient: "linear-gradient(135deg, #14b8a6, #0d9488)",
  },
  {
    id: "history",
    icon: "🏛️",
    premium: true,
    categories: {
      es: ["Personaje histórico", "Batalla", "Imperio/Civilización", "Invento de época", "Revolución", "Tratado", "Monarca"],
      en: ["Historical figure", "Battle", "Empire/Civilization", "Invention", "Revolution", "Treaty", "Monarch"],
      pt: ["Personagem histórico", "Batalha", "Império/Civilização", "Invenção", "Revolução", "Tratado", "Monarca"],
      fr: ["Personnage historique", "Bataille", "Empire/Civilisation", "Invention", "Révolution", "Traité", "Monarque"],
    },
    name: { es: "Historia", en: "History", pt: "História", fr: "Histoire" },
    color: "#b45309",
    gradient: "linear-gradient(135deg, #b45309, #92400e)",
  },
];

const PACK_STORAGE_KEY = "stop_selected_pack";

export function getSelectedPackId(): string {
  try {
    return localStorage.getItem(PACK_STORAGE_KEY) || "classic";
  } catch {
    return "classic";
  }
}

export function setSelectedPackId(id: string) {
  try {
    localStorage.setItem(PACK_STORAGE_KEY, id);
  } catch { /* ignore */ }
}

export function getPackById(id: string): CategoryPack {
  return CATEGORY_PACKS.find(p => p.id === id) || CATEGORY_PACKS[0];
}

export function getPackCategories(packId: string, lang: string): string[] {
  const pack = getPackById(packId);
  const key = (lang === "es" || lang === "en" || lang === "pt" || lang === "fr") ? lang : "es";
  return [...pack.categories[key]];
}

export function getSafePackId(packId: string, isPremium: boolean): string {
  const pack = getPackById(packId);
  if (pack.premium && !isPremium) return "classic";
  return pack.id;
}
