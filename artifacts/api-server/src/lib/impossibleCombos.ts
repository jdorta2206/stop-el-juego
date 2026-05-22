// Curated list of brutally hard (letter, category) pairs for the daily
// "Palabra Imposible" challenge. One is selected deterministically per
// UTC day so every player in a language gets the same combo.
//
// Design principles:
//  - Letters skew toward K, W, X, Y, Z, Ñ, and other low-frequency starts
//    in the target language.
//  - Categories are niche but answerable — never trivia. The goal is
//    "ohhhh I almost had it" frustration, not "impossible to guess".
//  - All combos hand-verified to have at least one valid answer.

export interface ImpossibleCombo {
  letter: string;
  category: string;
}

const ES: ImpossibleCombo[] = [
  { letter: "K", category: "Marcas de motos japonesas" },
  { letter: "W", category: "Capitales del mundo" },
  { letter: "X", category: "Personajes de cómic" },
  { letter: "Y", category: "Bailes o danzas" },
  { letter: "Z", category: "Animales africanos" },
  { letter: "Ñ", category: "Cosas de la cocina" },
  { letter: "K", category: "Países del mundo" },
  { letter: "W", category: "Apellidos famosos" },
  { letter: "X", category: "Instrumentos musicales" },
  { letter: "Z", category: "Verbos en pretérito" },
  { letter: "K", category: "Ríos del mundo" },
  { letter: "H", category: "Verbos de cocina" },
  { letter: "Ñ", category: "Adjetivos" },
  { letter: "W", category: "Marcas de coches" },
  { letter: "Y", category: "Países del mundo" },
  { letter: "X", category: "Apellidos famosos" },
  { letter: "Z", category: "Frutas o verduras" },
  { letter: "K", category: "Cosas de la oficina" },
  { letter: "W", category: "Animales" },
  { letter: "Y", category: "Comidas o platos típicos" },
  { letter: "Q", category: "Cosas de la calle" },
  { letter: "J", category: "Verbos en imperativo" },
  { letter: "Z", category: "Cosas de la playa" },
  { letter: "K", category: "Deportes" },
  { letter: "W", category: "Películas famosas" },
  { letter: "Ñ", category: "Lugares de la casa" },
  { letter: "X", category: "Marcas de tecnología" },
  { letter: "Y", category: "Profesiones" },
  { letter: "Z", category: "Nombres de niño" },
  { letter: "H", category: "Adverbios" },
  { letter: "U", category: "Marcas de ropa" },
  { letter: "Q", category: "Animales" },
  { letter: "B", category: "Capitales africanas" },
  { letter: "G", category: "Verbos terminados en -ir" },
  { letter: "T", category: "Bailes o danzas" },
  { letter: "F", category: "Apellidos españoles" },
  { letter: "V", category: "Capitales europeas" },
  { letter: "R", category: "Marcas de motos" },
  { letter: "I", category: "Instrumentos de cuerda" },
  { letter: "N", category: "Frutas tropicales" },
  { letter: "D", category: "Personajes históricos" },
  { letter: "L", category: "Bailes latinos" },
  { letter: "M", category: "Capitales asiáticas" },
  { letter: "P", category: "Verbos terminados en -ar poco usados" },
  { letter: "S", category: "Animales marinos raros" },
  { letter: "A", category: "Marcas de relojes" },
  { letter: "E", category: "Apellidos italianos" },
  { letter: "O", category: "Ciudades japonesas" },
  { letter: "C", category: "Cosas que pesan más de 100kg" },
  { letter: "K", category: "Verbos cualquiera" },
];

