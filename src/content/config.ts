import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  schema: z.object({
    title: z.string(),
    order: z.number(),
    coverImage: z.optional(z.string()),
    thumbnail: z.optional(z.string()),
  }),
});

export const collections = { pages };
