import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist'); // ahora es "dist"

// ⚠️ RELLENA CADA PÁGINA CON TU CONTENIDO REAL (mínimo 800 palabras por página)
const pages = [
  {
    route: 'como-jugar',
    title: 'Cómo jugar a STOP - Reglas y tutorial',
    description: 'Aprende las reglas de STOP, el juego de palabras por categorías. Juega solo, contra la IA o con amigos.',
    content: `
      <h1>Cómo jugar a STOP</h1>
      <p>STOP es un juego de palabras por categorías. El objetivo es completar todas las categorías con palabras que empiecen por una letra determinada.</p>
      <h2>Reglas básicas</h2>
      <p>Se elige una letra al azar. Cada jugador debe escribir una palabra en cada categoría que empiece por esa letra. El primero en terminar dice "STOP" y todos dejan de escribir. Se puntúa según la originalidad de las respuestas.</p>
      <p>... (aquí debes poner el texto extenso de tu componente HowToPlay) ...</p>
      <h2>Consejos para ganar</h2>
      <p>Amplía tu vocabulario, piensa rápido y evita palabras comunes. Cuanto más rara sea tu palabra, más puntos obtendrás.</p>
      <p>... (más de 800 palabras en total) ...</p>
    `
  },
  {
    route: 'acerca',
    title: 'Acerca de STOP - El juego de palabras definitivo',
    description: 'Conoce la historia de STOP, nuestro equipo y por qué creamos este juego.',
    content: `
      <h1>Acerca de STOP</h1>
      <p>STOP nació como un juego de mesa clásico y lo hemos llevado al mundo digital para que puedas jugar con amigos o contra la IA.</p>
      <p>... (texto de tu componente About) ...</p>
    `
  },
  {
    route: 'blog',
    title: 'Blog de STOP - Estrategias, trucos y noticias',
    description: 'Artículos y guías para mejorar en STOP. Estrategias, trucos y análisis.',
    content: `
      <h1>Blog de STOP</h1>
      <article>
        <h2>Estrategias para ganar en STOP</h2>
        <p>... (800 palabras de contenido) ...</p>
      </article>
      <article>
        <h2>Los mejores trucos para el juego</h2>
        <p>... (más contenido) ...</p>
      </article>
    `
  },
  {
    route: 'contacto',
    title: 'Contacto - STOP Juego de Palabras',
    description: 'Ponte en contacto con nosotros. Sugerencias, reportes de errores o colaboraciones.',
    content: `
      <h1>Contacto</h1>
      <p>Puedes escribirnos a stopjuegodepalabras@gmail.com o a través de nuestras redes sociales.</p>
      <p>... (texto de tu componente Contacto) ...</p>
    `
  },
  {
    route: 'tienda',
    title: 'Tienda - STOP Juego de Palabras',
    description: 'Compras y suscripciones premium para STOP. Mejora tu experiencia de juego.',
    content: `
      <h1>Tienda</h1>
      <p>Descubre todos los planes premium, elimina anuncios, consigue ventajas exclusivas.</p>
      <p>... (texto de tu componente Tienda) ...</p>
    `
  }
];

function generateHTML(page) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.title}</title>
  <meta name="description" content="${page.description}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.stopjuegodepalabras.com/${page.route}" />
</head>
<body>
  <div id="prerendered-content" style="max-width: 800px; margin: 40px auto; padding: 20px; font-family: system-ui, sans-serif; line-height: 1.6; color: #1a1a2e;">
    ${page.content}
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 0.9rem; color: #666;">
      <p>© STOP Juego de Palabras</p>
      <p><a href="/">Volver al juego</a></p>
    </footer>
  </div>
</body>
</html>`;
}

pages.forEach((page) => {
  const folderPath = path.join(distPath, page.route);
  const filePath = path.join(folderPath, 'index.html');

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  fs.writeFileSync(filePath, generateHTML(page));
  console.log(`✅ Prerenderizado: /${page.route} → ${filePath}`);
});

console.log('🎉 ¡Prerrenderizado completado!');