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

function makeDocument(shell, { route, title, description, body }) {
  const rootPattern = /<div\s+id=["']root["']\s*>[\s\S]*?<\/div>/i;
  if (!rootPattern.test(shell)) throw new Error("No se encontró #root en la plantilla de Vite.");
  let html = shell.replace(rootPattern, `<div id="root">${body}</div>`);
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "description", description);
  html = setMeta(html, "og:title", title, "property");
  html = setMeta(html, "og:description", description, "property");
  html = setMeta(html, "og:url", `${SITE}${route || "/"}`, "property");
  const canonical = `<link rel="canonical" href="${SITE}${route || "/"}">`;
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
      <p>STOP es un juego de palabras rápido y divertido en el que tienes que encontrar respuestas que empiecen por una letra determinada y encajen en distintas categorías. Puedes jugar desde el móvil o el ordenador, practicar a solas o compartir una partida con otras personas.</p>
      <h2>¿Cómo se juega?</h2>
      <ol><li>Entra en una partida y revisa las categorías.</li><li>Cuando aparece la letra, escribe una palabra que empiece por ella para cada categoría.</li><li>Completa las respuestas antes de que termine el tiempo.</li><li>Al finalizar, compara las respuestas y consulta la puntuación.</li></ol>
      <p>STOP, conocido también como Basta o Tutti Frutti, combina vocabulario, rapidez mental y creatividad. Las categorías pueden incluir nombres, animales, países, alimentos, profesiones o colores.</p>
      <h2>Juega solo o con otras personas</h2>
      <p>Puedes practicar contra la IA, crear o unirte a partidas multijugador y consultar tu progreso. Los retos y las diferentes categorías permiten variar cada partida.</p>
      <p>Antes de empezar, consulta la <a href="/como-jugar">guía de reglas de STOP</a>, las <a href="/estrategias">estrategias por letra</a> y los <a href="/blog">artículos del blog</a>.</p>
    </main>`,
};

const staticPages = [
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
      ["Soporte por correo", "Escribe a soporte@stopjuegodepalabras.com e indica qué estabas intentando hacer, el dispositivo y el navegador que utilizas. No incluyas contraseñas ni datos de pago."],
      ["Sugerencias", "También puedes enviar ideas para mejorar las categorías, las reglas, la accesibilidad o la experiencia multijugador."]
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
