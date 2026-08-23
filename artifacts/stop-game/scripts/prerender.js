import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

const pages = [
  { route: 'como-jugar', title: 'Cómo jugar a STOP - Reglas oficiales, estrategias y trucos', description: 'Aprende las reglas de STOP, el juego de palabras por categorías. Descubre estrategias avanzadas, trucos para ganar y domina el juego con nuestra guía completa.' },
  { route: 'acerca', title: 'Acerca de STOP - Nuestra historia, misión y equipo', description: 'Conoce la historia detrás de STOP, nuestro equipo, nuestra misión y por qué creamos este juego de palabras online. Descubre todo sobre nosotros.' },
  { route: 'blog', title: 'Blog de STOP - Estrategias, trucos, noticias y actualizaciones', description: 'Descubre artículos exclusivos sobre STOP: estrategias para ganar, trucos avanzados, noticias sobre actualizaciones y análisis de juego. Todo lo que necesitas saber.' },
];

if (!fs.existsSync(distPath)) {
  console.warn('[prerender] dist directory not found:', distPath);
  process.exit(0);
}

const indexPath = path.join(distPath, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.warn('[prerender] index.html not found:', indexPath);
  process.exit(0);
}

const indexHtml = fs.readFileSync(indexPath, 'utf8');

for (const page of pages) {
  const routeDir = path.join(distPath, page.route);
  fs.mkdirSync(routeDir, { recursive: true });
  const html = indexHtml
    .replace(/<title>[^<]*<\/title>/i, `<title>${page.title}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${page.description.replace(/"/g, '&quot;')}">`);
  fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf8');
}

console.log(`[prerender] Generated ${pages.length} SEO route(s).`);
