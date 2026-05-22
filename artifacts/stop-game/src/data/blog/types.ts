export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  publishedAt: string;
  updatedAt?: string;
  author: string;
  category: string;
  readMinutes: number;
  content: string;
}
