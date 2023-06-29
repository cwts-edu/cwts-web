import { getEntryBySlug } from "astro:content";
import { getLanguageBySlug } from "./language";

interface Breadcrumb {
  title: string;
  link: string;
  isSelf: boolean;
}

const facultyPrefix = "academic/faculty/";

async function getBreadcrumbBySlug(
  s: string,
  isSelf: boolean
): Promise<Breadcrumb | undefined> {
  try {
    const { language, slug } = getLanguageBySlug(s);
    if (slug.startsWith(facultyPrefix)) {
      const pageSlug = slug.substring(facultyPrefix.length);
      const page = await getEntryBySlug("faculty", `${language}/${pageSlug}`);
      return (
        page && {
          title: page.data.name,
          link: "/" + s,
          isSelf,
        }
      );
    }

    const page = await getEntryBySlug("pages", s);
    return (
      page && {
        title: page.data.title,
        link: "/" + s,
        isSelf,
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
      getBreadcrumbBySlug(parts.slice(0, index).join("/"), false)
    )
  );
  if (includeCurrent) {
    links.push(await getBreadcrumbBySlug(slug, true));
  }
  const result: Breadcrumb[] = [];
  links.forEach((link) => {
    if (link) {
      result.push(link);
    }
  });
  return result;
}
