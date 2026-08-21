import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DraftProvider, useDraft } from "./context/DraftContext";
import { AuthGate } from "./components/AuthGate";
import { AdminLayout, type AdminTab } from "./components/AdminLayout";
import { DashboardView } from "./views/DashboardView";
import { NewsListView, type NewsItem } from "./views/NewsListView";
import { NewsEditView } from "./views/NewsEditView";
import { JobsListView, type JobItem } from "./views/JobsListView";
import { JobsEditView } from "./views/JobsEditView";
import { FacultyListView, type UnifiedFacultyItem } from "./views/FacultyListView";
import { FacultyEditView } from "./views/FacultyEditView";
import { CarouselListView, type CarouselSlideItem } from "./views/CarouselListView";
import { CarouselEditView } from "./views/CarouselEditView";
import { DegreesWidgetListView, type DegreesWidgetItem } from "./views/DegreesWidgetListView";
import { DegreesWidgetEditView } from "./views/DegreesWidgetEditView";
import { StudyModeWidgetListView, type StudyModeWidgetItem } from "./views/StudyModeWidgetListView";
import { StudyModeWidgetEditView } from "./views/StudyModeWidgetEditView";
import { ShortcutsManagerView } from "./views/ShortcutsManagerView";
import { BackupRestoreView } from "./views/BackupRestoreView";
import { MediaLibraryView } from "./views/MediaLibraryView";
import { db } from "./config/firebase";
import { collection, getDocs } from "firebase/firestore";
import type {
  NewsMetadata,
  JobMetadata,
  CarouselItem,
  DegreesWidgetMetadata,
  StudyModeWidgetMetadata,
  ShortcutsData,
  Language,
} from "../libs/content/schemas";

