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

const faculty = defineCollection({
  schema: z.object({
    photo: z.optional(z.string()),
    name: z.string(),
    category: z.enum(["faculty", "senior-adjunct", "adjunct"]),
    order: z.number(),
    positions: z.optional(z.array(z.string())),
    courses: z.array(z.string()),
    degrees: z.array(z.string()),
    moreDegrees: z.optional(z.array(z.string())),
    former: z.optional(z.array(z.string())),
  }),
});

export const collections = {
  pages,
  news,
  faculty,
  "degrees-widget": degreesWidget,
  "study-mode-widget": studyModeWidget,
};
