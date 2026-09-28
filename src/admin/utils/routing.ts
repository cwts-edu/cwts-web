import { PAGE_TYPES } from "../config/pageTypes";
import type { AdminTab } from "../components/AdminLayout";

export interface AdminRouteState {
  tab: AdminTab;
  param?: string;
}

export function parseAdminLocation(): AdminRouteState {
  if (typeof window === "undefined") {
    return { tab: "dashboard" };
  }
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/admin";
  const searchParams = new URLSearchParams(window.location.search);
  const idParam = searchParams.get("id") || undefined;

  for (const pt of PAGE_TYPES) {
    if (pt.hasNew && pathname === `${pt.path}/new`) {
      return { tab: `${pt.id}_new` as AdminTab };
    }
    if (pt.hasEdit && pathname === `${pt.path}/edit`) {
      return { tab: `${pt.id}_edit` as AdminTab, param: idParam };
    }
    if (pathname === pt.path) {
      return { tab: pt.id as AdminTab };
    }
  }

  return { tab: "dashboard" };
}

export function buildAdminUrl(tab: AdminTab, param?: string): string {
  if (tab === "dashboard") return "/admin";

  let basePath = "/admin";
  for (const pt of PAGE_TYPES) {
    if (tab === pt.id) {
      basePath = pt.path;
      break;
    }
    if (pt.hasNew && tab === `${pt.id}_new`) {
      basePath = `${pt.path}/new`;
      break;
    }
    if (pt.hasEdit && tab === `${pt.id}_edit`) {
      basePath = `${pt.path}/edit`;
      break;
    }
  }

  const query = new URLSearchParams();
  if (param) query.set("id", param);

  if (typeof window !== "undefined") {
    const curParams = new URLSearchParams(window.location.search);
    const lang = curParams.get("lang");
    const category = curParams.get("category");
    if (lang && !query.has("lang")) query.set("lang", lang);
    if (category && !query.has("category")) query.set("category", category);
  }

  const qStr = query.toString();
  return qStr ? `${basePath}?${qStr}` : basePath;
}
