import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Seo } from "@/components/Seo";
import { ALL_POSTS } from "@/data/blog";
import { Calendar, Clock, ArrowRight } from "lucide-react";

const SITE = "https://stopjuegodepalabras.com";

export default function Blog() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog STOP - Juego de Palabras",
    description: "Artículos, estrategias, listas de palabras y guías para dominar el juego de STOP (Scattergories).",
    url: `${SITE}/blog`,
    blogPost: ALL_POSTS.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      url: `${SITE}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      author: { "@type": "Organization", name: p.author },
    })),
  };

  return (
    <Layout>
      <Seo
        title="Blog STOP - Estrategias, palabras y guías | Juego de Palabras"
        description="Aprende a ganar al STOP (Scattergories): estrategias, listas de palabras por letra, historia del juego, errores comunes y trucos para pensar rápido bajo presión."
        url="/blog"
        keywords={["blog STOP", "Scattergories blog", "palabras juego STOP", "estrategias STOP", "trucos juego de palabras"]}
        jsonLd={jsonLd}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Blog STOP
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Estrategias, listas de palabras, trucos y guías para dominar el juego de STOP
            (también conocido como Scattergories, Tutti Frutti o Basta).
          </p>
        </header>

        <div className="grid gap-5">
          {ALL_POSTS.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article
                className="block p-5 md:p-6 rounded-2xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="flex items-center gap-3 text-xs text-white/50 mb-2">
                  <span
                    className="px-2 py-1 rounded-md font-bold uppercase tracking-wider"
                    style={{ background: "rgba(251,191,36,0.18)", color: "#fbbf24" }}
                  >
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formatDate(post.publishedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {post.readMinutes} min
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white mb-2">
                  {post.title}
                </h2>
                <p className="text-white/70 mb-3 leading-relaxed">{post.description}</p>
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  Leer artículo <ArrowRight className="w-4 h-4" />
                </div>
              </article>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center p-6 rounded-2xl"
          style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(236,72,153,0.3)" }}
        >
          <h3 className="text-2xl font-black text-white mb-2">¿Listo para jugar?</h3>
          <p className="text-white/70 mb-4">Aplica lo aprendido en una partida real.</p>
          <Link href="/">
            <button className="px-8 py-3 rounded-2xl font-black text-white"
              style={{ background: "linear-gradient(135deg, #ec4899, #a855f7)" }}
            >
              Jugar ahora
            </button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return iso;
  }
}
