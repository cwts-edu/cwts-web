import React from "react";
import type { AdminTab } from "./AdminLayout";
import { DashboardView } from "../views/DashboardView";
import { MediaLibraryView } from "../views/MediaLibraryView";
import { BackupRestoreView } from "../views/BackupRestoreView";
import { NewsListView } from "../views/NewsListView";
import { NewsEditView } from "../views/NewsEditView";
import { JobsListView } from "../views/JobsListView";
import { JobsEditView } from "../views/JobsEditView";
import { FacultyListView } from "../views/FacultyListView";
import { FacultyEditView } from "../views/FacultyEditView";
import { CarouselListView } from "../views/CarouselListView";
import { CarouselEditView } from "../views/CarouselEditView";
import { DegreesWidgetListView } from "../views/DegreesWidgetListView";
import { DegreesWidgetEditView } from "../views/DegreesWidgetEditView";
import { StudyModeWidgetListView } from "../views/StudyModeWidgetListView";
import { StudyModeWidgetEditView } from "../views/StudyModeWidgetEditView";
import { ShortcutsManagerView } from "../views/ShortcutsManagerView";

import { useNewsController } from "../hooks/collections/useNewsController";
import { useJobsController } from "../hooks/collections/useJobsController";
import { useFacultyController } from "../hooks/collections/useFacultyController";
import { useCarouselController } from "../hooks/collections/useCarouselController";
import { useDegreesWidgetController } from "../hooks/collections/useDegreesWidgetController";
import { useStudyModesController } from "../hooks/collections/useStudyModesController";
import { useShortcutsController } from "../hooks/collections/useShortcutsController";

interface Props {
  currentTab: AdminTab;
  editingId: string | null;
  onNavigate: (tab: AdminTab, param?: string) => void;
  onRefreshAll: () => void;
}