const EN: ImpossibleCombo[] = [
  { letter: "K", category: "Japanese motorcycle brands" },
  { letter: "W", category: "Capital cities" },
  { letter: "X", category: "Comic book characters" },
  { letter: "Y", category: "Dances" },
  { letter: "Z", category: "African animals" },
  { letter: "Q", category: "Kitchen items" },
  { letter: "K", category: "Countries" },
  { letter: "W", category: "Famous surnames" },
  { letter: "X", category: "Musical instruments" },
  { letter: "Z", category: "Past-tense verbs" },
  { letter: "K", category: "Rivers" },
  { letter: "H", category: "Cooking verbs" },
  { letter: "U", category: "Adjectives" },
  { letter: "W", category: "Car brands" },
  { letter: "Y", category: "Countries" },
  { letter: "X", category: "Famous surnames" },
  { letter: "Z", category: "Fruits or vegetables" },
  { letter: "K", category: "Office items" },
  { letter: "W", category: "Animals" },
  { letter: "Y", category: "Foods or dishes" },
  { letter: "Q", category: "Things in the street" },
  { letter: "J", category: "Imperative verbs" },
  { letter: "Z", category: "Beach things" },
  { letter: "K", category: "Sports" },
  { letter: "W", category: "Famous movies" },
  { letter: "V", category: "Rooms of the house" },
  { letter: "X", category: "Tech brands" },
  { letter: "Y", category: "Professions" },
  { letter: "Z", category: "Boys' names" },
  { letter: "H", category: "Adverbs" },
  { letter: "U", category: "Clothing brands" },
  { letter: "Q", category: "Animals" },
  { letter: "B", category: "African capitals" },
];

const PT: ImpossibleCombo[] = [
  { letter: "K", category: "Marcas de motos japonesas" },
  { letter: "W", category: "Capitais do mundo" },
  { letter: "X", category: "Personagens de banda desenhada" },
  { letter: "Y", category: "Danças" },
  { letter: "Z", category: "Animais africanos" },
  { letter: "Q", category: "Coisas da cozinha" },
  { letter: "K", category: "Países" },
  { letter: "W", category: "Apelidos famosos" },
  { letter: "X", category: "Instrumentos musicais" },
  { letter: "Z", category: "Verbos no passado" },
  { letter: "K", category: "Rios" },
  { letter: "H", category: "Verbos de cozinha" },
  { letter: "U", category: "Adjetivos" },
  { letter: "W", category: "Marcas de carros" },
  { letter: "Y", category: "Países" },
  { letter: "X", category: "Apelidos famosos" },
  { letter: "Z", category: "Frutas ou legumes" },
  { letter: "K", category: "Itens de escritório" },
  { letter: "W", category: "Animais" },
  { letter: "Y", category: "Comidas ou pratos" },
];

const FR: ImpossibleCombo[] = [
  { letter: "K", category: "Marques de moto japonaises" },
  { letter: "W", category: "Capitales du monde" },
  { letter: "X", category: "Personnages de BD" },
  { letter: "Y", category: "Danses" },
  { letter: "Z", category: "Animaux d'Afrique" },
  { letter: "Q", category: "Choses dans la cuisine" },
  { letter: "K", category: "Pays" },
  { letter: "W", category: "Noms de famille célèbres" },
  { letter: "X", category: "Instruments de musique" },
  { letter: "Z", category: "Verbes au passé" },
  { letter: "H", category: "Verbes de cuisine" },
  { letter: "U", category: "Adjectifs" },
  { letter: "W", category: "Marques de voiture" },
  { letter: "Y", category: "Pays" },
  { letter: "Z", category: "Fruits ou légumes" },
  { letter: "K", category: "Sports" },
  { letter: "W", category: "Films célèbres" },
];

const BY_LANG: Record<string, ImpossibleCombo[]> = { es: ES, en: EN, pt: PT, fr: FR };

// Deterministic seed from a date string so the same date always yields the
// same combo. Same algorithm as the regular daily challenge.
function seedFromDate(dateStr: string): number {
  return dateStr.replace(/-/g, "").split("").reduce(
    (acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0
  );
}

export function getImpossibleCombo(dateStr: string, language: string): ImpossibleCombo {
  const list = BY_LANG[language] ?? ES;
  const seed = seedFromDate(dateStr);
  return list[seed % list.length];
}
