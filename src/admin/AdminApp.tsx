import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DraftProvider, useDraft } from "./context/DraftContext";
import { AuthGate } from "./components/AuthGate";
import { AdminLayout, type AdminTab } from "./components/AdminLayout";
import { DashboardView } from "./views/DashboardView";
import { NewsListView, type NewsItem } from "./views/NewsListView";
import { NewsEditView } from "./views/NewsEditView";
import { JobsListView, type JobItem } from "./views/JobsListView";
import { JobsEditView } from "./views/JobsEditView";
import { db } from "./config/firebase";
import { collection, doc, getDocs, deleteDoc } from "firebase/firestore";
import type { NewsMetadata, JobMetadata } from "../libs/content/schemas";

const INITIAL_NEWS: NewsItem[] = [
  {
    id: "2026-04-24-newsletter",
    data: {
      title: "基神院訊 2026",
      date: new Date("2026-04-24"),
      thumbnail: "/images/news/newsletter-2026A.jpg",
      url: "/zh/news-events/newsletter/",
    },
    body: "基神院訊",
    status: "published",
    version: 1,
    publishedVersion: 1,
  },
  {
    id: "2026-05-26-MI Bring Church Home",
    data: {
      title: "把教會帶回家",
      date: new Date("2026-05-26"),
      thumbnail: "/images/news/MI Bring Church Home.jpg",
      url: "/zh/ministry-institute/courses/#把教會帶回家-課程編碼ff013學分zoom授課",
    },
    body: "基神證書課程 Zoom課堂\\\n9/3-10/8 逢周四晚",
    status: "published",
    version: 1,
    publishedVersion: 1,
  },
];

