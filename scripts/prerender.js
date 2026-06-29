import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist/public');

// ⚠️ IMPORTANTE: Sustituye este texto con el contenido REAL de cada página.
// Copia los textos que ya tienes en tus componentes React (HowToPlay, About, Blog, Tienda, etc.)
const pages = [
  {
    route: 'como-jugar',
    title: 'Cómo jugar a STOP - Reglas y tutorial',
    description: 'Aprende las reglas de STOP, el juego de palabras por categorías. Juega solo, contra la IA o con amigos.',
    content: `
      <h1>Cómo jugar a STOP</h1>
      <p>STOP es un juego de palabras por categorías...</p>
      <!-- Aquí va TODO el texto de tu página HowToPlay -->
    `
  },
  {
    route: 'acerca',
    title: 'Acerca de STOP - El juego de palabras definitivo',
    description: 'Conoce la historia de STOP, nuestro equipo y por qué creamos este juego.',
    content: `
      <h1>Acerca de STOP</h1>
      <p>STOP nació como un juego de mesa...</p>
      <!-- Aquí va TODO el texto de tu página About -->
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
        <p>... 800 palabras de contenido original ...</p>
      </article>
      <article>
        <h2>Los mejores trucos para el juego</h2>
        <p>... más contenido ...</p>
      </article>
    `
  },
  {
    route: 'contacto',
    title: 'Contacto - STOP Juego de Palabras',
    description: 'Ponte en contacto con nosotros. Sugerencias, reportes de errores o colaboraciones.',
    content: `
      <h1>Contacto</h1>
      <p>Puedes escribirnos a ...</p>
    `
  },
  {
    route: 'tienda',
    title: 'Tienda - STOP Juego de Palabras',
    description: 'Compras y suscripciones premium para STOP. Mejora tu experiencia de juego.',
    content: `
      <h1>Tienda</h1>
      <p>Descubre todos los planes premium...</p>
    `
  },
  // Añade más rutas si las necesitas: /privacidad, /terminos, /faq, etc.
];

// Función para generar el HTML completo
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
  <!-- Esto redirige a los usuarios reales a la SPA de React -->
  <script>
    // Si NO eres un robot de Google, ve a la SPA
    if (!navigator.userAgent.includes('Googlebot') && !navigator.userAgent.includes('bingbot') && !navigator.userAgent.includes('Twitterbot')) {
      window.location.href = '/';
    }
  </script>
</head>
<body>
  <div id="prerendered-content" style="max-width: 800px; margin: 40px auto; padding: 20px; font-family: system-ui, sans-serif; line-height: 1.6; color: #1a1a2e;">
    ${page.content}
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 0.9rem; color: #666;">
      <p>© STOP Juego de Palabras</p>
    </footer>
  </div>
</body>
</html>`;
}

// Crear las carpetas y archivos
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