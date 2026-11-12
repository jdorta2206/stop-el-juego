import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distPath = path.join(packageRoot, "dist");
const indexPath = path.join(distPath, "index.html");
const SITE = "https://stopjuegodepalabras.com";

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function setMeta(html, name, content, attribute = "name") {
  const tag = new RegExp(`<meta\s+${attribute}=["']${name}["'][^>]*>`, "i");
  const replacement = `<meta ${attribute}="${name}" content="${escapeHtml(content)}">`;
  return tag.test(html) ? html.replace(tag, replacement) : html.replace(/<\/head>/i, `  ${replacement}\n</head>`);
}

function makeDocument(shell, { route, canonicalRoute = route, title, description, body }) {
  const rootPattern = /<div\s+id=["']root["']\s*>[\s\S]*?<\/div>/i;
  if (!rootPattern.test(shell)) throw new Error("No se encontró #root en la plantilla de Vite.");
  let html = shell.replace(rootPattern, `<div id="root">${body}</div>`);
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "description", description);
  html = setMeta(html, "og:title", title, "property");
  html = setMeta(html, "og:description", description, "property");
  html = setMeta(html, "og:url", `${SITE}${canonicalRoute || "/"}`, "property");
  const canonical = `<link rel="canonical" href="${SITE}${canonicalRoute || "/"}">`;
  if (/<link\s+rel=["']canonical["']/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonical);
  } else {
    html = html.replace(/<\/head>/i, `  ${canonical}\n</head>`);
  }
  return html;
}

function pageBody(title, intro, sections = []) {
  return `<main data-prerendered="true" class="seo-content"><article><h1>${escapeHtml(title)}</h1><p>${intro}</p>${sections.map(([heading, text]) => `<section><h2>${escapeHtml(heading)}</h2><p>${text}</p></section>`).join("")}</article><nav aria-label="Más información"><a href="/">Jugar a STOP</a> · <a href="/como-jugar">Cómo jugar</a> · <a href="/blog">Blog</a> · <a href="/faq">Preguntas frecuentes</a></nav></main>`;
}

if (!fs.existsSync(indexPath)) {
  throw new Error(`No se encontró el index.html real de Vite en: ${indexPath}`);
}

const shell = fs.readFileSync(indexPath, "utf8");
if (!/<div\s+id=["']root["']\s*>/i.test(shell)) {
  throw new Error('dist/index.html no contiene el contenedor React <div id="root"></div> esperado.');
}

const homepage = {
  route: "",
  title: "STOP - Juego de palabras online: juega gratis",
  description: "Juega a STOP online gratis. Completa categorías con palabras que empiecen por la letra indicada, compite contra amigos o la IA y descubre nuevas formas de jugar.",
  body: `
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
        <p>La experiencia está pensada para que una partida sea fácil de empezar y también para que haya motivos para volver. Las diferentes categorías y modos hacen que no tengas que repetir siempre la misma combinación de respuestas. STOP también incorpora sistemas propios de partidas online, como ranking, retos diarios, progresión y partidas multijugador.</p>
        <h2>Cómo funciona la versión online de STOP</h2>
        <p>La versión online mantiene la mecánica del juego de categorías y añade sistemas digitales para gestionar rondas, respuestas y resultados. Puedes practicar contra la IA, crear o unirte a partidas multijugador y consultar tu progreso después de jugar. La plataforma separa la experiencia de juego de las páginas informativas para que puedas conocer las reglas, estrategias y características del servicio antes de empezar.</p>
        <p>Si quieres conocer estos sistemas con más detalle, consulta nuestra <a href="/como-funciona">guía sobre cómo funciona STOP El Juego</a>.</p>
        <h2>¿Por qué es divertido?</h2>
        <p>STOP mezcla tres cosas que funcionan especialmente bien juntas: palabras, tiempo y competición. El límite de tiempo hace que tengas que tomar decisiones rápidas; las categorías te obligan a cambiar de una idea a otra; y la puntuación convierte cada respuesta en una pequeña apuesta entre velocidad y originalidad. Además, las respuestas inesperadas suelen ser parte de lo más divertido de una partida: una palabra que alguien recuerda de repente puede cambiar el resultado de una ronda.</p>
        <p>También es un juego fácil de explicar. No necesitas aprender un sistema complicado antes de empezar: basta con entender las categorías y la regla de la letra inicial. Después, la práctica hace que cada vez encuentres respuestas con mayor rapidez.</p>
        <h2>Consejos para mejorar en STOP</h2>
        <p>Una buena estrategia es familiarizarte con las categorías antes de que empiece el contador. También ayuda a practicar con letras menos habituales y a ampliar el vocabulario por temas. No te quedes demasiado tiempo bloqueado en una sola categoría: una respuesta sencilla en varias categorías puede ser más útil que intentar encontrar una palabra perfecta y dejar otras casillas vacías.</p>
        <p>Con la práctica aprenderás a reconocer rápidamente familias de palabras, nombres, lugares y conceptos que pueden encajar en distintas categorías. Si quieres más ideas, puedes visitar nuestras <a href="/estrategias">guías y recursos</a> y consultar el <a href="/blog">blog de STOP</a>, donde publicamos contenidos sobre estrategias, vocabulario y novedades del juego.</p>
        <h2>Empieza una partida</h2>
        <p>Si te gustan los juegos de palabras, STOP está pensado para que puedas empezar una partida sin complicaciones. Elige cómo quieres jugar, prepara tus categorías y demuestra cuántas respuestas puedes encontrar antes de que termine el tiempo. Puedes volver a jugar para intentar mejorar tu puntuación, practicar una letra difícil o simplemente pasar un rato entretenido.</p>
        <p><a href="/como-jugar">Aprende las reglas de STOP</a>, descubre nuestras <a href="/blog">publicaciones del blog</a> y explora las <a href="/estrategias">guías del juego</a> antes de empezar. Cuando estés listo, vuelve a esta página y juega a STOP online.</p>
      </main>
    `,
};

const staticPages/ = [
  {
    route: "/como-jugar",
    title: "Cómo jugar a STOP: reglas, rondas y puntuación",
    description: "Aprende las reglas de STOP, cómo elegir categorías, jugar una ronda, validar respuestas y calcular los puntos.",
    body: pageBody("Cómo jugar a STOP", "STOP es un juego de categorías y palabras. En cada ronda se elige una letra y todos los jugadores deben escribir respuestas que empiecen por ella antes de que se agote el tiempo.", [
      ["Preparar la partida", "Elegid las categorías antes de comenzar. Algunas habituales son nombre, animal, lugar, objeto, color, fruta y marca. Acordad también cuántas rondas jugaréis y cuánto durará cada una."],
      ["Desarrollo de una ronda", "Se anuncia una letra. Cada participante completa una respuesta por categoría. Cuando alguien termina puede pulsar STOP; si el tiempo se agota, la ronda se cierra para todos."],
      ["Revisar las respuestas", "Comprobad que cada palabra empieza por la letra indicada y encaja en la categoría. Acordad antes de jugar cómo resolver nombres propios, marcas, variantes regionales y respuestas dudosas."],
      ["Puntuación", "Una regla habitual concede 10 puntos por una respuesta válida que nadie más haya escrito, 5 por una respuesta válida repetida y 0 por una respuesta vacía o inválida. Si jugáis con otra variante, dejadla clara antes de la primera ronda."],
      ["Consejos para empezar", "No te quedes bloqueado en una categoría. Escribe primero las respuestas que tengas claras, vuelve después a las difíciles y practica con letras poco frecuentes."]
    ]),
  },
  {
    route: "/como-funciona",
    title: "Cómo funciona STOP El Juego online",
    description: "Conoce cómo se desarrollan las rondas, la validación de respuestas, el modo individual y las partidas multijugador de STOP.",
    body: pageBody("Cómo funciona STOP El Juego", "STOP El Juego adapta el clásico juego de categorías a una experiencia online para móvil y ordenador. La plataforma organiza las rondas, muestra las categorías y permite enviar respuestas durante el tiempo disponible.", [
      ["Rondas y respuestas", "Cada ronda combina una letra con un conjunto de categorías. El objetivo es encontrar respuestas que cumplan las dos condiciones antes de que termine el contador."],
      ["Modo individual", "El modo individual permite practicar sin esperar a otros participantes y comparar tus respuestas con las de la partida."],
      ["Partidas multijugador", "Puedes compartir una sala con otras personas y competir en las mismas rondas. El resultado se consulta al terminar la partida."],
      ["Aprender y mejorar", "La práctica, las listas de vocabulario y las estrategias por letra ayudan a reducir bloqueos y encontrar respuestas válidas con mayor rapidez."]
    ]),
  },
  {
    route: "/acerca",
    title: "Acerca de STOP El Juego",
    description: "Conoce el proyecto STOP El Juego, su propósito, las funciones de la plataforma y cómo contactar con el equipo.",
    body: pageBody("Acerca de STOP El Juego", "STOP El Juego es un proyecto independiente inspirado en los juegos clásicos de categorías y palabras, conocidos en distintos lugares como STOP, Basta o Tutti Frutti. Su objetivo es ofrecer una forma accesible de jugar desde el navegador y compartir partidas.", [
      ["Qué ofrece el proyecto", "La plataforma reúne partidas individuales, opciones multijugador y recursos para aprender las reglas y ampliar vocabulario. El juego está pensado para poder abrirse desde dispositivos móviles y ordenadores."],
      ["Desarrollo y mejoras", "El proyecto evoluciona mediante correcciones, mejoras de accesibilidad y nuevas funciones. La experiencia de juego y la estabilidad de las partidas son prioridades del desarrollo."],
      ["Contacto", "Para consultas o incidencias puedes escribir a soporte@stopjuegodepalabras.com o utilizar el formulario de contacto disponible en la web."]
    ]),
  },
  {
    route: "/faq",
    title: "Preguntas frecuentes sobre STOP El Juego",
    description: "Respuestas sobre cómo jugar a STOP, crear partidas, usar el modo individual, puntuación, cuentas y soporte.",
    body: pageBody("Preguntas frecuentes sobre STOP", "Estas respuestas explican las dudas más habituales antes de empezar una partida o utilizar las funciones online.", [
      ["¿Es gratis jugar?", "Puedes acceder al juego y empezar partidas sin comprar un producto. La web también puede ofrecer packs opcionales con elementos cosméticos."],
      ["¿Cómo juego con amigos?", "Entra en el modo multijugador, crea una sala y comparte el código de acceso con las personas que quieras invitar."],
      ["¿Puedo practicar sin otros jugadores?", "Sí. El modo individual permite jugar sin esperar a que se conecten otras personas."],
      ["¿Cómo se puntúa?", "La puntuación depende de la validez de la respuesta y de si otros jugadores han escrito la misma palabra. Consulta las reglas de la partida antes de empezar."],
      ["¿Necesito conexión a Internet?", "Sí. Las funciones online y la sincronización de partidas requieren conexión."],
      ["¿Cómo contacto con soporte?", "Puedes escribir a soporte@stopjuegodepalabras.com o visitar la página de contacto."]
    ]),
  },
  {
    route: "/contacto",
    title: "Contacto y soporte de STOP El Juego",
    description: "Contacta con el equipo de STOP El Juego para comunicar incidencias, enviar sugerencias o solicitar ayuda.",
    body: pageBody("Contacto y soporte", "Si tienes problemas al acceder, iniciar una partida o utilizar una función, puedes ponerte en contacto con el equipo de STOP El Juego.", [
      ["Soporte por correo", "Escribe a dorynex@stopjuegodepalabras.com e indica qué estabas intentando hacer y el dispositivo y navegador que utilizas. No incluyas contraseñas ni datos de pago."],
      ["Sugerencias", "También puedes enviar ideas para mejorar las categorías, las reglas, la accesibilidad o la experiencia multijugador."]
    ]),
  },
  {
    route: "/privacidad",
    title: "Política de privacidad de STOP El Juego",
    description: "Consulta qué datos trata STOP El Juego, con qué finalidades y qué opciones tienes para ejercer tus derechos y solicitar la eliminación de tu cuenta.",
    body: pageBody("Política de privacidad", "Última actualización: 1 de octubre de 2026. En STOP valoramos tu privacidad. Esta política explica qué información tratamos, para qué la usamos y con qué servicios puede compartirse.", [
      ["Información que tratamos", "Podemos tratar tu nombre de usuario, correo electrónico cuando lo facilita el proveedor de inicio de sesión, foto de perfil, datos de partidas, puntuaciones, progreso, preferencias y datos necesarios para mantener tu sesión y tu cuenta. También registramos eventos de uso y datos técnicos para medir el funcionamiento y la actividad del juego."],
      ["Para qué utilizamos los datos", "Utilizamos la información para gestionar cuentas, sesiones, perfiles, partidas, rankings y progreso; procesar pagos mediante los proveedores correspondientes; enviar notificaciones si las activas; y mejorar la seguridad, el funcionamiento y la experiencia del juego."],
      ["Analítica, publicidad y cookies", "La versión web puede utilizar Google Analytics, Google Tag Manager y Google AdSense. La aplicación Android/TWA puede utilizar servicios de medición y publicidad asociados a Google Play y AdMob. Estos servicios pueden utilizar cookies, identificadores u otras tecnologías según su configuración y sus propias políticas."],
      ["Proveedores externos", "STOP puede utilizar servicios de Google para autenticación, analítica, publicidad, notificaciones y distribución, y Stripe para pagos. Cada proveedor procesa los datos conforme a sus propias condiciones y políticas. STOP no vende datos personales."],
      ["Tus derechos y eliminación de cuenta", "Puedes solicitar acceso, rectificación o eliminación de tus datos escribiendo a dorynex@stopjuegodepalabras.com. También puedes utilizar la página de eliminación de cuenta para enviar una solicitud específica."]
    ]),
  },
  {
    route: "/privacy",
    canonicalRoute: "/privacidad",
    title: "Política de privacidad de STOP El Juego",
    description: "Consulta qué datos trata STOP El Juego, con qué finalidades y qué opciones tienes para ejercer tus derechos y solicitar la eliminación de tu cuenta.",
    body: pageBody("Política de privacidad", "Última actualización: 1 de octubre de 2026. En STOP valoramos tu privacidad. Esta política explica qué información tratamos, para qué la usamos y con qué servicios puede compartirse.", [
      ["Información que tratamos", "Podemos tratar tu nombre de usuario, correo electrónico cuando lo facilita el proveedor de inicio de sesión, foto de perfil, datos de partidas, puntuaciones, progreso, preferencias y datos necesarios para mantener tu sesión y tu cuenta."],
      ["Tus derechos", "Puedes solicitar acceso, rectificación o eliminación de tus datos escribiendo a dorynex@stopjuegodepalabras.com o utilizando la página de eliminación de cuenta."]
    ]),
  },
  {
    route: "/terminos",
    title: "Términos y condiciones de STOP El Juego",
    description: "Lee las condiciones de uso de STOP El Juego, las reglas sobre cuentas, compras, conducta y propiedad intelectual.",
    body: pageBody("Términos y condiciones", "Última actualización: 17 de junio de 2026. Al utilizar STOP aceptas estas condiciones. Si no estás de acuerdo con ellas, no utilices el servicio.", [
      ["Uso del servicio", "STOP es un juego de palabras gratuito para mayores de 13 años. Puedes jugar sin registro, aunque algunas funciones como el ranking o la tienda pueden requerir una cuenta."],
      ["Cuentas", "Eres responsable de la actividad realizada desde tu cuenta y de mantener protegidas tus credenciales. No compartas tu contraseña con terceros."],
      ["Compras", "Los packs opcionales y sus condiciones se muestran antes de completar la compra. Consulta la información del producto y las condiciones del proveedor de pago antes de confirmar."],
      ["Conducta", "No está permitido hacer trampas, acosar a otros jugadores ni utilizar lenguaje ofensivo. El incumplimiento puede dar lugar a medidas sobre la cuenta."],
      ["Propiedad intelectual", "Los elementos propios de STOP pertenecen a sus titulares. Las marcas de terceros mencionadas en el servicio pertenecen a sus respectivos propietarios."],
      ["Cambios y contacto", "Las condiciones pueden actualizarse. Para consultas, visita la página de contacto o escribe a dorynex@stopjuegodepalabras.com."]
    ]),
  },
  {
    route: "/terms",
    canonicalRoute: "/terminos",
    title: "Términos y condiciones de STOP El Juego",
    description: "Lee las condiciones de uso de STOP El Juego, las reglas sobre cuentas, compras, conducta y propiedad intelectual.",
    body: pageBody("Términos y condiciones", "Última actualización: 17 de junio de 2026. Al utilizar STOP aceptas estas condiciones. Si no estás de acuerdo con ellas, no utilices el servicio.", [
      ["Uso del servicio", "STOP es un juego de palabras gratuito para mayores de 13 años. Puedes jugar sin registro, aunque algunas funciones como el ranking o la tienda pueden requerir una cuenta."],
      ["Conducta", "No está permitido hacer trampas, acosar a otros jugadores ni utilizar lenguaje ofensivo. El incumplimiento puede dar lugar a medidas sobre la cuenta."],
      ["Contacto", "Para consultas, visita la página de contacto o escribe a dorynex@stopjuegodepalabras.com."]
    ]),
  },
  {
    route: "/estrategias",
    title: "Estrategias y vocabulario para jugar mejor a STOP",
    description: "Consejos para pensar palabras por letra, elegir categorías y mejorar tus respuestas en el juego STOP.",
    body: pageBody("Estrategias para jugar mejor a STOP", "Una buena estrategia consiste en combinar vocabulario preparado con decisiones rápidas durante cada ronda. No se trata solo de escribir deprisa: las respuestas deben encajar con la letra y la categoría.", [
      ["Prepara familias de palabras", "Practica vocabulario por temas: animales, ciudades, alimentos, profesiones, objetos y nombres. Aprender grupos de palabras facilita recuperar una respuesta bajo presión."],
      ["Entrena las letras difíciles", "Dedica partidas de práctica a letras menos frecuentes. Anota respuestas válidas que te cueste recordar y revisa después si realmente encajan en la categoría."],
      ["Gestiona el tiempo", "Responde primero las categorías que dominas. Si una palabra no aparece, pasa a otra casilla y vuelve al final si queda tiempo."],
      ["Busca originalidad sin inventar", "Una respuesta poco común puede diferenciarte, pero debe existir y ser válida. Si el grupo utiliza reglas especiales, acordadlas antes de comenzar."]
    ]),
  },
];

const vite = await createServer({
  root: packageRoot,
  mode: "production",
  configFile: path.join(packageRoot, "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
});
let allPosts;
try {
  const blogModule = await vite.ssrLoadModule("/src/data/blog/index.ts");
  allPosts = blogModule.ALL_POSTS;
} finally {
  await vite.close();
}

if (!Array.isArray(allPosts) || allPosts.length === 0) {
  throw new Error("No se pudieron cargar los artículos del blog para el prerenderizado.");
}

const pages = [homepage, ...staticPages];
for (const post of allPosts) {
  const markdownHtml = renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, post.content),
  );
  const article = `<main data-prerendered="true" class="seo-content"><article><nav aria-label="Migas de pan"><a href="/">Inicio</a> / <a href="/blog">Blog</a></nav><header><h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(post.description)}</p><p>Publicado: <time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(post.publishedAt)}</time> · ${escapeHtml(post.readMinutes)} min de lectura · ${escapeHtml(post.author)}</p></header><div class="blog-content">${markdownHtml}</div><p><a href="/blog">Volver al blog</a> · <a href="/">Jugar a STOP</a></p></article></main>`;
  pages.push({
    route: `/blog/${post.slug}`,
    title: `${post.title} | Blog STOP`,
    description: post.description,
    body: article,
  });
}

const blogCards = allPosts.map((post) => `<article><h2><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.description)}</p><p>${escapeHtml(post.category)} · ${escapeHtml(post.readMinutes)} min de lectura</p></article>`).join("");
pages.push({
  route: "/blog",
  title: "Blog STOP: estrategias, vocabulario y guías",
  description: "Artículos y guías para aprender las reglas de STOP, practicar vocabulario por letra y mejorar tus estrategias de juego.",
  body: `<main data-prerendered="true" class="seo-content"><h1>Blog de STOP</h1><p>Guías prácticas, vocabulario y estrategias para jugar al STOP, Basta o Tutti Frutti. Cada artículo desarrolla un tema concreto para ayudarte a comprender las reglas, encontrar palabras y organizar mejores partidas.</p>${blogCards}<p><a href="/">Jugar a STOP</a> · <a href="/como-jugar">Consultar las reglas</a></p></main>`,
});

for (const page of pages) {
  const html = makeDocument(shell, page);
  const outputDir = page.route
    ? path.join(distPath, ...page.route.split("/").filter(Boolean))
    : distPath;
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "index.html"), html, "utf8");
}

