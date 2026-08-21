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
        />
      )}

      {currentTab === "news_new" && (
        <NewsEditView
          onSave={handleSaveNewsDraft}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "news_edit" && (
        isLoadingData && !mergedNews.find((n) => n.id === editingId) ? (
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
        />
      )}

      {currentTab === "jobs_new" && (
        <JobsEditView
          onSave={handleSaveJobDraft}
          onCancel={() => handleNavigate("jobs")}
        />
      )}

      {currentTab === "jobs_edit" && (
        isLoadingData && !mergedJobs.find((j) => j.id === editingId) ? (
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
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Hero Carousel</h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage homepage hero banner carousel slides and links.
              </p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">🎠</div>
            <p className="text-sm font-medium">Hero Carousel Management</p>
            <p className="text-xs text-slate-500">Ready for Firestore integration and drag-and-drop slide management.</p>
          </div>
        </div>
      )}

      {currentTab === "homepage_degrees" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Degrees Widget</h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage homepage degree program tabs and category highlights.
              </p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">🎓</div>
            <p className="text-sm font-medium">Degrees Widget Management</p>
            <p className="text-xs text-slate-500">Ready for Firestore integration and tab content editing.</p>
          </div>
        </div>
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
