import { Link, useRoute } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { Seo } from "@/components/Seo";
import { getPost, relatedPosts } from "@/data/blog";
import NotFound from "@/pages/not-found";
import { Calendar, Clock, ArrowLeft, ArrowRight } from "lucide-react";

const SITE = "https://stopjuegodepalabras.com";

export default function BlogPost() {
  const [, params] = useRoute<{ slug: string }>("/blog/:slug");
  const slug = params?.slug ?? "";
  const post = getPost(slug);

  if (!post) return <NotFound />;

  const related = relatedPosts(slug, 4);
  const url = `${SITE}/blog/${post.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      url,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      author: { "@type": "Organization", name: post.author },
      publisher: {
        "@type": "Organization",
        name: "STOP - Juego de Palabras",
        logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      keywords: post.keywords.join(", "),
      inLanguage: "es-ES",
      image: `${SITE}/icon-512.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  return (
    <Layout>
      <Seo
        title={`${post.title} | Blog STOP`}
        description={post.description}
        url={`/blog/${post.slug}`}
        type="article"
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
        author={post.author}
        keywords={post.keywords}
        jsonLd={jsonLd}
      />

      <article className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-xs text-white/50 mb-6 flex items-center gap-2">
          <Link href="/"><span className="hover:text-white cursor-pointer">Inicio</span></Link>
          <span>/</span>
          <Link href="/blog"><span className="hover:text-white cursor-pointer">Blog</span></Link>
          <span>/</span>
          <span className="text-white/80 truncate">{post.title}</span>
        </nav>

        <header className="mb-8">
          <div className="flex items-center gap-3 text-xs text-white/50 mb-3 flex-wrap">
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
              <Clock className="w-3 h-3" /> {post.readMinutes} min de lectura
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
            {post.title}
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">{post.description}</p>
        </header>

        <div className="prose prose-invert max-w-none blog-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 rounded-2xl text-center"
          style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.18), rgba(168,85,247,0.18))", border: "1px solid rgba(236,72,153,0.3)" }}
        >
          <h3 className="text-2xl font-black text-white mb-2">¿Quieres ponerlo en práctica?</h3>
          <p className="text-white/70 mb-4">Juega una partida gratis ahora mismo, sin descargas.</p>
          <Link href="/">
            <button className="px-8 py-3 rounded-2xl font-black text-white"
              style={{ background: "linear-gradient(135deg, #ec4899, #a855f7)" }}
            >
              Jugar al STOP gratis
            </button>
          </Link>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-black text-white mb-4">Sigue leyendo</h2>
            <div className="grid gap-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/blog/${r.slug}`}>
                  <div className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-between gap-3"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-amber-400 font-bold uppercase mb-1">{r.category}</div>
                      <div className="text-white font-bold truncate">{r.title}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/50 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10">
          <Link href="/blog">
            <button className="text-white/70 hover:text-white flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Volver al blog
            </button>
          </Link>
        </div>
      </article>
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
