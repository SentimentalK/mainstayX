import { getCollection } from 'astro:content';

/** Published posts, newest first. Drafts show up in `astro dev` only. */
export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getProjects() {
  const projects = await getCollection('projects');
  return projects.sort((a, b) => a.data.order - b.data.order);
}

export const formatDate = (d: Date) => d.toISOString().slice(0, 10);
