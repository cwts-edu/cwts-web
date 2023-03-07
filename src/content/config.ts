import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  schema: z.object({
    title: z.string(),
    order: z.number(),
    coverImage: z.optional(z.string()),
    thumbnail: z.optional(z.string()),
  }),
});

const news = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    thumbnail: z.string(),
    url: z.string(),
  }),
});

const degreesWidget = defineCollection({
  schema: z.object({
    title: z.string(),
    shortTitle: z.optional(z.string()),
  }),
});

const studyModeWidget = defineCollection({
  schema: z.object({
    title: z.string(),
    order: z.number(),
  }),
});

export const collections = {
  pages,
  news,
  "degrees-widget": degreesWidget,
  "study-mode-widget": studyModeWidget,
};
