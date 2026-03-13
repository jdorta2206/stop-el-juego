import { Router, type IRouter } from "express";
import { ValidateRoundBody, ValidateRoundResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Dictionaries ─────────────────────────────────────────────────────────────
// Keys must match (or be substrings of) the category names sent by the client.
// Each language key matches the category array in src/i18n/<lang>.ts

const DICTIONARY: Record<string, Record<string, string[]>> = {
  es: {
    nombre: ["ana","andrés","antonio","amanda","alberto","adriana","beatriz","benito","bárbara","bruno","belén","carlos","cecilia","césar","clara","cristina","david","dolores","diana","daniel","diego","elena","esteban","eva","eduardo","emma","fabián","fatima","fernando","felipe","florencia","gabriel","gloria","gonzalo","graciela","guillermo","hugo","helena","héctor","hilda","horacio","ignacio","irene","isabel","iván","inés","javier","jimena","juan","julia","jorge","karla","kevin","karina","kike","katia","luis","laura","lucía","leonardo","leticia","manuel","maría","marta","miguel","mónica","natalia","nicolás","noelia","nuria","norma","óscar","olivia","omar","olga","osvaldo","pablo","paula","pedro","patricia","pilar","roberto","raquel","rosa","ricardo","rita","santiago","sofía","susana","sergio","silvia","tomás","teresa","tatiana","teodoro","trinidad","ursula","unai","ulises","valentina","victor","vanesa","vicente","verónica","walter","wendy","wanda","wilson","ximena","yolanda","yasmin","yago","yanina","zoe","zacarías","zulema","zenón"],
    lugar: ["alemania","argentina","atenas","alicante","albacete","brasil","bogotá","barcelona","bilbao","berlín","canadá","china","copenhague","córdoba","caracas","dinamarca","dublín","ecuador","españa","estocolmo","edimburgo","egipto","francia","finlandia","florencia","fiyi","filipinas","grecia","guatemala","ginebra","granada","guadalajara","holanda","honduras","helsinki","hungría","hamburgo","italia","irlanda","islandia","indonesia","india","japón","jamaica","jerusalén","jaén","jordania","kenia","kuwait","kiev","kioto","kazajistán","libia","lisboa","londres","lima","luxemburgo","méxico","madrid","moscú","málaga","marrakech","noruega","nairobi","nueva york","nicosia","nepal","oslo","ottawa","omán","oporto","oxford","parís","perú","praga","panamá","palermo","qatar","quito","quebec","rumanía","roma","rusia","río de janeiro","rotterdam","suecia","suiza","santiago","sevilla","singapur","tokio","turquía","toronto","toledo","tailandia","uruguay","ucrania","utrecht","venecia","vietnam","varsovia","valencia","viena","washington","wellington","yemen","yakarta","zagreb","zimbabue","zaragoza","zurich"],
    animal: ["araña","águila","avispa","avestruz","alce","búho","ballena","buitre","bisonte","burro","caballo","canguro","cocodrilo","cucaracha","camello","delfín","dromedario","elefante","erizo","escorpión","estrella de mar","escarabajo","foca","flamenco","faisán","gato","gacela","gorila","gusano","gallina","halcón","hiena","hipopótamo","hormiga","hurón","iguana","impala","jabali","jirafa","jilguero","koala","krill","kiwi","león","loro","lobo","libélula","leopardo","mapache","mariposa","medusa","murciélago","mantis","nutria","ñu","ñandú","orangután","oso","orca","oveja","ostra","perro","pingüino","pantera","pato","perezoso","quetzal","quirquincho","rana","ratón","rinoceronte","reno","ruiseñor","serpiente","sapo","salamandra","salmón","saltamontes","tiburón","tigre","tortuga","topo","tucán","urraca","urogallo","vaca","vicuña","víbora","wallaby","wombat","yak","yegua","zorro","zopilote","cebra","ciervo"],
    objeto: ["anillo","aguja","arco","altavoz","armario","barco","botella","brújula","bombilla","bandeja","cámara","cuchillo","copa","cinturón","cuadro","dado","destornillador","diamante","disco","dron","escalera","escoba","espejo","estufa","espada","flauta","flecha","foco","florero","frasco","guitarra","gafas","globo","grapa","guante","hacha","hilo","horno","herradura","imán","impresora","imperdible","jarrón","jeringa","juguete","joya","jabón","lámpara","lápiz","libro","lupa","linterna","martillo","mesa","micrófono","moneda","mochila","nube","navaja","ordenador","olla","paraguas","pelota","piano","peine","plato","reloj","regla","rueda","radio","rastrillo","silla","sofá","sombrero","sartén","sello","teléfono","tijeras","tambor","taza","taladro","uniforme","usb","ukelele","violín","vela","ventana","vaso","ventilador","xilófono","yoyo","zapato","zapatilla"],
    color: ["azul","amarillo","añil","amatista","ámbar","blanco","beige","burdeos","bronce","cian","carmesí","castaño","caoba","crema","dorado","esmeralda","escarlata","fucsia","grana","gris","grafito","hueso","índigo","jade","kaki","lavanda","lila","marrón","magenta","marfil","malva","naranja","negro","nácar","ocre","oro","púrpura","plata","perla","pistacho","rojo","rosa","salmón","sepia","turquesa","terracota","trigo","ultramar","verde","violeta","vino","wengue","zafiro"],
    fruta: ["arándano","albaricoque","aceituna","ananá","avellana","banana","cereza","ciruela","coco","chirimoya","dátil","durazno","damasco","frambuesa","fresa","frutilla","granada","guayaba","grosella","higo","kiwi","kumquat","limón","lima","lichi","mandarina","manzana","melón","mango","maracuyá","mora","naranja","nectarina","níspero","nuez","papaya","pera","piña","plátano","pomelo","paraguaya","sandía","tamarindo","toronja","tuna","uva"],
    marca: ["adidas","audi","apple","amazon","ariel","bic","bosch","bayer","barbie","boeing","casio","chanel","cocacola","colgate","canon","dior","dell","disney","danone","durex","ebay","elle","fila","ford","ferrari","facebook","fedex","gucci","google","gillette","hp","honda","heineken","ibm","ikea","intel","instagram","jaguar","jeep","kodak","kia","kfc","lego","lg","lamborghini","microsoft","mercedes","motorola","marvel","nike","nintendo","nestlé","netflix","omega","oracle","pepsi","prada","puma","porsche","playstation","rolex","ray-ban","reebok","red bull","samsung","sony","sega","starbucks","toyota","tesla","tiktok","twitter","uber","volkswagen","versace","vodafone","walmart","wikipedia","whatsapp","xbox","xiaomi","yahoo","youtube","yamaha","zara","zoom","zalando"],
  },

  en: {
    name: ["alice","andrew","adam","amanda","ashley","bella","brandon","brian","brittany","charles","christopher","charlotte","chloe","diana","david","daniel","emily","emma","ethan","elizabeth","fiona","frank","grace","george","henry","hannah","isabella","ivan","jack","jessica","james","julia","kevin","karen","liam","laura","lucas","lily","michael","maria","matthew","mia","natalie","noah","olivia","oscar","patricia","peter","paul","paula","quinn","rachel","ryan","rebecca","sarah","samuel","sophia","scott","thomas","tyler","tiffany","ursula","victor","victoria","vanessa","walter","wendy","william","xavier","yolanda","zoe","zachary"],
    place: ["australia","austria","amsterdam","barcelona","berlin","belgium","brazil","canada","china","cuba","denmark","dubai","egypt","england","ethiopia","france","finland","greece","germany","ghana","hawaii","hungary","iceland","india","ireland","israel","italy","japan","jamaica","jordan","kenya","korea","london","lima","luxembourg","madrid","mexico","morocco","nigeria","norway","new york","nepal","oslo","oxford","paris","peru","prague","portugal","qatar","rome","russia","sweden","switzerland","singapore","toronto","tokyo","turkey","ukraine","uruguay","vienna","vietnam","warsaw","washington","yemen","zagreb","zimbabwe"],
    animal: ["ant","alligator","bear","bat","bird","cat","camel","cow","deer","dog","dolphin","duck","eagle","elephant","fish","fox","frog","gorilla","giraffe","hawk","hippo","horse","iguana","jaguar","kangaroo","koala","leopard","lion","lizard","monkey","mouse","octopus","orca","ostrich","owl","panda","parrot","penguin","rabbit","raccoon","shark","sheep","snake","tiger","turtle","vulture","wolf","yak","zebra"],
    object: ["anchor","arrow","axe","ball","book","bottle","brush","camera","candle","clock","compass","cup","drum","envelope","flute","globe","guitar","hammer","knife","lamp","mirror","pen","phone","piano","ring","scissors","shield","sword","table","umbrella","vase","violin","watch","wheel","xylophone","yoyo","zipper"],
    color: ["amber","azure","beige","black","blue","brown","coral","crimson","cyan","emerald","fuchsia","gold","gray","green","indigo","ivory","jade","khaki","lavender","lime","magenta","maroon","navy","olive","orange","peach","pink","purple","red","rose","ruby","salmon","silver","teal","turquoise","ultramarine","violet","white","yellow"],
    fruit: ["apple","apricot","avocado","banana","blueberry","cherry","coconut","cranberry","date","elderberry","fig","grape","guava","jackfruit","kiwi","lemon","lime","lychee","mango","melon","nectarine","olive","orange","papaya","peach","pear","pineapple","plum","pomegranate","quince","raspberry","strawberry","tangerine","ugli","watermelon"],
    brand: ["adidas","amazon","apple","audi","barbie","boeing","canon","chanel","cocacola","disney","ebay","facebook","ferrari","ford","google","gucci","honda","ikea","instagram","jaguar","kfc","lego","lg","microsoft","netflix","nike","nintendo","oracle","pepsi","prada","samsung","sony","starbucks","tesla","twitter","uber","volkswagen","walmart","whatsapp","xbox","yamaha","youtube","zara"],
  },

  pt: {
    nome: ["adriana","alberto","alexandre","alice","amanda","ana","antonio","beatriz","bernardo","bruna","caio","camila","carlos","carolina","clara","claudia","daniela","daniel","diego","eduarda","eduardo","fernanda","fernando","filipe","flavia","gabriel","giovanna","guilherme","gustavo","helena","hugo","ines","isabella","joao","jorge","jose","julia","juliana","karen","katia","larissa","laura","leandro","leticia","lucas","lucia","luiz","manuela","marcos","mariana","mario","mateus","monica","natalia","nicolas","nuno","olivia","oscar","patricia","paulo","pedro","rafaela","rafael","renata","ricardo","roberta","rodrigo","samuel","sandra","sergio","silvia","sofia","tiago","valentina","victor","vitoria","viviane","walter","yasmin","zara"],
    lugar: ["africa","alaska","alemanha","amazonia","angola","argentina","asia","australia","austria","bahia","barcelona","belgica","berlim","bolivia","brasilia","brasil","canada","chile","china","colombia","coreia","cuba","curitiba","dinamarca","dubai","egito","espanha","estonia","europa","finlandia","franca","genebra","grecia","holanda","hungria","india","indonesia","irlanda","italia","japao","jordania","kenya","lisboa","londres","luxemburgo","madri","mexico","mocambique","nigeria","nigeria","noruega","nova york","oslo","paris","peru","polonia","portugal","praga","roma","russia","salvador","sao paulo","singapura","suecia","suica","tailandia","toquio","turquia","ucrania","uruguai","viena","vietnam","washington","zagreb","zimbabue"],
    animal: ["abelha","aguia","alce","aranha","arara","baleia","borboleta","boi","burro","cabra","cachorro","camelo","capivara","cavalo","cervo","cobra","coelho","coruja","crocodilo","cutia","dromedario","elefante","ema","esquilo","falcao","formiga","frango","gato","gaviao","girafa","gorila","golfinho","hipopotamo","hiena","iguana","jabuti","jaguar","lagarto","lagarta","leao","leopardo","lobo","morcego","mosquito","mula","onca","orangotango","ostrica","ourico","papagaio","pato","peixe","pinguim","pombo","porco","puma","quati","rato","rinoceronte","sapo","serpente","tartaruga","tigre","tucano","tubarao","urubu","vaca","veado","zebra","zorrilho"],
    objeto: ["agulha","anel","arco","balde","bicicleta","bolsa","borracha","cadeira","caixao","camera","caneta","carro","celular","chave","colher","computador","copo","corda","dado","escada","espelho","faca","flauta","fogao","forno","frasco","garrafa","guitarra","guarda-chuva","lampada","lapis","livro","martelo","mesa","mochila","moeda","navalha","oclulos","panela","piano","prato","radio","relogio","roda","saco","sela","sofá","teclado","telefone","tesoura","violao","xilofone","zapato"],
    cor: ["amarelo","azul","bege","branco","bronze","caramelo","ciano","cinza","coral","creme","dourado","esmeralda","fucsia","grafite","indigo","jade","laranja","lavanda","lilas","magenta","marfim","marrom","mostarda","nude","ocre","ouro","prata","preto","rosa","roxo","salmon","turquesa","verde","vermelho","violeta","vinho","xadrez"],
    fruta: ["abacate","abacaxi","abiu","acerola","ameixa","amora","araça","banana","cajá","caju","carambola","cereja","coco","cupuacu","damasco","figo","framboesa","goiaba","graviola","jabuticaba","jaca","laranja","limao","lichia","manga","maracuja","maçã","melancia","melão","morango","nectarina","nespera","papaia","pera","pessego","pitanga","pitaya","romã","sapoti","tâmara","uva"],
    marca: ["adidas","amazon","apple","audi","bosch","brahma","casio","chanel","cocacola","colgate","dell","disney","ebay","facebook","ferrari","ford","google","gucci","havaianas","honda","ikea","instagram","jaguar","kfc","lego","lg","loreal","microsoft","netflix","nike","nintendo","oracle","pepsi","petrobras","prada","samsung","sony","starbucks","tesla","twitter","uber","volkswagen","walmart","whatsapp","xbox","yamaha","youtube","zara"],
  },

  fr: {
    prénom: ["adèle","adrien","alice","alexis","amelie","antoine","arthur","axel","baptiste","camille","charlotte","chloé","clement","coralie","diane","dylan","elise","emma","ethan","eva","fabien","floriane","gabriel","gaelle","guillaume","hugo","ines","isabelle","jade","julien","julie","kevin","laetitia","laura","leo","lucas","lucie","louis","manon","margot","marine","mathieu","mathis","maxime","melissa","noemie","nicolas","oceane","olivia","paul","pauline","pierre","quentin","rachel","remi","robin","romane","samuel","sarah","simon","sophie","thomas","thibault","theo","valentin","valentine","victor","victoria","vincent","yannick","yasmine","zoe"],
    lieu: ["afrique","algerie","allemagne","amsterdam","angleterre","australie","autriche","barcelone","belgique","berlin","bordeaux","bretagne","bruxelles","canada","chine","colombie","copenhagen","corse","danemark","dubai","ecosse","egypte","espagne","etats-unis","europe","finlande","florence","france","geneve","grece","grenade","hambourg","hollande","hongrie","inde","indonesie","irlande","islande","italie","japon","jordanie","kenya","lisbonne","londres","luxembourg","lyon","madrid","maroc","marseille","mexique","milan","monaco","montreal","moscou","nantes","nice","nigeria","norvege","oslo","paris","perou","pologne","portugal","prague","rome","russie","seville","singapour","stockholm","suede","suisse","syrie","tokyo","toulouse","turquie","ukraine","venise","vienne","vietnam","washington","zurich"],
    animal: ["aigle","alouette","âne","araignee","baleine","bison","blaireau","boeuf","buffle","canard","cerf","chameau","chat","cheval","chien","cigogne","cobra","coq","corbeau","crocodile","dauphin","ecureuil","elephant","elan","faucon","flamant","fourmilion","girafe","gorille","grenouille","hamster","herisson","hibou","hippopotame","hyene","jaguar","kangourou","koala","lapin","leopard","lion","loup","meduse","mouton","ours","panda","panther","paon","perroquet","pieuvre","pigeon","pingouin","porc","puma","renard","requin","rhinoceros","sanglier","serpent","singe","tigre","tortue","toucan","vache","vautour","zebre"],
    objet: ["aiguille","anneau","arbre","assiette","balai","ballon","bicyclette","bougie","bouteille","boussole","camera","canif","ceinture","chaise","clé","coffre","couteau","crayon","cruche","drapeau","echarpe","echelle","epee","escalier","flute","frasco","globe","guitare","hache","horloge","lampe","livre","loupe","marteau","miroir","montre","parapluie","piano","pince","pistolet","plume","radio","rideau","sac","seau","serrure","table","telephone","toboggan","vase","violon","xylophone","yoyo"],
    couleur: ["abricot","ambre","ardoise","argent","azur","beige","bistre","blanc","bleu","bordeaux","brun","carmin","celadon","cerise","citron","corail","cramoisi","cyan","doré","ecarlate","emeraude","framboise","fuchsia","gris","indigo","jade","jaune","lavande","lilas","magenta","marron","mauve","nacre","navy","noir","ocre","olive","orange","or","perle","pivoine","prune","rose","rouge","rouille","sable","saumon","turquoise","vert","violet","zinzolin"],
    fruit: ["abricot","ananas","avocat","banane","cassis","cerise","citron","clémentine","coco","datte","figue","fraise","framboise","groseille","grenade","kiwi","kumquat","lime","litchi","mangue","melon","mirabelle","mure","myrtille","nectarine","noisette","olive","orange","papaye","pastèque","peche","poire","pomme","prune","raisin","tamarin","yuzu"],
    marque: ["adidas","amazon","apple","audi","bic","boeing","canon","carrefour","chanel","citroën","cocacola","dassault","dior","disney","ebay","facebook","ferrari","ford","google","gucci","hermes","honda","ikea","instagram","jaguar","kfc","lacoste","lego","lg","loreal","lvmh","michelin","microsoft","netflix","nike","nintendo","oracle","pepsi","peugeot","prada","renault","samsung","sony","starbucks","tesla","twitter","uber","volkswagen","walmart","whatsapp","xbox","yamaha","youtube","zara"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeWord(word: string): string {
  return word.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

function findCategoryWords(langDict: Record<string, string[]>, category: string): string[] {
  const norm = normalizeWord(category);
  for (const [key, words] of Object.entries(langDict)) {
    const normKey = normalizeWord(key);
    if (norm === normKey || norm.startsWith(normKey) || normKey.startsWith(norm)) {
      return words;
    }
  }
  return [];
}

function isWordValid(word: string, letter: string, category: string, language = "es"): boolean {
  if (!word || word.trim().length === 0) return false;

  const normalizedWord = normalizeWord(word);
  const normalizedLetter = normalizeWord(letter);

  if (!normalizedWord.startsWith(normalizedLetter)) return false;
  if (normalizedWord.length < 2) return false;

  const langDict = DICTIONARY[language] || DICTIONARY["es"];
  const categoryWords = findCategoryWords(langDict, category);

  if (categoryWords.length === 0) {
    // No dictionary for this category — accept any word with the correct letter
    return true;
  }

  // Accept if any dictionary word starts with what the player typed (min 3 chars prefix)
  const prefix = normalizedWord.substring(0, Math.max(3, normalizedWord.length));
  return categoryWords.some(w => {
    const nw = normalizeWord(w);
    return nw === normalizedWord || nw.startsWith(prefix) || normalizedWord.startsWith(nw.substring(0, Math.min(nw.length, 4)));
  });
}

function getAiWord(letter: string, category: string, language = "es"): string {
  const langDict = DICTIONARY[language] || DICTIONARY["es"];
  const categoryWords = findCategoryWords(langDict, category);
  const normalizedLetter = normalizeWord(letter);

  const matches = categoryWords.filter(w => normalizeWord(w).startsWith(normalizedLetter));
  if (matches.length === 0) return "";

  return matches[Math.floor(Math.random() * Math.min(matches.length, 5))];
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/validate", (req, res) => {
  const body = ValidateRoundBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { letter, language, playerResponses } = body.data;
  const results: Record<string, {
    player: { response: string; isValid: boolean; score: number };
    ai: { response: string; isValid: boolean; score: number };
  }> = {};
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
