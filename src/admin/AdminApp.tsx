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
import { BackupRestoreView } from "./views/BackupRestoreView";
import { MediaLibraryView } from "./views/MediaLibraryView";
import { db } from "./config/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { NewsMetadata, JobMetadata } from "../libs/content/schemas";
import { INITIAL_NEWS_FIXTURES, INITIAL_JOBS_FIXTURES } from "./fixtures/initialContent";

export interface AdminRouteState {
  tab: AdminTab;
  param?: string;
}

export function parseAdminLocation(): AdminRouteState {
  if (typeof window === "undefined") {
    return { tab: "dashboard" };
  }
  const path = window.location.pathname.replace(/\/+$/, "");
  const searchParams = new URLSearchParams(window.location.search);
  const idParam = searchParams.get("id") || undefined;

  if (path === "/admin/faculty/new") {
    return { tab: "faculty_new" };
  }
  if (path === "/admin/faculty/edit") {
    return { tab: "faculty_edit", param: idParam };
  }
  if (path === "/admin/faculty") {
    return { tab: "faculty" };
  }
  if (path === "/admin/news/new") {
    return { tab: "news_new" };
  }
  if (path === "/admin/news/edit") {
    return { tab: "news_edit", param: idParam };
  }
  if (path === "/admin/news") {
    return { tab: "news" };
  }
  if (path === "/admin/jobs/new") {
    return { tab: "jobs_new" };
  }
  if (path === "/admin/jobs/edit") {
    return { tab: "jobs_edit", param: idParam };
  }
  if (path === "/admin/jobs") {
    return { tab: "jobs" };
  }
  if (path === "/admin/media") {
    return { tab: "media" };
  }
  if (path === "/admin/backup") {
    return { tab: "backup" };
  }

  return { tab: "dashboard" };
}

export function buildAdminUrl(tab: AdminTab, param?: string): string {
  switch (tab) {
    case "dashboard":
      return "/admin";
    case "faculty":
      return "/admin/faculty";
    case "faculty_new":
      return "/admin/faculty/new";
    case "faculty_edit":
      return param ? `/admin/faculty/edit?id=${encodeURIComponent(param)}` : "/admin/faculty/edit";
    case "news":
      return "/admin/news";
    case "news_new":
      return "/admin/news/new";
    case "news_edit":
      return param ? `/admin/news/edit?id=${encodeURIComponent(param)}` : "/admin/news/edit";
    case "jobs":
      return "/admin/jobs";
    case "jobs_new":
      return "/admin/jobs/new";
    case "jobs_edit":
      return param ? `/admin/jobs/edit?id=${encodeURIComponent(param)}` : "/admin/jobs/edit";
    case "media":
      return "/admin/media";
    case "backup":
      return "/admin/backup";
    default:
      return "/admin";
  }
}

const INITIAL_NEWS: NewsItem[] = INITIAL_NEWS_FIXTURES.map((item) => ({
  id: item.id,
  data: {
    title: item.data.title,
    date: new Date(item.data.date),
    thumbnail: item.data.thumbnail,
    url: item.data.url,
  },
  body: item.body,
  status: "published",
  version: 1,
  publishedVersion: 1,
}));

