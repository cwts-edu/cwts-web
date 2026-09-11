export type NavGroup = "overview" | "homepage" | "collections" | "tools";

export interface PageTypeConfig {
  id: string;
  title: string;
  path: string;
  icon?: string;
  group: NavGroup;
  collectionName?: string;
  hasNew?: boolean;
  hasEdit?: boolean;
  description?: string;
}

export const NAV_GROUPS: { id: NavGroup; title: string }[] = [
  { id: "overview", title: "Overview" },
  { id: "homepage", title: "Homepage Data" },
  { id: "collections", title: "Collections" },
  { id: "tools", title: "Tools & System" },
];

/**
 * Central registry of all Admin page types, collections, and tools.
 * Adding an entry here automatically configures:
 *  1. Sidebar navigation & groupings
 *  2. URL path parsing (e.g. /admin/pages, /admin/pages/new, /admin/pages/edit?id=...)
 *  3. Dynamic URL generation (buildAdminUrl)
 *  4. Astro SSG static paths generation ([...app].astro)
 */
export const PAGE_TYPES: PageTypeConfig[] = [
  // Overview
  {
    id: "dashboard",
    title: "Dashboard",
    path: "/admin",
    icon: "📊",
    group: "overview",
  },
  // 1. Homepage Data Group
  {
    id: "homepage_carousel",
    title: "Hero Carousel",
    path: "/admin/homepage/carousel",
    icon: "🎠",
    group: "homepage",
    collectionName: "carousel",
    hasNew: true,
    hasEdit: true,
    description: "Homepage hero banner carousel slides and links",
  },
  {
    id: "news",
    title: "Latest News",
    path: "/admin/news",
    icon: "📰",
    group: "homepage",
    collectionName: "news",
    hasNew: true,
    hasEdit: true,
    description: "Homepage news announcements and articles",
  },
  {
    id: "homepage_degrees",
    title: "Degrees Widget",
    path: "/admin/homepage/degrees",
    icon: "🎓",
    group: "homepage",
    collectionName: "degrees-widget",
    hasNew: true,
    hasEdit: true,
    description: "Homepage degree program tabs and category highlights",
  },
  {
    id: "homepage_studymodes",
    title: "Study Modes",
    path: "/admin/homepage/study-modes",
    icon: "📖",
    group: "homepage",
    collectionName: "study-mode-widget",
    hasNew: true,
    hasEdit: true,
    description: "Homepage learning format descriptions",
  },
  {
    id: "homepage_shortcuts",
    title: "Shortcuts",
    path: "/admin/homepage/shortcuts",
    icon: "⚡",
    group: "homepage",
    collectionName: "shortcuts",
    description: "Homepage quick action buttons",
  },
  {
    id: "homepage_menu",
    title: "Navigation Menu",
    path: "/admin/homepage/menu",
    icon: "🧭",
    group: "homepage",
    collectionName: "menu",
    description: "Desktop navbar dropdowns and mobile drawer navigation tree",
  },
  // 2. Site Collections
  {
    id: "faculty",
    title: "Faculty & Adjuncts",
    path: "/admin/faculty",
    icon: "👤",
    group: "collections",
    collectionName: "faculty",
    hasNew: true,
    hasEdit: true,
    description: "Faculty biographies, courses, and adjunct listings",
  },
  {
    id: "degrees_programs",
    title: "Degrees & Programs",
    path: "/admin/degrees-programs",
    icon: "🎓",
    group: "collections",
    collectionName: "degrees-programs",
    hasNew: true,
    hasEdit: true,
    description: "Academic degree programs, certificates, credits, and requirements",
  },
  {
    id: "jobs",
    title: "Job Postings",
    path: "/admin/jobs",
    icon: "💼",
    group: "collections",
    collectionName: "jobs",
    hasNew: true,
    hasEdit: true,
    description: "Church and ministry job postings",
  },
  {
    id: "assembly",
    title: "Assembly (早會)",
    path: "/admin/assembly",
    icon: "⛪",
    group: "collections",
    collectionName: "assembly",
    hasNew: true,
    hasEdit: true,
    description: "Weekly chapel assembly schedules, speakers, topics, and recordings",
  },
  {
    id: "newsletter",
    title: "Newsletter (院訊)",
    path: "/admin/newsletter",
    icon: "📰",
    group: "collections",
    collectionName: "newsletter",
    hasNew: true,
    hasEdit: true,
    description: "Seminary quarterly newsletter PDF documents and cover image assets",
  },
  {
    id: "pages",
    title: "Content Pages",
    path: "/admin/pages",
    icon: "📄",
    group: "collections",
    collectionName: "pages",
    hasNew: true,
    hasEdit: true,
    description: "Main website content pages and hierarchical section tree",
  },
  // 3. Tools & System
  {
    id: "media",
    title: "Media Library",
    path: "/admin/media",
    icon: "🖼️",
    group: "tools",
    description: "Browse, upload, crop, and manage storage assets",
  },
  {
    id: "backup",
    title: "Backup & Restore",
    path: "/admin/backup",
    icon: "💾",
    group: "tools",
    description: "Export full ZIP packages or restore collections cleanly",
  },
];

/**
 * Generate Astro static paths for all registered page types and subroutes
 */
export const ADMIN_STATIC_PATHS = [
  { params: { app: undefined } },
  { params: { app: "dashboard" } },
  ...PAGE_TYPES.flatMap((pt) => {
    if (pt.path === "/admin") return [];
    const rel = pt.path.replace(/^\/admin\/?/, "");
    const paths = [{ params: { app: rel } }];
    if (pt.hasNew) paths.push({ params: { app: `${rel}/new` } });
    if (pt.hasEdit) paths.push({ params: { app: `${rel}/edit` } });
    return paths;
  }),
];
