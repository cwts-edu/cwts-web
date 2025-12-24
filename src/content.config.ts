import { defineCollection, z } from "astro:content";
import { glob, file } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/content/pages' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    coverImage: z.optional(z.string()),
    thumbnail: z.optional(z.string()),
    showChildren: z.optional(z.boolean()),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    thumbnail: z.string(),
    url: z.string(),
  }),
});

const degreesWidget = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/content/degrees-widget' }),
  schema: z.object({
    title: z.string(),
    shortTitle: z.optional(z.string()),
    order: z.number(),
    url: z.optional(z.string()),
  }),
});

const studyModeWidget = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/content/study-mode-widget' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    url: z.optional(z.string()),
  }),
});

const facultySchema = z.object({
  photo: z.optional(z.string()),
  name: z.string(),
  category: z.enum(["faculty", "senior-adjunct", "adjunct"]),
  order: z.optional(z.number()),
  email: z.string().email().optional(),
  positions: z.optional(z.array(z.string())),
  courses: z.array(z.string()),
  degrees: z.array(z.string()),
  moreDegrees: z.optional(z.array(z.string())),
  former: z.optional(z.array(z.string())),
});

const faculty = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/content/faculty' }),
  schema: facultySchema,
});

const adjunctProf = defineCollection({
  loader: glob({ pattern: ['**/adjunct-prof.yml'], base: 'src/content/faculty' }),
  schema: z.array(facultySchema)
});

const degreesPrograms = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/content/degrees-programs' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    thumbnail: z.optional(z.string()),
    length: z.optional(z.string()),
    credits: z.number(),
    category: z.enum(["doctor", "master", "diploma", "certificate"]),
    redirect: z.optional(z.string()),
  }),
});

const jobs = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/content/jobs' }),
  schema: z.object({
    title: z.string(),
    location: z.string(),
    date: z.date(),
    file: z.optional(z.string()),
  }),
});

const carousel = defineCollection({
  loader: glob({ pattern: ['carousel.yml'], base: 'src/content/homepage' }),
  schema: z.array(z.object({
    link: z.string().optional(),
    image: z.string(),
    newWindow: z.boolean().optional(),
  }))
});

const shortcuts = defineCollection({
  loader: glob({ pattern: ['shortcuts.yml'], base: 'src/content/homepage' }),
  schema: z.object({
    zh: z.array(z.object({
      name: z.string(),
      url: z.string(),
      type: z.string().optional(),
      breakBefore: z.boolean().optional(),
    })),
    en: z.array(z.object({
      name: z.string(),
      url: z.string(),
      type: z.string().optional(),
      breakBefore: z.boolean().optional(),
    })),
  })
});

const translation = defineCollection({
  loader: glob({ pattern: ['translation.yml'], base: 'src/content/translation' }),
  schema: z.record(z.object({
    en: z.string(),
    zh: z.string(),
  }))
});

const menuItemSchema = z.object({
  page: z.string(),
  noUrl: z.boolean().optional(),
  includeChildren: z.boolean().optional(),
  get children(): z.ZodOptional<z.ZodArray<any>> {
    return z.array(menuItemSchema).optional();
  }
});

const menu = defineCollection({
  loader: glob({ pattern: ['en.yml', 'zh.yml'], base: 'src/content/menu' }),
  schema: z.array(menuItemSchema),
});

export const collections = {
  pages,
  news,
  faculty,
  jobs,
  "degrees-widget": degreesWidget,
  "study-mode-widget": studyModeWidget,
  "degrees-programs": degreesPrograms,
  "adjunct-prof": adjunctProf,
  carousel,
  shortcuts,
  translation,
  menu,
};