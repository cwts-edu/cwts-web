import { z } from "zod";

export type Language = "zh" | "en";
export type FacultyCategory = "faculty" | "senior-adjunct" | "adjunct";
export type DegreeCategory = "doctor" | "master" | "diploma" | "certificate";

function normalizeSiteUrl(val: string): string {
  if (!val) return val;
  if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/")) {
    return val;
  }
  return `/${val}`;
}

// 1. Pages Schema
export const PageMetadataSchema = z.object({
  title: z.string(),
  order: z.number(),
  coverImage: z.string().optional().transform((v) => (v ? normalizeSiteUrl(v) : v)),
  thumbnail: z.string().optional().transform((v) => (v ? normalizeSiteUrl(v) : v)),
  showChildren: z.boolean().optional(),
  referencedAssets: z.array(z.string()).optional(),
});
export type PageMetadata = z.infer<typeof PageMetadataSchema>;

// 2. News Schema
export const NewsMetadataSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  thumbnail: z.string().transform(normalizeSiteUrl),
  url: z.string().transform(normalizeSiteUrl),
  referencedAssets: z.array(z.string()).optional(),
});
export type NewsMetadata = z.infer<typeof NewsMetadataSchema>;

// 3. Faculty Schema
export const FacultyMetadataSchema = z.object({
  photo: z.string().optional(),
  name: z.string(),
  category: z.enum(["faculty", "senior-adjunct", "adjunct"]),
  order: z.number().optional(),
  email: z.string().email().optional(),
  positions: z.array(z.string()).optional(),
  courses: z.array(z.string()),
  degrees: z.array(z.string()),
  moreDegrees: z.array(z.string()).optional(),
  former: z.array(z.string()).optional(),
  referencedAssets: z.array(z.string()).optional(),
});
export type FacultyMetadata = z.infer<typeof FacultyMetadataSchema>;

// 4. Degrees Programs Schema
export const DegreeProgramMetadataSchema = z.object({
  title: z.string(),
  order: z.number(),
  thumbnail: z.string().optional(),
  length: z.string().optional(),
  credits: z.number(),
  category: z.enum(["doctor", "master", "diploma", "certificate"]),
  redirect: z.string().optional(),
  referencedAssets: z.array(z.string()).optional(),
});
export type DegreeProgramMetadata = z.infer<typeof DegreeProgramMetadataSchema>;

// 5. Degrees Widget Schema
export const DegreeProgramItemSchema = z.object({
  title: z.string(),
  body: z.string().default(""),
  bodyJson: z.any().optional(),
  bodyHtml: z.string().optional(),
  open: z.boolean().optional(),
});
export type DegreeProgramItem = z.infer<typeof DegreeProgramItemSchema>;

export const DegreesWidgetMetadataSchema = z.object({
  title: z.string(),
  order: z.number().default(0),
  url: z.string().optional(),
  programs: z.array(DegreeProgramItemSchema).default([]),
});
export type DegreesWidgetMetadata = z.infer<typeof DegreesWidgetMetadataSchema>;

// 6. Study Mode Widget Schema
export const StudyModeWidgetMetadataSchema = z.object({
  title: z.string(),
  order: z.number().default(0),
  url: z.string().optional(),
  body: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyJson: z.any().optional(),
});
export type StudyModeWidgetMetadata = z.infer<typeof StudyModeWidgetMetadataSchema>;

// 7. Jobs Schema
export const JobMetadataSchema = z.object({
  title: z.string(),
  location: z.string(),
  date: z.coerce.date(),
  file: z.string().optional().transform((v) => (v ? normalizeSiteUrl(v) : v)),
  referencedAssets: z.array(z.string()).optional(),
});
export type JobMetadata = z.infer<typeof JobMetadataSchema>;

// 8. Carousel Schema
export const CarouselItemSchema = z.object({
  order: z.number().optional(),
  link: z.string().optional(),
  image: z.string().transform(normalizeSiteUrl),
  newWindow: z.boolean().optional(),
  referencedAssets: z.array(z.string()).optional(),
});
export type CarouselItem = z.infer<typeof CarouselItemSchema>;

// 9. Shortcuts Schema
export const ShortcutItemSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.string().optional(),
  breakBefore: z.boolean().optional(),
});
export type ShortcutItem = z.infer<typeof ShortcutItemSchema>;

export const ShortcutsSchema = z.object({
  zh: z.array(ShortcutItemSchema),
  en: z.array(ShortcutItemSchema),
});
export type ShortcutsData = z.infer<typeof ShortcutsSchema>;

// 10. Translation Schema
export const TranslationDictionarySchema = z.record(
  z.object({
    en: z.string(),
    zh: z.string(),
  })
);
export type TranslationDictionary = z.infer<typeof TranslationDictionarySchema>;

// 11. Menu Schema
export const MenuItemSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string().optional(),
    page: z.string().optional(),
    url: z.string().optional(),
    noUrl: z.boolean().optional(),
    includeChildren: z.boolean().optional(),
    children: z.array(MenuItemSchema).optional(),
  })
);
export type MenuItem = z.infer<typeof MenuItemSchema>;

// Central Collection Schema Registry
export interface ContentSchemaMap {
  pages: PageMetadata;
  news: NewsMetadata;
  faculty: FacultyMetadata;
  "adjunct-prof": FacultyMetadata[];
  "degrees-programs": DegreeProgramMetadata;
  "degrees-widget": DegreesWidgetMetadata;
  "study-mode-widget": StudyModeWidgetMetadata;
  jobs: JobMetadata;
  carousel: CarouselItem;
  shortcuts: ShortcutsData;
  translation: TranslationDictionary;
  menu: MenuItem[];
}

export const SchemaValidators: { [K in keyof ContentSchemaMap]: z.ZodType<any> } = {
  pages: PageMetadataSchema,
  news: NewsMetadataSchema,
  faculty: FacultyMetadataSchema,
  "adjunct-prof": z.array(FacultyMetadataSchema),
  "degrees-programs": DegreeProgramMetadataSchema,
  "degrees-widget": DegreesWidgetMetadataSchema,
  "study-mode-widget": StudyModeWidgetMetadataSchema,
  jobs: JobMetadataSchema,
  carousel: CarouselItemSchema,
  shortcuts: ShortcutsSchema,
  translation: TranslationDictionarySchema,
  menu: z.array(MenuItemSchema),
};
