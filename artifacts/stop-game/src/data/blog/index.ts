import type { BlogPost } from "./types";

const modules = import.meta.glob<{ default: BlogPost }>("./posts/*.ts", { eager: true });

export const ALL_POSTS: BlogPost[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

export function getPost(slug: string): BlogPost | undefined {
  return ALL_POSTS.find((p) => p.slug === slug);
}

export function relatedPosts(slug: string, n = 4): BlogPost[] {
  const current = getPost(slug);
  if (!current) return ALL_POSTS.slice(0, n);
  const others = ALL_POSTS.filter((p) => p.slug !== slug);
  const sameCat = others.filter((p) => p.category === current.category);
  const rest = others.filter((p) => p.category !== current.category);
  return [...sameCat, ...rest].slice(0, n);
}

export type { BlogPost };