const homeHtml = fs.readFileSync(indexPath, "utf8");
const rootMatch = homeHtml.match(/<div\s+id=["']root["']>([\s\S]*?)<\/div>/i);
const homeRoot = rootMatch?.[1] ?? "";
const wordCount = homeRoot.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").trim().split(/\s+/).filter(Boolean).length;
if (wordCount < 150) throw new Error(`La portada prerenderizada tiene solo ${wordCount} palabras.`);

for (const route of ["/como-jugar", "/como-funciona", "/acerca", "/faq", "/contacto", "/estrategias", "/blog"]) {
  const output = path.join(distPath, ...route.split("/").filter(Boolean), "index.html");
  if (!fs.existsSync(output)) throw new Error(`No se generó el HTML de ${route}`);
  const html = fs.readFileSync(output, "utf8");
  if (!html.includes('data-prerendered="true"') || !html.includes("<h1>")) {
    throw new Error(`El HTML de ${route} no contiene contenido prerenderizado propio.`);
  }
}

for (const post of allPosts) {
  const output = path.join(distPath, "blog", post.slug, "index.html");
  if (!fs.existsSync(output)) throw new Error(`No se generó el artículo /blog/${post.slug}`);
  const html = fs.readFileSync(output, "utf8");
  if (!html.includes(escapeHtml(post.title)) || !html.includes('data-prerendered="true"')) {
    throw new Error(`El artículo /blog/${post.slug} no contiene su título y contenido.`);
  }
}

console.log(`[prerender] Portada: ${wordCount} palabras`);
console.log(`[prerender] Páginas informativas: ${staticPages.length}`);
console.log(`[prerender] Blog: ${allPosts.length} artículos + índice`);
console.log(`[prerender] Total de URLs prerenderizadas: ${pages.length}`);
