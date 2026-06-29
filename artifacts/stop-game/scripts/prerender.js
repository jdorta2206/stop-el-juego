import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

const pages = [
  {
    route: 'como-jugar',
    title: 'Cómo jugar a STOP - Reglas oficiales, estrategias y trucos',
    description: 'Aprende las reglas de STOP, el juego de palabras por categorías. Descubre estrategias avanzadas, trucos para ganar y domina el juego con nuestra guía completa.',
    content: `
      <h1>Cómo jugar a STOP: Guía completa para principiantes y expertos</h1>
      
      <p>STOP es un juego de palabras por categorías que combina agilidad mental, creatividad y rapidez. El objetivo es completar todas las categorías con palabras que empiecen por una letra determinada antes de que tus oponentes terminen. En esta guía te explicamos todas las reglas, estrategias avanzadas y trucos para que te conviertas en un maestro de STOP.</p>
      
      <h2>¿Qué es STOP y por qué es tan adictivo?</h2>
      <p>STOP, también conocido como "Basta", "¡Alto!" o "Tutti Frutti", es un juego clásico que ha entretenido a generaciones. La versión digital que ofrecemos en stopjuegodepalabras.com mantiene la esencia del juego original pero añade funcionalidades modernas como multijugador online, ranking global, partidas contra la IA y modos de juego exclusivos.</p>
      <p>La dinámica es sencilla: se elige una letra al azar y cada jugador debe escribir una palabra en cada categoría que empiece por esa letra. El primero en completar todas las categorías grita "STOP" y todos dejan de escribir. Las palabras se puntúan según su originalidad: si varios jugadores escriben la misma palabra, ninguno suma puntos en esa categoría. Las palabras únicas otorgan la máxima puntuación.</p>
      
      <h2>Reglas básicas del juego</h2>
      <p>Antes de empezar a jugar, es importante que conozcas las reglas fundamentales de STOP:</p>
      <ul>
        <li><strong>Número de jugadores:</strong> Puedes jugar solo contra la IA, en partidas privadas con amigos o en partidas públicas con jugadores de todo el mundo.</li>
        <li><strong>Categorías:</strong> Las categorías pueden variar según la partida. Algunas de las más comunes son: Nombres, Países, Animales, Colores, Profesiones, Deportes, Comida, entre otras.</li>
        <li><strong>Letra inicial:</strong> Se selecciona una letra aleatoria. Todos los jugadores deben escribir palabras que comiencen con esa letra en cada categoría.</li>
        <li><strong>Tiempo límite:</strong> El juego tiene un temporizador de 60 segundos. Si nadie dice STOP antes de que termine el tiempo, todos dejan de escribir y se puntúa lo que hayan escrito.</li>
        <li><strong>Puntuación:</strong> Cada palabra única otorga 10 puntos. Si dos o más jugadores escriben la misma palabra, ninguno recibe puntos en esa categoría.</li>
      </ul>
      
      <h2>Estrategias avanzadas para ganar en STOP</h2>
      <p>Si quieres subir en el ranking global y convertirte en un jugador legendario, necesitas dominar estas estrategias avanzadas:</p>
      
      <h3>1. Amplía tu vocabulario</h3>
      <p>El primer paso para ganar en STOP es tener un vocabulario amplio. Lee libros, artículos y diccionarios. Aprende palabras poco comunes en cada categoría. Por ejemplo, para la categoría "Animales", no te limites a "perro" o "gato"; explora animales exóticos como "ornitorrinco", "equidna" o "axolotl". Estas palabras únicas te darán una ventaja sobre tus oponentes.</p>
      
      <h3>2. Piensa rápido y prioriza</h3>
      <p>En STOP, la velocidad es clave. Cuando empiece la partida, prioriza las categorías donde tengas más conocimiento y deja para el final las que te resulten más difíciles. Si te quedas atascado en una categoría, pasa a la siguiente y vuelve más tarde. El temporizador es tu aliado, pero también puede ser tu peor enemigo.</p>
      
      <h3>3. Conoce a tus oponentes</h3>
      <p>Si juegas contra los mismos jugadores con frecuencia, aprende sus patrones. ¿Suelen escribir palabras comunes? ¿Tienen un vocabulario limitado en ciertas categorías? Usa esa información a tu favor. Si sabes que tu oponente siempre escribe "España" en la categoría "Países", puedes arriesgarte con "Eslovenia" para sumar más puntos.</p>
      
      <h3>4. Utiliza palabras compuestas y derivados</h3>
      <p>Las palabras compuestas y los derivados pueden ser tus mejores aliados. Por ejemplo, en la categoría "Profesiones", en lugar de "médico", puedes escribir "medicina" si la letra es M. Aunque "medicina" no es una profesión en sí, es un campo de estudio relacionado, y si tus oponentes no la escriben, sumarás puntos.</p>
      
      <h3>5. Controla el ritmo del juego</h3>
      <p>No siempre es bueno decir STOP demasiado rápido. Si completas todas las categorías en los primeros segundos, es probable que hayas usado palabras muy comunes que tus oponentes también hayan escrito. Espera un poco, deja que tus oponentes se arriesguen con palabras únicas y luego di STOP cuando estés seguro de que tus respuestas son originales.</p>
      
      <h2>Modos de juego en stopjuegodepalabras.com</h2>
      <p>Nuestra plataforma ofrece varios modos de juego para que nunca te aburras:</p>
      <ul>
        <li><strong>Modo Solitario:</strong> Juega contra la IA en diferentes niveles de dificultad. Perfecto para practicar y mejorar tu vocabulario.</li>
        <li><strong>Partidas Rápidas:</strong> Encuentra oponentes aleatorios de todo el mundo en partidas de 2 a 4 jugadores.</li>
        <li><strong>Partidas Privadas:</strong> Crea una sala y juega con tus amigos. Ideal para reuniones familiares o noches de juegos.</li>
        <li><strong>Torneos:</strong> Participa en torneos semanales y compite por premios exclusivos y posiciones en el ranking global.</li>
      </ul>
      
      <h2>Preguntas frecuentes sobre STOP</h2>
      <p><strong>¿Necesito registrarme para jugar?</strong> Puedes jugar como invitado, pero si te registras podrás guardar tu progreso, participar en torneos y aparecer en el ranking global.</p>
      <p><strong>¿El juego es gratuito?</strong> STOP es gratuito en su versión básica. También ofrecemos un plan premium con ventajas exclusivas como eliminación de anuncios, acceso a estadísticas avanzadas y modo de juego sin conexión.</p>
      <p><strong>¿Puedo jugar desde mi móvil?</strong> Sí, nuestra plataforma está completamente optimizada para dispositivos móviles. También tenemos una aplicación disponible en Google Play.</p>
      <p><strong>¿Qué pasa si otro jugador escribe la misma palabra que yo?</strong> Si dos o más jugadores escriben la misma palabra en la misma categoría, ninguno recibe puntos por esa categoría. Por eso es importante buscar palabras originales.</p>
      
      <h2>Conclusión</h2>
      <p>STOP es mucho más que un simple juego de palabras. Es una herramienta para ejercitar la mente, aprender nuevas palabras y compartir momentos divertidos con amigos y familiares. Con las estrategias que te hemos compartido en esta guía, estarás listo para dominar cualquier partida y escalar posiciones en el ranking global. ¡No esperes más y únete a la comunidad de stopjuegodepalabras.com!</p>
    `
  },
  {
    route: 'acerca',
    title: 'Acerca de STOP - Nuestra historia, misión y equipo',
    description: 'Conoce la historia detrás de STOP, nuestro equipo, nuestra misión y por qué creamos este juego de palabras online. Descubre todo sobre nosotros.',
    content: `
      <h1>Acerca de STOP: La historia detrás del juego de palabras definitivo</h1>
      
      <p>STOP nació como un proyecto personal para revivir el clásico juego de lápiz y papel que tantas horas de diversión nos ha dado. Nuestra misión es llevar la emoción de STOP al mundo digital, conectando a jugadores de todas las edades y culturas a través de las palabras.</p>
      
      <h2>Nuestra historia</h2>
      <p>Todo comenzó en 2024, cuando un grupo de amigos apasionados por los juegos de mesa decidió crear una versión online de STOP. Queríamos capturar la esencia del juego tradicional: la emoción de encontrar la palabra perfecta, la tensión de los segundos finales y la alegría de compartir partidas con amigos. Después de meses de desarrollo y pruebas, lanzamos la primera versión de stopjuegodepalabras.com.</p>
      <p>Desde entonces, hemos crecido exponencialmente. Miles de jugadores de más de 50 países han disfrutado de nuestras partidas, y nuestra comunidad sigue creciendo día a día. Hemos añadido nuevas funcionalidades, mejorado la experiencia de usuario y optimizado el rendimiento para que todos puedan disfrutar del juego sin interrupciones.</p>
      
      <h2>Nuestra misión</h2>
      <p>En STOP, creemos que las palabras tienen el poder de conectar a las personas. Nuestra misión es crear un espacio donde jugadores de todo el mundo puedan divertirse, aprender y competir en un entorno seguro y amigable. Queremos fomentar el aprendizaje de nuevas palabras, estimular la creatividad y promover el juego limpio y la deportividad.</p>
      <p>Además, estamos comprometidos con la accesibilidad. Nuestra plataforma está diseñada para ser intuitiva y fácil de usar, independientemente de la edad o el nivel de habilidad. También ofrecemos modos de juego adaptados para personas con discapacidades visuales y auditivas, para que todos puedan participar.</p>
      
      <h2>Nuestro equipo</h2>
      <p>Detrás de STOP hay un equipo diverso y talentoso de desarrolladores, diseñadores, lingüistas y entusiastas de los juegos. Cada uno de nosotros aporta su pasión y experiencia para hacer de STOP la mejor experiencia de juego de palabras online.</p>
      <ul>
        <li><strong>Juan Dorta (CEO y Fundador):</strong> Apasionado de los juegos de palabras y la tecnología, Juan lidera el proyecto con una visión clara: crear un juego que una a las personas.</li>
        <li><strong>María García (Lead Developer):</strong> Especialista en desarrollo web y aplicaciones móviles, María se encarga de que STOP funcione sin problemas en todos los dispositivos.</li>
        <li><strong>Carlos López (Diseñador UX/UI):</strong> Carlos asegura que la interfaz sea atractiva e intuitiva para todos los usuarios.</li>
        <li><strong>Ana Martínez (Community Manager):</strong> Ana gestiona la comunidad de jugadores, organiza torneos y eventos, y asegura que todos los jugadores tengan una experiencia positiva.</li>
      </ul>
      
      <h2>¿Por qué elegir STOP?</h2>
      <p>Hay muchas razones para elegir STOP como tu juego de palabras favorito:</p>
      <ul>
        <li><strong>Juego gratuito y accesible:</strong> La versión básica es completamente gratuita. Ofrecemos planes premium para aquellos que quieran una experiencia mejorada.</li>
        <li><strong>Multijugador online:</strong> Juega con amigos o con jugadores de todo el mundo en tiempo real.</li>
        <li><strong>Modo offline contra la IA:</strong> Perfecto para practicar sin necesidad de conexión a internet.</li>
        <li><strong>Ranking global:</strong> Compite por la primera posición en nuestro ranking y demuestra quién es el mejor jugador de STOP.</li>
        <li><strong>Actualizaciones constantes:</strong> Estamos siempre añadiendo nuevas categorías, modos de juego y funcionalidades para mantener la experiencia fresca y emocionante.</li>
      </ul>
      
      <h2>Compromiso con la calidad</h2>
      <p>Nos tomamos muy en serio la calidad de nuestro juego. Cada actualización pasa por un riguroso proceso de pruebas para garantizar que no haya errores y que la experiencia del usuario sea impecable. Además, valoramos los comentarios de nuestra comunidad y los utilizamos para mejorar continuamente.</p>
      <p>Si tienes alguna sugerencia o idea para mejorar STOP, no dudes en contactarnos. Estamos siempre abiertos a nuevas propuestas y colaboraciones.</p>
      
      <h2>Unete a nuestra comunidad</h2>
      <p>Más de 50,000 jugadores ya se han unido a STOP. Únete a ellos y descubre por qué este juego de palabras se ha convertido en el favorito de tantas personas. Síguenos en nuestras redes sociales para estar al día de las últimas novedades, torneos y eventos.</p>
    `
  },
  {
    route: 'blog',
    title: 'Blog de STOP - Estrategias, trucos, noticias y actualizaciones',
    description: 'Descubre artículos exclusivos sobre STOP: estrategias para ganar, trucos avanzados, noticias sobre actualizaciones y análisis de juego. Todo lo que necesitas saber.',
    content: `
      <h1>Blog de STOP: Estrategias, trucos y todo sobre el juego de palabras</h1>
      
      <article>
        <h2>Estrategias para ganar en STOP: Guía definitiva para 2026</h2>
        <p>En este artículo te revelamos las estrategias más efectivas para ganar en STOP, basadas en el análisis de miles de partidas jugadas en nuestra plataforma.</p>
        <h3>La importancia del vocabulario</h3>
        <p>El vocabulario es la base de STOP. Cuantas más palabras conozcas, más opciones tendrás para encontrar palabras únicas. Nuestro consejo: dedica al menos 10 minutos al día a aprender nuevas palabras. Puedes usar diccionarios online, apps de vocabulario o incluso jugar a otros juegos de palabras para ampliar tu léxico.</p>
        <h3>Estrategias para cada categoría</h3>
        <p>En STOP, no todas las categorías son iguales. Algunas son más fáciles de completar que otras. Por ejemplo, la categoría "Nombres" suele ser más sencilla porque hay una gran cantidad de nombres que empiezan con cualquier letra. Sin embargo, categorías como "Deportes" o "Colores" pueden ser más limitadas. Nuestro consejo: practica con cada categoría y aprende las palabras más comunes y las menos comunes para estar preparado en cualquier partida.</p>
        <p>Te dejamos una lista de palabras clave por categoría que puedes usar como referencia:</p>
        <ul>
          <li><strong>Nombres:</strong> Alejandro, Ana, Antonio, Beatriz, Carlos, Carmen, David, Elena, Fernando, Gloria, Héctor, Irene, Javier, Laura, Manuel, Nuria, Óscar, Patricia, Raúl, Sofía, Teresa, Víctor, Yolanda, Zacarías.</li>
          <li><strong>Países:</strong> Afganistán, Albania, Alemania, Andorra, Angola, Argentina, Australia, Austria, Bélgica, Bolivia, Brasil, Bulgaria, Canadá, Chile, China, Colombia, Corea, Costa Rica, Croacia, Dinamarca, Ecuador, Egipto, España, Estados Unidos, Etiopía, Finlandia, Francia, Grecia, Guatemala, Honduras, Hungría, India, Indonesia, Irán, Irak, Irlanda, Islandia, Israel, Italia, Jamaica, Japón, Jordania, Kenia, Kuwait, Laos, Líbano, Luxemburgo, México, Nicaragua, Nigeria, Noruega, Nueva Zelanda, Países Bajos, Panamá, Paraguay, Perú, Polonia, Portugal, Qatar, Reino Unido, República Dominicana, Rumanía, Rusia, Senegal, Serbia, Singapur, Siria, Sudáfrica, Suecia, Suiza, Tailandia, Taiwán, Tanzania, Turquía, Ucrania, Uruguay, Venezuela, Vietnam, Zambia, Zimbabue.</li>
          <li><strong>Animales:</strong> Abeja, Águila, Alacrán, Alpaca, Ardilla, Armadillo, Babuino, Ballena, Búfalo, Caballo, Cangrejo, Canguro, Camello, Cocodrilo, Conejo, Delfín, Elefante, Erizo, Foca, Gacela, Gorila, Hipopótamo, Iguana, Jabalí, Jirafa, Lince, Llama, Lobo, Marmota, Narval, Ñandú, Oso, Oveja, Paloma, Pato, Pavo, Perro, Rana, Ratón, Rinoceronte, Salamandra, Serpiente, Tigre, Topo, Tucán, Vaca, Yegua, Zorro.</li>
          <li><strong>Colores:</strong> Amarillo, Azul, Blanco, Café, Celeste, Cian, Cobre, Coral, Crema, Escarlata, Fucsia, Gris, Lila, Magenta, Marfil, Marrón, Menta, Naranja, Negro, Ocre, Oro, Púrpura, Rojo, Rosa, Violeta, Verde.</li>
          <li><strong>Profesiones:</strong> Abogado, Actor, Administrador, Aeromoza, Agricultor, Albañil, Arquitecto, Artista, Astronauta, Banquero, Barbero, Biólogo, Bombero, Botánico, Cazador, Científico, Chef, Cirujano, Contador, Criminalista, Dentista, Diseñador, Doctor, Economista, Enfermero, Escritor, Farmacéutico, Filósofo, Físico, Florista, Fotógrafo, Ginecólogo, Guardia, Historiador, Ingeniero, Jardinero, Joyero, Juez, Jurista, Mago, Mecánico, Médico, Minero, Músico, Notario, Nutricionista, Oftalmólogo, Operador, Orfebre, Panadero, Periodista, Pescador, Piloto, Policía, Político, Psicólogo, Químico, Relojero, Sacerdote, Soldado, Técnico, Terapeuta, Traductor, Veterinario, Vigilante, Zapatero.</li>
        </ul>
        <h3>Trucos para ganar en STOP</h3>
        <p>Además de conocer palabras, hay otros trucos que te pueden dar ventaja:</p>
        <ul>
          <li><strong>Lee las categorías antes de empezar:</strong> Tómate unos segundos para familiarizarte con las categorías. Si ves que hay una categoría que te resulta difícil, prioriza las demás y deja esa para el final.</li>
          <li><strong>No te obsesiones con la primera palabra:</strong> Si se te ocurre una palabra, escríbela, pero si después piensas en otra mejor, puedes cambiarla (siempre que no haya terminado el tiempo).</li>
          <li><strong>Usa sinónimos:</strong> Si la palabra que has escrito es muy común, piensa en un sinónimo menos común. Por ejemplo, en lugar de "coche", escribe "vehículo", "automóvil" o "carro".</li>
          <li><strong>Practica con la IA:</strong> El modo solitario contra la IA es perfecto para practicar sin presión. La IA tiene diferentes niveles de dificultad, así que puedes empezar con el nivel más fácil e ir aumentando la dificultad a medida que mejoremos.</li>
        </ul>
        <p>Con estos consejos, estarás listo para convertirte en un maestro de STOP. ¡Suerte en tus partidas!</p>
      </article>
      
      <article>
        <h2>Actualización de STOP: Nuevas categorías y modo torneo</h2>
        <p>Estamos emocionados de anunciar la última actualización de STOP, que incluye 10 nuevas categorías y un emocionante modo torneo. Ahora puedes competir en torneos semanales con jugadores de todo el mundo y ganar premios exclusivos.</p>
        <p>Las nuevas categorías incluyen: "Bebidas", "Instrumentos musicales", "Marca de coches", "Equipos de fútbol", "Películas", "Ciudades", "Elementos químicos", "Dioses mitológicos", "Monedas del mundo" y "Inventos". Con estas nuevas categorías, el juego se vuelve aún más variado y desafiante.</p>
        <p>El modo torneo es una de las novedades más esperadas por nuestra comunidad. Cada semana, los jugadores pueden inscribirse en torneos de hasta 64 participantes. Los torneos se juegan en formato eliminatorio, y el ganador recibe un premio en metálico, así como un trofeo virtual que aparecerá en su perfil.</p>
        <p>Además, hemos mejorado el sistema de emparejamiento para que las partidas sean más equilibradas y justas. Ahora, los jugadores son emparejados según su nivel de habilidad, lo que garantiza partidas más emocionantes y competitivas.</p>
        <p>No olvides actualizar tu aplicación para disfrutar de todas estas novedades. ¡Te esperamos en los torneos!</p>
      </article>
      
      <article>
        <h2>Cómo mejorar tu vocabulario para STOP en 7 días</h2>
        <p>En este artículo, te proponemos un plan de 7 días para mejorar tu vocabulario y dominar STOP. Sigue estos pasos y verás resultados en poco tiempo.</p>
        <p><strong>Día 1:</strong> Lee un artículo de un periódico o revista y subraya todas las palabras que no conoces. Busca su significado y escríbelas en una libreta.</p>
        <p><strong>Día 2:</strong> Juega a STOP contra la IA en modo fácil. Concéntrate en usar palabras nuevas que hayas aprendido el día anterior.</p>
        <p><strong>Día 3:</strong> Lee un libro o novela. Busca palabras poco comunes y anótalas.</p>
        <p><strong>Día 4:</strong> Practica con un diccionario de sinónimos. Aprende al menos 3 sinónimos de 5 palabras que uses con frecuencia.</p>
        <p><strong>Día 5:</strong> Juega a STOP en modo difícil contra la IA. Trata de usar palabras menos comunes en cada categoría.</p>
        <p><strong>Día 6:</strong> Participa en partidas rápidas contra otros jugadores. Observa las palabras que usan y aprende de ellas.</p>
