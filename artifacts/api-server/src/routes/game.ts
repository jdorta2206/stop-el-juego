import { Router, type IRouter } from "express";
import { ValidateRoundBody, ValidateRoundResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Dictionaries ─────────────────────────────────────────────────────────────
// Used ONLY for AI answer generation AND for finite categories (animal, color, fruta).
// Nombre/Lugar/Objeto/Marca are open — infinite valid answers exist.

const DICTIONARY: Record<string, Record<string, string[]>> = {
  es: {
    // ── Animales (exhaustivo) ────────────────────────────────────────────────
    animal: [
      "abeja","abejorro","águila","aguilucho","ajolote","alacrán","albatros","alce","alpaca","ameba",
      "anaconda","anguila","antílope","araña","ardilla","armadillo","asno","atún","avestruz","avispón",
      "avispa","axolote","babosa","babuino","ballena","becada","bisonte","boa","búfalo","buey",
      "búho","buitre","burro","caballo","cabra","caimán","camaleón","camello","canario","cangrejo",
      "canguro","capibara","capivara","caracol","caribú","castor","cebra","ciervo","cigüeña","cisne",
      "cobra","cocodrilo","codorniz","colibrí","comadreja","conejo","cormorán","cóndor","coral",
      "coyote","cucaracha","cuervo","delfín","dromedario","elefante","erizo","escorpión",
      "esturión","faisán","flamenco","foca","gacela","gallina","gallo","gamuza",
      "ganso","gaviota","gecko","gibón","glotón","gorila","gorrión","grillo","grulla","guacamayo",
      "guepardo","halcón","hamster","hiena","hipopótamo","hormiga","hurón","iguana","impala","jabalí",
      "jaguar","jirafa","jilguero","koala","langosta","lechuza","lemur","leopardo","liebre","lince",
      "llama","lobo","loro","luciérnaga","manatí","mariposa","marmota","medusa","milano","mono",
      "morsa","mosquito","murciélago","musaraña","mula","nutria","ñandú","ñu","orangután","orca",
      "oruga","oso","ostra","oveja","pájaro","paloma","panda","pantera","pato","pavo","pavorreal",
      "pelícano","perro","pez","pez espada","pez globo","pez payaso","pingüino","piraña","pitón",
      "polilla","puerco","puercoespín","pulga","pulpo","puma","quetzal","quirquincho",
      "rana","ratón","raya","reno","rinoceronte","ruiseñor","salamandra",
      "salmón","saltamontes","sapo","sardina","serpiente","suricata","tapir","tejón","tiburón","tigre",
      "topo","toro","tortuga","trucha","tucán","urraca","urogallo","vaca","venado","vicuña","víbora","visón",
      "cerdo","wallaby","wombat","yak","yacaré","yarará","yegua","zamuro","zancudo","zebra","zorillo","zorro","zorzal"
    ],

    // ── Colores (exhaustivo) ─────────────────────────────────────────────────
    color: [
      "amarillo","amarillento","ámbar","añil","anaranjado","azafrán","azul","azulado","azul marino",
      "azul celeste","azul cobalto","azul eléctrico","azul pizarra","azul rey","azul turquesa",
      "beige","bermejo","blanco","borgoña","bronce","burdeos","café","canela","caoba","carmesí",
      "castaño","celeste","cereza","cian","cobre","coral","crema","champán","chocolate","ciruela",
      "chartreuse","caqui","dorado","ebano","ébano","escarlata","esmeralda","frambuesa","fucsia",
      "grana","granate","grafito","gris","gris perla","gris plata","guinda","herrumbre","hueso",
      "índigo","jade","kaki","lavanda","ladrillo","lila","lima","lino","magenta","malva","mandarina",
      "marrón","marfil","melocotón","menta","mostaza","morado","nácar","naranja","negro","ocre",
      "oliva","oro","perla","plata","plateado","púrpura","rosa","rosado","rojo","rubí","rubiáceo",
      "salmón","sepia","siena","taupe","teja","terracota","tierra","tomate","topacio","turquesa",
      "ultramar","uva","verde","verdoso","verde lima","verde oliva","verde esmeralda","verde menta",
      "verde pino","verde botella","verde militar","violeta","violáceo","vino","wengue","zafiro"
    ],

    // ── Frutas (exhaustivo) ──────────────────────────────────────────────────
    fruta: [
      "aceituna","acerola","aguacate","albaricoque","ananá","anona","arándano","araçá","bacuri",
      "banana","boysenberry","cacao","caimito","caju","caqui","carambola","castaña","cereza",
      "chirimoya","ciruela","cítrico","coco","corozo","cupuazú","dátil","damasco","durazno",
      "frambuesa","fresa","frutilla","fruta de la pasión","granada","granadilla","grosella","guanábana",
      "guayaba","higo","jackfruit","jaca","jocote","kiwi","kumquat","lichi","lima","limón",
      "lúcuma","mamey","mandarina","mango","mangostán","maracuyá","marañón","melón","membrillo",
      "mirtilo","mora","naranja","nectarina","níspero","nuez","oliva","papaya","paraguaya","pera",
      "piña","pitahaya","pitaya","plátano","pomelo","rambután","sandía","sapote","tamarindo",
      "tuna","toronja","uva","uva pasa","uvilla","yuzu","zapote","zarzamora","acerola","aguaje",
      "arazá","badea","biribá","borojó","camu camu","chontaduro","chupa chupa","copoazú","curuba",
      "feijoa","granadilla","guama","lulo","marañón","nance","noni","pepino dulce","pomarrosa",
      "rambután","salak","sirsak","tomate de árbol","tumbo","uchuva"
    ],

    // ── Nombres (ABIERTO — diccionario solo para IA) ─────────────────────────
    nombre: [
      "ana","andrés","antonio","amanda","alberto","adriana","beatriz","benito","bárbara","bruno",
      "belén","carlos","cecilia","césar","clara","cristina","david","dolores","diana","daniel",
      "diego","elena","esteban","eva","eduardo","emma","fabián","fatima","fernando","felipe",
      "florencia","gabriel","gloria","gonzalo","graciela","guillermo","gerardo","guadalupe","gisela",
      "hugo","helena","héctor","hilda","horacio","ignacio","irene","isabel","iván","inés",
      "javier","jimena","juan","julia","jorge","karla","kevin","karina","kike","katia",
      "luis","laura","lucía","leonardo","leticia","manuel","maría","marta","miguel","mónica",
      "natalia","nicolás","noelia","nuria","norma","óscar","olivia","omar","olga","osvaldo",
      "pablo","paula","pedro","patricia","pilar","roberto","raquel","rosa","ricardo","rita",
      "santiago","sofía","susana","sergio","silvia","tomás","teresa","tatiana","trinidad","ulises",
      "valentina","victor","vanesa","vicente","verónica","walter","wendy","wanda","ximena",
      "yolanda","yasmin","yago","yanina","zoe","zacarías","zulema","zenón","renata","rodrigo"
    ],

    // ── Lugares (ABIERTO — diccionario solo para IA) ─────────────────────────
    lugar: [
      "alemania","argentina","atenas","alicante","albacete","brasil","bogotá","barcelona","bilbao",
      "berlín","canadá","china","copenhague","córdoba","caracas","dinamarca","dublín","ecuador",
      "españa","estocolmo","edimburgo","egipto","francia","finlandia","florencia","fiyi","filipinas",
      "grecia","guatemala","ginebra","granada","guadalajara","holanda","honduras","helsinki",
      "hungría","hamburgo","italia","irlanda","islandia","indonesia","india","japón","jamaica",
      "jerusalén","jaén","jordania","kenia","kuwait","kiev","kioto","kazajistán","libia","lisboa",
      "londres","lima","luxemburgo","méxico","madrid","moscú","málaga","marrakech","noruega",
      "nairobi","nueva york","nepal","oslo","ottawa","omán","oporto","oxford","parís","perú",
      "praga","panamá","palermo","qatar","quito","rumanía","roma","rusia","río de janeiro",
      "suecia","suiza","santiago","sevilla","singapur","tokio","turquía","toronto","toledo",
      "tailandia","uruguay","ucrania","venecia","vietnam","varsovia","valencia","viena","washington",
      "wellington","yakarta","zagreb","zimbabue","zaragoza","zurich"
    ],

    // ── Objetos (ABIERTO — diccionario solo para IA) ─────────────────────────
    objeto: [
      "anillo","aguja","arco","altavoz","armario","barco","botella","brújula","bombilla","bandeja",
      "cámara","cuchillo","copa","cinturón","cuadro","dado","destornillador","diamante","disco",
      "escalera","escoba","espejo","estufa","espada","flauta","flecha","foco","florero","frasco",
      "guitarra","gafas","globo","guante","hacha","hilo","horno","herradura","imán","impresora",
      "jarrón","jeringa","juguete","joya","jabón","lámpara","lápiz","libro","lupa","linterna",
      "martillo","mesa","micrófono","moneda","mochila","navaja","ordenador","olla","paraguas",
      "pelota","piano","peine","plato","reloj","regla","rueda","radio","rastrillo","silla",
      "sofá","sombrero","sartén","sello","teléfono","tijeras","tambor","taza","taladro",
      "violín","vela","ventana","vaso","ventilador","xilófono","yoyo","zapato","zapatilla"
    ],

    // ── Marcas (ABIERTO — diccionario solo para IA) ──────────────────────────
    marca: [
      "adidas","audi","apple","amazon","ariel","bic","bosch","bayer","barbie","boeing","casio",
      "chanel","cocacola","colgate","canon","dior","dell","disney","danone","durex","ebay",
      "fila","ford","ferrari","facebook","fedex","gucci","google","gillette","hp","honda",
      "heineken","ibm","ikea","intel","jaguar","jeep","kodak","kia","kfc","lego","lg",
      "lamborghini","microsoft","mercedes","motorola","marvel","nike","nintendo","nestlé","netflix",
      "omega","oracle","pepsi","prada","puma","porsche","playstation","rolex","ray-ban","reebok",
      "red bull","samsung","sony","sega","starbucks","toyota","tesla","tiktok","twitter","uber",
      "volkswagen","versace","vodafone","walmart","wikipedia","whatsapp","xbox","xiaomi","yahoo",
      "youtube","yamaha","zara","zoom","zalando"
    ],
    // ── Categorías de modo caos (validación semántica básica) ────────────────
    // Prefijo clave: funciona con startsWith → coincide con frases completas del modo caos.
    "excusa": [
      "accidente","alergia","artritis","asma","atasco","avería","ansiedad","abuela","abuelo",
      "batería","bronquitis","bloqueo","brazo","bebé",
      "caída","catarro","cita","congestión","cansancio","cirugía","cortocircuito","crisis",
      "diarrea","dolor","dentista","depresión","desvío",
      "emergencia","enfermedad","estrés",
      "fiebre","fractura","funeral","fatiga","fuga",
      "gastritis","gripe",
      "herida","hipertensión","huelga","hipoglucemia","hospital","humo",
      "infección","insomnio","intoxicación","incendio","inundación",
      "jaqueca",
      "laringitis","lesión","lluvia","lumbalgia","luto","llave","llanta",
      "migraña","médico","muerte","mascota","manifestación","malestar",
      "náusea","nevada","neumático","nervios","niño",
      "operación","obras","otitis",
      "parálisis","pinchazo","pánico","pérdida","problema",
      "quebranto","quemadura",
      "resfriado","rinitis","robo","reunión",
      "sarampión","sinusitis","sangrado",
      "tos","trauma","tormenta","tráfico","tren",
      "urgencia","úlcera",
      "vértigo","vómito","virus","viaje",
      "yeso",
      "zumbidos"
    ],
    "alimento": [
      "aceitunas","ajo","alcachofas","anchoas","atún","algas","arenque",
      "bacalao","berberechos","berenjenas","brócoli","boniato",
      "calamares","cangrejo","cebolla","cilantro","col","coliflor","caracol",
      "durian",
      "espárragos","espinacas","ensalada",
      "frambuesas","frijoles",
      "garbanzos","guisantes",
      "hígado","huitlacoche",
      "intestinos",
      "jamón","judías","jengibre",
      "kale","ketchup",
      "lentejas","lima","limón","langosta",
      "mango","mayonesa","melón","mostaza","mejillones",
      "nabo","natto",
      "ostras","orégano",
      "pepino","perejil","picante","pimienta","pimientos","pulpo",
      "queso","quinoa",
      "rábano","remolacha","repollo","riñones",
      "salmón","sardinas","setas","soja","sangre",
      "tofu","tomate","trigo","tripas","tocino",
      "uvas",
      "verduras","vísceras","vinagre",
      "wasabi",
      "yuca","yogur",
      "zanahoria","zarzamoras"
    ],
    "superpoder": [
      "absorción","agilidad","anticipación","aceleración","aura",
      "biocinesis","biotelepatía",
      "clarividencia","clonación","control","curación",
      "duplicación","destrucción","densidad",
      "elasticidad","energía","escudo","empatía","electricidad",
      "fuerza","fuego","fusión","frío",
      "gravitación","generación","geokinesis",
      "hidrocinesis","hipnosis","hipervelocidad",
      "impermeabilidad","inmortalidad","inteligencia","invisibilidad","invulnerabilidad",
      "kinesis",
      "levitación","luz","lectura mental",
      "magnetismo","metamorfosis","mente","movimiento","multiplicación",
      "omnisciencia",
      "percepción","pirokinesis","poderes","premonición","psicoquinesis",
      "quantum",
      "regeneración","resurrección","radiación",
      "seducción","sanación","sombras",
      "telecinesis","telepatía","teletransportación","telepresencia","tiempo",
      "ubicuidad",
      "velocidad","visión","vuelo","veneno",
      "xenoglosia",
      "zoomorfismo"
    ],
    "cosa que asusta": [
      "abejas","araña","arañas","alimañas","abismos",
      "brujas","brujería","búhos",
      "calabazas","cementerio","cocodrilos","cucarachas","cueva","criaturas",
      "diablo","dinosaurios","dragones","duendes","demonios",
      "espectros","espíritus","extraterrestres",
      "fantasmas",
      "garras","gigante","gusanos","gritos",
      "hombre lobo","horror","huesos",
      "insectos","infierno",
      "joker","jabalí",
      "lagartos","lobo","lobos",
      "monstruos","muerte","murciélagos",
      "niebla","noche",
      "oscuridad","ogros",
      "payasos","pesadillas",
      "quimeras",
      "ratas","relámpagos","robots","ruidos",
      "sangre","serpientes","sombras",
      "tiburones","tormentas","truenos","tumbas",
      "vampiros","voces",
      "wendigos",
      "yetis",
      "zombis","zombies"
    ],
    "cosa que nunca": [
      "abusar","abandonar","asesinar","atacar","acusar",
      "besar","burlarse","brutalizar",
      "calumniar","chantajear","comprometer","crimen",
      "degradar","denunciar","desnudar","destruir",
      "engañar","envenenar","esclavizar","estafar",
      "falsificar",
      "golpear",
      "herir","humillar","homicidio",
      "incriminar","insultar",
      "juzgar",
      "lastimar",
      "matar","manipular","maltratar","mentir","morder",
      "narcotráfico",
      "oprimir",
      "perjurar","prostituir",
      "quebrantar",
      "robar","rendirse",
      "sacrificar","sobornar",
      "torturar","traicionar",
      "ultrajar",
      "vender","violar",
      "zaherir"
    ],
    "cosa que llevarías": [
      "agua","axe","brújula","botiquín","biblia","botas",
      "comida","cuchillo","cuerdas","candela","cobija",
      "desinfectante","diamante","dinero",
      "espejo","encendedor","escoba","espada",
      "fósforos","fuego","filtro",
      "gafas","garrote",
      "hamaca","hacha","herramientas","hilo",
      "jabón","jeringuilla",
      "kit",
      "lanza","libro","linterna","lupa","lámpara",
      "machete","manta","mapa","medicamento","navaja","naipes",
      "ordenador","oxígeno",
      "pastillas","pinzas","provisiones",
      "radio","reloj","red","ropa",
      "sal","soga","señal","sogas",
      "teléfono","tabaco","tienda","torniquete","tijeras",
      "útiles",
      "vela","vendaje","vestido",
      "walkie",
      "yesca",
      "zapatos"
    ],
  },

  en: {
    animal: [
      "albatross","alligator","alpaca","anaconda","ant","anteater","antelope","ape","armadillo",
      "baboon","badger","bat","bear","beaver","bee","bison","boa","boar","buffalo","bull",
      "butterfly","camel","canary","capybara","cat","caterpillar","cheetah","chicken","chimpanzee",
      "cobra","cockroach","condor","coral","cougar","cow","coyote","crab","crane","cricket",
      "crocodile","crow","deer","dog","dolphin","donkey","dove","dragonfly","duck","eagle",
      "eel","elephant","elk","emu","falcon","ferret","firefly","fish","flamingo","fly","fox",
      "frog","gazelle","giraffe","goat","gorilla","grasshopper","hamster","hawk","hedgehog",
      "hippo","horse","hyena","iguana","impala","jaguar","jellyfish","kangaroo","koala","leopard",
      "lion","lizard","llama","lobster","lynx","manatee","monkey","moose","mosquito","moth",
      "mouse","mule","narwhal","octopus","orca","ostrich","otter","owl","panda","panther","parrot",
      "peacock","penguin","pig","pigeon","piranha","platypus","porcupine","puma","python","rabbit",
      "raccoon","rat","raven","reindeer","rhino","salmon","scorpion","seahorse","seal","shark",
      "sheep","skunk","sloth","snail","snake","sparrow","squid","stork","swan","tapir","tiger",
      "toad","tortoise","toucan","turkey","turtle","viper","vulture","walrus","wasp","whale",
      "wolf","wolverine","wombat","woodpecker","yak","zebra"
    ],
    color: [
      "amber","amethyst","aquamarine","aqua","azure","beige","black","blue","bronze","brown",
      "burgundy","caramel","celadon","cerulean","charcoal","chartreuse","chocolate","cobalt","copper",
      "coral","cream","crimson","cyan","ebony","ecru","emerald","fuchsia","gold","golden","gray",
      "green","greenish","grey","indigo","ivory","jade","khaki","lavender","lemon","lilac","lime",
      "linen","magenta","mahogany","maroon","mauve","mint","mustard","navy","nude","oak","ochre",
      "olive","orange","peach","pearl","periwinkle","pink","plum","purple","red","reddish","rose",
      "ruby","russet","rust","saffron","sage","salmon","sand","sapphire","scarlet","sepia","silver",
      "slate","tan","teal","terracotta","topaz","turquoise","ultramarine","umber","vermilion","violet",
      "white","wine","yellow","yellowish"
    ],
    fruit: [
      "apple","apricot","avocado","banana","blackberry","blackcurrant","blueberry","boysenberry",
      "breadfruit","cantaloupe","carambola","cherimoya","cherry","clementine","coconut","cranberry",
      "currant","damson","date","dragonfruit","durian","elderberry","feijoa","fig","gooseberry",
      "grape","grapefruit","guava","honeydew","jackfruit","jujube","kiwi","kumquat","lemon","lime",
      "lychee","mandarin","mango","mangosteen","melon","mulberry","nectarine","olive","orange",
      "papaya","passion fruit","peach","pear","persimmon","pineapple","pitahaya","plantain","plum",
      "pomegranate","pomelo","quince","rambutan","raspberry","redcurrant","salak","starfruit",
      "strawberry","tamarind","tangerine","ugli","watermelon","yuzu"
    ],
    name: [
      "aaron","adam","alice","amanda","andrew","anna","ashley","bella","benjamin","brandon",
      "brian","brittany","catherine","charles","charlotte","chloe","christopher","claire","daniel",
      "diana","dylan","emily","emma","ethan","elizabeth","fiona","frank","george","grace",
      "henry","hannah","isabella","ivan","jack","jessica","james","john","julia","kate",
      "kevin","karen","liam","laura","lily","lucas","mark","maria","matthew","michael","mia",
      "natalie","noah","olivia","oscar","patricia","paul","peter","quinn","rachel","ryan",
      "rebecca","sarah","samuel","sophia","scott","thomas","tyler","victor","victoria","vanessa",
      "walter","wendy","william","xavier","yolanda","zachary","zoe"
    ],
    place: [
      "afghanistan","albania","algeria","amsterdam","argentina","athens","australia","austria",
      "bahamas","bangladesh","barcelona","belgium","berlin","bolivia","boston","brazil","brussels",
      "bucharest","budapest","cairo","canada","chicago","chile","china","colombia","cuba",
      "denmark","dubai","dublin","ecuador","egypt","england","ethiopia","finland","florence",
      "france","germany","ghana","greece","hawaii","hungary","iceland","india","indonesia",
      "iran","ireland","israel","istanbul","italy","japan","jamaica","jordan","kenya","korea",
      "london","lima","lisbon","luxembourg","madrid","mexico","miami","milan","morocco","moscow",
      "nairobi","nigeria","norway","new york","oslo","oxford","paris","peru","prague","portugal",
      "qatar","rome","russia","scotland","singapore","spain","stockholm","sweden","switzerland",
      "sydney","tokyo","toronto","turkey","ukraine","uruguay","venice","vienna","vietnam",
      "warsaw","washington","zimbabwe","zurich"
    ],
    object: [
      "anchor","arrow","axe","backpack","ball","basket","bell","blanket","book","bottle",
      "bowl","box","brush","bucket","bulb","button","camera","candle","chain","chair",
      "clock","compass","crown","cup","curtain","desk","diamond","door","drawer","drum",
      "envelope","eraser","fan","flag","flashlight","flask","flute","fork","frame","gear",
      "glasses","globe","glove","guitar","hammer","hat","helmet","hook","horn","jar",
      "key","knife","lamp","lantern","lock","map","mask","mirror","mug","nail","needle",
      "net","pan","pen","pencil","phone","piano","pillow","pin","pipe","pitcher","plate",
      "plug","pot","purse","radio","rake","ring","rope","ruler","saw","scissors","shield",
      "shoe","shovel","sieve","sofa","spoon","stamp","stapler","sword","table","tape",
      "torch","umbrella","urn","vase","violin","wallet","watch","wheel","whistle","xylophone",
      "yoyo","zipper"
    ],
    brand: [
      "adidas","amazon","apple","audi","barbie","boeing","canon","chanel","cocacola","colgate",
      "dell","disney","dyson","ebay","facebook","ferrari","fila","ford","google","gucci",
      "honda","hp","huawei","ikea","instagram","intel","jaguar","jeep","kfc","kodak","lego",
      "lg","lamborghini","microsoft","netflix","nike","nintendo","oracle","pepsi","prada","puma",
      "porsche","reebok","rolex","samsung","sony","spotify","starbucks","tesla","tiktok","twitter",
      "uber","volkswagen","walmart","whatsapp","xbox","xiaomi","yahoo","youtube","yamaha","zara"
    ],
    // ── Chaos mode categories (basic semantic validation) ────────────────────
    "excuse": [
      "accident","allergy","arthritis","asthma","appointment","anxiety",
      "backache","bronchitis","breakdown","bleeding",
      "cold","cough","congestion","cramps","crisis","car trouble",
      "death","diarrhea","dizziness",
      "emergency","exhaustion","explosion",
      "fever","flu","fracture","funeral","fatigue","flood",
      "gastritis","grief",
      "headache","heartburn","hospitalization","heatstroke",
      "illness","infection","insomnia","injury","indigestion",
      "jaundice",
      "laryngitis","lockout","lockdown",
      "migraine","medicine","misfortune",
      "nausea","nervousness",
      "operation","outage",
      "pain","pneumonia","panic",
      "quarantine",
      "rash","respiratory",
      "sickness","sinusitis","surgery","stress","sprain",
      "traffic","tiredness","toothache","tonsillitis","trauma",
      "upset stomach",
      "vomiting","vertigo","virus",
      "wound","whiplash",
      "x-ray",
      "yeast infection",
      "zombie apocalypse"
    ],
    "food": [
      "anchovies","artichokes","avocado",
      "blueberries","broccoli","brussel sprouts","beets",
      "cabbage","cauliflower","celery","cheese","cilantro","cucumber","carrots",
      "durian",
      "eggplant","endive",
      "fish","fennel","figs",
      "garlic","guava","grapefruit",
      "horseradish",
      "intestines",
      "jalapeño","jello",
      "kale","kumquat","kidney beans",
      "licorice","liver","lima beans",
      "mushrooms","mustard","mango",
      "natto","nori",
      "olives","onions","oysters","organs","offal",
      "peas","pepper","pickles","pineapple",
      "queso","quinoa",
      "raisins","radishes","rhubarb",
      "sauerkraut","sardines","seaweed","spinach","squid",
      "tofu","turnip","tomato","tripe",
      "urchin",
      "vinegar",
      "wasabi",
      "yams","yogurt",
      "zucchini"
    ],
    "superpower": [
      "absorbing","agility","anticipation",
      "biokinesis",
      "clairvoyance","cloning","control","curing","cryokinesis",
      "duplication","destruction","density",
      "elasticity","energy","empathy","electricity",
      "fire","flight","fusion","force","freezing",
      "gravity","generation",
      "hydrokinesis","hypnosis","hypervelocity",
      "immortality","intelligence","invisibility","invulnerability",
      "kinesis",
      "levitation","light","laser vision","luck",
      "magnetism","metamorphosis","mind control","multiplication",
      "omniscience",
      "perception","pyrokinesis","power","premonition","psychokinesis",
      "quantum",
      "regeneration","resurrection","radiation","reading minds",
      "seduction","super speed","strength","shield","sorcery",
      "telekinesis","telepathy","teleportation","time manipulation",
      "ubiquity",
      "velocity","vision","venom",
      "wings","wish granting","weather control",
      "xenoglossalia",
      "zoomorphism"
    ],
    "thing that scares": [
      "alligators","ants","abysses",
      "bees","boogeymen","bugs",
      "clowns","cockroaches","crocodiles","caves","creeps",
      "darkness","death","devils","dinosaurs","dragons",
      "explosions","evil",
      "falling","fire","frights",
      "ghosts","giants","goblins","gorillas","ghouls",
      "haunted houses","heights","horrors","howling",
      "insects",
      "jellyfish",
      "knives",
      "lightning","loud noises","leeches",
      "monsters","mummies",
      "nightmares","needles",
      "ogres",
      "predators",
      "quicksand",
      "rats","robots","reptiles","roaches","roaring",
      "skeletons","shadows","spiders","snakes","screaming",
      "thunder","tigers","terror",
      "unknown",
      "vampires","voices",
      "werewolves","witches","worms",
      "xenomorphs",
      "yetis",
      "zombies"
    ],
    "thing you'd never": [
      "abuse","assault","attack","abandon",
      "betray","beg","bribe",
      "cheat","commit","corrupt","coerce",
      "deceive","destroy","defraud","degrade","defame",
      "endanger","exploit","extort",
      "falsify","fight","fraud",
      "grope",
      "harm","harass","hurt","humiliate","homicide",
      "incriminate","injure","insult",
      "judge","jail",
      "kill","kidnap",
      "lie","loot","lynch",
      "manipulate","murder","molest","maim","mug",
      "neglect",
      "oppress",
      "poison","perjure","prostitute",
      "rob","rape",
      "sacrifice","spy","steal","stab","scam","shoot",
      "torture","torment","threaten","traffic","trespass",
      "undermine",
      "victimize","violate",
      "wound"
    ],
    "thing you'd bring": [
      "axe","antiseptic",
      "blanket","binoculars","books","boots",
      "compass","clothes","cord","canteen","canned food",
      "diamonds","diary","drinking water","drill",
      "emergency kit","ebook",
      "fire starter","flashlight","food","fishing rod",
      "generator","glasses","gun",
      "hammock","hat","hatchet","hook","herbs",
      "insect repellent","iodine",
      "jacket","journal",
      "knife","kit",
      "lighter","lantern","laptop",
      "machete","map","matches","medicine","multi-tool",
      "notebook",
      "phone","provisions",
      "radio","rope","rations",
      "salt","satellite phone","sunscreen","signal mirror",
      "tent","tinder","torch","tools",
      "umbrella",
      "vest","vitamins",
      "water","whistle","wood",
      "yarn",
      "ziplock"
    ],
  },

  pt: {
    animal: [
      "abelha","aguia","alce","anaconda","anta","aranha","arara","baleia","boa","borboleta",
      "boi","burro","cabra","cachorro","caimao","camaleao","camelo","capivara","cavalo","cervo",
      "cobra","coelho","coruja","crocodilo","cutia","dromedario","elefante","ema","esquilo",
      "falcao","flamingo","formiga","frango","gato","gaviao","girafa","gorila","golfinho",
      "hamster","hipopotamo","hiena","iguana","jabuti","jaguar","jaguatirica","lagarto","lagarta",
      "leao","leopardo","lobo","lontra","macaco","morcego","mosquito","mula","onca","orangotango",
      "ostrica","ourico","papagaio","pato","peixe","pinguim","piranha","pombo","porco","puma",
      "quati","rato","rinoceronte","sapo","serpente","suricato","tartaruga","tigre","tucano",
      "tubarao","urso","urubu","vaca","veado","zebra","zorrilho"
    ],
    cor: [
      "amarelo","amarelado","ambar","anil","azul","azulado","azul marinho","azul celeste","azul royal",
      "bege","branco","bronze","burgundy","cafe","canela","caramelo","carmim","castanho","chumbo",
      "ciano","cinza","cinzento","coral","creme","cobre","dourado","ebano","esmeralda","fuchsia",
      "gelo","grafite","granate","indigo","jade","laranja","lavanda","lilas","lima","linho",
      "magenta","marfim","marrom","mel","mostarda","nude","ocre","ouro","prata","preto",
      "rosa","roxo","ruivo","salmao","sepia","siena","terracota","tijolos","tomate","turquesa",
      "uva","verde","verde lima","verde oliva","vermelho","vinho","violeta","xadrez"
    ],
    fruta: [
      "abacate","abacaxi","abiu","acerola","ameixa","amora","araça","bacuri","banana","biriba",
      "borojo","cacao","caju","caqui","carambola","castanha","cereja","coco","cupuacu","damasco",
      "figo","framboesa","goiaba","graviola","jaca","jabuticaba","kiwi","laranja","lichia",
      "lima","limao","lulo","lucuma","mamao","mamey","manga","maracuja","maca","melancia",
      "melao","morango","nectarina","nespera","papaia","pera","pessego","pitanga","pitaya",
      "pitahaya","pomelo","rambutan","romã","sapoti","seriguela","tamara","uva","uvaia","yuzu"
    ],
    nome: [
      "adriana","alberto","alexandre","alice","amanda","ana","antonio","beatriz","bernardo",
      "bruna","caio","camila","carlos","carolina","clara","claudia","daniela","daniel","diego",
      "eduarda","eduardo","fernanda","fernando","filipe","flavia","gabriel","giovanna","guilherme",
      "gustavo","helena","hugo","ines","isabella","joao","jorge","jose","julia","juliana",
      "karen","katia","larissa","laura","leandro","leticia","lucas","lucia","luiz","manuela",
      "marcos","mariana","mario","mateus","monica","natalia","nicolas","nuno","olivia","oscar",
      "patricia","paulo","pedro","rafaela","rafael","renata","ricardo","roberta","rodrigo",
      "samuel","sandra","sergio","silvia","sofia","tiago","valentina","victor","vitoria","yasmin"
    ],
    lugar: [
      "africa","alaska","alemanha","amazonia","angola","argentina","asia","australia","austria",
      "bahia","barcelona","belgica","berlim","bolivia","brasilia","brasil","canada","chile",
      "china","colombia","coreia","cuba","curitiba","dinamarca","dubai","egito","espanha",
      "estonia","europa","finlandia","franca","genebra","grecia","holanda","hungria","india",
      "indonesia","irlanda","italia","japao","jordania","kenya","lisboa","londres","luxemburgo",
      "madri","mexico","mocambique","noruega","nova york","oslo","paris","peru","polonia",
      "portugal","praga","roma","russia","salvador","sao paulo","singapura","suecia","suica",
      "tailandia","toquio","turquia","ucrania","uruguai","viena","vietnam","washington"
    ],
    objeto: [
      "agulha","anel","arco","balde","bicicleta","bolsa","borracha","cadeira","camera","caneta",
      "carro","celular","chave","colher","computador","copo","corda","dado","escada","espelho",
      "faca","flauta","fogao","forno","frasco","garrafa","guitarra","guarda-chuva","lampada",
      "lapis","livro","martelo","mesa","mochila","moeda","navalha","panela","piano","prato",
      "radio","relogio","roda","saco","sofa","teclado","telefone","tesoura","violao"
    ],
    marca: [
      "adidas","amazon","apple","audi","bosch","brahma","casio","chanel","cocacola","colgate",
      "dell","disney","ebay","facebook","ferrari","ford","google","gucci","havaianas","honda",
      "ikea","instagram","jaguar","kfc","lego","lg","loreal","microsoft","netflix","nike",
      "nintendo","oracle","pepsi","petrobras","prada","samsung","sony","starbucks","tesla",
      "twitter","uber","volkswagen","walmart","whatsapp","xbox","yamaha","youtube","zara"
    ],
  },

  fr: {
    animal: [
      "aigle","alouette","âne","araignee","autruche","baleine","biche","bison","blaireau",
      "boeuf","bouquetin","buffle","canard","castor","cerf","chameau","chat","cheval","chien",
      "cigogne","cobra","coq","corbeau","crocodile","cygne","dauphin","dindon","ecureuil",
      "elephant","elan","faucon","flamant","fourmi","gazelle","girafe","gorille","grenouille",
      "hamster","herisson","hibou","hippopotame","hyene","jaguar","kangourou","koala","lapin",
      "leopard","lievre","lion","loup","lynx","meduse","mouton","mule","narval","ours",
      "panda","panthère","paon","perroquet","pieuvre","pigeon","pingouin","porc","puma",
      "renard","requin","rhinoceros","sanglier","serpent","singe","suricate","tapir","tigre",
      "tortue","toucan","vache","vautour","zebre","zibeline"
    ],
    couleur: [
      "abricot","ambre","amethyste","ardoise","argent","aubergine","azur","beige","bistre",
      "blanc","bleu","bordeaux","brun","caramel","carmin","celadon","cerise","chartreuse",
      "chocolat","citron","corail","cramoisi","cyan","dore","ecarlate","ecru","emeraude",
      "framboise","fuchsia","gris","indigo","ivoire","jade","jaune","lavande","lilas",
      "magenta","marron","mauve","menthe","miel","nacre","navy","noir","noisette","ocre",
      "olive","orange","or","perle","pivoine","platine","pourpre","prune","rose","rouge",
      "rouille","sable","safran","saumon","topaze","turquoise","vert","violet","zinzolin"
    ],
    fruit: [
      "abricot","ananas","avocat","banane","bigarreau","cassis","cerise","citron","clementine",
      "coco","datte","figue","fraise","framboise","grenade","groseille","kaki","kiwi","kumquat",
      "lime","litchi","mandarine","mangue","melon","mirabelle","mure","myrtille","nectarine",
      "noisette","noix","olive","orange","papaye","pastèque","peche","physalis","poire",
      "pomme","prune","quetsche","raisin","rambutan","tamarin","yuzu"
    ],
    prénom: [
      "adele","adrien","alice","alexis","amelie","antoine","arthur","axel","baptiste","camille",
      "charlotte","chloe","clement","coralie","diane","dylan","elise","emma","ethan","eva",
      "fabien","floriane","gabriel","gaelle","guillaume","hugo","ines","isabelle","jade",
      "julien","julie","kevin","laetitia","laura","leo","lucas","lucie","louis","manon",
      "margot","marine","mathieu","mathis","maxime","melissa","noemie","nicolas","oceane",
      "olivia","paul","pauline","pierre","quentin","rachel","remi","robin","romane","samuel",
      "sarah","simon","sophie","thomas","thibault","theo","valentin","valentine","victor",
      "victoria","vincent","yannick","yasmine","zoe"
    ],
    lieu: [
      "afrique","algerie","allemagne","amsterdam","angleterre","australie","autriche","barcelone",
      "belgique","berlin","bordeaux","bretagne","bruxelles","canada","chine","colombie",
      "copenhagen","corse","danemark","dubai","ecosse","egypte","espagne","europe","finlande",
      "florence","france","geneve","grece","grenade","hambourg","hollande","hongrie","inde",
      "indonesie","irlande","islande","italie","japon","jordanie","kenya","lisbonne","londres",
      "luxembourg","lyon","madrid","maroc","marseille","mexique","milan","monaco","montreal",
      "moscou","nantes","nice","nigeria","norvege","oslo","paris","perou","pologne","portugal",
      "prague","rome","russie","seville","singapour","stockholm","suede","suisse","tokyo",
      "toulouse","turquie","ukraine","venise","vienne","vietnam","washington","zurich"
    ],
    objet: [
      "aiguille","anneau","arbre","assiette","balai","ballon","bicyclette","bougie","bouteille",
      "boussole","camera","canif","ceinture","chaise","cle","coffre","couteau","crayon",
      "cruche","drapeau","echarpe","echelle","epee","escalier","flute","globe","guitare",
      "hache","horloge","lampe","livre","loupe","marteau","miroir","montre","parapluie",
      "piano","pince","plume","radio","rideau","sac","seau","serrure","table","telephone",
      "toboggan","vase","violon","xylophone","yoyo"
    ],
    marque: [
      "adidas","amazon","apple","audi","bic","boeing","canon","carrefour","chanel","citroën",
      "cocacola","dassault","dior","disney","ebay","facebook","ferrari","ford","google","gucci",
      "hermes","honda","ikea","instagram","jaguar","kfc","lacoste","lego","lg","loreal",
      "lvmh","michelin","microsoft","netflix","nike","nintendo","oracle","pepsi","peugeot",
      "prada","renault","samsung","sony","starbucks","tesla","twitter","uber","volkswagen",
      "walmart","whatsapp","xbox","yamaha","youtube","zara"
    ],
  },
};

// ─── Open categories ───────────────────────────────────────────────────────────
// These have infinite valid answers — any word starting with the correct letter is valid.
// Dictionaries above for these categories exist only so the AI can play.
const OPEN_CATEGORIES = new Set([
  "nombre","lugar","objeto","marca",       // es
  "name","place","object","brand",         // en
  "nome","objeto","marca",                 // pt
  "prénom","prenom","lieu","objet","marque", // fr
]);

// ─── Words that are NEVER valid STOP answers ──────────────────────────────────
// Pure spatial/directional words that can never be a noun answer in any category.
// Applied globally (including open categories) to block obvious non-answers.
const NEVER_VALID_WORDS = new Set([
  // Spanish directional words
  "derecha","izquierda","arriba","abajo","adelante","atras",
  "detras","delante","encima","debajo",
  // English equivalents
  "above","below","forward","behind",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeWord(word: string): string {
  // Protect Ñ/ñ with a placeholder BEFORE NFD decomposition,
  // otherwise "ñ" → "n" + combining-tilde → "n" (indistinguishable from N)
  return word.toLowerCase().trim()
    .replace(/ñ/g, "~")               // protect ñ from NFD
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip other accent marks
    .replace(/[^a-z~\s]/g, "")        // keep letters + ñ placeholder
    .replace(/~/g, "ñ")               // restore ñ
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
  // Global minimum: 2 chars (allows "ñu", "ox", etc. in closed finite categories)
  if (normalizedWord.length < 2) return false;

  // Reject words that are never valid in any STOP category (spatial/directional words)
  if (NEVER_VALID_WORDS.has(normalizedWord)) return false;

  const normCategory = normalizeWord(category);

  // Open categories: any word is valid IF it has at least 3 chars.
  // (Min-2 is kept globally only for closed categories like Animal where "ñu" is valid.)
  if (OPEN_CATEGORIES.has(normCategory)) return normalizedWord.length >= 3;

  const langDict = DICTIONARY[language] || DICTIONARY["es"];
  const categoryWords = findCategoryWords(langDict, category);

  // No dictionary found for this category → accept any word
  if (categoryWords.length === 0) return true;

  // Check if word matches or is a variation of any dictionary word
  return categoryWords.some(w => {
    const nw = normalizeWord(w);
    return nw === normalizedWord ||
      normalizedWord.startsWith(nw) ||   // e.g. "rosado" starts with "rosa" ✓
      nw.startsWith(normalizedWord);     // e.g. "ro" prefix of "rojo" ✓
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
    player: { response: string; isValid: boolean; score: number; isDuplicate?: boolean };
    ai: { response: string; isValid: boolean; score: number };
  }> = {};
  let playerTotalScore = 0;
  let aiTotalScore = 0;

  for (const pr of playerResponses) {
    const playerWord = pr.word?.trim() || "";
    const aiWord = getAiWord(letter, pr.category, language);

    const normPlayerWord = normalizeWord(playerWord);

    // "Repetida" only means the player and the AI wrote the exact same word in the same category
    // (handled below by giving 5pts each). Using the same word in different categories is allowed.
    const isPlayerWordValid = isWordValid(playerWord, letter, pr.category, language);
    const isAiWordValid = aiWord.length > 0 && isWordValid(aiWord, letter, pr.category, language);

    let playerScore = 0;
    let aiScore = 0;

    if (isPlayerWordValid && isAiWordValid) {
      const normAi = normalizeWord(aiWord);
      if (normPlayerWord === normAi) {
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
