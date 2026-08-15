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
      <h2>Nuestro equipo</h2>
      <p>Detrás de STOP hay un equipo diverso y talentoso de desarrolladores, diseñadores, lingüistas y entusiastas de los juegos. Cada uno de nosotros aporta su pasión y experiencia para hacer de STOP la mejor experiencia de juego de palabras online.</p>
      <h2>Compromiso con la calidad</h2>
      <p>Nos tomamos muy en serio la calidad de nuestro juego. Cada actualización pasa por un riguroso proceso de pruebas para garantizar que no haya errores y que la experiencia del usuario sea impecable.</p>
    `
  },
  {
    route: 'blog',
    title: 'Blog de STOP - Estrategias, trucos, noticias y actualizaciones',
    description: 'Descubre artículos exclusivos sobre STOP: estrategias para ganar, trucos avanzados, noticias sobre actualizaciones y análisis de juego.',
    content: `
      <h1>Blog de STOP: Estrategias, trucos y todo sobre el juego de palabras</h1>
      <article>
        <h2>Estrategias para ganar en STOP</h2>
        <p>El vocabulario es la base de STOP. Cuantas más palabras conozcas, más opciones tendrás para encontrar respuestas únicas. Practica con cada categoría y aprende palabras comunes y menos comunes.</p>
        <h3>Trucos para ganar</h3>
        <ul>
          <li><strong>Lee las categorías antes de empezar:</strong> identifica las categorías difíciles y prioriza las que domines.</li>
          <li><strong>No te obsesiones con la primera palabra:</strong> escribe una respuesta válida y mejórala si aparece una opción mejor.</li>
          <li><strong>Usa sinónimos:</strong> busca alternativas menos comunes cuando las reglas de la categoría lo permitan.</li>
          <li><strong>Practica con la IA:</strong> utiliza el modo solitario para ampliar tu vocabulario sin presión.</li>
        </ul>
      </article>
      <article>
        <h2>Cómo mejorar tu vocabulario para STOP en 7 días</h2>
        <p>En este artículo te proponemos un plan de 7 días para mejorar tu vocabulario y dominar STOP.</p>
        <p><strong>Día 1:</strong> Lee un artículo y anota palabras nuevas.</p>
        <p><strong>Día 2:</strong> Juega contra la IA en modo fácil.</p>
        <p><strong>Día 3:</strong> Lee un libro o novela y busca palabras poco comunes.</p>
        <p><strong>Día 4:</strong> Aprende sinónimos de palabras frecuentes.</p>
        <p><strong>Día 5:</strong> Juega contra la IA en modo difícil.</p>
        <p><strong>Día 6:</strong> Participa en partidas rápidas y observa las respuestas de otros jugadores.</p>
        <p><strong>Día 7:</strong> Repasa todo lo aprendido y juega una partida completa aplicando tus nuevas estrategias.</p>
      </article>
    `
  }
];

if (!fs.existsSync(distPath)) {
  throw new Error(`La carpeta de build no existe: ${distPath}`);
}

const templatePath = path.join(distPath, 'index.html');
if (!fs.existsSync(templatePath)) {
  throw new Error(`No se encontró el index.html generado por Vite: ${templatePath}`);
}

const template = fs.readFileSync(templatePath, 'utf8');

for (const page of pages) {
  const routePath = path.join(distPath, page.route);
  fs.mkdirSync(routePath, { recursive: true });

  const title = page.title.replace(/"/g, '&quot;');
  const description = page.description.replace(/"/g, '&quot;');
  const canonical = `https://www.stopjuegodepalabras.com/${page.route}`;
  const seoHead = `\n    <meta name="description" content="${description}" />\n    <link rel="canonical" href="${canonical}" />\n`;
  const seoBody = `\n    <main id="seo-content" style="max-width:900px;margin:0 auto;padding:24px;font-family:Inter,system-ui,sans-serif;line-height:1.6">${page.content}\n    </main>\n`;

  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  html = html.replace('</head>', `${seoHead}</head>`);
  html = html.replace(/<div id="root">\s*<\/div>/i, `${seoBody}<div id="root"></div>`);

  fs.writeFileSync(path.join(routePath, 'index.html'), html, 'utf8');
}

console.log(`Prerender completado: ${pages.length} páginas SEO generadas.`);