export const AdminRouter: React.FC<Props> = ({
  currentTab,
  editingId,
  onNavigate,
  onRefreshAll,
}) => {
  // ---- Per-collection controllers (each self-contained) ----
  const news = useNewsController(currentTab.startsWith("news"), onNavigate);
  const jobs = useJobsController(currentTab.startsWith("jobs"), onNavigate);
  const faculty = useFacultyController(currentTab.startsWith("faculty"), onNavigate);
  const carousel = useCarouselController(currentTab.startsWith("homepage_carousel"), onNavigate);
  const degreesWidget = useDegreesWidgetController(currentTab.startsWith("homepage_degrees"), onNavigate);
  const studyModes = useStudyModesController(currentTab.startsWith("homepage_studymodes"), onNavigate);
  const shortcuts = useShortcutsController(currentTab.startsWith("homepage_shortcuts"));

  // ---- Global reload (used by BackupRestoreView) ----
  const reloadAll = async () => {
    await Promise.all([
      news.reload(),
      jobs.reload(),
      faculty.reload(),
      carousel.reload(),
      degreesWidget.reload(),
      studyModes.reload(),
      shortcuts.reload(),
    ]);
    onRefreshAll();
  };

  // ---- Dashboard ----
  if (currentTab === "dashboard") {
    return <DashboardView onNavigate={onNavigate} onRefreshData={reloadAll} />;
  }

  // ---- Media ----
  if (currentTab === "media") {
    return <MediaLibraryView />;
  }

  // ---- Backup ----
  if (currentTab === "backup") {
    return <BackupRestoreView onRefreshData={reloadAll} />;
  }

  // ---- News ----
  if (currentTab === "news") {
    return (
      <NewsListView
        items={news.items}
        onNew={() => onNavigate("news_new")}
        onEdit={(id) => onNavigate("news_edit", id)}
        onDelete={news.deleteItem}
        onUndoDelete={news.undoDelete}
        isLoading={news.isLoading}
      />
    );
  }

  if (currentTab === "news_new") {
    return (
      <NewsEditView
        onSave={news.saveDraft}
        onCancel={() => onNavigate("news")}
      />
    );
  }

  if (currentTab === "news_edit") {
    return (
      <NewsEditView
        key={editingId ? `news-edit-${editingId}` : "news-new"}
        initialItem={news.items.find((n) => n.id === editingId)}
        onSave={news.saveDraft}
        onCancel={() => onNavigate("news")}
      />
    );
  }

  // ---- Jobs ----
  if (currentTab === "jobs") {
    return (
      <JobsListView
        items={jobs.items}
        onNew={() => onNavigate("jobs_new")}
        onEdit={(id) => onNavigate("jobs_edit", id)}
        onDelete={jobs.deleteItem}
        onUndoDelete={jobs.undoDelete}
        isLoading={jobs.isLoading}
      />
    );
  }

  if (currentTab === "jobs_new") {
    return (
      <JobsEditView
        onSave={jobs.saveDraft}
        onCancel={() => onNavigate("jobs")}
      />
    );
  }

  if (currentTab === "jobs_edit") {
    return (
      <JobsEditView
        key={editingId ? `jobs-edit-${editingId}` : "jobs-new"}
        initialItem={jobs.items.find((j) => j.id === editingId)}
        onSave={jobs.saveDraft}
        onCancel={() => onNavigate("jobs")}
      />
    );
  }

  // ---- Faculty ----
  if (currentTab === "faculty") {
    return (
      <FacultyListView
        items={faculty.items.filter((f) => f.status !== "deleted")}
        onNew={() => onNavigate("faculty_new")}
        onEdit={(item) => onNavigate("faculty_edit", item.id)}
        onDelete={faculty.deleteItem}
        isLoading={faculty.isLoading}
      />
    );
  }

  if (currentTab === "faculty_new") {
    return (
      <FacultyEditView
        onSave={faculty.saveDraft}
        onCancel={() => onNavigate("faculty")}
      />
    );
  }

  if (currentTab === "faculty_edit") {
    return (
      <FacultyEditView
        key={editingId ? `faculty-edit-${editingId}` : "faculty-new"}
        initialItem={faculty.items.find((f) => f.id === editingId)}
        onSave={faculty.saveDraft}
        onCancel={() => onNavigate("faculty")}
      />
    );
  }

  // ---- Carousel ----
  if (currentTab === "homepage_carousel") {
    return (
      <CarouselListView
        items={carousel.items.filter((c) => c.status !== "deleted")}
        onNew={() => onNavigate("homepage_carousel_new")}
        onEdit={(item) => onNavigate("homepage_carousel_edit", item.id)}
        onDelete={carousel.deleteItem}
        onUndoDelete={carousel.undoDelete}
        onReorder={carousel.reorderItems}
        isLoading={carousel.isLoading}
      />
    );
  }

  if (currentTab === "homepage_carousel_new") {
    return (
      <CarouselEditView
        nextOrder={carousel.items.length + 1}
        onSave={carousel.saveDraft}
        onCancel={() => onNavigate("homepage_carousel")}
      />
    );
  }

  if (currentTab === "homepage_carousel_edit") {
    return (
      <CarouselEditView
        key={editingId ? `carousel-edit-${editingId}` : "carousel-new"}
        initialItem={carousel.items.find((c) => c.id === editingId)}
        onSave={carousel.saveDraft}
        onCancel={() => onNavigate("homepage_carousel")}
      />
    );
  }

  // ---- Degrees Widget ----
  if (currentTab === "homepage_degrees") {
    return (
      <DegreesWidgetListView
        items={degreesWidget.items.filter((d) => d.status !== "deleted")}
        onNew={() => onNavigate("homepage_degrees_new")}
        onEdit={(item) => onNavigate("homepage_degrees_edit", item.id)}
        onDelete={degreesWidget.deleteItem}
        onUndoDelete={degreesWidget.undoDelete}
        onReorder={degreesWidget.reorderItems}
        isLoading={degreesWidget.isLoading}
      />
    );
  }

  if (currentTab === "homepage_degrees_new") {
    return (
      <DegreesWidgetEditView
        nextOrder={degreesWidget.items.length + 1}
        onSave={degreesWidget.saveDraft}
        onCancel={() => onNavigate("homepage_degrees")}
      />
    );
  }

  if (currentTab === "homepage_degrees_edit") {
    return (
      <DegreesWidgetEditView
        key={editingId ? `degrees-edit-${editingId}` : "degrees-new"}
        initialItem={degreesWidget.items.find((d) => d.id === editingId)}
        onSave={degreesWidget.saveDraft}
        onCancel={() => onNavigate("homepage_degrees")}
      />
    );
  }

  // ---- Study Modes ----
  if (currentTab === "homepage_studymodes") {
    return (
      <StudyModeWidgetListView
        items={studyModes.items.filter((s) => s.status !== "deleted")}
        onNew={() => onNavigate("homepage_studymodes_new")}
        onEdit={(item) => onNavigate("homepage_studymodes_edit", item.id)}
        onDelete={studyModes.deleteItem}
        onUndoDelete={studyModes.undoDelete}
        onReorder={studyModes.reorderItems}
        isLoading={studyModes.isLoading}
      />
    );
  }

  if (currentTab === "homepage_studymodes_new") {
    return (
      <StudyModeWidgetEditView
        nextOrder={studyModes.items.length + 1}
        onSave={studyModes.saveDraft}
        onCancel={() => onNavigate("homepage_studymodes")}
      />
    );
  }

  if (currentTab === "homepage_studymodes_edit") {
    return (
      <StudyModeWidgetEditView
        key={editingId ? `studymode-edit-${editingId}` : "studymode-new"}
        initialItem={studyModes.items.find((s) => s.id === editingId)}
        onSave={studyModes.saveDraft}
        onCancel={() => onNavigate("homepage_studymodes")}
      />
    );
  }

  // ---- Shortcuts ----
  if (currentTab === "homepage_shortcuts") {
    return (
      <ShortcutsManagerView
        initialData={shortcuts.data}
        isLoading={shortcuts.isLoading}
      />
    );
  }

  return null;
};