const INITIAL_JOBS: JobItem[] = INITIAL_JOBS_FIXTURES.map((item) => ({
  id: item.id,
  data: {
    title: item.data.title,
    location: item.data.location,
    date: new Date(item.data.date),
    ...(item.data.file ? { file: item.data.file } : {}),
  },
  body: item.body,
  status: "published",
  version: 1,
  publishedVersion: 1,
}));

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();

  const [currentTab, setCurrentTab] = useState<AdminTab>(() => parseAdminLocation().tab);
  const [editingId, setEditingId] = useState<string | null>(() => parseAdminLocation().param || null);

  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [jobs, setJobs] = useState<JobItem[]>(INITIAL_JOBS);
  const [faculty, setFaculty] = useState<UnifiedFacultyItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

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

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch News (filter out soft-deleted items)
      const newsSnap = await getDocs(collection(db, "news"));
      if (!newsSnap.empty) {
        const loadedNews: NewsItem[] = [];
        newsSnap.forEach((d) => {
          const val = d.data();
          if (val.status === "deleted") return; // Ignore soft-deleted documents
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
      }

      // 2. Fetch Jobs (filter out soft-deleted items)
      const jobsSnap = await getDocs(collection(db, "jobs"));
      if (!jobsSnap.empty) {
        const loadedJobs: JobItem[] = [];
        jobsSnap.forEach((d) => {
          const val = d.data();
          if (val.status === "deleted") return; // Ignore soft-deleted documents
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
      }

      // 3. Fetch Faculty
      const facultySnap = await getDocs(collection(db, "faculty"));
      if (!facultySnap.empty) {
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
      }
    } catch (err) {
      console.warn("Could not connect to live Firestore (using initial state):", err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
  const handleSaveNewsDraft = async (item: { id: string; data: NewsMetadata; body: string }) => {
    await saveChangeToDraft("news", item.id, "update", item.data, item.body);
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

  const handleDeleteFaculty = async (id: string) => {
    const target = faculty.find((f) => f.id === id);
    if (target) {
      await saveChangeToDraft("faculty", id, "delete", target);
    }
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

  return (
    <AdminLayout currentTab={currentTab} onNavigate={handleNavigate}>
      {currentTab === "dashboard" && (
        <DashboardView
          onNavigate={handleNavigate}
          newsCount={mergedNews.filter((n) => n.status !== "deleted").length}
          jobsCount={mergedJobs.filter((j) => j.status !== "deleted").length}
          facultyCount={mergedFaculty.filter((f) => f.status !== "deleted").length}
          onRefreshData={loadData}
        />
      )}

      {currentTab === "faculty" && (
        <FacultyListView
          items={mergedFaculty.filter((f) => f.status !== "deleted")}
          onNew={() => handleNavigate("faculty_new")}
          onEdit={(item) => handleNavigate("faculty_edit", item.id)}
          onDelete={handleDeleteFaculty}
          isLoading={isLoadingData}
        />
      )}

      {currentTab === "faculty_new" && (
        <FacultyEditView
          onSave={handleSaveFacultyDraft}
          onCancel={() => handleNavigate("faculty")}
        />
      )}

      {currentTab === "faculty_edit" && (
        <FacultyEditView
          initialItem={mergedFaculty.find((f) => f.id === editingId)}
          onSave={handleSaveFacultyDraft}
          onCancel={() => handleNavigate("faculty")}
        />
      )}

      {currentTab === "news" && (
        <NewsListView
          items={mergedNews}
          onNew={() => handleNavigate("news_new")}
          onEdit={(id) => handleNavigate("news_edit", id)}
          onDelete={handleDeleteNews}
          onUndoDelete={handleUndoDeleteNews}
        />
      )}

      {currentTab === "news_new" && (
        <NewsEditView
          onSave={handleSaveNewsDraft}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "news_edit" && (
        <NewsEditView
          initialItem={mergedNews.find((n) => n.id === editingId)}
          onSave={handleSaveNewsDraft}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "jobs" && (
        <JobsListView
          items={mergedJobs}
          onNew={() => handleNavigate("jobs_new")}
          onEdit={(id) => handleNavigate("jobs_edit", id)}
          onDelete={handleDeleteJob}
          onUndoDelete={handleUndoDeleteJob}
        />
      )}

      {currentTab === "jobs_new" && (
        <JobsEditView
          onSave={handleSaveJobDraft}
          onCancel={() => handleNavigate("jobs")}
        />
      )}

      {currentTab === "jobs_edit" && (
        <JobsEditView
          initialItem={mergedJobs.find((j) => j.id === editingId)}
          onSave={handleSaveJobDraft}
          onCancel={() => handleNavigate("jobs")}
        />
      )}

      {currentTab === "media" && <MediaLibraryView />}

      {currentTab === "backup" && <BackupRestoreView onRefreshData={loadData} />}
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
