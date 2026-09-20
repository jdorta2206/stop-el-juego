import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");
const indexPath = path.join(distPath, "index.html");

const pages = [
  {
    route: "",
    title: "STOP - Juego de palabras online: juega gratis",
    description: "Juega a STOP online gratis. Completa categorías con palabras que empiecen por la letra indicada, compite contra amigos o la IA y descubre nuevas formas de jugar.",
    content: `
      <main data-prerendered="true">
        <h1>STOP: juego de palabras online</h1>
        <p>STOP es un juego de palabras rápido y divertido en el que tienes que encontrar respuestas que empiecen por una letra determinada y encajen en distintas categorías. La idea es sencilla, pero cada ronda pone a prueba tu vocabulario, tu capacidad para pensar bajo presión y tu creatividad. Puedes jugar desde el móvil o el ordenador y disfrutar de una partida cuando quieras, tanto para practicar a solas como para compartirla con otras personas.</p>
        <p>En cada partida aparece una letra y varias categorías. Tu objetivo es escribir una respuesta válida para cada una antes de que termine el tiempo. Cuando terminas puedes pulsar STOP, se cierra la ronda y llega el momento de comparar las respuestas. Las palabras repetidas pueden tener una puntuación diferente de las respuestas que nadie más haya encontrado, por lo que no basta con escribir deprisa: también conviene buscar opciones originales.</p>
        <h2>¿Qué es STOP?</h2>
        <p>STOP, conocido también en muchos lugares como Basta o Tutti Frutti, pertenece a la familia de juegos de palabras que se pueden jugar con una hoja de papel y un lápiz. Esta versión online conserva esa mecánica y la adapta a una experiencia digital. Las partidas pueden incluir categorías como nombres, animales, países, alimentos, profesiones o colores, y la combinación hace que cada letra plantee un reto diferente.</p>
        <p>La gracia del juego está en la variedad. Una letra puede parecer fácil hasta que aparece una categoría complicada; otra puede obligarte a recordar una palabra que hacía años que no utilizabas. Por eso una partida de STOP sirve tanto para competir como para practicar vocabulario y descubrir palabras nuevas.</p>
        <h2>¿Cómo se juega?</h2>
        <ol>
          <li>Entra en una partida y revisa las categorías de la ronda.</li>
          <li>Cuando aparece la letra, busca una palabra que empiece por ella para cada categoría.</li>
          <li>Escribe tus respuestas mientras el contador está activo.</li>
          <li>Pulsa STOP cuando hayas terminado o espera a que finalice el tiempo.</li>
          <li>Compara las respuestas y consulta la puntuación de la ronda.</li>
        </ol>
        <p>Si quieres conocer las reglas con más detalle, consulta nuestra <a href="/como-jugar">guía sobre cómo jugar a STOP</a>. Allí explicamos la dinámica, las categorías, la puntuación y distintas estrategias para mejorar.</p>
        <h2>Juega solo o con otras personas</h2>
        <p>Puedes utilizar STOP como una forma de practicar por tu cuenta o entrar en partidas multijugador. Jugar contra la IA permite entrenar la rapidez mental y ampliar tu repertorio de respuestas sin depender de que haya otra persona disponible. En las partidas online puedes competir con amigos y otros jugadores, comparar resultados y tratar de mejorar tu posición en el ranking.</p>
        <p>La experiencia está pensada para que una partida sea fácil de empezar y también para que haya motivos para volver. Las diferentes categorías y modos hacen que no tengas que repetir siempre la misma combinación de respuestas.</p>
        <h2>¿Por qué es divertido?</h2>
        <p>STOP mezcla tres cosas que funcionan especialmente bien juntas: palabras, tiempo y competición. El límite de tiempo hace que tengas que tomar decisiones rápidas; las categorías te obligan a cambiar de una idea a otra; y la puntuación convierte cada respuesta en una pequeña apuesta entre velocidad y originalidad. Además, las respuestas inesperadas suelen ser parte de lo más divertido de una partida: una palabra que alguien recuerda de repente puede cambiar el resultado de una ronda.</p>
        <p>También es un juego fácil de explicar. No necesitas aprender un sistema complicado antes de empezar: basta con entender las categorías y la regla de la letra inicial. Después, la práctica hace que cada vez encuentres respuestas con mayor rapidez.</p>
        <h2>Consejos para mejorar en STOP</h2>
        <p>Una buena estrategia es familiarizarte con las categorías antes de que empiece el contador. También ayuda a practicar con letras menos habituales y a ampliar el vocabulario por temas. No te quedes demasiado tiempo bloqueado en una sola categoría: una respuesta sencilla en varias categorías puede ser más útil que intentar encontrar una palabra perfecta y dejar otras casillas vacías.</p>
        <p>Con la práctica aprenderás a reconocer rápidamente familias de palabras, nombres, lugares y conceptos que pueden encajar en distintas categorías. Si quieres más ideas, puedes visitar nuestras <a href="/guias">guías y recursos</a> y consultar el <a href="/blog">blog de STOP</a>, donde publicamos contenidos sobre estrategias, vocabulario y novedades del juego.</p>
        <h2>Empieza una partida</h2>
        <p>Si te gustan los juegos de palabras, STOP está pensado para que puedas empezar una partida sin complicaciones. Elige cómo quieres jugar, prepara tus categorías y demuestra cuántas respuestas puedes encontrar antes de que termine el tiempo. Puedes volver a jugar para intentar mejorar tu puntuación, practicar una letra difícil o simplemente pasar un rato entretenido.</p>
        <p><a href="/como-jugar">Aprende las reglas de STOP</a>, descubre nuestras <a href="/blog">publicaciones del blog</a> y explora las <a href="/guias">guías del juego</a> antes de empezar. Cuando estés listo, vuelve a esta página y juega a STOP online.</p>
      </main>
    `,
  },
];

