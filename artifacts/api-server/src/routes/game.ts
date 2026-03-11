import { Router, type IRouter } from "express";
import { ValidateRoundBody, ValidateRoundResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const ALPHABET_VOWELS = new Set(["A", "E", "I", "O", "U"]);

// Comprehensive Spanish dictionary for AI and validation
const DICTIONARY: Record<string, Record<string, string[]>> = {
  es: {
    nombre: ["ana","andrés","antonio","amanda","alberto","adriana","beatriz","benito","bárbara","bruno","belén","carlos","cecilia","césar","clara","cristina","david","dolores","diana","daniel","diego","elena","esteban","eva","eduardo","emma","fabián","fatima","fernando","felipe","florencia","gabriel","gloria","gonzalo","graciela","guillermo","hugo","helena","héctor","hilda","horacio","ignacio","irene","isabel","iván","inés","javier","jimena","juan","julia","jorge","karla","kevin","karina","kike","katia","luis","laura","lucía","leonardo","leticia","manuel","maría","marta","miguel","mónica","natalia","nicolás","noelia","nuria","norma","óscar","olivia","omar","olga","osvaldo","pablo","paula","pedro","patricia","pilar","roberto","raquel","rosa","ricardo","rita","santiago","sofía","susana","sergio","silvia","tomás","teresa","tatiana","teodoro","trinidad","ursula","unai","ulises","valentina","victor","vanesa","vicente","verónica","walter","wendy","wanda","wilson","wilfredo","xavier","ximena","yolanda","yasmin","yago","yanina","zoe","zacarías","zulema","zenón"],
    lugar: ["alemania","argentina","atenas","alicante","albacete","brasil","bogotá","barcelona","bilbao","berlín","canadá","china","copenhague","córdoba","caracas","dinamarca","dublín","ecuador","españa","estocolmo","edimburgo","egipto","francia","finlandia","florencia","fiyi","filipinas","grecia","guatemala","ginebra","granada","guadalajara","holanda","honduras","helsinki","hungría","hamburgo","italia","irlanda","islandia","indonesia","india","japón","jamaica","jerusalén","jaén","jordania","kenia","kuwait","kiev","kioto","kazajistán","libia","lisboa","londres","lima","luxemburgo","méxico","madrid","moscú","málaga","marrakech","noruega","nairobi","nueva york","nicosia","nepal","oslo","ottawa","omán","oporto","oxford","parís","perú","praga","panamá","palermo","qatar","quito","quebec","rumanía","roma","rusia","río de janeiro","rotterdam","suecia","suiza","santiago","sevilla","singapur","tokio","turquía","toronto","toledo","tailandia","uruguay","ucrania","utrecht","venecia","vietnam","varsovia","valencia","viena","washington","wellington","xalapa","yemen","yakarta","zagreb","zimbabue","zaragoza","zurich"],
    animal: ["araña","águila","avispa","avestruz","alce","búho","ballena","buitre","bisonte","burro","caballo","canguro","cocodrilo","cucaracha","camello","delfín","dromedario","elefante","erizo","escorpión","estrella de mar","escarabajo","foca","flamenco","faisán","gato","gacela","gorila","gusano","gallina","halcón","hiena","hipopótamo","hormiga","hurón","iguana","impala","jabali","jirafa","jilguero","koala","krill","kiwi","león","loro","lobo","libélula","leopardo","mapache","mariposa","medusa","murciélago","mantis","nutria","ñu","ñandú","orangután","oso","orca","oveja","ostra","perro","pingüino","pantera","pato","perezoso","quetzal","quirquincho","rana","ratón","rinoceronte","reno","ruiseñor","serpiente","sapo","salamandra","salmón","saltamontes","tiburón","tigre","tortuga","topo","tucán","urraca","urogallo","vaca","vicuña","víbora","wallaby","wombat","xoloitzcuintle","yak","yegua","zorro","zopilote","cebra","ciervo"],
    objeto: ["anillo","aguja","arco","altavoz","armario","barco","botella","brújula","bombilla","bandeja","cámara","cuchillo","copa","cinturón","cuadro","dado","destornillador","diamante","disco","dron","escalera","escoba","espejo","estufa","espada","flauta","flecha","foco","florero","frasco","guitarra","gafas","globo","grapa","guante","hacha","hilo","horno","herradura","imán","impresora","imperdible","jarrón","jeringa","juguete","joya","jabón","lámpara","lápiz","libro","lupa","linterna","martillo","mesa","micrófono","moneda","mochila","nube","navaja","ordenador","olla","paraguas","pelota","piano","peine","plato","reloj","regla","rueda","radio","rastrillo","silla","sofá","sombrero","sartén","sello","teléfono","tijeras","tambor","taza","taladro","uniforme","usb","ukelele","violín","vela","ventana","vaso","ventilador","xilófono","yoyo","zapato","zapatilla"],
    color: ["azul","amarillo","añil","amatista","ámbar","blanco","beige","burdeos","bronce","cian","carmesí","castaño","caoba","crema","dorado","esmeralda","escarlata","fucsia","grana","gris","grafito","hueso","índigo","jade","kaki","lavanda","lila","marrón","magenta","marfil","malva","naranja","negro","nácar","ocre","oro","púrpura","plata","perla","pistacho","rojo","rosa","salmón","sepia","turquesa","terracota","trigo","ultramar","verde","violeta","vino","wengue","xantico","zafiro"],
    fruta: ["arándano","albaricoque","aceituna","ananá","avellana","banana","cereza","ciruela","coco","chirimoya","dátil","durazno","damasco","frambuesa","fresa","frutilla","granada","guayaba","grosella","higo","kiwi","kumquat","limón","lima","lichi","mandarina","manzana","melón","mango","maracuyá","mora","naranja","nectarina","níspero","nuez","papaya","pera","piña","plátano","pomelo","paraguaya","sandía","tamarindo","toronja","tuna","uva"],
    marca: ["adidas","audi","apple","amazon","ariel","bic","bosch","bayer","barbie","boeing","casio","chanel","cocacola","colgate","canon","dior","dell","disney","danone","durex","ebay","elle","fila","ford","ferrari","facebook","fedex","gucci","google","gillette","hp","honda","heineken","ibm","ikea","intel","instagram","jaguar","jeep","kodak","kia","kfc","lego","lg","lamborghini","microsoft","mercedes","motorola","marvel","nike","nintendo","nestlé","netflix","omega","oracle","pepsi","prada","puma","porsche","playstation","rolex","ray-ban","reebok","red bull","samsung","sony","sega","starbucks","toyota","tesla","tiktok","twitter","uber","volkswagen","versace","vodafone","walmart","wikipedia","whatsapp","xbox","xiaomi","yahoo","youtube","yamaha","zara","zoom","zalando"],
  },
  en: {
    nombre: ["alice","andrew","adam","amanda","ashley","bella","brandon","brian","brittany","charles","christopher","charlotte","chloe","diana","david","daniel","emily","emma","ethan","elizabeth","fiona","frank","grace","george","henry","hannah","isabella","ivan","jack","jessica","james","julia","kevin","karen","liam","laura","lucas","lily","michael","maria","matthew","mia","natalie","noah","olivia","oscar","patricia","peter","paul","paula","quinn","rachel","ryan","rebecca","sarah","samuel","sophia","scott","thomas","tyler","tiffany","ursula","victor","victoria","vanessa","walter","wendy","william","xavier","yolanda","zoe","zachary"],
    lugar: ["australia","austria","amsterdam","barcelona","berlin","belgium","brazil","canada","china","cuba","denmark","dubai","egypt","england","ethiopia","france","finland","greece","germany","ghana","hawaii","hungary","iceland","india","ireland","israel","italy","japan","jamaica","jordan","kenya","korea","london","lima","luxembourg","madrid","mexico","morocco","nigeria","norway","new york","nepal","oslo","oxford","paris","peru","prague","portugal","qatar","rome","russia","sweden","switzerland","singapore","toronto","tokyo","turkey","ukraine","uruguay","vienna","vietnam","warsaw","washington","yemen","zagreb","zimbabwe"],
    animal: ["ant","alligator","bear","bat","bird","cat","camel","cow","deer","dog","dolphin","duck","eagle","elephant","fish","fox","frog","gorilla","giraffe","hawk","hippo","horse","iguana","jaguar","kangaroo","koala","leopard","lion","lizard","monkey","mouse","octopus","orca","ostrich","owl","panda","parrot","penguin","rabbit","raccoon","shark","sheep","snake","tiger","turtle","vulture","wolf","yak","zebra"],
    objeto: ["anchor","arrow","axe","ball","book","bottle","brush","camera","candle","clock","compass","cup","drum","envelope","flute","globe","guitar","hammer","knife","lamp","mirror","pen","phone","piano","ring","scissors","shield","sword","table","umbrella","vase","violin","watch","wheel","xylophone","yoyo","zipper"],
    color: ["amber","azure","beige","black","blue","brown","coral","crimson","cyan","emerald","fuchsia","gold","gray","green","indigo","ivory","jade","khaki","lavender","lime","magenta","maroon","navy","olive","orange","peach","pink","purple","red","rose","ruby","salmon","silver","teal","turquoise","ultramarine","violet","white","yellow"],
    fruta: ["apple","apricot","avocado","banana","blueberry","cherry","coconut","cranberry","date","elderberry","fig","grape","guava","jackfruit","kiwi","lemon","lime","lychee","mango","melon","nectarine","olive","orange","papaya","peach","pear","pineapple","plum","pomegranate","quince","raspberry","strawberry","tangerine","ugli","watermelon"],
    marca: ["adidas","amazon","apple","audi","barbie","boeing","canon","chanel","cocacola","disney","ebay","facebook","ferrari","ford","google","gucci","honda","ikea","instagram","jaguar","kfc","lego","lg","microsoft","netflix","nike","nintendo","oracle","pepsi","prada","samsung","sony","starbucks","tesla","twitter","uber","volkswagen","walmart","whatsapp","xbox","yamaha","youtube","zara"],
  },
};

// Normalize word for comparison
function normalizeWord(word: string): string {
  return word.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Check if word is valid for a given letter and category
function isWordValid(word: string, letter: string, category: string, language: string = "es"): boolean {
  if (!word || word.trim().length === 0) return false;
  
  const normalizedWord = normalizeWord(word);
  const normalizedLetter = normalizeWord(letter);
  
  if (!normalizedWord.startsWith(normalizedLetter)) return false;
  if (normalizedWord.length < 2) return false;

  const langDict = DICTIONARY[language] || DICTIONARY.es;
  const categoryKey = category.toLowerCase();
  
  // Find matching category
  let categoryWords: string[] = [];
  for (const [key, words] of Object.entries(langDict)) {
    if (categoryKey.includes(key) || key.includes(categoryKey)) {
      categoryWords = words;
      break;
    }
  }
  
  if (categoryWords.length === 0) {
    // If no dictionary for this category, accept any word starting with the letter
    return normalizedWord.startsWith(normalizedLetter) && normalizedWord.length >= 2;
  }

  return categoryWords.some(w => normalizeWord(w).startsWith(normalizedLetter) && 
    (normalizeWord(w) === normalizedWord || normalizeWord(w).startsWith(normalizedWord.substring(0, Math.min(normalizedWord.length, 4)))));
}

// Get AI word for a category
function getAiWord(letter: string, category: string, language: string = "es"): string {
  const langDict = DICTIONARY[language] || DICTIONARY.es;
  const categoryKey = category.toLowerCase();
  const normalizedLetter = normalizeWord(letter);
  
  let categoryWords: string[] = [];
  for (const [key, words] of Object.entries(langDict)) {
    if (categoryKey.includes(key) || key.includes(categoryKey)) {
      categoryWords = words;
      break;
    }
  }

  const matches = categoryWords.filter(w => normalizeWord(w).startsWith(normalizedLetter));
  if (matches.length === 0) return "";
  
  return matches[Math.floor(Math.random() * Math.min(matches.length, 5))];
}

router.post("/validate", (req, res) => {
  const body = ValidateRoundBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { letter, language, playerResponses } = body.data;
  const results: Record<string, { player: { response: string; isValid: boolean; score: number }; ai: { response: string; isValid: boolean; score: number } }> = {};
  let playerTotalScore = 0;
  let aiTotalScore = 0;

  for (const pr of playerResponses) {
    const playerWord = pr.word?.trim() || "";
    const aiWord = getAiWord(letter, pr.category, language);
    
    const isPlayerWordValid = isWordValid(playerWord, letter, pr.category, language);
    const isAiWordValid = aiWord.length > 0 && isWordValid(aiWord, letter, pr.category, language);

    let playerScore = 0;
    let aiScore = 0;

    if (isPlayerWordValid && isAiWordValid) {
      const normPlayer = normalizeWord(playerWord);
      const normAi = normalizeWord(aiWord);
      if (normPlayer === normAi) {
        playerScore = 5;
        aiScore = 5;
      } else {
        playerScore = 10;
        aiScore = 10;
      }
    } else if (isPlayerWordValid) {
      playerScore = 10;
      aiScore = 0;
    } else if (isAiWordValid) {
      playerScore = 0;
      aiScore = 10;
    }

    const formattedAiWord = aiWord ? aiWord.charAt(0).toUpperCase() + aiWord.slice(1) : "";
    results[pr.category] = {
      player: { response: playerWord, isValid: isPlayerWordValid, score: playerScore },
      ai: { response: formattedAiWord, isValid: isAiWordValid, score: aiScore },
    };

    playerTotalScore += playerScore;
    aiTotalScore += aiScore;
  }

  const response = ValidateRoundResponse.parse({
    results,
    playerTotalScore,
    aiTotalScore,
  });

  res.json(response);
});

export default router;
