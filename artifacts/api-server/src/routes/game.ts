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

    // ── Geography pack ───────────────────────────────────────────────────────
    "país": [
      "alemania","argentina","australia","austria","bélgica","bolivia","brasil","bulgaria",
      "canadá","chile","china","colombia","corea","costa rica","cuba","croacia","dinamarca",
      "ecuador","egipto","el salvador","escocia","eslovaquia","eslovenia","españa","estonia",
      "etiopía","filipinas","finlandia","francia","gales","grecia","guatemala","haití","honduras",
      "hungría","india","indonesia","inglaterra","irán","iraq","irlanda","islandia","israel","italia",
      "jamaica","japón","jordania","kazajistán","kenia","kuwait","laos","letonia","líbano","libia",
      "liechtenstein","lituania","luxemburgo","madagascar","malasia","mali","malta","marruecos",
      "méxico","mónaco","nicaragua","nigeria","noruega","nueva zelanda","omán","pakistán","panamá",
      "paraguay","perú","polonia","portugal","puerto rico","qatar","reino unido","república dominicana",
      "rumanía","rusia","san marino","senegal","serbia","singapur","siria","somalia","sri lanka",
      "sudáfrica","sudán","suecia","suiza","tailandia","taiwán","tanzania","togo","tunicia","turquía",
      "ucrania","uganda","uruguay","uzbekistán","venezuela","vietnam","yemen","zambia","zimbabue"
    ],
    "capital": [
      "amsterdam","ankara","atenas","bangkok","beirut","berlín","berna","bogotá","brasilia","bratislava",
      "bruselas","bucarest","budapest","buenos aires","cairo","canberra","caracas","copenhague","dakar",
      "damasco","dublín","estocolmo","helsinki","kabul","kingston","kiev","la habana","la paz","lima",
      "lisboa","liubliana","londres","madrid","managua","manila","minsk","moscú","nairobi","new delhi",
      "oslo","ottawa","panamá","paris","pekin","pretoria","praga","quito","reikiavik","riad","riga",
      "roma","san josé","san salvador","santiago","santo domingo","sarajevo","seúl","skopie","sofia",
      "tallin","tegucigalpa","tel aviv","teherán","tirana","tokio","tunez","ulan bator","varsovia",
      "viena","vientiane","vilna","washington","wellington","yakarta","zagreb"
    ],
    "río": [
      "amazonas","amur","aragón","arno","brahmaputra","colorado","congo","danubio","duero","ebro",
      "elba","éufrates","ganges","garona","guadalquivir","guadiana","hudson","indo","jordán",
      "loira","mekong","misisipi","misuri","nilo","oder","orinoco","pánuco","paraná","pisuerga",
      "po","rin","ródano","sena","tajo","támesis","tigris","tisza","ucayali","ural","uruguay",
      "vístula","volga","yangtsé","yaqui","yenisei","yukon","zambeze"
    ],
    "montaña": [
      "aconcagua","alpes","andes","annapurna","apeninos","atlas","ararat","balcanes","blanco",
      "cárpatos","caucaso","cervino","cotopaxi","denali","elbrús","etna","everest","fitz roy",
      "fuji","himalaya","huascarán","jungfrau","k2","kazbek","kilimanjaro","logan","makalu",
      "mckinley","mont blanc","monte perdido","mulhacén","olimpo","ojos del salado","orizaba",
      "pirineos","popocatépetl","rocallosas","sierra nevada","teide","torre","ural","veleta",
      "vesubio","vinson","volcán","whitney"
    ],
    "idioma": [
      "alemán","arameo","árabe","aragonés","armenio","asturiano","aymara","bantú","bengalí","bielorruso",
      "bretón","búlgaro","cantonés","castellano","catalán","cebuano","checo","chino","coreano","corso",
      "criollo","croata","danés","esperanto","estonio","euskera","farsi","finés","francés","gaélico",
      "galego","gallego","georgiano","griego","guaraní","hebreo","hindi","holandés","húngaro","ibo",
      "indonesio","inglés","italiano","japonés","javanés","kazajo","kurdo","ladino","laosiano","latín",
      "letón","lituano","macedonio","malayo","mandarín","maorí","maya","mongol","náhuatl","navajo",
      "nepalí","noruego","occitano","pashtún","persa","polaco","portugués","punjabi","quechua","rumano",
      "ruso","sánscrito","serbio","siciliano","sueco","swahili","tagalo","tailandés","tamil","tibetano",
      "turco","ucraniano","urdu","valenciano","vasco","vietnamita","wolof","xhosa","yiddish","yoruba","zulú"
    ],
    "monumento": [
      "acrópolis","alcatraz","alhambra","arco","atomium","big ben","brandeburgo","cataratas","catedral",
      "chichén itzá","coliseo","cristo redentor","duomo","escorial","empire state","esfinge","estatua",
      "eiffel","faro","fortaleza","golden gate","gran muralla","kremlin","louvre","machu picchu",
      "neuschwanstein","ópera","obelisco","pagoda","palacio","panteón","partenón","petra","pirámide",
      "puente","puerta","sagrada familia","santuario","stonehenge","taj mahal","templo","torre","trevi",
      "uffizi","versalles","vaticano","westminster","windsor","yacimiento","zigurat"
    ],
    "mar": [
      "adriático","amarillo","arábigo","aral","argentino","ártico","atlántico","azov","báltico","barents",
      "bering","caribe","caspio","celebes","china","coral","cortés","índico","japón","jónico","jüjpico",
      "labrador","ligure","mar negro","marmara","mediterráneo","muerto","negro","norte","océano",
      "okhotsk","pacífico","plata","rojo","ross","tasmania","timor","tirreno","weddell"
    ],

    // ── Football pack ────────────────────────────────────────────────────────
    futbolista: [
      "agüero","alaba","alba","alves","ancelotti","auba","bale","baggio","beckham","benzema","bergkamp",
      "best","buffon","busquets","butragueño","cafú","cannavaro","casillas","cavani","chiellini",
      "cristiano","cruyff","de bruyne","de gea","dembélé","di stefano","díaz","dybala","eto'o","etxeberria",
      "fàbregas","figo","forlán","gattuso","gerrard","griezmann","guardiola","guardado","haaland",
      "hazard","henry","higuaín","hummels","ibrahimović","iniesta","isco","james","jordi alba","kanté",
      "kaká","kane","kaká","kimmich","klose","koke","kross","kun","lahm","lampard","laporte","laudrup",
      "lewandowski","lineker","mané","maradona","maldini","marcelo","marc-andré","mascherano","mbappé",
      "messi","mertens","milla","modric","müller","muller","nadal","nesta","neto","neuer","neymar",
      "nesta","oblak","ozil","pavón","pedri","pelé","piqué","pogba","popescu","puyol","raul","rashford",
      "ramos","reyes","rivaldo","robben","rodrygo","rodri","romario","ronaldinho","ronaldo","rooney",
      "ruud","salah","sanchez","scholes","schweinsteiger","seedorf","silva","simeone","stam","suárez",
      "thiago","thiago silva","torres","totti","trezeguet","valdano","valdés","van basten","van persie",
      "vidal","villa","vinicius","xabi","xavi","yashin","zambrotta","zanetti","zidane","zlatan"
    ],
    equipo: [
      "ajax","ac milan","arsenal","atlético","atalanta","atletico madrid","barcelona","bayern","benfica",
      "betis","boca","borussia","brentford","brighton","celta","celtic","chelsea","colón","comunicaciones",
      "dortmund","ecuador","eibar","everton","feyenoord","fiorentina","flamengo","fluminense","fulham",
      "galatasaray","getafe","girona","gremio","huesca","independiente","internazionale","internacional",
      "juventus","lazio","leeds","leganés","leicester","levante","liverpool","leverkusen","lyon",
      "manchester","manchester city","manchester united","mainz","milan","monaco","montpellier","mallorca",
      "napoli","newcastle","nottingham","olympiakos","osasuna","paris","palmeiras","peñarol","porto",
      "psg","racing","rayo","real madrid","real sociedad","rennes","river","river plate","roma",
      "sampdoria","santos","sao paulo","sassuolo","sevilla","sheffield","sporting","stuttgart","tottenham",
      "udinese","unión","valencia","valladolid","valencia","vasco","verona","villarreal","west ham",
      "wolverhampton","yokohama","zaragoza","zenit"
    ],
    estadio: [
      "anoeta","azteca","balaídos","bernabéu","camp nou","centenario","ciutat de valencia","emirates",
      "etihad","el monumental","el madrigal","la bombonera","la cartuja","la rosaleda","ipurúa","king fahd",
      "luzhniki","maracaná","mestalla","metropolitano","montjuïc","monumental","old trafford","parc des princes",
      "ramón sánchez pizjuán","reale arena","ricardo saprissa","rio tinto","san mamés","san paolo","san siro",
      "santiago bernabéu","santiago bernabeu","signal iduna","stadio olimpico","tottenham hotspur","velódromo",
      "villamarín","vodafone arena","wanda metropolitano","wembley","westfalenstadion","yankee stadium"
    ],
    entrenador: [
      "alex ferguson","ancelotti","arrigo sacchi","aragonés","beenhakker","bielsa","bosque","capello",
      "cesar luis menotti","clemente","conte","cruyff","del bosque","didier deschamps","emery",
      "ferguson","flick","guardiola","gasperini","heynckes","hiddink","klinsmann","klopp","koeman",
      "lopetegui","luis enrique","luis aragonés","mancini","manuel pellegrini","mourinho","nagelsmann",
      "pep","pochettino","pellegrini","queiroz","ranieri","raymond goethals","rijkaard","sacchi",
      "sampaoli","scaloni","scolari","setién","simeone","spalletti","tata martino","ten hag","tite",
      "tuchel","valverde","vicente del bosque","wenger","xavi","zidane","zinedine zidane"
    ],
    competición: [
      "amistoso","apertura","bundesliga","champions","clausura","conference","copa américa","copa argentina",
      "copa del rey","copa libertadores","copa mundial","copa oro","copa sudamericana","cup","eliminatorias",
      "europa","eurocopa","fa cup","ligue 1","libertadores","la liga","liga","mundial","mls","nations",
      "olímpicos","olimpiadas","paulista","preolímpico","premier","recopa","relámpago","sudamericana",
      "supercopa","trofeo","uefa","uefa champions league","uefa europa league","uefa nations league","yeclano"
    ],
    "país futbolero": [
      "alemania","argentina","australia","austria","bélgica","bolivia","brasil","camerún","canadá","chile",
      "china","colombia","corea","croacia","dinamarca","ecuador","egipto","el salvador","escocia","eslovaquia",
      "españa","estados unidos","francia","gales","ghana","grecia","holanda","honduras","hungría","inglaterra",
      "irlanda","irán","italia","jamaica","japón","marruecos","méxico","nigeria","noruega","panamá",
      "paraguay","perú","polonia","portugal","qatar","república checa","república dominicana","rumanía",
      "rusia","serbia","suecia","suiza","túnez","turquía","ucrania","uruguay","venezuela","yugoslavia"
    ],
    jugada: [
      "amague","arquero","ataque","autopase","barrida","bicicleta","bolea","caño","cabezazo","centro",
      "chilena","contraataque","corner","despeje","dribbling","entrada","escorpión","falta","finta","foul",
      "gambeta","gol","golpe","habilidad","intercepción","jugada","keepie","lanzamiento","libre","luchada",
      "maradoniana","media volea","media chilena","mejicana","nutmeg","off-side","paradinha","palomita",
      "parada","pase","penal","penalti","quite","rabona","ramonete","recuperación","regate","remate",
      "rosca","rueda","saque","sombrero","taco","tanda","taquilla","tijera","tiro","trivela","túnel",
      "voleo","vuelta","wengue","xut","yarda","zamarrazo"
    ],

    // ── Cinema pack ──────────────────────────────────────────────────────────
    "actor": [
      "adam","adrián","alba","alfredo","al pacino","alejandro","amaia","ana de armas","andrés","angelina",
      "antonio banderas","arnold","audrey","banderas","ben","bardem","brad","brad pitt","bruce willis",
      "cameron","cate","charlize","chris","chris hemsworth","clint","clint eastwood","cooper","cruz",
      "daniel craig","de niro","dicaprio","diego","emma","emma stone","eva","fernando","george clooney",
      "gerard","gisela","goya","hanks","harrison","hilary","hugh","hugh jackman","irene","javier",
      "javier bardem","jennifer","jhonny depp","jodie","johnny depp","jolie","julia","julia roberts",
      "keanu","keanu reeves","kevin","kidman","kristen","leonardo","liam","liam neeson","luis","mads",
      "matthew","mel","meryl","meryl streep","morgan","morgan freeman","natalie","nicolas","nicole","oscar",
      "oprah","penelope cruz","peter","ricardo","richard","robert","robert downey","roberto","ryan",
      "samantha","samuel l jackson","sandra","sandra bullock","scarlett","sigourney","stallone","streep",
      "tom","tom cruise","tom hanks","tom holland","tom hardy","uma","viggo","viola","wesley","willem",
      "xavier","yolanda","zac efron","zoe","zoë"
    ],
    "película": [
      "alien","amelie","amistades","apocalypse now","atrapado","avatar","aviator","batman","beetlejuice",
      "blade runner","brave","cars","casino","casablanca","cazafantasmas","chicago","chinatown","coco",
      "constantino","cube","django","dunkerque","el padrino","el rey león","ella","encanto","everest",
      "encantada","facundo","forrest gump","frozen","gladiador","gone girl","gravity","grease","harry potter",
      "her","hércules","hook","independence day","increíbles","inception","interstellar","irréversible",
      "it","jaws","jaws","jurassic park","jumanji","jojo rabbit","king kong","la la land","la lista de schindler",
      "leon","lion","los goonies","matrix","memento","minari","minions","monstruos","moonlight","narnia",
      "naruto","nimona","oceans","orgullo y prejuicio","oppenheimer","platoon","predator","psicosis","psycho",
      "quién engañó","rocky","ratatouille","reservoir dogs","rocky","seven","shrek","spiderman","spirit",
      "star wars","sully","tarzan","tarzán","taxi driver","terminator","titanic","tron","toy story","up",
      "vértigo","vaiana","wall-e","watchmen","x-men","xanadu","yentl","zombieland","zootopia"
    ],
    serie: [
      "amigos","arrow","ágata","americana","andor","ahsoka","atlanta","bárbaros","big bang theory","black mirror",
      "breaking bad","bridgerton","cobra kai","el chavo","el internado","el juego del calamar","el ministerio",
      "élite","euphoria","frasier","friends","fugitivos","game of thrones","glee","gossip girl","greys anatomy",
      "hawkeye","heartstopper","heidi","heroes","hijos de papá","homeland","house","house of the dragon",
      "house of cards","industry","invincible","jane the virgin","jessica jones","kung fu","la casa de papel",
      "lost","loki","lupin","mad men","mandalorian","mar de plástico","money heist","narcos","new girl","obi-wan",
      "ozark","outlander","peaky blinders","pose","pulgarcito","quien es la máscara","queen of the south",
      "rick and morty","rosa de guadalupe","sex education","sherlock","squid game","stranger things","succession",
      "ted lasso","the last of us","the witcher","this is us","traffic","tulsa king","umbrella academy","upload",
      "vikings","wandavision","wednesday","you","yo soy bea","z nation","zapping zone"
    ],
    "director": [
      "almodóvar","akira","alfred","alfred hitchcock","amenábar","ang lee","aronofsky","ari aster","bayona",
      "bigelow","brian de palma","burton","cameron","carpenter","ceylan","chazelle","chris columbus","christopher",
      "clint eastwood","coen","coppola","cuarón","de palma","del toro","denis villeneuve","duvernay",
      "eastwood","ferran adrià","fincher","ford","francis ford coppola","gerwig","godard","gonzález iñárritu",
      "guillermo del toro","hitchcock","huston","ingmar bergman","iñárritu","jackson","james cameron","jane campion",
      "jenkins","jonathan demme","jordan peele","jose luis garci","kar-wai","kathryn","kelly","kubrick",
      "lanthimos","lasseter","lars von trier","linklater","lynne ramsay","luc besson","luhrmann","lucas",
      "mann","mendes","miller","miyazaki","nolan","nora ephron","oliver stone","ozu","pablo larraín","park chan-wook",
      "paul thomas anderson","peter jackson","peter weir","quentin tarantino","ridley scott","ritchie","ron howard",
      "roman polanski","sam mendes","sam raimi","scorsese","sean penn","scott","sergio leone","spike lee",
      "spielberg","steven spielberg","stanley kubrick","tarantino","tati","trier","truffaut","ueda","villa-lobos",
      "villeneuve","von trier","wes anderson","wong kar-wai","xavier dolan","yates","yorgos","zhang yimou","zwick"
    ],
    personaje: [
      "aladdin","alf","ariel","aragorn","arthur","atreyu","bambi","barbie","batman","bart simpson","bilbo",
      "buzz lightyear","capitán américa","catwoman","chewbacca","chucky","cinderella","conan","darth vader",
      "darius","deadpool","don quijote","drácula","dora","dumbledore","eddard stark","edward","el grinch",
      "elsa","elliot","emperador","enola holmes","ethan hunt","falcón","fiona","forrest gump","frankestein",
      "freddy krueger","frodo","gandalf","gargamel","garfield","gohan","goku","gollum","hanibal","han solo",
      "harry","harry potter","hermione","hércules","hulk","iron man","james bond","jason","john wick","joker",
      "joaquín","kakashi","king kong","kung fu panda","laharl","leon","loki","luigi","luke skywalker","mario",
      "merlín","michael myers","mickey","monstruo","mowgli","mufasa","murcielago","nemo","neo","obi-wan",
      "obélix","odd","peter pan","pikachu","pinocho","piñera","pluto","popeye","quasimodo","ramos",
      "rambo","rapunzel","ratoncito pérez","robin hood","rocky","sadako","sasuke","scarface","scooby","seven",
      "shrek","simba","skywalker","spiderman","stewie","superman","tarzán","terminator","toad","tonto","totoro",
      "ulises","uma","umbridge","vincent","virgilio","wally","wednesday","willy wonka","wolverine","woody",
      "xena","yoda","zafira","zorro"
    ],
    "género": [
      "acción","animación","aventura","autobiográfico","bélico","biografía","biopic","ciencia ficción",
      "comedia","comedia romántica","crimen","cyberpunk","deporte","detectives","distopía","documental",
      "drama","éepico","épico","erótico","estilo musical","experimental","fantasía","ficción","film noir",
      "gore","gótico","gangster","historia","horror","independiente","infantil","jovial","juvenil","kuroshitsuji",
      "legal","melodrama","misterio","musical","negro","neo-noir","odisea","pixar","policial","policíaco",
      "religioso","romance","road movie","ruralista","sátira","sci-fi","slasher","superhéroes","suspense",
      "terror","thriller","ultra violento","vintage","western","wuxia","xenofobia","zombie"
    ],
    "canción": [
      "amor","abrázame","ante el espejo","baby blue","bohemian rhapsody","born free","cherry bomb","city of stars",
      "danza kuduro","despacito","el cóndor pasa","el rey","eye of the tiger","flashdance","footloose",
      "ghost","gloria","hakuna matata","heart of glass","heart will go on","hotel california","i will always love you",
      "imagine","james bond theme","jailhouse rock","kiss from a rose","lady marmalade","la bamba","la vie en rose",
      "let it go","let it be","life is a highway","living la vida loca","mamma mia","my heart will go on","new york new york",
      "ocean man","old town road","over the rainbow","piensa en mí","purple rain","quédate","raindrops",
      "remember me","rock around the clock","ruta 66","sing","stayin alive","summer nights","take my breath away",
      "the time of my life","unchained melody","under the sea","viento","viva la vida","walking on sunshine",
      "writings on the wall","you are my sunshine","you raise me up","yesterday","zorba"
    ],

    // ── Food pack ────────────────────────────────────────────────────────────
    plato: [
      "albóndigas","arepa","arroz","asado","barbacoa","brochetas","burrito","calzone","canelones","carbonara",
      "carpaccio","cebiche","ceviche","chilaquiles","chop suey","cocido","crepas","croquetas","curry","empanada",
      "ensalada","fabada","fajitas","feijoada","filete","fish and chips","focaccia","fondue","gazpacho","goulash",
      "guisado","gumbo","hamburguesa","hot dog","jambalaya","kebab","lasaña","macarrones","milanesa","moussaka",
      "nachos","ñoquis","paella","pad thai","pasta","pizza","pollo asado","potaje","puchero","quesadilla","quiche",
      "raviolis","risotto","rollitos","sancocho","sashimi","sopa","stroganoff","sushi","taco","tagine","tamal",
      "tartar","tempura","tortilla","tortelini","tortelloni","tournedos","udon","vichyssoise","wonton","xinxim",
      "yakisoba","yucca","zarzuela"
    ],
    ingrediente: [
      "aceite","aceituna","ajo","albahaca","almendra","arroz","azúcar","bacalao","berenjena","carne",
      "cebolla","champiñón","chorizo","cilantro","comino","cordero","crema","cúrcuma","dátil","ejote","escarola",
      "espárrago","espinaca","fideos","frijol","garbanzo","gelatina","harina","hígado","huevo","jamón","jengibre",
      "judía","kétchup","laurel","leche","lechuga","levadura","limón","maíz","mantequilla","manzana","menta","miel",
      "nata","nuez","ñame","oliva","orégano","pan","papa","pepino","perejil","pescado","pimienta","piña","plátano",
      "pollo","queso","quinoa","rábano","remolacha","romero","sal","salmón","salvia","sésamo","setas","tomate",
      "tomillo","trigo","uva","vainilla","vinagre","wasabi","xantana","yogur","zanahoria","zumo"
    ],
    restaurante: [
      "abuela","aroi","barbacoa","bistro","brasería","cafetería","cantina","casa lola","casa pepe","casserole",
      "chez","churrasquería","churrería","comedor","cocina","crepería","cervecería","deli","delicatessen",
      "dominos","el corral","el portal","fonda","frankfurt","gastrobar","grill","hamburguesería","heladería",
      "ikea","inn","izakaya","japonés","jardín","kebab","kfc","la bodeguita","la mafia","la pizzería","la trattoria",
      "marisquería","mcdonalds","mexicano","mesón","negroni","oasis","osteria","palace","paladar","palmarés",
      "panadería","parrilla","pizza hut","pizzería","posada","quiosco","restaurante","ribs","ristorante","sake",
      "starbucks","subway","sushi bar","tapas","taquería","taberna","tasca","tasquinha","trattoria","udon",
      "venta","vinería","wendys","yatai","zaida"
    ],
    postre: [
      "alfajor","arroz con leche","babá","baklava","brazo de gitano","brownie","bizcocho","buñuelo","cake",
      "calabaza","cannoli","caramelos","carrot cake","cassata","cheesecake","chocolate","chocotorta","churros",
      "compota","copa","crema catalana","creme brulee","crepa","crocante","cupcake","donut","dulce de leche",
      "éclair","eclair","empanadilla","ensaimada","filloas","flan","fondant","frappé","fresas","fruta","galletas",
      "gelatina","granizado","helado","helado","kremlin","leche frita","lemon pie","macarons","magdalena","mantecado",
      "marquesa","mazapán","membrillo","merengue","milhojas","mochi","mousse","muffin","natilla","ñoño","panqueque",
      "panettone","parfait","pastel","pastel de queso","pasta frola","peras al vino","picarón","pie","pionono",
      "polvorón","ponche","pretzel","profiteroles","pudín","queque","quesillo","rocambole","rosquilla","sorbete",
      "soufflé","strudel","sundae","tarta","tartaleta","tiramisú","torta","trifle","turrón","tortita","umble",
      "vainilla","wafer","waffle","yogur","zabaglione"
    ],
    bebida: [
      "agua","agua mineral","agua tónica","aguardiente","amaretto","aperol","batido","bebida","bourbon","brandy",
      "cachaça","café","caipiriña","calimocho","capuccino","cava","cerveza","champagne","chicha","chocolate",
      "cidra","cola","cóctel","coñac","cortado","crema","daiquiri","destilado","ginebra","granadina","guarapo",
      "hidromiel","hidromel","horchata","infusión","jugo","jaibol","kalimotxo","kombucha","leche","licor",
      "limonada","macchiato","manzanilla","margarita","martini","matcha","mezcal","mojito","moscatel","néctar",
      "ouzo","pacharán","pisco","poncha","ponche","ron","sake","sangría","sidra","sirope","smoothie","soda",
      "té","tequila","ti punch","tinto de verano","tónica","vermouth","vino","vodka","whisky","yerba mate",
      "yogur","zumo"
    ],
    especia: [
      "ajedrea","ajenuz","ajo","ajowan","albahaca","alcaravea","amapola","anís","azafrán","azúcar","baya",
      "bergamota","cacao","cardamomo","canela","cebollino","cilantro","clavo","cominos","cúrcuma","curry","damasco",
      "enebro","eneldo","epazote","estragón","fenogreco","frutos rojos","galanga","garam masala","gengibre",
      "hierbabuena","hierbas finas","hinojo","hojas de laurel","hojas de tilo","jengibre","kabsa","kafir lima","laurel",
      "lavanda","lemongrass","limón","macis","mejorana","menta","mostaza","muskmelon","nuez moscada","ñoño","orégano",
      "paprika","perejil","perilla","pimienta","pimienta de cayena","pimentón","piparra","pizza","poro","quinoto",
      "ras el hanout","romero","rosa mosqueta","sal","salvia","sasafrás","sazón","sésamo","sumac","tomillo","tomato",
      "umble","vainilla","wasabi","ximenia","yuzu","zumaque"
    ],
    "cocina del mundo": [
      "africana","alemana","americana","andaluza","arabe","argentina","asiática","austriaca","belga","brasileña",
      "británica","cajún","canadiense","caribeña","catalana","central","chilena","china","colombiana","coreana",
      "criolla","cubana","danesa","ecuatoriana","egipcia","escandinava","escocesa","española","etíope","filipina",
      "francesa","galesa","gallega","griega","guatemalteca","hawaiana","holandesa","húngara","india","indonesia",
      "inglesa","irlandesa","israelí","italiana","jamaicana","japonesa","keniata","libanesa","macedonia","malaya",
      "marroquí","mediterránea","mexicana","mongol","moruna","noruega","nórdica","oaxaqueña","oriental","panameña",
      "persa","peruana","polaca","portuguesa","quebequense","rumana","rusa","salvadoreña","sefardí","siciliana",
      "siria","suiza","tailandesa","taiwanesa","texano","turca","tunecina","ucraniana","uruguaya","vasca",
      "venezolana","vietnamita","yucateca","zambiana"
    ],

    // ── Music pack ───────────────────────────────────────────────────────────
    artista: [
      "abba","adele","alanis","alejandro sanz","alicia keys","amaia","ana belén","arctic monkeys","ariana grande",
      "armin van buuren","arnaldo antunes","aterciopelados","aviation","baby","bad bunny","beatles","beyoncé",
      "billie eilish","bizarrap","björk","bon jovi","britney spears","bruno mars","calvin harris","camilo",
      "carlos vives","celine dion","chayanne","chayanne","chris brown","christian nodal","coldplay","coque",
      "daft punk","daddy yankee","david bisbal","david bowie","david guetta","dia","drake","dua lipa","ed sheeran",
      "eminem","ella fitzgerald","enrique iglesias","extremoduro","feid","fito páez","frank sinatra","gloria estefan",
      "guns n roses","green day","hozier","iron maiden","j balvin","jack white","james blunt","jay-z","jennifer lopez",
      "jesse y joy","john mayer","jonas brothers","julio iglesias","justin bieber","kanye west","karol g","katy perry",
      "kendrick lamar","ke$ha","king","la oreja de van gogh","lady gaga","lana del rey","laura pausini","lily allen",
      "linkin park","luis miguel","luis fonsi","luis r conriquez","madonna","maluma","mana","manuel turizo","marc anthony",
      "miley cyrus","muse","natanael cano","ne-yo","nirvana","oasis","olivia rodrigo","one direction","opera","peso pluma",
      "phil collins","pharrell williams","pink floyd","piso 21","pitbull","quasar","queen","ricky martin","rihanna",
      "rolling stones","rosalía","rubén blades","sabina","selena","selena gomez","shakira","shania twain","shawn mendes",
      "soda stereo","spice girls","sting","sugarhill","supersub","taylor swift","the cure","the weeknd","timberlake",
      "tigres del norte","u2","umbral","usher","vetusta morla","vicente fernández","whitney houston","wilfrido vargas",
      "xavi","yandel","ye","zoe"
    ],
    canción: [
      "abrázame","amor","amor eterno","baby","baby one more time","bailando","bohemian rhapsody","bring me to life",
      "creep","con calma","callaita","despacito","don't stop believin","ella","faded","feel good inc","frente a frente",
      "gangnam style","good 4 u","happy","hey jude","hotel california","hello","imagine","i will always love you",
      "japón","jingle bells","kiss me","kiss the rain","la bamba","la mordidita","let it be","la canción","la flaca",
      "macarena","mil veces","mi gente","mojito","montero","mr brightside","never gonna give you up","no me ames",
      "ocean eyes","old town road","ojos así","payphone","poker face","provenza","quédate","rolling in the deep",
      "rosa pastel","saoko","señorita","shake it off","shape of you","shake","ti amo","take on me","thriller",
      "thriller","tusa","unchained melody","umbrella","viva la vida","vivir mi vida","vente pa ca","waiting","wonderwall",
      "x gon give it","yellow","y volveré","yesterday","zombie"
    ],
    banda: [
      "abba","ac/dc","aerosmith","amaral","arctic monkeys","arcade fire","aterciopelados","auryn","bandalos chinos",
      "barón rojo","beatles","beach boys","beirut","ben folds","blink 182","blur","bon jovi","cafe tacuba","cafe tacvba",
      "carajo","cars","chile","chic","coldplay","creedence","dover","duran duran","el canto del loco","enanitos verdes",
      "estopa","extremoduro","fito y fitipaldis","fall out boy","foo fighters","fugees","green day","gorillaz",
      "guns n roses","heroes del silencio","imagine dragons","incubus","iron maiden","jonas brothers","jefferson airplane",
      "kasabian","kings of leon","la oreja de van gogh","la pegatina","led zeppelin","leon de greiff","linkin park",
      "los caligaris","los cafres","los enanitos verdes","los fabulosos cadillacs","los lonely boys","love of lesbian",
      "manú chao","mecano","metallica","muse","my chemical romance","nirvana","no doubt","nine inch nails","oasis",
      "oingo boingo","ocean colour scene","one direction","osmosis","panteón rococó","panic at the disco","pearl jam",
      "pink floyd","placebo","primal scream","queen","queens of the stone age","rammstein","ramones","rata blanca",
      "red hot chili peppers","r.e.m.","ride","rolling stones","scorpions","sex pistols","shakira","silvestre dangond",
      "siniestro total","skid row","sodastereo","spice girls","stone temple pilots","supertramp","sum 41","tame impala",
      "the cure","the killers","the smiths","the strokes","the weather girls","the who","u2","ultraje a rigor","vetusta morla",
      "vampire weekend","vetusta morla","weezer","wallflowers","white stripes","x japan","yes","zoé","zz top"
    ],
    instrumento: [
      "acordeón","acústica","arpa","armónica","banjo","bajo","balalaika","bandoneón","batería","bombo",
      "campana","caja","cajón","castañuelas","cello","charango","clarinete","clavecín","contrabajo","corneta",
      "cuatro","didgeridoo","didjeridoo","djembé","dulcimer","duduk","ervecería","flauta","flauta dulce","flauta traversa",
      "fagot","gaita","guitarra","glockenspiel","güira","guitarrón","hammond","harmónica","harpa","instrumento",
      "jarana","kazoo","kalimba","koto","laúd","lira","mandolina","maracas","marimba","melódica","metalófono",
      "nai","obra","oboe","ocarina","octavín","órgano","órgano","pandereta","pandeiro","percusión","piano",
      "platillos","quena","quitarra","requinto","rondador","saxofón","sintetizador","sitar","tabla","tambor",
      "tambora","tamboril","timbal","triangle","trombón","trompeta","tuba","ukelele","viola","violín","violoncelo",
      "vihuela","wah-wah","xilófono","yangqin","zampoña"
    ],
    álbum: [
      "abbey road","achtung baby","after hours","aladdin sane","american idiot","amorfoda","appetite for destruction",
      "back in black","bad","bambino","be","blackout","blonde","born to die","born to run","boys for pele",
      "californication","calypso","chinatown","circus","crazy","damn","dangerous","dark side of the moon",
      "death magnetic","dejavu","divide","done by the forces of nature","dookie","dr feelgood","dummy","el ataque","el amor",
      "el dorado","el mal querer","el viaje","encore","fever to tell","four","futura","good kid mad city","graceland",
      "hot fuss","heartstrings","horror show","houses of the holy","hounds of love","hybrid theory","i never loved a man",
      "in utero","it takes a nation","japón","joshua tree","kid a","kind of blue","la quinta estación","ladies and gentlemen",
      "led zeppelin iv","lemonade","let it be","made in lagos","master of puppets","mañana es para siempre","michael",
      "miles","minor threat","montero","my beautiful dark twisted fantasy","nevermind","never","noise","nothing else matters",
      "officium","ok computer","once","oro","paranoid android","pet sounds","persona","piano sonata","plastic ono band",
      "purpose","quando quando","rage against the machine","random access memories","ready to die","red","reload","renaissance",
      "revolver","rumours","saturday night fever","scorpions","sgt peppers","sticky fingers","superunknown","synchronicity",
      "tapestry","texas","thriller","tommy","tracy chapman","unplugged","unknown pleasures","veneer","viva la vida",
      "white album","wish you were here","yeezus","yellow submarine","yo","zooropa"
    ],
    "sello": [
      "agencia","alfa","arista","atlantic","backlot","bmg","blue note","capitol","cbs","columbia","decca",
      "def jam","disney music","dreamworks","emi","epic","fonomusic","gamma","geffen","grand royal","hispavox",
      "interscope","island","kontor","lava","love records","mercury","metalblade","ministry of sound","mute",
      "nuclear blast","octobre","odeon","one music","panda","parlophone","pias","polydor","polygram","quality control",
      "rca","reprise","rondonex","roadrunner","rounder","sire","sony","spotify","sub pop","sumerian","tempo",
      "tk","trojan","umg","universal","valle","vertigo","virgin","walt disney","warner","wea","windham","xl",
      "young money","zomba"
    ],

    // ── Science pack ─────────────────────────────────────────────────────────
    "elemento": [
      "actinio","aluminio","americio","antimonio","argón","arsénico","ástato","azufre","bario","berilio","berkelio",
      "bismuto","bohrio","boro","bromo","cadmio","calcio","californio","carbono","cerio","cesio","circonio","cloro",
      "cobalto","cobre","copernicio","cromo","curio","darmstatio","disprosio","dubnio","einstenio","erbio","escandio",
      "estaño","estroncio","europio","fermio","flúor","flerovio","fósforo","francio","gadolinio","galio","germanio",
      "hafnio","hassio","helio","hidrógeno","hierro","holmio","indio","iridio","kriptón","lantano","lawrencio",
      "litio","livermorio","lutecio","magnesio","manganeso","meitnerio","mendelevio","mercurio","molibdeno","moscovio",
      "neodimio","neón","neptunio","niobio","níquel","nitrógeno","nobelio","oganesón","osmio","oro","oxígeno",
      "paladio","plata","platino","plomo","plutonio","polonio","potasio","praseodimio","prometio","protactinio",
      "radio","radón","renio","rodio","roentgenio","rubidio","rutenio","rutherfordio","samario","seaborgio","selenio",
      "silicio","sodio","talio","tantalio","tecnecio","teluro","tennessine","terbio","titanio","torio","tulio",
      "tungsteno","uranio","vanadio","wolframio","xenón","yodo","yterbio","ytrio","zinc"
    ],
    "científico": [
      "adam smith","alan turing","albert einstein","aldrin","alessandro volta","alexander fleming","ampere","anderson",
      "antonio meucci","aristóteles","arquímedes","avogadro","bardeen","bell","bohr","boltzmann","boyle","cajal",
      "carl sagan","cavendish","celsius","chadwick","chien-shiung wu","copérnico","crick","curie","da vinci","dalton",
      "darwin","darwin","de broglie","descartes","dirac","edison","ehrlich","einstein","euler","faraday","feynman",
      "fermi","fleming","franklin","freud","galileo","galileo galilei","galvani","gauss","gell-mann","goeppert",
      "goodall","graham bell","hahn","halley","hawking","heisenberg","henry","hertz","higgs","hipócrates",
      "hooke","hubble","huygens","isaac newton","jenner","jodrell","james watt","kelvin","kepler","kerckring",
      "koch","lamarck","laplace","lavoisier","leakey","leeuwenhoek","leibniz","linneo","lord kelvin","lorentz",
      "louis pasteur","lucretius","mach","margaret mead","marie curie","maxwell","maya angelou","meitner","mendel",
      "mendeleyev","mendoza","michael faraday","mileva maric","milstein","morgan","morse","newton","nobel","ochoa",
      "ohm","oppenheimer","pascal","pasteur","pavlov","planck","platón","poincaré","ptolomeo","pythagoras","pierre curie",
      "ramón y cajal","raoult","redi","ritter","rontgen","russell","rutherford","sagan","schrodinger","semmelweis",
      "tesla","tesla","tolstoi","torricelli","torricelli","ulises","umbral","vesalio","virchow","volta","von neumann",
      "wallace","watson","watt","wegener","yates","yalow","young","zinc","zwicky"
    ],
    invento: [
      "abacus","aire acondicionado","airbag","alfabeto","ambulancia","anteojos","arado","arco","ascensor","aspirina",
      "automóvil","avión","ácido","bala","balón","barómetro","batería","bicicleta","bombilla","brújula","cafetera",
      "calculadora","cámara","carro","cerveza","cine","cohete","computadora","cuchillo","dinamita","dirigible","disco",
      "dvd","ebanistería","electricidad","electrón","elevador","escalera","escáner","escopeta","espejo","esquí",
      "estufa","estetoscopio","fonograma","fonógrafo","fotografía","fotocopia","frigorífico","fusil","gafas",
      "globo","grabadora","guitarra eléctrica","helicóptero","hierro","hilo","horno","horno microondas","hongo","imán",
      "imprenta","internet","jabón","jardín","jaula","jet","juego","kayak","lámpara","lápiz","laser","leche en polvo",
      "lente","libro","linterna","mantequilla","máquina","máquina de coser","metro","microscopio","misil","molino",
      "moneda","motocicleta","motor","navaja","nevera","ordenador","panadería","papel","paracaídas","periódico",
      "pesca","piano","pintura","pólvora","queso","radio","radar","reloj","rueda","silbato","silla","sombrero",
      "submarino","tableta","taladro","teléfono","teléfono móvil","televisión","termómetro","timón","tinta","tornillo",
      "transistor","tren","ultrasonido","vacuna","velocímetro","vidrio","walkman","xerox","yelmo","zíper"
    ],
    "planeta": [
      "alpha centauri","altair","andrómeda","antares","arcturus","betelgeuse","callisto","calixto","capella",
      "carmen","castor","ceres","cisne","cometa","constelación","copérnico","corona","cruz del sur","deimos","draco",
      "edad","eridano","encélado","enana","encefalo","éride","eros","escorpio","estrella","europa","fobos","ganimedes",
      "halley","hidra","híades","hyperion","io","júpiter","kepler","koropi","kuiper","la luna","la vía láctea","leo",
      "luna","makemake","marte","mercurio","miranda","mira","mizar","neptuno","nube","oberón","océano","orión",
      "osa mayor","osa menor","pegaso","pleiades","plutón","polaris","procyon","quaoar","rigel","saturno","sirius",
      "sirio","sol","solaris","tauro","tierra","titán","triángulo","tritón","ulises","umbriel","urano","vega",
      "venus","virgo","weddell","xena","yúgaro","zeta"
    ],
    enfermedad: [
      "alzheimer","amebiasis","amigdalitis","anemia","angina","ansiedad","apendicitis","artritis","asma","ataxia",
      "autismo","bronquitis","botulismo","brucelosis","cáncer","candidiasis","celiaca","chagas","cirrosis",
      "colera","colitis","conjuntivitis","corea de huntington","covid","dengue","depresión","dermatitis","diabetes",
      "difteria","disentería","ebola","eccema","embolia","encefalitis","epilepsia","escarlatina","escoliosis",
      "esclerosis","esquizofrenia","faringitis","fibromialgia","fiebre","flebitis","gastritis","gastroenteritis",
      "gingivitis","glaucoma","gripe","gripe aviar","helicobacter","hemofilia","hepatitis","herpes","hipertensión",
      "hipotiroidismo","ictericia","ictiosis","insomnio","insuficiencia","keratosis","kuru","lepra","leucemia",
      "linfoma","lupus","malaria","meningitis","menopausia","migraña","miopia","narcolepsia","neumonía","neuritis",
      "neuralgia","obesidad","ojeras","onicomicosis","osteoporosis","otitis","paludismo","parálisis","parkinson",
      "paperas","pneumonía","poliomelitis","poliomielitis","psoriasis","queratoconjuntivitis","queratitis",
      "rabia","resfriado","rubéola","sarampión","sida","sífilis","tétanos","tifoidea","tifus","tos ferina",
      "tuberculosis","tumor","úlcera","urticaria","varicela","viruela","vitíligo","wright","xeroftalmia","yactus",
      "zika"
    ],
    "órgano": [
      "abdomen","apéndice","aorta","arteria","articulación","bazo","bíceps","boca","bronquios","cabeza","cerebro",
      "cerebelo","clavícula","columna","corazón","córnea","costilla","craneo","cráneo","cuello","dientes","duodeno",
      "encéfalo","encías","encia","epidermis","epífisis","escapula","esófago","espalda","estómago","faringe","fémur",
      "fígado","ganglio","garganta","glándula","gónada","hígado","hipotálamo","hipófisis","hombro","hueso",
      "iris","intestino","laringe","lengua","ligamento","linfa","médula","mejilla","mente","metabolismo","miembro",
      "músculo","nariz","nervio","oído","ojo","ovario","páncreas","paratiroides","párpado","pectoral","pene","piel",
      "pierna","placenta","pleura","próstata","pulmón","quilo","retina","riñón","saco","sangre","seno","sien","tiroides",
      "tímpano","torso","tráquea","útero","uretra","uña","vejiga","vena","ventrículo","vesícula","víscera","vulva",
      "xifoides","yunque","zigoto"
    ],
    "fórmula": [
      "agua","álgebra","aleación","amoníaco","atómica","bicarbonato","binomial","binomio","cálculo","calor",
      "cinética","cloruro","co2","constante","cuadrática","densidad","derivada","dióxido","ecuación","einstein",
      "energía","entropía","etano","etanol","euler","fahrenheit","faraday","fluorita","fotosíntesis","fuerza",
      "gauss","glucosa","gravitación","hertz","hidróxido","integral","kelvin","kepler","kilo","kilogramo","kw",
      "lambert","laplace","lógica","masa","matriz","mole","newton","nitrato","ohm","onda","óxido","pascal",
      "péndulo","peso","pi","planck","poisson","polinomio","potencia","presión","rayos x","resistencia",
      "salto","seno","silicato","sulfato","temperatura","tensión","teorema","torque","trigonometría","umbral",
      "vector","velocidad","volumen","voltaje","watios","yodo","zumo"
    ],

    // ── History pack ─────────────────────────────────────────────────────────
    "personaje histórico": [
      "abraham lincoln","adolfo suárez","alejandro magno","alfonso x","ana bolena","ana frank","aníbal","aristóteles",
      "atila","augusto","benito juárez","bismarck","bolívar","bonaparte","buda","carlos i","carlos magno","carlomagno",
      "catalina la grande","cervantes","clausewitz","cleopatra","colón","cortés","churchill","da vinci","danton",
      "darío","darwin","david","de gaulle","disraeli","domiciano","edison","einstein","el cid","el greco","emiliano zapata",
      "ernesto guevara","escipión","esopo","estalin","fidel castro","felipe ii","fernando vii","franco","franklin",
      "freud","galileo","gandhi","garibaldi","gengis kan","george washington","gorbachov","goya","guerra","gutenberg",
      "haile selassie","hammurabi","helena","hitler","homero","hugo chávez","isabel i","isabel ii","isabela la católica",
      "iván el terrible","jefferson","jeronimo","juana de arco","julio césar","kennedy","khan","kim il-sung","kipchak",
      "kruschev","la malinche","lenín","leonardo","leonardo da vinci","liszt","luis xiv","macedonio","magallanes","mandela",
      "mao zedong","martín lutero","marco polo","mata hari","maradona","marx","matías","menelaus","mendes pinto",
      "mendoza","miguel ángel","moisés","montezuma","mussolini","nelson mandela","newton","napoleón","napoleón bonaparte",
      "nerón","nietzsche","obama","odisea","osmán","otelo","oviedo","pablo neruda","pancho villa","perón","pitágoras",
      "pizarro","platón","ptolomeo","quevedo","quirino mendoza","reinaldo","ricardo corazón de león","robespierre",
      "rommel","roosevelt","san agustín","san francisco","san pedro","sebastián","séneca","shakespeare","simón bolívar",
      "smetana","sócrates","stalin","sucre","sun tzu","talleyrand","teodoro","thomas más","tito","trajano","trotski",
      "trump","tutankamón","umar","unamuno","valera","velázquez","veronés","vicente fox","vasco da gama","vespucio",
      "voltaire","washington","whitney","wittgenstein","xerxes","yamamoto","yeltsin","yolanda díaz","yuri gagarin",
      "zapata","zoroastro"
    ],
    batalla: [
      "ad decimum","actium","afganistán","alarcos","álcacer","alesia","aliados","alma","ardenas","austerlitz",
      "ayacucho","bailén","barrancas","batalla","bedriacum","beresina","berlín","blitzkrieg","borodinó","boyacá",
      "boyne","brunete","bucarest","caballería","calais","cannas","carabobo","caudine forks","cerro de las campanas",
      "challenger","champagne","chequia","chichimeca","ciudad real","civitate","clontarf","cordillera","creta",
      "covadonga","crimea","crécy","cuauhtémoc","danubio","danubio","desierto","dien bien phu","dunas","edesa","el cid",
      "el alamein","el ebro","el escorial","empel","esfacelo","ester","ewa","francia","fuente la rápita","filipinas",
      "gallípoli","gettysburg","granada","guadalcanal","guadalajara","guadalete","guernica","guerra","habsburgo",
      "hastings","hattin","heraklion","hidalpico","hidaspes","hispania","hispaniola","hue","ica","ifni","irak","iraq",
      "issy","issus","italia","jueves santo","julio","junín","jutlandia","kabul","kanagawa","karbala","kortrijk",
      "kursk","la corte","la marne","las navas","lepanto","leningrado","leuctra","leyte","lieja","liechtenstein",
      "lobos","lodi","luchas","macedonia","madrid","manaure","maratón","margarita","maya","megido","milvian",
      "monterrey","monte cassino","moscú","navarino","navarra","negro","ngwe","nilo","ningbo","nueva orleans",
      "okinawa","oporto","órdenes","pacífico","palermo","panamá","pangloss","pantanal","panipat","passchendaele",
      "pasiones","pavia","pearl harbor","peleliu","perú","piedras","poltava","praga","puebla","quebec","quemado",
      "queretaro","ravenna","reyes","rocroi","sabbioneta","salaminas","salamis","san jacinto","santiago","sarajevo",
      "sedán","sevastopol","sicilia","sirte","somalia","somme","stalingrado","stamford","sudbury","tannenberg",
      "tanga","tarapacá","tarawa","teruel","teutonia","texcoco","themistocles","timor","toba","tora bora","trafalgar",
      "trent","ulmen","ulm","uruguay","urvina","valmy","valverde","vargas","vega","vendée","venezuela","verdún",
      "vigo","viena","volveniere","waterloo","westminster","ypres","yorktown","ypsilanti","yser","ysleta","zama",
      "zaragoza","zenta","ziphmir","zorndorf"
    ],
    imperio: [
      "akadio","aksum","alemán","aqueménida","aragón","argelia","aragonés","ática","austrohúngaro","azteca",
      "babilonio","bizantino","británico","cártago","cartaginés","celta","chino","colombo","cretense","danés",
      "dinamarca","egipcio","emirato","español","estado pontificio","etrusco","etíope","francés","fenicio","francés",
      "francés","franco","ghana","gótico","griego","gupta","han","helénico","hispano","hispánico","hitita","holandés",
      "hunno","ibérico","incaico","incas","ingles","inglés","iraní","japonés","jaurón","kuomintang","khmer","kushán",
      "lacedemonio","lechita","liechtenstein","lombardo","macedonio","mali","macedón","marroquí","maya","minoico",
      "mongol","mughal","nabateo","nabateos","napoleónico","neobabilónico","normando","numidio","omeyas","otomano",
      "ottomano","palmireno","panónico","parto","persa","portugués","ptolemaico","ptolemeo","qing","quénia","romano",
      "ruso","sasánida","sajón","seleucida","selyucida","selímida","serbio","shang","sirio","soviético","sueco",
      "sumerio","tang","timúrida","timur","tracio","turco","umayyad","urartu","valois","veneciano","vietnamita",
      "visigodo","wadai","wari","ximango","yamato","yoruba","yuan","zande","zulú"
    ],
    invención: [
      "agua corriente","aire acondicionado","alambrada","alfombra","alfabeto","ambulancia","anillo","arado","arco",
      "armadura","ascensor","aspirina","automóvil","avión","balanza","bandera","barómetro","biblioteca","bicicleta",
      "billete","binoculares","bombilla","brújula","cafetera","calculadora","cámara","carro","cerillo","ciudad",
      "cohete","computadora","cubierta","dirigible","disco","dvd","ebanistería","electricidad","escuela","escopeta",
      "espada","espejo","estampilla","estetoscopio","estufa","fonógrafo","fotografía","fusil","gafas","globo",
      "grabadora","guitarra","helicóptero","hilo","horno","imprenta","internet","jabón","jardín","kayak","lámpara",
      "lápiz","libro","linterna","mantequilla","máquina","mapa","martillo","metro","microscopio","misil","molino",
      "moneda","motor","navaja","ordenador","papel","paracaídas","periódico","pesca","piano","pintura","pólvora",
      "queso","radio","reloj","rueda","silbato","sofá","submarino","taladro","teléfono","televisión","termómetro",
      "timón","tinta","tornillo","tren","ultrasonido","vacuna","vidrio","walkman","xerox","yelmo"
    ],
    revolución: [
      "africana","agraria","alemana","americana","apostólica","árabe","argelina","azerí","balcánica","bolchevique",
      "bolivariana","budista","carlista","catalana","china","clavel","comunista","conservadora","constitucional",
      "copernicana","cubana","danesa","democrática","digital","educativa","egipcia","escandinava","española",
      "espartaquista","estonia","etíope","feminista","filipina","finlandesa","francesa","georgiana","glorious",
      "gloriosa","griega","guatemalteca","haitiana","helénica","hindi","holandesa","húngara","independencia",
      "industrial","inglesa","irlandesa","islámica","italiana","jasmín","jaracaranda","jugoslava","keniata","lechera",
      "liberal","libia","liechtenstein","lituana","macedonia","maoísta","mexicana","mongola","naranja","nepalí",
      "nicaragüense","nórdica","obrera","olímpica","pacífica","panameña","panárabe","peruana","polaca","popular",
      "portuguesa","quechua","quesera","quiteña","quiróptera","reformista","religiosa","republicana","rosa","rumana",
      "rusa","saharaui","salvadoreña","saudí","sandinista","serbia","siglo de oro","silente","silvestre","social",
      "socialista","tailandesa","textil","tunecina","turca","ucraniana","uruguaya","uzbeka","velvet","venezolana",
      "verde","vietnamita","wahabita","yemení","yugoslava","zapatista","zonghua"
    ],
    tratado: [
      "alfonsino","aix-la-chapelle","amiens","amistad","aquisgrán","aristóteles","aviñón","badajoz","barcelona","basilea",
      "berlín","bonn","brest-litovsk","bruselas","bucarest","budapest","cabo verde","camp david","campo formio","ciudad real",
      "constantinopla","copenhague","córdoba","cracovia","cretas","dayton","dresde","ducal","dublín","edimburgo","elba","emden",
      "eslovaquia","estocolmo","extremadura","fátima","fontainebleau","fortalecimiento","frankfurt","gante","ginebra",
      "guadalupe-hidalgo","guimarães","habsburgo","hamburgo","hispano","hubertusburg","igualdad","imperial","interbús",
      "interlaken","jaén","japonés","kárlowitz","kársten","kiel","kilkenny","kolomna","la haya","libre comercio",
      "lisboa","londres","lucerne","luneville","luxemburgo","madrid","maastricht","milán","montreal","moscú","múnich",
      "nymphenburg","oliva","oporto","orange","oslo","pandectas","parís","paz","plenitudes","plovdiv","portsmouth","praga",
      "qajar","rapallo","ratisbona","río","ribbentrop-molotov","ribbentropp","rin","roma","rusia","saavedra lamas","saint-cloud",
      "saint-germain","san stefano","santo domingo","sevres","shimoda","sindán","stresa","stresemann","sykes-picot","tafna",
      "thessalia","tilsit","tlatelolco","tordesillas","torino","trianon","troyes","ucrania","unión","unión europea","utrecht",
      "valencia","valladolid","valloncellis","vereeniging","versalles","vichy","viena","vincennes","wales","westfalia",
      "windsor","worms","yokosuka","ypres","zacatecas","zaragoza","zhejiang"
    ],
    monarca: [
      "alarico","alejandro magno","alejo","alejandro","alfonso x","alfonso xiii","amaru","amenofis","amenofis iii",
      "ana bolena","artaxerxes","arturo","atahualpa","attila","augusto","balduino","beatriz","benigno","blanca",
      "bolívar","brunilda","calígula","carlos i","carlos magno","carlomagno","carlos","carlos v","catalina","catalino",
      "cleopatra","cnut","cuauhtémoc","claudio","claudio césar","constantino","cristóbal","ciro","ciro el grande",
      "darío","darío i","david","domiciano","eduardo","elagábalo","enrique iv","enrique viii","ernesto","escipión",
      "eteocles","fátima","felipe ii","fernando","fernando vii","francisco","francisco josé","gengis kan","george iii",
      "godofredo","gonzalo","gustavo","gunbei","henrique","henry","heraclio","hidalgo","horacio","huayna cápac",
      "ibrahim","iván","iván el terrible","jaime","jorge","juan","juan carlos","juana","juana de arco","juliano","julio césar",
      "kublai khan","kamehameha","kapilavastu","luis","luis ix","luis xiv","manuel","manco capac","marco aurelio","matías",
      "milcíades","milcríades","muley","murat","montezuma","nabucodonosor","napoleón","nerón","numa pompilio","octaviano",
      "olav","oliva","oraciano","ottón","pacal","papa","pedro","pedro el grande","pepín","píndaro","pizarro","plotino",
      "ptolomeo","puente","quetzalcóatl","ramsés","rasputin","reyes","ricardo","ricardo i","ricardo iii","robespierre",
      "rodolfo","rodrigo","rómulo","rurik","saladino","salomon","sancho","sancho iv","sebastián","selim","selim i",
      "siavash","silvio","simón bolívar","simón de petlura","sócrates","solomón","stephen","sumeru","suleimán","tarquin",
      "thomas","tiberio","tito","trajano","trantor","tutankamón","umar","urico","valentiniano","vasco da gama",
      "vespasiano","vicente fox","victorino","victoria","vladimiro","wladislao","yago","yi","ymrón","yvain","zacarías",
      "zorobabel"
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

// ─── Strict categories ────────────────────────────────────────────────────────
// These are the only categories whose player answers must be in the dictionary.
// Any other category (including all themed-pack categories) is lenient and
// accepts any word ≥ 3 chars; their dictionaries exist primarily for the AI.
const STRICT_CATEGORIES = new Set([
  "animal","color","fruta",                // es
  "animal","color","fruit",                // en
  "animal","cor","fruta",                  // pt
  "animal","couleur","fruit",              // fr
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
    .replace(/[^a-z~\s]/g, "")        // strip numbers, emojis, symbols
    .replace(/\s+/g, " ")             // collapse multiple spaces into one
    .replace(/~/g, "ñ")               // restore ñ
    .trim();
}

/** Hard limits to prevent abuse: max 60 chars, must contain a real letter, no absurd repetitions */
function isSafeInput(word: string): boolean {
  if (!word || word.trim().length === 0) return false;
  if (word.length > 60) return false;
  if (!/[a-záéíóúàèìòùäëïöüñ]/i.test(word)) return false;
  // Reject keyboard-mashing: 4+ consecutive identical characters (e.g. "aaaa", "bbbbb")
  if (/(.)\1{3,}/.test(word.toLowerCase())) return false;
  return true;
}

function findCategoryWords(langDict: Record<string, string[]>, category: string): string[] {
  const norm = normalizeWord(category);
  // 1) Exact match wins
  for (const [key, words] of Object.entries(langDict)) {
    if (normalizeWord(key) === norm) return words;
  }
  // 2) Otherwise pick the LONGEST key that overlaps as a prefix in either direction.
  // This avoids "personaje histórico" matching the shorter cinema key "personaje".
  let best: { key: string; words: string[] } | null = null;
  for (const [key, words] of Object.entries(langDict)) {
    const normKey = normalizeWord(key);
    if (norm.startsWith(normKey) || normKey.startsWith(norm)) {
      if (!best || normKey.length > normalizeWord(best.key).length) {
        best = { key, words };
      }
    }
  }
  return best ? best.words : [];
}

function isWordValid(word: string, letter: string, category: string, language = "es"): boolean {
  if (!isSafeInput(word)) return false;

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

  // No dictionary found for this category → accept any word ≥ 3 chars
  if (categoryWords.length === 0) return normalizedWord.length >= 3;

  // Check if word matches or is a variation of any dictionary word
  const inDict = categoryWords.some(w => {
    const nw = normalizeWord(w);
    return nw === normalizedWord ||
      normalizedWord.startsWith(nw) ||   // e.g. "rosado" starts with "rosa" ✓
      nw.startsWith(normalizedWord);     // e.g. "ro" prefix of "rojo" ✓
  });
  if (inDict) return true;

  // Lenient fallback: only categories listed in STRICT_CATEGORIES (animal, color, fruta...)
  // require strict dictionary membership. All other category dictionaries exist primarily
  // so the AI has vocabulary; players can answer with any word ≥ 3 chars.
  if (STRICT_CATEGORIES.has(normCategory)) return false;
  return normalizedWord.length >= 3;
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

// 🕵️ Espía / Robar respuesta — peek at one possible AI word for a category.
// Returns a candidate (not the exact final word, since AI eval is randomized).
router.get("/peek", (req, res) => {
  const letter = String(req.query.letter || "").trim();
  const category = String(req.query.category || "").trim();
  const language = String(req.query.language || "es");
  if (!letter || !category) {
    res.status(400).json({ error: "letter and category required" });
    return;
  }
  const word = getAiWord(letter, category, language);
  res.json({ word });
});

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
