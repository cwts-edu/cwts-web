import { getEntryBySlug } from "astro:content";
import { getLanguageBySlug } from "./language";

interface Breadcrumb {
  title: string;
  link: string;
}

const facultyPrefix = "academic/faculty/";

async function getBreadcrumbBySlug(s: string): Promise<Breadcrumb | undefined> {
  try {
    const { language, slug } = getLanguageBySlug(s);
    if (slug.startsWith(facultyPrefix)) {
      const pageSlug = slug.substring(facultyPrefix.length);
      const page = await getEntryBySlug("faculty", `${language}/${pageSlug}`);
      return (
        page && {
          title: page.data.name,
          link: "/" + s,
        }
      );
    }

    const page = await getEntryBySlug("pages", s);
    return (
      page && {
        title: page.data.title,
        link: "/" + s,
      }
    );
  } catch {
    return undefined;
  }
}

export async function getBreadcrumbList(
  slug: string,
  includeCurrent: boolean
): Promise<Breadcrumb[]> {
  const parts = slug.split("/");
  const links = await Promise.all(
    parts.map((_, index) =>
      getBreadcrumbBySlug(parts.slice(0, index).join("/"))
    )
  );
  if (includeCurrent) {
    links.push(await getBreadcrumbBySlug(slug));
  }
  const result: Breadcrumb[] = [];
  links.forEach((link) => {
    if (link) {
      result.push(link);
    }
  });
  return result;
}
