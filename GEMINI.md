# CWTS Web Project Architecture

This document provides a high-level overview of the `cwts-web` project architecture for developers and AI agents.

## Project Overview

This is the official website for Christian Witness Theological Seminary (CWTS), built as a static site using [Astro](https://astro.build/). It serves content in multiple languages (English and Chinese) and manages complex data like degree programs, faculty profiles, and news via structured content collections.

## Technology Stack

-   **Framework:** [Astro v5](https://astro.build/)
    -   Static Site Generation (SSG).
    -   File-based routing.
-   **UI Library:** [React v19](https://react.dev/) (via `@astrojs/react`) for interactive components.
-   **Styling:** [Tailwind CSS v3](https://tailwindcss.com/)
    -   Configured with `postcss-import` and nesting.
    -   Custom typography plugins.
-   **Content:**
    -   **MDX/Markdown:** Primary format for pages and articles.
    -   **YAML:** Used for configuration, menus, and simple data lists (carousel, shortcuts).
    -   **CSV:** Used for tabular data like assembly schedules.
-   **Icons:** `astro-icon` for SVG icon management.
-   **Build & Tooling:**
    -   `npm` for dependency management.
    -   `tsx` for running TypeScript scripts in `tools/`.
    -   Likely deployed to Netlify (indicated by `netlify-redirect-parser`).

## Project Structure

```
cwts-web/
├── astro.config.mjs        # Astro configuration (integrations, site URL)
├── package.json            # Dependencies and scripts
├── public/                 # Static assets (PDFs, raw images, robots.txt)
│   ├── docs/               # Downloadable documents (newsletters, forms)
│   └── images/             # Optimized images for the site
├── src/
│   ├── assets/             # CSS, fonts, and images processed by Astro
│   ├── components/         # Reusable UI components (React & Astro)
│   │   ├── common/         # Generic UI elements
│   │   ├── header/         # Navigation and header logic
│   │   ├── footer/         # Site footer
│   │   └── home/           # Homepage-specific widgets
│   ├── content/            # The "Database" of the site (Content Collections)
│   │   ├── config.ts       # Content collection schemas (Zod)
│   │   ├── csv/            # Tabular data (assembly schedules)
│   │   ├── degrees-programs/ # Degree program details
│   │   ├── degrees-widget/  # Content for degrees widget
│   │   ├── faculty/        # Faculty profiles and adjunct list
│   │   ├── homepage/       # Homepage data (carousel, shortcuts, etc.)
│   │   ├── jobs/           # Job postings
│   │   ├── menu/           # Navigation menu definitions (YAML)
│   │   ├── news/           # News items
│   │   ├── pages/          # Main site pages (MD/MDX)
│   │   ├── study-mode-widget/ # Study mode info
│   │   └── translation/    # Site-wide translations
│   ├── icons/              # SVG icons
│   ├── layouts/            # Page templates
│   │   ├── Base.astro      # Master layout with HTML head, header, and footer
│   │   ├── Redirect.astro  # Layout for client-side redirects
│   │   ├── Section.astro   # Standard layout for content sections with cover images
│   │   └── SectionNoCover.astro # Content layout without the top cover image
│   ├── libs/               # Utility functions and business logic
│   │   ├── breadcrumbs.ts  # Breadcrumb navigation generator
│   │   ├── csv_data.ts     # CSV parsing and data handling
│   │   ├── degrees_programs.ts # Degree program data processing
│   │   ├── degrees_widget.ts # Degree widget logic
│   │   ├── faculty.ts      # Faculty data processing
│   │   ├── language.ts     # I18n and locale utilities
│   │   ├── listing.ts      # Page listing and directory logic
│   │   ├── menu.ts         # Navigation menu processing
│   │   ├── redirects.ts    # Redirect logic
│   │   ├── shortcuts.ts    # Homepage shortcuts processing
│   │   ├── site.ts         # Site-wide configuration and metadata
│   │   ├── study_mode_widget.ts # Study mode widget logic
│   │   └── types.ts        # Global TypeScript interfaces
│   ├── pages/              # Astro routes
│   │   ├── index.astro     # Root homepage (redirects)
│   │   ├── en/index.astro  # English homepage
│   │   ├── [language]/
│   │   │   ├── search.astro # Search results page
│   │   │   ├── [...slug].astro # Catch-all for most content pages
│   │   │   ├── academic/
│   │   │   │   ├── degrees-programs/
│   │   │   │   │   ├── index.astro     # Degrees listing
│   │   │   │   │   └── [...slug].astro # Program details
│   │   │   │   └── faculty/
│   │   │   │       ├── index.astro     # Faculty listing
│   │   │   │       ├── [...slug].astro # Faculty bios
│   │   │   │       └── adjunct-professors.astro
│   │   │   └── student-life/
│   │   │       └── job-posting/
│   │   │           ├── index.astro     # Job board
│   │   │           └── [slug].astro    # Job details
│   │   └── [...redirectFrom].astro # Legacy URL redirect handler
│   └── scripts/            # Client-side interactions
├── tools/                  # Maintenance scripts
│   ├── process-images.ts   # Image processing pipeline
│   └── process-pdfs.ts     # PDF cover generation for newsletters
└── assets-original/        # Source directory for high-res assets (not deployed)
```

## Page Generation
HTML page generation starts from `src/pages/`.
-   **Standard Content:** Most content pages map directly to the `pages` content collection via `src/pages/[language]/[...slug].astro`. This catch-all route queries the collection and renders the content.
-   **Special Pages:** Specific routes in `src/pages/` (e.g., homepage, faculty listings) override the catch-all pattern to provide custom logic or layouts.
-   **Layouts:** Pages typically wrap their content in a layout component (e.g., `src/layouts/Base.astro` or `Section.astro`) which provides the common HTML structure (header, footer, metadata).
-   **Components:** Pages import specific UI components from `src/components/` to build complex interfaces beyond standard Markdown.

## Homepage Implementation
The homepage is a specialized page (`src/pages/index.astro` and `src/pages/en/index.astro`) composed of modular widgets.
-   **Widgets:** The homepage logic is implemented via independent components located in `src/components/home/`.
-   **Key Widgets:**
    -   `VisionAndMission`: Displays the school's core values.
    -   `WhyUs`: Highlights unique selling points.
    -   `News`: Fetches and displays recent news items from the content collection.
    -   `Degrees`: Showcases degree programs.
    -   `StudyModes`: Explains available learning formats.
    -   `Faculty`: Highlights faculty members.

## Navigation
Navigation is data-driven and defined in YAML files.
-   **Data Source:** `src/content/menu/en.yml` and `zh.yml` define the menu structure.
-   **Logic:** `src/libs/menu.ts` processes these YAML files. It can automatically resolve links to internal pages by their slug (`page: path/to/page`) or accept manual URLs. It also handles hierarchical nesting for dropdowns.
-   **Rendering:** The `Navbar.astro` component fetches the processed menu data and renders the responsive navigation bar, including dropdowns (`NavbarDropdown.astro`) and mobile menus (`MobileNavbar.astro`).

## News and Carousel
The "Latest News" section on the homepage combines dynamic news items and a featured carousel.
-   **Carousel Implementation:**
    -   **Data:** Carousel items (images and links) are defined in `src/content/homepage/carousel.yml`.
    -   **Component:** `Carousel.tsx` is a React component that uses the **Swiper** library (`swiper/react`) for navigation, pagination, and autoplay functionality.
    -   **Usage:** It is rendered within the `News.astro` widget with `client:idle` to ensure it hydrates on the client side without blocking initial page load.
-   **News Items:**
    -   **Collection:** News articles are stored in `src/content/news/`.
    -   **Logic:** `News.astro` fetches all news items, sorts them by date in descending order, and displays the top 4.
    -   **Rendering:** Each news item displays its thumbnail, title, and a snippet of its content (rendered via `render(page)`).

## Faculty Profiles
Faculty information is managed through a combination of Markdown files and YAML data, rendered across widgets and dedicated pages.
-   **Data Structure:**
    -   **Core Faculty:** Stored as individual MDX files in `src/content/faculty/`. Frontmatter defines metadata like name, photo, category ("faculty", "senior-adjunct", "adjunct"), and courses.
    -   **Adjunct Faculty:** Stored as a list in `src/content/faculty/[language]/adjunct-prof.yml` for simpler management of large lists.
-   **Data Processing (`src/libs/faculty.ts`):
    -   Aggregates data from both content collections.
    -   Generates URLs for individual profiles or anchor links for adjuncts.
    -   Categorizes faculty by type and language.
-   **Rendering:**
    -   **Homepage Widget (`src/components/home/Faculty.astro`):** Displays a grid of core faculty members with their photos and key roles.
    -   **Listing Page (`src/pages/[language]/academic/faculty/index.astro`):** Lists all faculty members grouped by category, rendering a summary card for each.
    -   **Profile Page (`src/pages/[language]/academic/faculty/[...slug].astro`):** Renders the full biography from the MDX content, along with detailed metadata like education history and courses taught.

## Degrees and Programs
Academic program information is presented both as a full listing and a summarized homepage widget.
-   **Full Program Listing:**
    -   **Data:** Stored in `src/content/degrees-programs/`.
    -   **Page:** `src/pages/[language]/academic/degrees-programs/index.astro` renders the main listing.
    -   **Logic:** `src/libs/degrees_programs.ts` fetches and sorts programs.
    -   **Interactivity:** A React component `DegreesProgramsListing` provides client-side filtering by degree category (e.g., Master, Doctor, Diploma).
-   **Homepage Widget:**
    -   **Data:** Structure defined in `src/content/homepage/degrees-widget.yml` (hierarchy) and content in `src/content/degrees-widget/` (descriptions).
    -   **Logic:** `src/libs/degrees_widget.ts` maps the hierarchical structure to the actual content pages.
    -   **Rendering:** `src/components/home/Degrees.astro` uses a custom `Tabs` component to display programs in a tabbed interface (or accordion on mobile).

## Job Postings
The seminary provides a job board for students and alumni, managed through the `jobs` content collection.
-   **Data Storage:** Job postings are stored in `src/content/jobs/` as Markdown files.
-   **Frontmatter:** Key fields include `title`, `location`, `date`, and an optional `file` path for PDF postings.
-   **Rendering Logic:**
    -   **List View:** `src/components/section/JobPostingList.astro` fetches all jobs and sorts them by date.
    -   **Linking:** If a `file` (PDF) is specified, the link points directly to the document. Otherwise, it links to a generated content page.
    -   **Detail Pages:** `src/pages/[language]/student-life/job-posting/[slug].astro` dynamically generates pages for job postings that use Markdown content instead of PDFs.

## Assembly Schedule (CSV Integration)
The Assembly (早會) page uses a unique approach to manage frequently updated tabular data.
-   **Data Source:** Schedules are stored as CSV files in `src/content/csv/assembly/`. This allows administrators to manage data in spreadsheets (like Google Sheets) and export them to the repository.
-   **Data Loading:** `src/libs/csv_data.ts` uses `import.meta.glob` to dynamically load CSV files based on their path.
-   **Rendering:** The `CsvTable.astro` component parses the CSV and renders it as an HTML table.
-   **Special Column Handling:** The component supports a suffix-based naming convention for columns:
    -   `ColumnName.video`: Renders a video icon linking to the URL in the cell.
    -   `ColumnName.audio`: Renders an audio icon linking to the URL in the cell.
    -   This allows merging multiple data points (like a title and its media links) into a single logical column in the UI.

## Styling & Theming
The project uses Tailwind CSS with a custom configuration defined in `tailwind.config.cjs`.
-   **Color Palette:** Custom colors include `darkviolet` (#410659), `maxpurple` (#6E4080), `darkblue` (#211F54), and `beige` (#F8F5F4).
-   **Typography:** A custom typography theme overrides standard Prose defaults, setting specific colors, spacing, and font sizes for better readability in both Chinese and English.

## Redirects & Legacy URLs
To support legacy URLs from previous versions of the site, a robust redirect system is in place.
-   **Definitions:** Redirects are defined in `public/_redirects` (Netlify format).
-   **Dynamic Generation:** `src/pages/[...redirectFrom].astro` reads this file via `netlify-redirect-parser` and generates static redirect pages for every entry.
-   **Benefit:** This ensures redirects work client-side even if the hosting platform's native redirect engine isn't fully utilized or for local development.

## Search Functionality
Site-wide search is implemented using **Google Custom Search Engine (CSE)**.
-   **Page:** `src/pages/[language]/search.astro` renders the search interface.
-   **Integration:** It embeds the Google CSE script (`cse.js`) and initializes the search box and results container.
-   **Scope:** The search results are scoped to the site domains configured in the Google CSE control panel (ID: `47728d3b7262a4617`).

## Translation (i18n) System
While content pages are separated by directory (`src/content/pages/zh/` vs `/en/`), UI strings are managed via a centralized translation system.
-   **Data:** `src/content/translation/translation.yml` contains key-value pairs for UI labels (e.g., "Menu", "Read More", "Search").
-   **Helper:** `src/libs/language.ts` exports a type-safe `T(key, language)` function to retrieve the correct string for the current locale.

### Custom Scripts (`tools/`)
-   **Image Processing:** `npm run process-images` takes raw images from `assets-original/` and outputs optimized versions to `public/images/`.
-   **PDF Processing:** `npm run process-pdfs` generates cover thumbnails for PDF newsletters.

## Development Workflow

1.  **Start Dev Server:** `npm run dev` (runs on `localhost:3000`).
2.  **Build & Verification:**
    -   Run `npm run build` to generate the production artifact in `dist/`.
    -   **Important:** Always run the build command locally to verify that changes are made correctly. The build process performs validation on content schemas, internal links, and component logic that might not be caught during development.

