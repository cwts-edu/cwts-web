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
import { BackupRestoreView } from "./views/BackupRestoreView";
import { MediaLibraryView } from "./views/MediaLibraryView";
import { db } from "./config/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { NewsMetadata, JobMetadata, CarouselItem, DegreesWidgetMetadata, Language } from "../libs/content/schemas";

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

  for (const pt of PAGE_TYPES) {
    if (tab === pt.id) return pt.path;
    if (pt.hasNew && tab === `${pt.id}_new`) return `${pt.path}/new`;
    if (pt.hasEdit && tab === `${pt.id}_edit`) {
      return param ? `${pt.path}/edit?id=${encodeURIComponent(param)}` : `${pt.path}/edit`;
    }
  }
  return "/admin";
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
      const facultySnap = await getDocs(collection(db, "faculty"));
      const loadedFaculty: UnifiedFacultyItem[] = [];
      facultySnap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loadedFaculty.push({
          id: d.id,
          category: val.category || "faculty",
          photo: val.photo,
          email: val.email,
          order: val.order || 999,
          inCategoryOrder: val.inCategoryOrder,
          referencedAssets: val.referencedAssets,
          zh: val.zh || { name: val.name || d.id },
          en: val.en || { name: val.name || d.id },
          status: val.status || "published",
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
      const carouselSnap = await getDocs(collection(db, "carousel"));
      const loadedCarousel: CarouselSlideItem[] = [];
      carouselSnap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loadedCarousel.push({
          id: d.id,
          order: val.order ?? 999,
          image: val.image || "",
          link: val.link,
          newWindow: Boolean(val.newWindow),
          referencedAssets: val.referencedAssets || [],
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setCarousel(loadedCarousel);
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
            shortTitle: val.shortTitle,
            order: val.order ?? 0,
            url: val.url,
          },
          body: val.body || "",
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
    }
  }, [currentTab, loadedCollections, loadingCollections, loadNews, loadJobs, loadFaculty, loadCarousel, loadDegreesWidget]);

  // Global reload (e.g. after restoring backup)
  const reloadAll = useCallback(async () => {
    setLoadedCollections({});
    if (currentTab.startsWith("news")) await loadNews();
    else if (currentTab.startsWith("jobs")) await loadJobs();
    else if (currentTab.startsWith("faculty")) await loadFaculty();
    else if (currentTab.startsWith("homepage_carousel")) await loadCarousel();
    else if (currentTab.startsWith("homepage_degrees")) await loadDegreesWidget();
  }, [currentTab, loadNews, loadJobs, loadFaculty, loadCarousel, loadDegreesWidget]);

  const handleNavigate = (tab: AdminTab, param?: string, replace = false) => {
    if (param) setEditingId(param);
    else setEditingId(null);
    setCurrentTab(tab);

    const targetUrl = buildAdminUrl(tab, param);
    if (typeof window !== "undefined") {
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== targetUrl) {
        if (replace) {
          window.history.replaceState({ tab, param }, "", targetUrl);
        } else {
          window.history.pushState({ tab, param }, "", targetUrl);
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // News Handlers (Draft Save & Soft Delete)
  // --------------------------------------------------------------------------
  const handleSaveNewsDraft = async (id: string, data: NewsMetadata, body: string) => {
    await saveChangeToDraft("news", id, "update", data, body);
    handleNavigate("news");
  };

  const handleDeleteNews = async (id: string) => {
    const target = news.find((n) => n.id === id);
    if (target) {
      await saveChangeToDraft("news", id, "delete", target.data, target.body);
    }
  };

  const handleUndoDeleteNews = async (id: string) => {
    await discardDraftChange("news", id);
  };

  // --------------------------------------------------------------------------
  // Jobs Handlers (Draft Save & Soft Delete)
  // --------------------------------------------------------------------------
  const handleSaveJobDraft = async (item: { id: string; data: JobMetadata; body: string }) => {
    await saveChangeToDraft("jobs", item.id, "update", item.data, item.body);
    handleNavigate("jobs");
  };

  const handleDeleteJob = async (id: string) => {
    const target = jobs.find((j) => j.id === id);
    if (target) {
      await saveChangeToDraft("jobs", id, "delete", target.data, target.body);
    }
  };

  const handleUndoDeleteJob = async (id: string) => {
    await discardDraftChange("jobs", id);
  };

  // --------------------------------------------------------------------------
  // Faculty Handlers (Draft Save & Soft Delete)
  // --------------------------------------------------------------------------
  const handleSaveFacultyDraft = async (id: string, data: any) => {
    await saveChangeToDraft("faculty", id, "update", data);
    handleNavigate("faculty");
  };

  // --------------------------------------------------------------------------
  // Carousel Handlers (Draft Save, Reorder, & Soft Delete)
  // --------------------------------------------------------------------------
  const handleSaveCarouselDraft = async (id: string, data: CarouselItem) => {
    await saveChangeToDraft("carousel", id, "update", data);
    handleNavigate("homepage_carousel");
  };

  const handleDeleteCarousel = async (id: string) => {
    const target = carousel.find((c) => c.id === id);
    if (target) {
      await saveChangeToDraft("carousel", id, "delete", target);
    }
  };

  const handleUndoDeleteCarousel = async (id: string) => {
    await discardDraftChange("carousel", id);
  };

  const handleReorderCarousel = async (reorderedIds: string[]) => {
    const orderMap: Record<string, number> = {};
    reorderedIds.forEach((id, index) => {
      orderMap[id] = index + 1;
    });
    await saveChangeToDraft("carousel", "_order", "update", { orderMap });
  };

  const handleSaveDegreesWidgetDraft = async (
    id: string,
    language: Language,
    type: string,
    data: DegreesWidgetMetadata,
    body: string
  ) => {
    await saveChangeToDraft("degrees-widget", id, "update", { ...data, language, type }, body);
    handleNavigate("homepage_degrees");
  };

  const handleDeleteDegreesWidget = async (id: string) => {
    const target = degreesWidget.find((d) => d.id === id);
    if (target) {
      await saveChangeToDraft("degrees-widget", id, "delete", target.data, target.body);
    }
  };

  const handleUndoDeleteDegreesWidget = async (id: string) => {
    await discardDraftChange("degrees-widget", id);
  };

  const handleReorderDegreesWidget = async (reorderedIds: string[]) => {
    const orderMap: Record<string, number> = {};
    reorderedIds.forEach((id, index) => {
      orderMap[id] = index + 1;
    });
    await saveChangeToDraft("degrees-widget", "_order", "update", { orderMap });
  };

  // Overlay active draft items into the view list for the editor
  const newsMap = new Map<string, NewsItem>(news.map((item) => [item.id, { ...item }]));
  const newsDraftChanges = pendingChanges.filter((p) => p.collection === "news");

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
      const rawDraftDate = draft.data?.date;
      const normalizedDate = rawDraftDate?.toDate
        ? rawDraftDate.toDate()
        : rawDraftDate
        ? new Date(rawDraftDate)
        : new Date();

      const normalizedData = {
        ...draft.data,
        date: isNaN(normalizedDate.getTime()) ? new Date() : normalizedDate,
      } as NewsMetadata;

      newsMap.set(draft.documentId, {
        id: draft.documentId,
        data: normalizedData,
        draftData: normalizedData,
        body: draft.body,
        draftBody: draft.body,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }
  const mergedNews = Array.from(newsMap.values());

  const jobsMap = new Map<string, JobItem>(jobs.map((item) => [item.id, { ...item }]));
  const jobsDraftChanges = pendingChanges.filter((p) => p.collection === "jobs");

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
      const rawDraftDate = draft.data?.date;
      const normalizedDate = rawDraftDate?.toDate
        ? rawDraftDate.toDate()
        : rawDraftDate
        ? new Date(rawDraftDate)
        : new Date();

      const normalizedData = {
        ...draft.data,
        date: isNaN(normalizedDate.getTime()) ? new Date() : normalizedDate,
      } as JobMetadata;

      jobsMap.set(draft.documentId, {
        id: draft.documentId,
        data: normalizedData,
        draftData: normalizedData,
        body: draft.body,
        draftBody: draft.body,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }
  const mergedJobs = Array.from(jobsMap.values());

  const facultyMap = new Map<string, UnifiedFacultyItem>(faculty.map((item) => [item.id, { ...item }]));
  const facultyDraftChanges = pendingChanges.filter((p) => p.collection === "faculty");

  // First apply general doc changes
  for (const draft of facultyDraftChanges) {
    if (draft.documentId === "_order") continue; // Handled separately below

    const existing = facultyMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        facultyMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
        });
      }
    } else {
      facultyMap.set(draft.documentId, {
        id: draft.documentId,
        category: draft.data?.category || existing?.category || "faculty",
        photo: draft.data?.photo || existing?.photo,
        email: draft.data?.email || existing?.email,
        order: draft.data?.order || existing?.order || 999,
        inCategoryOrder: draft.data?.inCategoryOrder || existing?.inCategoryOrder,
        referencedAssets: draft.data?.referencedAssets || existing?.referencedAssets,
        zh: draft.data?.zh || existing?.zh || { name: draft.documentId },
        en: draft.data?.en || existing?.en || { name: draft.documentId },
        status: "draft",
        draftData: draft.data,
      });
    }
  }

  // Second apply the single _order draft item if present
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

  // Carousel Draft Overlay
  const carouselMap = new Map<string, CarouselSlideItem>(carousel.map((item) => [item.id, { ...item }]));
  const carouselDraftChanges = pendingChanges.filter((p) => p.collection === "carousel");

  for (const draft of carouselDraftChanges) {
    if (draft.documentId === "_order") continue;

    const existing = carouselMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        carouselMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          draftAction: "delete",
        });
      }
    } else {
      const rawData = draft.data as CarouselItem;
      carouselMap.set(draft.documentId, {
        id: draft.documentId,
        order: rawData?.order ?? existing?.order ?? 999,
        image: rawData?.image || existing?.image || "",
        link: rawData?.link ?? existing?.link,
        newWindow: rawData?.newWindow ?? existing?.newWindow,
        referencedAssets: rawData?.referencedAssets ?? existing?.referencedAssets,
        status: "draft",
        draftData: rawData,
        draftAction: existing ? "update" : "create",
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
        updatedBy: draft.updatedBy,
      });
    }
  }

  const carouselOrderDraft = carouselDraftChanges.find((p) => p.documentId === "_order");
  if (carouselOrderDraft?.data?.orderMap) {
    for (const [id, newOrder] of Object.entries(carouselOrderDraft.data.orderMap)) {
      const item = carouselMap.get(id);
      if (item) {
        carouselMap.set(id, { ...item, order: Number(newOrder) });
      }
    }
  }

  const mergedCarousel = Array.from(carouselMap.values()).filter((c) => c.id !== "_order");

  // Degrees Widget Draft Overlay
  const degreesWidgetMap = new Map<string, DegreesWidgetItem>(
    degreesWidget.map((item) => [item.id, { ...item }])
  );
  const degreesWidgetDraftChanges = pendingChanges.filter((p) => p.collection === "degrees-widget");

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
        shortTitle: rawData?.shortTitle ?? existing?.data?.shortTitle,
        order: rawData?.order ?? existing?.data?.order ?? 0,
        url: rawData?.url ?? existing?.data?.url,
      };

      degreesWidgetMap.set(draft.documentId, {
        id: draft.documentId,
        language: lang,
        type: cardType,
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
        isLoadingData && !mergedFaculty.find((f) => f.id === editingId) ? (
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
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Study Modes</h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage homepage learning formats (Full-time, Part-time, Online).
              </p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">📖</div>
            <p className="text-sm font-medium">Study Modes Management</p>
            <p className="text-xs text-slate-500">Ready for Firestore integration and study format descriptions.</p>
          </div>
        </div>
      )}

      {currentTab === "homepage_shortcuts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Shortcuts</h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage homepage quick action buttons (Give, Contact, Apply).
              </p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">⚡</div>
            <p className="text-sm font-medium">Shortcuts Management</p>
            <p className="text-xs text-slate-500">Ready for Firestore integration and quick link buttons.</p>
          </div>
        </div>
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
