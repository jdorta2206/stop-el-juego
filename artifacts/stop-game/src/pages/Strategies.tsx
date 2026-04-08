import { Link } from "wouter";
import { useState } from "react";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

type Letter = { letter: string; difficulty: "fácil" | "media" | "difícil"; tips: { cat: string; words: string[] }[]; advice: string };

const LETTERS: Letter[] = [
  {
    letter: "A", difficulty: "fácil", advice: "Una de las letras más ricas del español. Hay miles de opciones en todas las categorías. Evita palabras demasiado comunes como 'árbol' o 'avión' — seguro que otro jugador las pensará igual.",
    tips: [
      { cat: "Nombre", words: ["Álvaro", "Adriana", "Alejandro", "Ariadna", "Agustín"] },
      { cat: "Animal", words: ["Armadillo", "Axolotl", "Avestruz", "Anaconda", "Alce"] },
      { cat: "País / Lugar", words: ["Azerbaiyán", "Afganistán", "Ámsterdam", "Asunción", "Argelia"] },
      { cat: "Marca", words: ["Adidas", "Apple", "Audi", "Alibaba", "Airbnb"] },
      { cat: "Fruta", words: ["Arándano", "Aguacate", "Albaricoque", "Aceituna", "Anón"] },
      { cat: "Color", words: ["Amarillo", "Azul marino", "Añil", "Almagre", "Azulón"] },
    ],
  },
  {
    letter: "B", difficulty: "fácil", advice: "Letra fácil para nombres propios y marcas, pero más difícil para colores y frutas. Si la letra es B, apuesta por nombres exóticos o compuestos para diferenciarte.",
    tips: [
      { cat: "Nombre", words: ["Beatriz", "Bruno", "Bernardo", "Belén", "Bartolomé"] },
      { cat: "Animal", words: ["Búfalo", "Babuino", "Boa", "Buitre", "Ballena"] },
      { cat: "País / Lugar", words: ["Bielorrusia", "Bangladés", "Bogotá", "Bruselas", "Budapest"] },
      { cat: "Marca", words: ["BMW", "Burger King", "Bershka", "Boss", "Booking"] },
      { cat: "Fruta", words: ["Banana", "Boysenberry", "Breva", "Badea"] },
      { cat: "Color", words: ["Burdeos", "Blanco hueso", "Beige", "Bronce"] },
    ],
  },
  {
    letter: "C", difficulty: "fácil", advice: "C es quizás la letra más generosa del español. El peligro es que todos piensan lo mismo. Apuesta por palabras poco comunes: en vez de 'caballo' di 'ciervo', en vez de 'Colombia' di 'Camerún'.",
    tips: [
      { cat: "Nombre", words: ["Claudia", "Cayetano", "Consuelo", "Celestino", "Catalina"] },
      { cat: "Animal", words: ["Capibara", "Cacatúa", "Castor", "Cocodrilo", "Cisne"] },
      { cat: "País / Lugar", words: ["Camerún", "Camboya", "Copenhague", "Caracas", "Cartagena"] },
      { cat: "Marca", words: ["Coca-Cola", "Chanel", "Canon", "Cupra", "Cortefiel"] },
      { cat: "Fruta", words: ["Carambola", "Cereza", "Ciruela", "Caqui", "Chirimoya"] },
      { cat: "Color", words: ["Carmesí", "Celeste", "Coral", "Cian", "Cobrizo"] },
    ],
  },
  {
    letter: "D", difficulty: "media", advice: "D tiene menos palabras que C pero sigue siendo asequible. Los nombres propios con D son menos comunes, así que si encuentras uno bueno, probablemente sea único. Para países, 'Dinamarca' y 'Dominicana' las pensarán todos; opta por 'Djibouti' o 'Dominica'.",
    tips: [
      { cat: "Nombre", words: ["Dolores", "Desirée", "Damián", "Dionisio", "Débora"] },
      { cat: "Animal", words: ["Delfín", "Dromedario", "Dingo", "Dugongo"] },
      { cat: "País / Lugar", words: ["Djibouti", "Dinamarca", "Dubái", "Dominica", "Damasco"] },
      { cat: "Marca", words: ["Disney", "Dior", "Dyson", "Dell", "DHL"] },
      { cat: "Fruta", words: ["Dátil", "Durazno", "Dragonfruta"] },
      { cat: "Color", words: ["Dorado", "Dodger blue", "Damasco"] },
    ],
  },
  {
    letter: "E", difficulty: "fácil", advice: "E es una letra muy cómoda. El truco es evitar las respuestas más obvias (Elefante, España, Eduardo) y buscar palabras más originales que pocos jugadores conocen. 'Equidna' para Animal o 'Eritrea' para País son joyas poco usadas.",
    tips: [
      { cat: "Nombre", words: ["Esmeralda", "Evaristo", "Electra", "Efraín", "Edelmira"] },
      { cat: "Animal", words: ["Equidna", "Erizo de mar", "Escarabajo", "Estornino", "Emú"] },
      { cat: "País / Lugar", words: ["Eritrea", "Eslovenia", "Estambul", "Edimburgo", "Etiopía"] },
      { cat: "Marca", words: ["Epson", "Estrella Damm", "El Corte Inglés", "Emirates"] },
      { cat: "Fruta", words: ["Endrino", "Espino cerval", "Escaramujo"] },
      { cat: "Color", words: ["Escarlata", "Esmeralda", "Ebony", "Encarnado"] },
    ],
  },
  {
    letter: "F", difficulty: "media", advice: "F empieza a ser un poco más complicada. Para frutas, 'Fresa' y 'Frambuesa' son las que todos piensan. Para diferenciarte, busca 'Feijoa' o 'Fruta de la pasión'. Para países, 'Fiyi' es una respuesta poco común que da 10 puntos seguros.",
    tips: [
      { cat: "Nombre", words: ["Filomena", "Fabián", "Florinda", "Federico", "Fernanda"] },
      { cat: "Animal", words: ["Flamenco", "Foca", "Faisán", "Frailecillo", "Focena"] },
      { cat: "País / Lugar", words: ["Fiyi", "Finlandia", "Filipinas", "Frankfurt", "Florencia"] },
      { cat: "Marca", words: ["Ferrari", "Fendi", "Facebook", "Ferrero", "Fiat"] },
      { cat: "Fruta", words: ["Feijoa", "Frambuesa", "Fresa", "Fruta del dragón"] },
      { cat: "Color", words: ["Fucsia", "Frambuesa", "Flor de cerezo"] },
    ],
  },
  {
    letter: "G", difficulty: "media", advice: "G tiene muchas opciones en animales y lugares, pero es complicada para frutas y colores. 'Guayaba' es la fruta más conocida — todos la pondrán, así que vale solo 5 puntos. Para marcas, 'Google' y 'Gucci' son demasiado obvias.",
    tips: [
      { cat: "Nombre", words: ["Guadalupe", "Gonzalo", "Genoveva", "Gaspar", "Gervasio"] },
      { cat: "Animal", words: ["Gorila", "Guepardo", "Ganso", "Gaviota", "Gamo"] },
      { cat: "País / Lugar", words: ["Gabón", "Gambia", "Gujarat", "Guadalajara", "Ginebra"] },
      { cat: "Marca", words: ["Gap", "Garmin", "Gillette", "GoPro", "Glovo"] },
      { cat: "Fruta", words: ["Guayaba", "Granada", "Grosellas", "Guanábana"] },
      { cat: "Color", words: ["Granate", "Gris perla", "Grafito", "Gualda"] },
    ],
  },
  {
    letter: "H", difficulty: "difícil", advice: "H es una de las letras más temidas. Recuerda que en español la H es muda, pero la palabra sí empieza por H. Para animales, piensa en 'Hiena', 'Hipopótamo' o 'Hurón'. Para países, 'Hungría' y 'Honduras' son las más rápidas.",
    tips: [
      { cat: "Nombre", words: ["Hortensia", "Heriberto", "Higinio", "Herminia", "Horacio"] },
      { cat: "Animal", words: ["Hiena", "Hurón", "Hipocampo", "Hormiga", "Halcón"] },
      { cat: "País / Lugar", words: ["Hungría", "Haití", "Helsinki", "La Habana", "Hokkaido"] },
      { cat: "Marca", words: ["Hugo Boss", "H&M", "Honda", "Huawei", "Hilton"] },
      { cat: "Fruta", words: ["Higo", "Higo chumbo", "Huaya"] },
      { cat: "Color", words: ["Humo", "Herrumbre"] },
    ],
  },
  {
    letter: "I", difficulty: "media", advice: "I es moderada. El problema es que muchas palabras con I son comunes. Para animales, 'Iguana' e 'Ibis' son buenas opciones. Para frutas, casi nadie sabe que existe el 'Ilama' o la 'Inga'.",
    tips: [
      { cat: "Nombre", words: ["Ignacio", "Inmaculada", "Inés", "Imelda", "Isidro"] },
      { cat: "Animal", words: ["Iguana", "Ibis", "Impala", "Insecto palo", "Irarrarí"] },
      { cat: "País / Lugar", words: ["Islandia", "Irlanda", "Islamabad", "Estambul", "Innsbruck"] },
      { cat: "Marca", words: ["Ikea", "Instagram", "Intel", "Iberia", "Inditex"] },
      { cat: "Fruta", words: ["Inga", "Ilama", "Icaco"] },
      { cat: "Color", words: ["Índigo", "Ivory", "Imán"] },
    ],
  },
  {
    letter: "J", difficulty: "media", advice: "J puede sorprender a muchos jugadores. Para países, recuerda Jordania, Jamaica y Japón, pero también Djibouti (en inglés Djibouti empieza por D, pero Yibuti empieza por Y). Para animales, 'Jaguar', 'Jilguero' y 'Jabalí' son sólidos.",
    tips: [
      { cat: "Nombre", words: ["Jacinta", "Jeremías", "Josefina", "Jonás", "Jerónimo"] },
      { cat: "Animal", words: ["Jaguar", "Jilguero", "Jabalí", "Jibia", "Jerbo"] },
      { cat: "País / Lugar", words: ["Jordania", "Jamaica", "Japón", "Jakarta", "Johanesburgo"] },
      { cat: "Marca", words: ["Jaguar", "JBL", "Johnnie Walker", "Jimmy Choo"] },
      { cat: "Fruta", words: ["Jaca", "Jambú", "Jaboncillo"] },
      { cat: "Color", words: ["Jade", "Jaspe"] },
    ],
  },
  {
    letter: "L", difficulty: "fácil", advice: "L es generosa. Cuidado con las respuestas que todos ponen: 'León', 'Lima', 'Luis'. Busca la variante menos común: 'Lemur' en vez de 'León', 'Letonia' en vez de 'Líbano'.",
    tips: [
      { cat: "Nombre", words: ["Lorenza", "Leopoldo", "Lourdes", "Lisandro", "Leonor"] },
      { cat: "Animal", words: ["Lemur", "Lagarto", "Linx", "Langosta", "Lamprea"] },
      { cat: "País / Lugar", words: ["Letonia", "Liechtenstein", "Lagos", "Lisboa", "Lima"] },
      { cat: "Marca", words: ["Lego", "Louis Vuitton", "LinkedIn", "Lacoste", "Leroy Merlin"] },
      { cat: "Fruta", words: ["Lichí", "Lima", "Limón", "Lucuma", "Langsat"] },
      { cat: "Color", words: ["Lavanda", "Lima", "Lila", "Lapislázuli"] },
    ],
  },
  {
    letter: "M", difficulty: "fácil", advice: "M tiene muchísimas opciones pero también mucha competencia. Para marcas, casi todo el mundo pone 'Mercedes' o 'McDonald's'. Prueba 'Maersk', 'Mango' o 'Moët'. Para animales, 'Manatí' o 'Mofeta' son sorprendentes.",
    tips: [
      { cat: "Nombre", words: ["Milagros", "Maximiliano", "Montserrat", "Melchor", "Miroslava"] },
      { cat: "Animal", words: ["Manatí", "Mofeta", "Mantarraya", "Marsopa", "Marmota"] },
      { cat: "País / Lugar", words: ["Maldivas", "Mauricio", "Mozambique", "Montevideo", "Melbourne"] },
      { cat: "Marca", words: ["Movistar", "Mango", "Motorola", "Mahou", "Massimo Dutti"] },
      { cat: "Fruta", words: ["Maracuyá", "Mamey", "Mora", "Melocotón", "Membrillo"] },
      { cat: "Color", words: ["Magenta", "Malva", "Mostaza", "Marfil", "Marrón"] },
    ],
  },
  {
    letter: "N", difficulty: "media", advice: "N tiene menos palabras que M pero sigue siendo manejable. Para frutas, 'Naranja' la pondrá todo el mundo. 'Nance' o 'Níspero' pueden darte los 10 puntos. Para animales, 'Narval' es una respuesta poco común que vale mucho.",
    tips: [
      { cat: "Nombre", words: ["Nicanor", "Natividad", "Narciso", "Nicolasa", "Natanael"] },
      { cat: "Animal", words: ["Narval", "Nutria", "Ñandú", "Noctilio", "Numbat"] },
      { cat: "País / Lugar", words: ["Namibia", "Nepal", "Nicaragua", "Nairobi", "Nápoles"] },
      { cat: "Marca", words: ["Netflix", "Nike", "Nintendo", "Nestlé", "Nvidia"] },
      { cat: "Fruta", words: ["Níspero", "Nance", "Naranja", "Noni"] },
      { cat: "Color", words: ["Negro azabache", "Naranja", "Nude", "Nácar"] },
    ],
  },
  {
    letter: "P", difficulty: "fácil", advice: "P es una de las letras más fértiles del español. El riesgo es que todo el mundo piensa lo mismo. Para diferenciarte: 'Pangolín' en vez de 'Perro', 'Paraguay' en vez de 'Perú', 'Papaya' la pondrán todos pero 'Pitahaya' te da 10 puntos.",
    tips: [
      { cat: "Nombre", words: ["Purificación", "Pantaleón", "Primitiva", "Prudencio", "Paloma"] },
      { cat: "Animal", words: ["Pangolín", "Pelícano", "Puercoespín", "Pirañas", "Perezoso"] },
      { cat: "País / Lugar", words: ["Papúa Nueva Guinea", "Pakistán", "Panamá", "Praga", "Pekín"] },
      { cat: "Marca", words: ["Pepsi", "Pandora", "Peugeot", "Pull&Bear", "Phillip Morris"] },
      { cat: "Fruta", words: ["Pitahaya", "Pitanga", "Pomelo", "Papaya", "Pera"] },
      { cat: "Color", words: ["Púrpura", "Pizarra", "Perla", "Palo de rosa", "Pistache"] },
    ],
  },
  {
    letter: "R", difficulty: "media", advice: "R es buena para animales y lugares. Para frutas es bastante limitada — 'Rambután' es la estrella y muy pocos la conocen. Para marcas, evita 'Renault' (muy obvia) y busca 'Ralph Lauren' o 'Rolex'.",
    tips: [
      { cat: "Nombre", words: ["Remedios", "Rogelio", "Rufina", "Rigoberto", "Rosaura"] },
      { cat: "Animal", words: ["Rorcual", "Rinoceronte", "Renacuajo", "Ratón de campo", "Rape"] },
      { cat: "País / Lugar", words: ["Ruanda", "Riad", "Rotterdam", "Reikiavik", "República Checa"] },
      { cat: "Marca", words: ["Rolex", "Ralph Lauren", "Rimmel", "Repsol", "Red Bull"] },
      { cat: "Fruta", words: ["Rambután", "Ruibarbo", "Raspberry", "Rosa mosqueta"] },
      { cat: "Color", words: ["Rojo carmín", "Rojizo", "Rosa pastel", "Rubí"] },
    ],
  },
  {
    letter: "S", difficulty: "media", advice: "S es amplia pero tiene mucha competencia en nombres y animales básicos. Para frutas, 'Sandía' y 'Fresa' las pondrán todos. 'Salak' o 'Sapote' son respuestas raras que valen 10 puntos seguros.",
    tips: [
      { cat: "Nombre", words: ["Soledad", "Saturnino", "Sonsoles", "Serafín", "Silvestre"] },
      { cat: "Animal", words: ["Salamandra", "Suricata", "Sapo", "Serpiente coral", "Salmón"] },
      { cat: "País / Lugar", words: ["Surinam", "Seychelles", "Singapur", "Sofía", "Salzburgo"] },
      { cat: "Marca", words: ["Samsung", "Sony", "Seat", "Spotify", "Swatch"] },
      { cat: "Fruta", words: ["Salak", "Sapote", "Saúco", "Sandía", "Strawberry"] },
      { cat: "Color", words: ["Salmón", "Sepia", "Siena", "Sangre de toro"] },
    ],
  },
  {
    letter: "T", difficulty: "media", advice: "T tiene buenas opciones pero es difícil para frutas y colores. Para animales, en vez del típico 'Tigre' prueba 'Tapir' o 'Tuátara'. Para lugares, 'Tayikistán' o 'Tuvalu' son difíciles de repetir.",
    tips: [
      { cat: "Nombre", words: ["Teófilo", "Trinidad", "Tiburcio", "Teodora", "Torcuato"] },
      { cat: "Animal", words: ["Tapir", "Tuátara", "Turón", "Tarsero", "Tortuga laud"] },
      { cat: "País / Lugar", words: ["Tayikistán", "Tuvalu", "Teherán", "Tbilisi", "Tiflis"] },
      { cat: "Marca", words: ["Toyota", "Twitter", "TikTok", "Tous", "Telepizza"] },
      { cat: "Fruta", words: ["Tamarindo", "Tomate", "Tangelo", "Tamarillo"] },
      { cat: "Color", words: ["Terracota", "Teja", "Turquesa", "Tostado"] },
    ],
  },
  {
    letter: "V", difficulty: "media", advice: "V es difícil para frutas pero tiene opciones decentes en el resto. 'Venezuela' y 'Viena' son las respuestas de lugar más comunes — intenta con 'Vanuatu' o 'Vaduz'. Para animales, 'Vicuña' es muy valorada.",
    tips: [
      { cat: "Nombre", words: ["Valentina", "Vespasiano", "Verónica", "Victoriano", "Violeta"] },
      { cat: "Animal", words: ["Vicuña", "Visón", "Vulpeja", "Vaca marina", "Varano"] },
      { cat: "País / Lugar", words: ["Vanuatu", "Vaduz", "Vilna", "Varsovia", "Vladivostok"] },
      { cat: "Marca", words: ["Valentino", "Visa", "Volkswagen", "Vans", "Vodafone"] },
      { cat: "Fruta", words: ["Uva", "Vainilla"] },
      { cat: "Color", words: ["Violeta", "Verde botella", "Vino tinto", "Vermillón"] },
    ],
  },
  {
    letter: "Q", difficulty: "difícil", advice: "Q es una de las letras más difíciles. Recuerda que en español 'Q' siempre va seguida de 'U'. Las respuestas más seguras: para animales 'Quetzal', para lugares 'Qatar' o 'Quito', para nombres 'Quintín' o 'Queridamia'.",
    tips: [
      { cat: "Nombre", words: ["Quintín", "Quirino", "Quetzali", "Querubina"] },
      { cat: "Animal", words: ["Quetzal", "Quoll"] },
      { cat: "País / Lugar", words: ["Qatar", "Quito", "Queensland", "Quilmes"] },
      { cat: "Marca", words: ["Qatar Airways", "Quicksilver"] },
      { cat: "Fruta", words: ["Quivi (kiwi)", "Quequisque"] },
      { cat: "Color", words: ["Quemado", "Quermes"] },
    ],
  },
  {
    letter: "X", difficulty: "difícil", advice: "X es la letra más difícil del español. Muchos jugadores saben muy pocas palabras con X. Si la sacas, recuerda: 'Xilófono' (objeto), 'Xochimilco' (lugar en México), 'Xenón' (elemento/color técnico). En modo internacional, 'Xavier' es un nombre válido.",
    tips: [
      { cat: "Nombre", words: ["Xóchitl", "Xavier", "Ximena", "Xerxes"] },
      { cat: "Animal", words: ["Xenops", "Xantusia"] },
      { cat: "País / Lugar", words: ["Xochimilco", "Xi'an", "Xiamen"] },
      { cat: "Marca", words: ["Xbox", "Xiaomi", "Xerox"] },
      { cat: "Objeto", words: ["Xilófono"] },
      { cat: "Color", words: ["Xanadu (verde grisáceo)"] },
    ],
  },
  {
    letter: "Z", difficulty: "difícil", advice: "Z es difícil pero tiene más opciones que X. Para animales, 'Zorro', 'Zebra' y 'Zarigüeya' son las más conocidas. Para lugares, 'Zanzíbar' y 'Zúrich' son únicas y poco repetidas. Para frutas, 'Zapote' es la gran baza.",
    tips: [
      { cat: "Nombre", words: ["Zacarías", "Zoila", "Zenobia", "Zacarias", "Zulema"] },
      { cat: "Animal", words: ["Zarigüeya", "Zorro ártico", "Zebra", "Zorzal", "Zooplancton"] },
      { cat: "País / Lugar", words: ["Zanzíbar", "Zúrich", "Zambia", "Zimbabue", "Zaragoza"] },
      { cat: "Marca", words: ["Zara", "Zoom", "Zeppelin", "Zippo"] },
      { cat: "Fruta", words: ["Zapote", "Zarzamora", "Ziziphus"] },
      { cat: "Color", words: ["Zafiro", "Zanahoria"] },
    ],
  },
];