import { PAGE_TYPES } from "./config/pageTypes";

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

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();

  const [currentTab, setCurrentTab] = useState<AdminTab>(() => parseAdminLocation().tab);
  const [editingId, setEditingId] = useState<string | null>(() => parseAdminLocation().param || null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [faculty, setFaculty] = useState<UnifiedFacultyItem[]>([]);
  const [carousel, setCarousel] = useState<CarouselSlideItem[]>([]);
  const [degreesWidget, setDegreesWidget] = useState<DegreesWidgetItem[]>([]);
  const [studyModes, setStudyModes] = useState<StudyModeWidgetItem[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutsData>({ zh: [], en: [] });

  const [loadingCollections, setLoadingCollections] = useState<Record<string, boolean>>({});
  const [loadedCollections, setLoadedCollections] = useState<Record<string, boolean>>({});

  // Sync state when user presses browser Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const route = parseAdminLocation();
      setCurrentTab(route.tab);
      setEditingId(route.param || null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 1. Fetch News on-demand
  const loadNews = useCallback(async () => {
    setLoadingCollections((prev) => ({ ...prev, news: true }));
    try {
      const newsSnap = await getDocs(collection(db, "news"));
      const loadedNews: NewsItem[] = [];
      newsSnap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loadedNews.push({
          id: d.id,
          data: {
            title: val.title,
            date: val.date?.toDate ? val.date.toDate() : new Date(val.date),
            thumbnail: val.thumbnail,
            url: val.url,
          },
          body: val.body || "",
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
        });
      });
      setNews(loadedNews);
      setLoadedCollections((prev) => ({ ...prev, news: true }));
    } catch (err) {
      console.warn("Could not load news from Firestore:", err);
    } finally {
      setLoadingCollections((prev) => ({ ...prev, news: false }));
    }
  }, []);

  // 2. Fetch Jobs on-demand
  const loadJobs = useCallback(async () => {
    setLoadingCollections((prev) => ({ ...prev, jobs: true }));
    try {
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const loadedJobs: JobItem[] = [];
      jobsSnap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loadedJobs.push({
          id: d.id,
          data: {
            title: val.title,
            location: val.location,
            date: val.date?.toDate ? val.date.toDate() : new Date(val.date),
            ...(val.file ? { file: val.file } : {}),
          },
          body: val.body || "",
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
        });
      });
      setJobs(loadedJobs);
      setLoadedCollections((prev) => ({ ...prev, jobs: true }));
    } catch (err) {
      console.warn("Could not load jobs from Firestore:", err);
    } finally {
      setLoadingCollections((prev) => ({ ...prev, jobs: false }));
    }
  }, []);

  // 3. Fetch Faculty on-demand
  const loadFaculty = useCallback(async () => {
    setLoadingCollections((prev) => ({ ...prev, faculty: true }));
    try {
      const snap = await getDocs(collection(db, "faculty"));
      const loadedFaculty: UnifiedFacultyItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted" || d.id === "_order") return;
        loadedFaculty.push({
          id: d.id,
          category: val.category || "faculty",
          order: val.order ?? 0,
          photo: val.photo,
          email: val.email,
          zh: val.zh || { name: d.id, title: "", bio: "" },
          en: val.en || { name: d.id, title: "", bio: "" },
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setFaculty(loadedFaculty);
      setLoadedCollections((prev) => ({ ...prev, faculty: true }));
    } catch (err) {
      console.warn("Could not load faculty from Firestore:", err);
    } finally {
      setLoadingCollections((prev) => ({ ...prev, faculty: false }));
    }
  }, []);

  // 4. Fetch Carousel on-demand
  const loadCarousel = useCallback(async () => {
    setLoadingCollections((prev) => ({ ...prev, carousel: true }));
    try {
      const snap = await getDocs(collection(db, "carousel"));
      const loaded: CarouselSlideItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loaded.push({
          id: d.id,
          order: val.order ?? 999,
          link: val.link,
          image: val.image,
          newWindow: val.newWindow,
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setCarousel(loaded);
      setLoadedCollections((prev) => ({ ...prev, carousel: true }));
    } catch (err) {
      console.warn("Could not load carousel from Firestore:", err);
    } finally {
      setLoadingCollections((prev) => ({ ...prev, carousel: false }));
    }
  }, []);

  // 5. Fetch Degrees Widget on-demand
  const loadDegreesWidget = useCallback(async () => {
    setLoadingCollections((prev) => ({ ...prev, "degrees-widget": true }));
    try {
      const snap = await getDocs(collection(db, "degrees-widget"));
      const loaded: DegreesWidgetItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        const lang = (val.language || d.id.split("_")[0] || "zh") as Language;
        const cardType = val.type || d.id.split("_")[1] || "master";
        loaded.push({
          id: d.id,
          language: lang,
          type: cardType,
          data: {
            title: val.title || d.id,
            order: val.order ?? 0,
            url: val.url,
            programs: val.programs || [],
          },
          body: val.body || "",
          bodyHtml: val.bodyHtml || "",
          bodyJson: val.bodyJson || null,
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setDegreesWidget(loaded);
      setLoadedCollections((prev) => ({ ...prev, "degrees-widget": true }));
    } catch (err) {
      console.warn("Could not load degrees-widget from Firestore:", err);
    } finally {
      setLoadingCollections((prev) => ({ ...prev, "degrees-widget": false }));
    }
  }, []);

  // 6. Fetch Study Mode Widget on-demand
  const loadStudyModes = useCallback(async () => {
    setLoadingCollections((prev) => ({ ...prev, "study-mode-widget": true }));
    try {
      const snap = await getDocs(collection(db, "study-mode-widget"));
      const loaded: StudyModeWidgetItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        const lang = (val.language || d.id.split("_")[0] || "zh") as Language;
        const modeType = val.type || d.id.split("_")[1] || "full-time";
        loaded.push({
          id: d.id,
          language: lang,
          type: modeType,
          data: {
            title: val.title || d.id,
            order: val.order ?? 0,
            url: val.url,
          },
          body: val.body || "",
          bodyHtml: val.bodyHtml || "",
          bodyJson: val.bodyJson || null,
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setStudyModes(loaded);
      setLoadedCollections((prev) => ({ ...prev, "study-mode-widget": true }));
    } catch (err) {
      console.warn("Could not load study-mode-widget from Firestore:", err);
    } finally {
      setLoadingCollections((prev) => ({ ...prev, "study-mode-widget": false }));
    }
  }, []);

  // 7. Fetch Shortcuts on-demand
  const loadShortcuts = useCallback(async () => {
    setLoadingCollections((prev) => ({ ...prev, shortcuts: true }));
    try {
      const snap = await getDocs(collection(db, "shortcuts"));
      let loaded: ShortcutsData = { zh: [], en: [] };
      snap.forEach((d) => {
        if (d.id === "shortcuts") {
          const val = d.data();
          loaded = {
            zh: val.zh || [],
            en: val.en || [],
          };
        }
      });
      setShortcuts(loaded);
      setLoadedCollections((prev) => ({ ...prev, shortcuts: true }));
    } catch (err) {
      console.warn("Could not load shortcuts from Firestore:", err);
    } finally {
      setLoadingCollections((prev) => ({ ...prev, shortcuts: false }));
    }
  }, []);

  // Trigger on-demand loading when a relevant tab is opened
  useEffect(() => {
    if (currentTab.startsWith("news") && !loadedCollections.news && !loadingCollections.news) {
      loadNews();
    } else if (currentTab.startsWith("jobs") && !loadedCollections.jobs && !loadingCollections.jobs) {
      loadJobs();
    } else if (currentTab.startsWith("faculty") && !loadedCollections.faculty && !loadingCollections.faculty) {
      loadFaculty();
    } else if (currentTab.startsWith("homepage_carousel") && !loadedCollections.carousel && !loadingCollections.carousel) {
      loadCarousel();
    } else if (currentTab.startsWith("homepage_degrees") && !loadedCollections["degrees-widget"] && !loadingCollections["degrees-widget"]) {
      loadDegreesWidget();
    } else if (currentTab.startsWith("homepage_studymodes") && !loadedCollections["study-mode-widget"] && !loadingCollections["study-mode-widget"]) {
      loadStudyModes();
    } else if (currentTab.startsWith("homepage_shortcuts") && !loadedCollections.shortcuts && !loadingCollections.shortcuts) {
      loadShortcuts();
    }
  }, [
    currentTab,
    loadedCollections,
    loadingCollections,
    loadNews,
    loadJobs,
    loadFaculty,
    loadCarousel,
    loadDegreesWidget,
    loadStudyModes,
    loadShortcuts,
  ]);

  // Global reload (e.g. after restoring backup)
  const reloadAll = useCallback(async () => {
    setLoadedCollections({});
    if (currentTab.startsWith("news")) await loadNews();
    else if (currentTab.startsWith("jobs")) await loadJobs();
    else if (currentTab.startsWith("faculty")) await loadFaculty();
    else if (currentTab.startsWith("homepage_carousel")) await loadCarousel();
    else if (currentTab.startsWith("homepage_degrees")) await loadDegreesWidget();
    else if (currentTab.startsWith("homepage_studymodes")) await loadStudyModes();
    else if (currentTab.startsWith("homepage_shortcuts")) await loadShortcuts();
  }, [
    currentTab,
    loadNews,
    loadJobs,
    loadFaculty,
    loadCarousel,
    loadDegreesWidget,
    loadStudyModes,
    loadShortcuts,
  ]);

  const handleNavigate = (tab: AdminTab, param?: string, replace = false) => {
    if (param) setEditingId(param);
    else setEditingId(null);
    setCurrentTab(tab);

    const targetUrl = buildAdminUrl(tab, param);
    if (replace) {
      window.history.replaceState({}, "", targetUrl);
    } else {
      window.history.pushState({}, "", targetUrl);
    }
  };

  // Draft Handlers - News
  const handleSaveNewsDraft = async (
    docId: string,
    data: NewsMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    await saveChangeToDraft("news", docId, "update", { ...data, bodyJson, bodyHtml }, body);
    handleNavigate("news");
  };

  const handleDeleteNews = async (id: string) => {
    await saveChangeToDraft("news", id, "delete");
  };

  const handleUndoDeleteNews = async (id: string) => {
    await discardDraftChange("news", id);
  };

  // Draft Handlers - Jobs
  const handleSaveJobDraft = async (
    docId: string,
    data: JobMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    await saveChangeToDraft("jobs", docId, "update", { ...data, bodyJson, bodyHtml }, body);
    handleNavigate("jobs");
  };

  const handleDeleteJob = async (id: string) => {
    await saveChangeToDraft("jobs", id, "delete");
  };

  const handleUndoDeleteJob = async (id: string) => {
    await discardDraftChange("jobs", id);
  };

  // Draft Handlers - Faculty
  const handleSaveFacultyDraft = async (
    docId: string,
    facultyData: Partial<UnifiedFacultyItem>,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    await saveChangeToDraft("faculty", docId, "update", { ...facultyData, bodyJson, bodyHtml });
    handleNavigate("faculty");
  };

  const handleDeleteFaculty = async (id: string) => {
    await saveChangeToDraft("faculty", id, "delete");
  };

  // Draft Handlers - Carousel
  const handleSaveCarouselDraft = async (docId: string, data: CarouselItem) => {
    await saveChangeToDraft("carousel", docId, "update", data);
    handleNavigate("homepage_carousel");
  };

  const handleDeleteCarousel = async (id: string) => {
    await saveChangeToDraft("carousel", id, "delete");
  };

  const handleUndoDeleteCarousel = async (id: string) => {
    await discardDraftChange("carousel", id);
  };

  const handleReorderCarousel = async (reorderedIds: string[]) => {
    const promises = reorderedIds.map((id, index) => {
      const existing = carousel.find((c) => c.id === id);
      const updatedData: CarouselItem = {
        order: index + 1,
        image: existing?.image || "",
        link: existing?.link,
        newWindow: existing?.newWindow,
      };
      return saveChangeToDraft("carousel", id, "update", updatedData);
    });
    await Promise.all(promises);
  };

  // Draft Handlers - Degrees Widget
  const handleSaveDegreesWidgetDraft = async (
    docId: string,
    language: Language,
    type: string,
    data: DegreesWidgetMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    const payload = {
      ...data,
      language,
      type,
      bodyJson,
      bodyHtml,
    };
    await saveChangeToDraft("degrees-widget", docId, "update", payload, body);
    handleNavigate("homepage_degrees");
  };

  const handleDeleteDegreesWidget = async (id: string) => {
    await saveChangeToDraft("degrees-widget", id, "delete");
  };

  const handleUndoDeleteDegreesWidget = async (id: string) => {
    await discardDraftChange("degrees-widget", id);
  };

  const handleReorderDegreesWidget = async (reorderedIds: string[]) => {
    const orderMap: Record<string, number> = {};
    reorderedIds.forEach((id, index) => {
      orderMap[id] = index + 1;
    });

    await saveChangeToDraft("degrees-widget", "_order", "update", {
      title: "Degrees Widget Ordering",
      orderMap,
    });
  };

  // Draft Handlers - Study Mode Widget
  const handleSaveStudyModeDraft = async (
    docId: string,
    language: Language,
    type: string,
    data: StudyModeWidgetMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    const payload = {
      ...data,
      language,
      type,
      bodyJson,
      bodyHtml,
    };
    await saveChangeToDraft("study-mode-widget", docId, "update", payload, body);
    handleNavigate("homepage_studymodes");
  };

  const handleDeleteStudyMode = async (id: string) => {
    await saveChangeToDraft("study-mode-widget", id, "delete");
  };

  const handleUndoDeleteStudyMode = async (id: string) => {
    await discardDraftChange("study-mode-widget", id);
  };

  const handleReorderStudyModes = async (reorderedIds: string[]) => {
    const orderMap: Record<string, number> = {};
    reorderedIds.forEach((id, index) => {
      orderMap[id] = index + 1;
    });

    await saveChangeToDraft("study-mode-widget", "_order", "update", {
      title: "Study Modes Ordering",
      orderMap,
    });
  };

  // --- Draft Merging Layer ---
  const newsDraftChanges = pendingChanges.filter((p) => p.collection === "news");
  const newsMap = new Map<string, NewsItem>();
  news.forEach((n) => newsMap.set(n.id, { ...n }));

  for (const draft of newsDraftChanges) {
    const existing = newsMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        newsMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      const rawData = draft.data as any;
      const normalizedData: NewsMetadata = {
        title: rawData?.title || existing?.data?.title || draft.documentId,
        date: rawData?.date ? new Date(rawData.date) : existing?.data?.date || new Date(),
        thumbnail: rawData?.thumbnail || existing?.data?.thumbnail || "",
        url: rawData?.url || existing?.data?.url || "",
      };

      newsMap.set(draft.documentId, {
        id: draft.documentId,
        data: normalizedData,
        draftData: normalizedData,
        body: draft.body ?? existing?.body ?? "",
        draftBody: draft.body,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }
  const mergedNews = Array.from(newsMap.values());

  const jobsDraftChanges = pendingChanges.filter((p) => p.collection === "jobs");
  const jobsMap = new Map<string, JobItem>();
  jobs.forEach((j) => jobsMap.set(j.id, { ...j }));

  for (const draft of jobsDraftChanges) {
    const existing = jobsMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        jobsMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      const rawData = draft.data as any;
      const normalizedData: JobMetadata = {
        title: rawData?.title || existing?.data?.title || draft.documentId,
        location: rawData?.location || existing?.data?.location || "",
        date: rawData?.date ? new Date(rawData.date) : existing?.data?.date || new Date(),
        file: rawData?.file || existing?.data?.file,
      };

      jobsMap.set(draft.documentId, {
        id: draft.documentId,
        data: normalizedData,
        draftData: normalizedData,
        body: draft.body ?? existing?.body ?? "",
        draftBody: draft.body,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }
  const mergedJobs = Array.from(jobsMap.values());

  const facultyDraftChanges = pendingChanges.filter((p) => p.collection === "faculty");
  const facultyMap = new Map<string, UnifiedFacultyItem>();
  faculty.forEach((f) => facultyMap.set(f.id, { ...f }));

  for (const draft of facultyDraftChanges) {
    if (draft.documentId === "_order") continue;

    const existing = facultyMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        facultyMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      facultyMap.set(draft.documentId, {
        id: draft.documentId,
        category: draft.data?.category || existing?.category || "faculty",
        order: draft.data?.order ?? existing?.order ?? 0,
        photo: draft.data?.photo ?? existing?.photo,
        email: draft.data?.email ?? existing?.email,
        zh: draft.data?.zh || existing?.zh || { name: draft.documentId, title: "", bio: "" },
        en: draft.data?.en || existing?.en || { name: draft.documentId, title: "", bio: "" },
        draftData: draft.data,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }

  const orderDraft = facultyDraftChanges.find((p) => p.documentId === "_order");
  if (orderDraft?.data?.orderMap) {
    for (const [id, newOrder] of Object.entries(orderDraft.data.orderMap)) {
      const item = facultyMap.get(id);
      if (item) {
        facultyMap.set(id, { ...item, order: Number(newOrder) });
      }
    }
  }
  const mergedFaculty = Array.from(facultyMap.values()).filter((f) => f.id !== "_order");

  const carouselDraftChanges = pendingChanges.filter((p) => p.collection === "carousel");
  const carouselMap = new Map<string, CarouselSlideItem>();
  carousel.forEach((c) => carouselMap.set(c.id, { ...c }));

  for (const draft of carouselDraftChanges) {
    const existing = carouselMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        carouselMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      carouselMap.set(draft.documentId, {
        id: draft.documentId,
        order: draft.data?.order ?? existing?.order ?? 999,
        image: draft.data?.image ?? existing?.image ?? "",
        link: draft.data?.link ?? existing?.link,
        newWindow: draft.data?.newWindow ?? existing?.newWindow,
        draftData: draft.data,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }
  const mergedCarousel = Array.from(carouselMap.values());

  const degreesWidgetDraftChanges = pendingChanges.filter((p) => p.collection === "degrees-widget");
  const degreesWidgetMap = new Map<string, DegreesWidgetItem>();
  degreesWidget.forEach((d) => degreesWidgetMap.set(d.id, { ...d }));

  for (const draft of degreesWidgetDraftChanges) {
    if (draft.documentId === "_order") continue;

    const existing = degreesWidgetMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        degreesWidgetMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      const rawData = draft.data as any;
      const lang = (rawData?.language || existing?.language || draft.documentId.split("_")[0] || "zh") as Language;
      const cardType = rawData?.type || existing?.type || draft.documentId.split("_")[1] || "master";
      const normalizedData: DegreesWidgetMetadata = {
        title: rawData?.title || existing?.data?.title || draft.documentId,
        order: rawData?.order ?? existing?.data?.order ?? 0,
        url: rawData?.url ?? existing?.data?.url,
        programs: rawData?.programs ?? existing?.data?.programs ?? [],
      };

      degreesWidgetMap.set(draft.documentId, {
        id: draft.documentId,
        language: lang,
        type: cardType,
        data: normalizedData,
        draftData: normalizedData,
        body: draft.body ?? existing?.body ?? "",
        draftBody: draft.body,
        bodyHtml: rawData?.bodyHtml ?? existing?.bodyHtml,
        bodyJson: rawData?.bodyJson ?? existing?.bodyJson,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }

  const degreesOrderDraft = degreesWidgetDraftChanges.find((p) => p.documentId === "_order");
  if (degreesOrderDraft?.data?.orderMap) {
    for (const [id, newOrder] of Object.entries(degreesOrderDraft.data.orderMap)) {
      const item = degreesWidgetMap.get(id);
      if (item) {
        degreesWidgetMap.set(id, {
          ...item,
          data: { ...item.data, order: Number(newOrder) },
          draftData: item.draftData ? { ...item.draftData, order: Number(newOrder) } : undefined,
        });
      }
    }
  }
  const mergedDegreesWidget = Array.from(degreesWidgetMap.values()).filter((d) => d.id !== "_order");

  // Study Mode Widget Draft Merging
  const studyModesDraftChanges = pendingChanges.filter((p) => p.collection === "study-mode-widget");
  const studyModesMap = new Map<string, StudyModeWidgetItem>();
  studyModes.forEach((s) => studyModesMap.set(s.id, { ...s }));

  for (const draft of studyModesDraftChanges) {
    if (draft.documentId === "_order") continue;

    const existing = studyModesMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        studyModesMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      const rawData = draft.data as any;
      const lang = (rawData?.language || existing?.language || draft.documentId.split("_")[0] || "zh") as Language;
      const modeType = rawData?.type || existing?.type || draft.documentId.split("_")[1] || "full-time";
      const normalizedData: StudyModeWidgetMetadata = {
        title: rawData?.title || existing?.data?.title || draft.documentId,
        order: rawData?.order ?? existing?.data?.order ?? 0,
        url: rawData?.url ?? existing?.data?.url,
      };

      studyModesMap.set(draft.documentId, {
        id: draft.documentId,
        language: lang,
        type: modeType,
        data: normalizedData,
        draftData: normalizedData,
        body: draft.body ?? existing?.body ?? "",
        draftBody: draft.body,
        bodyHtml: rawData?.bodyHtml ?? existing?.bodyHtml,
        bodyJson: rawData?.bodyJson ?? existing?.bodyJson,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }

  const studyModeOrderDraft = studyModesDraftChanges.find((p) => p.documentId === "_order");
  if (studyModeOrderDraft?.data?.orderMap) {
    for (const [id, newOrder] of Object.entries(studyModeOrderDraft.data.orderMap)) {
      const item = studyModesMap.get(id);
      if (item) {
        studyModesMap.set(id, {
          ...item,
          data: { ...item.data, order: Number(newOrder) },
          draftData: item.draftData ? { ...item.draftData, order: Number(newOrder) } : undefined,
        });
      }
    }
  }
  const mergedStudyModes = Array.from(studyModesMap.values()).filter((s) => s.id !== "_order");

  return (
    <AdminLayout currentTab={currentTab} onNavigate={handleNavigate}>
      {currentTab === "dashboard" && (
        <DashboardView
          onNavigate={handleNavigate}
          onRefreshData={reloadAll}
        />
      )}

      {currentTab === "faculty" && (
        <FacultyListView
          items={mergedFaculty.filter((f) => f.status !== "deleted")}
          onNew={() => handleNavigate("faculty_new")}
          onEdit={(item) => handleNavigate("faculty_edit", item.id)}
          onDelete={handleDeleteFaculty}
          isLoading={Boolean(loadingCollections.faculty)}
        />
      )}

      {currentTab === "faculty_new" && (
        <FacultyEditView
          onSave={handleSaveFacultyDraft}
          onCancel={() => handleNavigate("faculty")}
        />
      )}

      {currentTab === "faculty_edit" && (
        loadingCollections.faculty && !mergedFaculty.find((f) => f.id === editingId) ? (
          <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
            Loading faculty profile...
          </div>
        ) : (
          <FacultyEditView
            key={editingId ? `faculty-edit-${editingId}` : "faculty-new"}
            initialItem={mergedFaculty.find((f) => f.id === editingId)}
            onSave={handleSaveFacultyDraft}
            onCancel={() => handleNavigate("faculty")}
          />
        )
      )}

      {currentTab === "news" && (
        <NewsListView
          items={mergedNews}
          onNew={() => handleNavigate("news_new")}
          onEdit={(id) => handleNavigate("news_edit", id)}
          onDelete={handleDeleteNews}
          onUndoDelete={handleUndoDeleteNews}
          isLoading={Boolean(loadingCollections.news)}
        />
      )}

      {currentTab === "news_new" && (
        <NewsEditView
          onSave={handleSaveNewsDraft}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "news_edit" && (
        loadingCollections.news && !mergedNews.find((n) => n.id === editingId) ? (
          <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
            Loading news entry...
          </div>
        ) : (
          <NewsEditView
            key={editingId ? `news-edit-${editingId}` : "news-new"}
            initialItem={mergedNews.find((n) => n.id === editingId)}
            onSave={handleSaveNewsDraft}
            onCancel={() => handleNavigate("news")}
          />
        )
      )}

      {currentTab === "jobs" && (
        <JobsListView
          items={mergedJobs}
          onNew={() => handleNavigate("jobs_new")}
          onEdit={(id) => handleNavigate("jobs_edit", id)}
          onDelete={handleDeleteJob}
          onUndoDelete={handleUndoDeleteJob}
          isLoading={Boolean(loadingCollections.jobs)}
        />
      )}

      {currentTab === "jobs_new" && (
        <JobsEditView
          onSave={handleSaveJobDraft}
          onCancel={() => handleNavigate("jobs")}
        />
      )}

      {currentTab === "jobs_edit" && (
        loadingCollections.jobs && !mergedJobs.find((j) => j.id === editingId) ? (
          <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
            Loading job posting...
          </div>
        ) : (
          <JobsEditView
            key={editingId ? `jobs-edit-${editingId}` : "jobs-new"}
            initialItem={mergedJobs.find((j) => j.id === editingId)}
            onSave={handleSaveJobDraft}
            onCancel={() => handleNavigate("jobs")}
          />
        )
      )}

      {currentTab === "homepage_carousel" && (
        <CarouselListView
          items={mergedCarousel.filter((c) => c.status !== "deleted")}
          onNew={() => handleNavigate("homepage_carousel_new")}
          onEdit={(item) => handleNavigate("homepage_carousel_edit", item.id)}
          onDelete={handleDeleteCarousel}
          onUndoDelete={handleUndoDeleteCarousel}
          onReorder={handleReorderCarousel}
          isLoading={Boolean(loadingCollections.carousel)}
        />
      )}

      {currentTab === "homepage_carousel_new" && (
        <CarouselEditView
          nextOrder={mergedCarousel.length + 1}
          onSave={handleSaveCarouselDraft}
          onCancel={() => handleNavigate("homepage_carousel")}
        />
      )}

      {currentTab === "homepage_carousel_edit" && (
        loadingCollections.carousel && !mergedCarousel.find((c) => c.id === editingId) ? (
          <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
            Loading carousel slide...
          </div>
        ) : (
          <CarouselEditView
            key={editingId ? `carousel-edit-${editingId}` : "carousel-new"}
            initialItem={mergedCarousel.find((c) => c.id === editingId)}
            onSave={handleSaveCarouselDraft}
            onCancel={() => handleNavigate("homepage_carousel")}
          />
        )
      )}

      {currentTab === "homepage_degrees" && (
        <DegreesWidgetListView
          items={mergedDegreesWidget.filter((d) => d.status !== "deleted")}
          onNew={() => handleNavigate("homepage_degrees_new")}
          onEdit={(item) => handleNavigate("homepage_degrees_edit", item.id)}
          onDelete={handleDeleteDegreesWidget}
          onUndoDelete={handleUndoDeleteDegreesWidget}
          onReorder={handleReorderDegreesWidget}
          isLoading={Boolean(loadingCollections["degrees-widget"])}
        />
      )}

      {currentTab === "homepage_degrees_new" && (
        <DegreesWidgetEditView
          nextOrder={mergedDegreesWidget.length + 1}
          onSave={handleSaveDegreesWidgetDraft}
          onCancel={() => handleNavigate("homepage_degrees")}
        />
      )}

      {currentTab === "homepage_degrees_edit" && (
        loadingCollections["degrees-widget"] && !mergedDegreesWidget.find((d) => d.id === editingId) ? (
          <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
            Loading degree card...
          </div>
        ) : (
          <DegreesWidgetEditView
            key={editingId ? `degrees-edit-${editingId}` : "degrees-new"}
            initialItem={mergedDegreesWidget.find((d) => d.id === editingId)}
            onSave={handleSaveDegreesWidgetDraft}
            onCancel={() => handleNavigate("homepage_degrees")}
          />
        )
      )}

      {currentTab === "homepage_studymodes" && (
        <StudyModeWidgetListView
          items={mergedStudyModes.filter((s) => s.status !== "deleted")}
          onNew={() => handleNavigate("homepage_studymodes_new")}
          onEdit={(item) => handleNavigate("homepage_studymodes_edit", item.id)}
          onDelete={handleDeleteStudyMode}
          onUndoDelete={handleUndoDeleteStudyMode}
          onReorder={handleReorderStudyModes}
          isLoading={Boolean(loadingCollections["study-mode-widget"])}
        />
      )}

      {currentTab === "homepage_studymodes_new" && (
        <StudyModeWidgetEditView
          nextOrder={mergedStudyModes.length + 1}
          onSave={handleSaveStudyModeDraft}
          onCancel={() => handleNavigate("homepage_studymodes")}
        />
      )}

      {currentTab === "homepage_studymodes_edit" && (
        loadingCollections["study-mode-widget"] && !mergedStudyModes.find((s) => s.id === editingId) ? (
          <div className="p-16 text-center text-slate-400 text-sm animate-pulse">
            Loading study mode card...
          </div>
        ) : (
          <StudyModeWidgetEditView
            key={editingId ? `studymode-edit-${editingId}` : "studymode-new"}
            initialItem={mergedStudyModes.find((s) => s.id === editingId)}
            onSave={handleSaveStudyModeDraft}
            onCancel={() => handleNavigate("homepage_studymodes")}
          />
        )
      )}

      {currentTab === "homepage_shortcuts" && (
        <ShortcutsManagerView
          initialData={shortcuts}
          isLoading={Boolean(loadingCollections.shortcuts)}
        />
      )}

      {currentTab === "media" && <MediaLibraryView />}

      {currentTab === "backup" && <BackupRestoreView onRefreshData={reloadAll} />}
    </AdminLayout>
  );
};

export const AdminApp: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGate>
        <DraftProvider>
          <AdminDashboard />
        </DraftProvider>
      </AuthGate>
    </AuthProvider>
  );
};

export default AdminApp;
