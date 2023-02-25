import { getEntryBySlug } from "astro:content";

interface Breadcrumb {
  title: string;
  link: string;
}

async function getBreadcrumbBySlug(s: string): Promise<Breadcrumb | undefined> {
  const page = await getEntryBySlug("pages", s);
  return (
    page && {
      title: page.data.title,
      link: "/" + page.slug,
    }
  );
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