const DIFFICULTY_COLOR: Record<string, string> = {
  "fácil": "#22c55e",
  "media": "#f59e0b",
  "difícil": "#ef4444",
};

export default function Strategies() {
  const [selected, setSelected] = useState<string | null>(null);

  const current = LETTERS.find(l => l.letter === selected);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="flex items-center gap-4 mb-8">
          <img src={LOGO_URL} alt="STOP El Juego" className="w-14 h-14 rounded-full" />
          <div>
            <h1 className="text-3xl font-black text-[hsl(48,96%,57%)]">Estrategias y Trucos</h1>
            <p className="text-white/50 text-sm">Guía de palabras por letra para ganar en STOP</p>
          </div>
        </div>

        <section className="space-y-8 text-white/80 leading-relaxed mb-10">
          <div>
            <h2 className="text-2xl font-black text-white mb-3">¿Cómo mejorar en STOP?</h2>
            <p className="mb-3">
              Ganar en STOP no depende solo de tener buen vocabulario — también importa saber qué palabras <strong className="text-white">evitar</strong>. Las respuestas que todos ponen solo valen 5 puntos (respuesta repetida), mientras que una palabra poco común vale 10 (respuesta única). La diferencia entre ganar y perder muchas veces está en elegir palabras originales.
            </p>
            <p className="mb-3">
              En esta guía encontrarás las mejores palabras para cada categoría, organizadas por letra. También te indicamos qué letras son más difíciles y qué estrategia usar en cada caso.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Estrategias generales</h2>
            <div className="space-y-3">
              {[
                { icon: "🏃", tip: "Empieza siempre por tu categoría más fuerte", desc: "Si eres bueno con países, empieza ahí. Ganar tiempo en las categorías fáciles te permite pensar con más calma en las difíciles." },
                { icon: "🎯", tip: "Evita las respuestas obvias cuando puedas", desc: "Si todo el mundo va a poner 'Naranja' para fruta con N, tú pon 'Níspero' o 'Nance'. Las respuestas únicas doblan los puntos." },
                { icon: "📚", tip: "Aprende nombres de países poco conocidos", desc: "Los países exóticos casi nunca se repiten. Aprende 5 países raros por letra y tendrás una ventaja enorme en esa categoría." },
                { icon: "🧠", tip: "Usa nombres compuestos", desc: "En categorías de nombres propios, los nombres compuestos (María José, Juan Carlos) son menos comunes que los simples y suelen darte respuesta única." },
                { icon: "⏱️", tip: "Calcula cuándo gritar STOP", desc: "Gritar STOP con 5 categorías llenas da un bonus de +5 puntos. Pero si aún puedes completar 1-2 más, espera. No grites STOP si llevas menos de 4 categorías completas." },
                { icon: "🎭", tip: "Usa el bluff en categorías abiertas", desc: "El sistema 'Mentir es Válido' es más efectivo en categorías como Color o Animal, donde hay miles de respuestas posibles y los demás jugadores no pueden estar seguros de si mientes o no." },
              ].map(s => (
                <div key={s.tip} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <h3 className="font-bold text-white mb-1">{s.icon} {s.tip}</h3>
                  <p className="text-sm text-white/70">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Estrategias para letras difíciles</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)" }}>
                <h3 className="font-bold text-red-400 mb-2">🔴 Letras muy difíciles: Q, X, W, Y</h3>
                <p className="text-sm text-white/70 mb-2">Cuando te toca una letra difícil, el objetivo no es ganar — es sobrevivir. La mayoría de jugadores dejarán muchas categorías en blanco. Incluso una sola respuesta válida en estas letras puede marcar la diferencia.</p>
                <p className="text-sm text-white/70">Estrategia: memoriza 2-3 palabras por categoría para estas letras y úsalas siempre. Serán únicas porque nadie más las conoce.</p>
              </div>
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }}>
                <h3 className="font-bold text-amber-400 mb-2">🟡 Letras medias: H, J, K, Ñ</h3>
                <p className="text-sm text-white/70">Tienen palabras pero son menos abundantes. Prepara respuestas de reserva para estas letras y practica especialmente en categorías donde suelan ser más escasas (frutas con H, colores con J).</p>
              </div>
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)" }}>
                <h3 className="font-bold text-green-400 mb-2">🟢 Letras fáciles: A, C, E, M, P, S</h3>
                <p className="text-sm text-white/70">Aquí el reto es diferenciarse, no encontrar palabras. En estas letras, la victoria va para quien evita las respuestas más comunes y aporta algo original.</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Categorías especiales: consejos específicos</h2>
            <div className="space-y-3">
              {[
                { cat: "🌍 Países y Lugares", tip: "Aprende al menos 3 países raros por letra. Los más útiles: Djibouti (D), Eritrea (E), Fiyi (F), Gabón (G), Kiribati (K), Laos (L), Maldivas (M), Nauru (N), Omán (O), Papúa Nueva Guinea (P), Qatar (Q), Ruanda (R), Surinam (S), Tayikistán (T), Uganda (U), Vanuatu (V)." },
                { cat: "🐾 Animales", tip: "Los animales poco conocidos casi siempre son respuesta única. Aprende los menos comunes: Equidna, Axolotl, Numbat, Okapi, Quoll, Tapir, Tuátara, Dugongo, Narval, Manatí, Pangolín." },
                { cat: "🎨 Colores", tip: "Los colores con modificador (azul marino, verde botella, rojo carmín) cuentan como válidos en la mayoría de partidas y son más originales que los básicos. Aprovéchalo." },
                { cat: "🍎 Frutas", tip: "Las frutas exóticas son tu mejor baza: Rambután, Salak, Pitahaya, Tamarillo, Feijoa, Ilama, Lucuma, Maracuyá, Guanábana. Memoriza 2 o 3 por letra." },
                { cat: "🏷️ Marcas", tip: "Recuerda que las marcas pueden ser de cualquier sector: tecnología, moda, alimentación, automoción, aerolíneas, etc. Cuanto más específico sea el sector que elijas, menos repeticiones tendrás." },
              ].map(c => (
                <div key={c.cat} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <h3 className="font-bold text-[hsl(48,96%,57%)] mb-2">{c.cat}</h3>
                  <p className="text-sm text-white/70">{c.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mb-8">
          <h2 className="text-2xl font-black text-white mb-4">Guía letra por letra</h2>
          <p className="text-white/50 text-sm mb-5">Selecciona una letra para ver las mejores palabras por categoría y el consejo estratégico.</p>

          <div className="grid grid-cols-6 gap-2 mb-6">
            {LETTERS.map(l => (
              <button
                key={l.letter}
                onClick={() => setSelected(selected === l.letter ? null : l.letter)}
                className="py-3 rounded-xl font-black text-lg transition-all"
                style={selected === l.letter
                  ? { background: "hsl(6,90%,55%)", color: "white" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: `2px solid ${DIFFICULTY_COLOR[l.difficulty]}33` }}
              >
                {l.letter}
                <div className="text-[9px] font-normal mt-0.5" style={{ color: DIFFICULTY_COLOR[l.difficulty] }}>
                  {l.difficulty === "fácil" ? "●●●" : l.difficulty === "media" ? "●●○" : "●○○"}
                </div>
              </button>
            ))}
          </div>

          {current && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-5xl font-black text-[hsl(48,96%,57%)]">{current.letter}</span>
                  <span className="ml-3 text-xs font-bold px-2 py-1 rounded-full" style={{ background: `${DIFFICULTY_COLOR[current.difficulty]}22`, color: DIFFICULTY_COLOR[current.difficulty] }}>
                    Dificultad {current.difficulty}
                  </span>
                </div>
              </div>
              <div className="px-5 py-4 border-b border-white/10">
                <p className="text-sm text-white/70 leading-relaxed">{current.advice}</p>
              </div>
              <div className="p-5 space-y-4">
                {current.tips.map(tip => (
                  <div key={tip.cat}>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">{tip.cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {tip.words.map(w => (
                        <span key={w} className="px-3 py-1.5 rounded-xl text-sm font-bold bg-white/8 border border-white/10 text-white/80">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link href="/solo">
            <button className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg" style={{ background: "hsl(6,90%,55%)", color: "white" }}>
              ¡Practicar ahora!
            </button>
          </Link>
          <Link href="/como-jugar">
            <button className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg border-2 border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all">
              📖 Cómo jugar
            </button>
          </Link>
          <Link href="/">
            <button className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg border-2 border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all">
              ← Inicio
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
