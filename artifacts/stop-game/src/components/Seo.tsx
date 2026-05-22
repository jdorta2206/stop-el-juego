import { Helmet } from "react-helmet-async";

export interface SeoProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: "website" | "article";
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  keywords?: string[];
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE = "https://stopjuegodepalabras.com";
const DEFAULT_IMAGE = `${SITE}/icon-512.png`;

export function Seo(props: SeoProps) {
  const {
    title, description, url, image = DEFAULT_IMAGE, type = "website",
    publishedAt, updatedAt, author = "STOP", keywords, jsonLd,
  } = props;
  const fullUrl = url.startsWith("http") ? url : `${SITE}${url.startsWith("/") ? "" : "/"}${url}`;
  const fullImage = image.startsWith("http") ? image : `${SITE}${image.startsWith("/") ? "" : "/"}${image}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}
      <link rel="canonical" href={fullUrl} />
      <meta name="author" content={author} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:site_name" content="STOP - Juego de Palabras" />
      <meta property="og:locale" content="es_ES" />
      {publishedAt && <meta property="article:published_time" content={publishedAt} />}
      {updatedAt && <meta property="article:modified_time" content={updatedAt} />}
      {author && type === "article" && <meta property="article:author" content={author} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