const INITIAL_JOBS: JobItem[] = [
  {
    id: "2026-07-08",
    data: {
      title: "矽谷基督徒聚會三谷分堂 - 全職傳道同工（音樂敬拜、拓展牧養）",
      location: "Tri-Valley, CA",
      date: new Date("2026-07-08"),
      file: "/docs/jobs/2026-07-08-SVCA TV Worship Outreach.pdf",
    },
    status: "published",
    version: 1,
    publishedVersion: 1,
  },
  {
    id: "2026-07-06",
    data: {
      title: "基督之家第五家 - 主恩事工牧者",
      location: "Fremont, CA",
      date: new Date("2026-07-06"),
      file: "/docs/jobs/2026-07-06-HOC5-Caring-Pastor.pdf",
    },
    status: "published",
    version: 1,
    publishedVersion: 1,
  },
];

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { pendingChanges, saveChangeToDraft, publishDraftToProduction } = useDraft();

  const [currentTab, setCurrentTab] = useState<AdminTab>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [jobs, setJobs] = useState<JobItem[]>(INITIAL_JOBS);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Load canonical items from Firestore if available
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch News
        const newsSnap = await getDocs(collection(db, "news"));
        if (!newsSnap.empty) {
          const loadedNews: NewsItem[] = [];
          newsSnap.forEach((d) => {
            const val = d.data();
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

        // 2. Fetch Jobs
        const jobsSnap = await getDocs(collection(db, "jobs"));
        if (!jobsSnap.empty) {
          const loadedJobs: JobItem[] = [];
          jobsSnap.forEach((d) => {
            const val = d.data();
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
      } catch (err) {
        console.warn("Could not connect to live Firestore (using initial state):", err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, []);

  const handleNavigate = (tab: AdminTab, param?: string) => {
    if (param) setEditingId(param);
    else setEditingId(null);
    setCurrentTab(tab);
  };

  // --------------------------------------------------------------------------
  // News Handlers (Draft Save via DraftContext & Quick Publish)
  // --------------------------------------------------------------------------
  const handleSaveNewsDraft = async (item: { id: string; data: NewsMetadata; body: string }) => {
    await saveChangeToDraft("news", item.id, "update", item.data, item.body);
    setCurrentTab("news");
    setEditingId(null);
  };

  const handlePublishNewsDirect = async (item: { id: string; data: NewsMetadata; body: string }) => {
    await saveChangeToDraft("news", item.id, "update", item.data, item.body);
    await publishDraftToProduction();
    setCurrentTab("news");
    setEditingId(null);
  };

  const handleDeleteNews = async (id: string) => {
    try {
      await deleteDoc(doc(db, "news", id));
    } catch (e) {
      console.warn("Could not delete from Firestore:", e);
    }
    setNews((prev) => prev.filter((n) => n.id !== id));
  };

  // --------------------------------------------------------------------------
  // Jobs Handlers (Draft Save via DraftContext & Quick Publish)
  // --------------------------------------------------------------------------
  const handleSaveJobDraft = async (item: { id: string; data: JobMetadata; body: string }) => {
    await saveChangeToDraft("jobs", item.id, "update", item.data, item.body);
    setCurrentTab("jobs");
    setEditingId(null);
  };

  const handlePublishJobDirect = async (item: { id: string; data: JobMetadata; body: string }) => {
    await saveChangeToDraft("jobs", item.id, "update", item.data, item.body);
    await publishDraftToProduction();
    setCurrentTab("jobs");
    setEditingId(null);
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await deleteDoc(doc(db, "jobs", id));
    } catch (e) {
      console.warn("Could not delete job from Firestore:", e);
    }
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  // Overlay active draft items into the view list for the editor
  const mergedNews = news.map((item) => {
    const draft = pendingChanges.find((p) => p.collection === "news" && p.documentId === item.id);
    if (draft) {
      return {
        ...item,
        draftData: draft.data,
        draftBody: draft.body,
        status: "draft" as const,
        updatedBy: draft.updatedBy,
      };
    }
    return item;
  });

  const mergedJobs = jobs.map((item) => {
    const draft = pendingChanges.find((p) => p.collection === "jobs" && p.documentId === item.id);
    if (draft) {
      return {
        ...item,
        draftData: draft.data,
        draftBody: draft.body,
        status: "draft" as const,
        updatedBy: draft.updatedBy,
      };
    }
    return item;
  });

  return (
    <AdminLayout currentTab={currentTab} onNavigate={handleNavigate}>
      {currentTab === "dashboard" && (
        <DashboardView
          onNavigate={handleNavigate}
          newsCount={mergedNews.length}
          jobsCount={mergedJobs.length}
        />
      )}

      {currentTab === "news" && (
        <NewsListView
          items={mergedNews}
          onNew={() => handleNavigate("news_new")}
          onEdit={(id) => handleNavigate("news_edit", id)}
          onDelete={handleDeleteNews}
        />
      )}

      {currentTab === "news_new" && (
        <NewsEditView
          onSaveDraft={handleSaveNewsDraft}
          onPublish={handlePublishNewsDirect}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "news_edit" && (
        <NewsEditView
          initialItem={mergedNews.find((n) => n.id === editingId)}
          onSaveDraft={handleSaveNewsDraft}
          onPublish={handlePublishNewsDirect}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "jobs" && (
        <JobsListView
          items={mergedJobs}
          onNew={() => handleNavigate("jobs_new")}
          onEdit={(id) => handleNavigate("jobs_edit", id)}
          onDelete={handleDeleteJob}
        />
      )}

      {currentTab === "jobs_new" && (
        <JobsEditView
          onSaveDraft={handleSaveJobDraft}
          onPublish={handlePublishJobDirect}
          onCancel={() => handleNavigate("jobs")}
        />
      )}

      {currentTab === "jobs_edit" && (
        <JobsEditView
          initialItem={mergedJobs.find((j) => j.id === editingId)}
          onSaveDraft={handleSaveJobDraft}
          onPublish={handlePublishJobDirect}
          onCancel={() => handleNavigate("jobs")}
        />
      )}
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
