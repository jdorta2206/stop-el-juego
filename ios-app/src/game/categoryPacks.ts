export type StopLanguage = 'es' | 'en' | 'pt' | 'fr';

export interface NativeCategoryPack {
  id: string;
  icon: string;
  premium?: boolean;
  categories: Record<StopLanguage, string[]>;
  name: Record<StopLanguage, string>;
}

// Native copy of the real game's built-in category definitions.
// Web-only localStorage/custom-pack resolution is intentionally not copied;
// iOS will resolve account-owned data through the backend.
export const CATEGORY_PACKS: NativeCategoryPack[] = [
  { id: 'classic', icon: '📝', categories: { es: ['Nombre','Lugar','Animal','Objeto','Color','Fruta','Marca'], en: ['Name','Place','Animal','Object','Color','Fruit','Brand'], pt: ['Nome','Lugar','Animal','Objeto','Cor','Fruta','Marca'], fr: ['Prénom','Lieu','Animal','Objet','Couleur','Fruit','Marque'] }, name: { es: 'Clásico', en: 'Classic', pt: 'Clássico', fr: 'Classique' } },
  { id: 'football', icon: '⚽', categories: { es: ['Futbolista','Equipo','Estadio','Entrenador','Competición','País futbolero','Jugada'], en: ['Player','Team','Stadium','Coach','Competition','Football country','Move'], pt: ['Jogador','Time','Estádio','Treinador','Competição','País do futebol','Jogada'], fr: ['Joueur','Équipe','Stade','Entraîneur','Compétition','Pays foot','Action'] }, name: { es: 'Fútbol', en: 'Football', pt: 'Futebol', fr: 'Football' } },
  { id: 'cinema', icon: '🎬', categories: { es: ['Actor/Actriz','Película','Serie','Director/a','Personaje','Género','Canción de peli'], en: ['Actor/Actress','Movie','TV Show','Director','Character','Genre','Movie song'], pt: ['Ator/Atriz','Filme','Série','Diretor/a','Personagem','Gênero','Música de filme'], fr: ['Acteur/Actrice','Film','Série','Réalisateur','Personnage','Genre','Chanson de film'] }, name: { es: 'Cine y TV', en: 'Movies & TV', pt: 'Cinema e TV', fr: 'Ciné & TV' } },
  { id: 'food', icon: '🍕', categories: { es: ['Plato','Ingrediente','Restaurante','Postre','Bebida','Especia','Cocina del mundo'], en: ['Dish','Ingredient','Restaurant','Dessert','Drink','Spice','World cuisine'], pt: ['Prato','Ingrediente','Restaurante','Sobremesa','Bebida','Tempero','Culinária'], fr: ['Plat','Ingrédient','Restaurant','Dessert','Boisson','Épice','Cuisine du monde'] }, name: { es: 'Comida', en: 'Food', pt: 'Comida', fr: 'Cuisine' } },
  { id: 'music', icon: '🎵', categories: { es: ['Artista','Canción','Banda','Género','Instrumento','Álbum','Sello discográfico'], en: ['Artist','Song','Band','Genre','Instrument','Album','Record label'], pt: ['Artista','Música','Banda','Gênero','Instrumento','Álbum','Gravadora'], fr: ['Artiste','Chanson','Groupe','Genre','Instrument','Album','Label'] }, name: { es: 'Música', en: 'Music', pt: 'Música', fr: 'Musique' } },
  { id: 'geography', icon: '🌍', categories: { es: ['País','Capital','Río','Montaña','Idioma','Monumento','Mar/Océano'], en: ['Country','Capital','River','Mountain','Language','Monument','Sea/Ocean'], pt: ['País','Capital','Rio','Montanha','Idioma','Monumento','Mar/Oceano'], fr: ['Pays','Capitale','Fleuve','Montagne','Langue','Monument','Mer/Océan'] }, name: { es: 'Geografía', en: 'Geography', pt: 'Geografia', fr: 'Géographie' } },
  { id: 'science', icon: '🔬', categories: { es: ['Elemento químico','Científico/a','Invento','Planeta/Astro','Enfermedad','Órgano','Fórmula'], en: ['Chemical element','Scientist','Invention','Planet/Star','Disease','Organ','Formula'], pt: ['Elemento químico','Cientista','Invenção','Planeta/Astro','Doença','Órgão','Fórmula'], fr: ['Élément chimique','Scientifique','Invention','Planète/Astre','Maladie','Organe','Formule'] }, name: { es: 'Ciencia', en: 'Science', pt: 'Ciência', fr: 'Sciences' } },
  { id: 'history', icon: '🏛️', categories: { es: ['Personaje histórico','Batalla','Imperio/Civilización','Invento de época','Revolución','Tratado','Monarca'], en: ['Historical figure','Battle','Empire/Civilization','Invention','Revolution','Treaty','Monarch'], pt: ['Personagem histórico','Batalha','Império/Civilização','Invenção','Revolução','Tratado','Monarca'], fr: ['Personnage historique','Bataille','Empire/Civilisation','Invention','Révolution','Traité','Monarque'] }, name: { es: 'Historia', en: 'History', pt: 'História', fr: 'Histoire' } },
];

export function getPackById(id = 'classic'): NativeCategoryPack {
  return CATEGORY_PACKS.find(pack => pack.id === id) ?? CATEGORY_PACKS[0];
}

export function getPackCategories(id: string, language: string): string[] {
  const pack = getPackById(id);
  const lang: StopLanguage = language === 'en' || language === 'pt' || language === 'fr' ? language : 'es';
  return [...pack.categories[lang]];
}
