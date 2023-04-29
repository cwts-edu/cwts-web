import { parseAllRedirects } from "netlify-redirect-parser";

export default async function getRedirects() {
  const { redirects } = await parseAllRedirects({
    redirectsFiles: ["public/_redirects"],
  });
  return redirects as {
    from: string;
    to: string;
    status: number;
    force: boolean;
  }[];
}