if (!fs.existsSync(indexPath)) {
  throw new Error(`No se encontró el index.html real de Vite en: ${indexPath}`);
}

let html = fs.readFileSync(indexPath, "utf8");

if (!/<div\s+id=["']root["']\s*>/i.test(html)) {
  throw new Error('dist/index.html no contiene el contenedor React <div id="root"></div> esperado.');
}

for (const page of pages) {
  if (page.route !== "") continue;

  const content = page.content.trim();
  const rootPattern = /<div\s+id=["']root["']\s*>[\s\S]*?<\/div>/i;
  if (!rootPattern.test(html)) {
    throw new Error("No se pudo localizar el contenedor #root en dist/index.html.");
  }

  html = html.replace(rootPattern, `<div id="root">${content}</div>`);
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${page.title}</title>`);

  const descriptionTag = `<meta name="description" content="${page.description.replace(/"/g, "&quot;")}">`;
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, descriptionTag);
  } else {
    html = html.replace(/<\/head>/i, `  ${descriptionTag}\n</head>`);
  }
}

fs.writeFileSync(indexPath, html, "utf8");

const finalHtml = fs.readFileSync(indexPath, "utf8");
const rootMatch = finalHtml.match(/<div\s+id=["']root["']>([\s\S]*?)<\/div>/i);
const root = rootMatch?.[1] ?? "";
const wordCount = root.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").trim().split(/\s+/).filter(Boolean).length;
const requiredLinks = ["/como-jugar", "/blog", "/guias"];

if (wordCount < 300) {
  throw new Error(`El contenido prerenderizado de la portada tiene solo ${wordCount} palabras; se requieren al menos 300.`);
}

for (const link of requiredLinks) {
  if (!finalHtml.includes(`href="${link}"`)) {
    throw new Error(`Falta el enlace interno requerido: ${link}`);
  }
}

console.log(`[prerender] OK: ${indexPath}`);
console.log(`[prerender] Portada prerenderizada: ${wordCount} palabras`);
console.log("[prerender] React #root conservado; React puede montar sobre este contenido.");
console.log(`[prerender] Enlaces internos verificados: ${requiredLinks.join(", ")}`);
