// Content collections: Markdown files under src/content/<name>/.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    blurb: z.string(),
    status: z.enum(['active', 'paused', 'shipped', 'idea']).default('active'),
    url: z.url().optional(),
    github: z.url().optional(),
    /** Which agent in the hero "owns" this project (see src/hero/data/agents.ts). */
    agent: z.string().optional(),
    order: z.number().default(99),
  }),
});

export const collections = { blog, projects };
