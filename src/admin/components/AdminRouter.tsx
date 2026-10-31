import React from "react";
import type { AdminTab } from "./AdminLayout";
import { DashboardView } from "../views/DashboardView";
import { MediaLibraryView } from "../views/MediaLibraryView";
import { BackupRestoreView } from "../views/BackupRestoreView";
import { AccountManagementView } from "../views/AccountManagementView";
import { useAuth } from "../context/AuthContext";
import { NewsListView } from "../views/NewsListView";
import { NewsEditView } from "../views/NewsEditView";
import { JobsListView } from "../views/JobsListView";
import { JobsEditView } from "../views/JobsEditView";
import { FacultyListView } from "../views/FacultyListView";
import { FacultyEditView } from "../views/FacultyEditView";
import { DegreesProgramsListView } from "../views/DegreesProgramsListView";
import { DegreesProgramsEditView } from "../views/DegreesProgramsEditView";
import { CarouselListView } from "../views/CarouselListView";
import { CarouselEditView } from "../views/CarouselEditView";
import { DegreesWidgetListView } from "../views/DegreesWidgetListView";
import { DegreesWidgetEditView } from "../views/DegreesWidgetEditView";
import { StudyModeWidgetListView } from "../views/StudyModeWidgetListView";
import { StudyModeWidgetEditView } from "../views/StudyModeWidgetEditView";
import { ShortcutsManagerView } from "../views/ShortcutsManagerView";
import { MenuManagerView } from "../views/MenuManagerView";
import { AssemblyListView } from "../views/AssemblyListView";
import { AssemblyEditView } from "../views/AssemblyEditView";
import { NewsletterListView } from "../views/NewsletterListView";
import { NewsletterEditView } from "../views/NewsletterEditView";
import { PagesListView } from "../views/PagesListView";
import { PagesEditView } from "../views/PagesEditView";

import { useNewsController } from "../hooks/collections/useNewsController";
import { useJobsController } from "../hooks/collections/useJobsController";
import { useFacultyController } from "../hooks/collections/useFacultyController";
import { useDegreesProgramsController } from "../hooks/collections/useDegreesProgramsController";
import { useCarouselController } from "../hooks/collections/useCarouselController";
import { useDegreesWidgetController } from "../hooks/collections/useDegreesWidgetController";
import { useStudyModesController } from "../hooks/collections/useStudyModesController";
import { useShortcutsController } from "../hooks/collections/useShortcutsController";
import { useMenuController } from "../hooks/collections/useMenuController";
import { useAssemblyController } from "../hooks/collections/useAssemblyController";
import { useNewsletterController } from "../hooks/collections/useNewsletterController";
import { usePagesController } from "../hooks/collections/usePagesController";

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
  const { isAdmin } = useAuth();

  // ---- Per-collection controllers (each self-contained) ----
  const news = useNewsController(currentTab.startsWith("news"), onNavigate);
  const jobs = useJobsController(currentTab.startsWith("jobs"), onNavigate);
  const faculty = useFacultyController(currentTab.startsWith("faculty"), onNavigate);
  const degreesPrograms = useDegreesProgramsController(currentTab.startsWith("degrees_programs"), onNavigate);
  const carousel = useCarouselController(currentTab.startsWith("homepage_carousel"), onNavigate);
  const degreesWidget = useDegreesWidgetController(currentTab.startsWith("homepage_degrees"), onNavigate);
  const studyModes = useStudyModesController(currentTab.startsWith("homepage_studymodes"), onNavigate);
  const shortcuts = useShortcutsController(currentTab.startsWith("homepage_shortcuts"));
  const menu = useMenuController(currentTab.startsWith("homepage_menu"));
  const assembly = useAssemblyController(currentTab.startsWith("assembly"), onNavigate);
  const newsletter = useNewsletterController(currentTab.startsWith("newsletter"), onNavigate);
  const pages = usePagesController(currentTab.startsWith("pages"), onNavigate);

  // ---- Global reload (used by BackupRestoreView) ----
  const reloadAll = async () => {
    await Promise.all([
      news.reload(),
      jobs.reload(),
      faculty.reload(),
      degreesPrograms.reload(),
      carousel.reload(),
      degreesWidget.reload(),
      studyModes.reload(),
      shortcuts.reload(),
      menu.reload(),
      assembly.reload(),
      newsletter.reload(),
      pages.reload(),
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
    if (!isAdmin) {
      return (
        <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto text-xl">
            🔒
          </div>
          <h3 className="text-base font-bold text-white">Administrator Access Required</h3>
          <p className="text-xs text-slate-400">
            The Backup & Restore tool is restricted to CWTS Administrators only.
          </p>
          <button
            onClick={() => onNavigate("dashboard")}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }
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

  // ---- Degrees & Programs ----
  if (currentTab === "degrees_programs") {
    return (
      <DegreesProgramsListView
        items={degreesPrograms.items}
        onNew={() => onNavigate("degrees_programs_new")}
        onEdit={(id) => onNavigate("degrees_programs_edit", id)}
        onDelete={degreesPrograms.deleteItem}
        onUndoDelete={degreesPrograms.undoDelete}
        onReorder={degreesPrograms.reorderItems}
        isLoading={degreesPrograms.isLoading}
      />
    );
  }

  if (currentTab === "degrees_programs_new") {
    return (
      <DegreesProgramsEditView
        onSave={degreesPrograms.saveDraft}
        onCancel={() => onNavigate("degrees_programs")}
      />
    );
  }

  if (currentTab === "degrees_programs_edit") {
    return (
      <DegreesProgramsEditView
        key={editingId ? `degree-edit-${editingId}` : "degree-new"}
        initialItem={degreesPrograms.items.find((d) => d.id === editingId)}
        onSave={degreesPrograms.saveDraft}
        onCancel={() => onNavigate("degrees_programs")}
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

  // ---- Navigation Menu ----
  if (currentTab === "homepage_menu") {
    return (
      <MenuManagerView
        initialData={menu.data}
        isLoading={menu.isLoading}
      />
    );
  }

  // ---- Assembly ----
  if (currentTab === "assembly") {
    return (
      <AssemblyListView
        items={assembly.items}
        onNew={() => onNavigate("assembly_new")}
        onEdit={(id) => onNavigate("assembly_edit", id)}
        onDelete={assembly.deleteItem}
        onUndoDelete={assembly.undoDelete}
        onReorder={assembly.reorderItems}
        isLoading={assembly.isLoading}
      />
    );
  }

  if (currentTab === "assembly_new") {
    const pastOrders = assembly.items
      .filter(
        (i) =>
          !(
            (i.draftData?.isUpcoming ?? i.data.isUpcoming) ||
            (i.draftData?.semester ?? i.data.semester)?.toLowerCase() === "upcoming"
          )
      )
      .map((i) => (i.draftData?.order ?? i.data.order) || 0);
    const nextOrder = (pastOrders.length > 0 ? Math.max(...pastOrders) : 0) + 1;

    return (
      <AssemblyEditView
        nextOrder={nextOrder}
        onSave={assembly.saveDraft}
        onCancel={() => onNavigate("assembly")}
      />
    );
  }

  if (currentTab === "assembly_edit") {
    return (
      <AssemblyEditView
        key={editingId ? `assembly-edit-${editingId}` : "assembly-new"}
        initialItem={assembly.items.find((a) => a.id === editingId)}
        onSave={assembly.saveDraft}
        onCancel={() => onNavigate("assembly")}
      />
    );
  }

  // Newsletter
  if (currentTab === "newsletter") {
    return (
      <NewsletterListView
        items={newsletter.items}
        onNew={() => onNavigate("newsletter_new")}
        onEdit={(id) => onNavigate("newsletter_edit", id)}
        onDelete={newsletter.deleteItem}
        onUndoDelete={newsletter.undoDelete}
        isLoading={newsletter.isLoading}
      />
    );
  }

  if (currentTab === "newsletter_new") {
    return (
      <NewsletterEditView
        onSave={newsletter.saveDraft}
        onCancel={() => onNavigate("newsletter")}
      />
    );
  }

  if (currentTab === "newsletter_edit") {
    return (
      <NewsletterEditView
        key={editingId ? `newsletter-edit-${editingId}` : "newsletter-new"}
        initialItem={newsletter.items.find((a) => a.id === editingId)}
        onSave={newsletter.saveDraft}
        onCancel={() => onNavigate("newsletter")}
      />
    );
  }

  // Pages
  if (currentTab === "pages") {
    return (
      <PagesListView
        items={pages.items}
        onNew={() => onNavigate("pages_new")}
        onEdit={(id) => onNavigate("pages_edit", id)}
        onDelete={pages.deletePage}
        onUndoDelete={pages.undoDelete}
        onUpdateSiblingOrder={pages.updateSiblingOrder}
        isLoading={pages.isLoading}
      />
    );
  }

  if (currentTab === "pages_new") {
    return (
      <PagesEditView
        allPages={pages.items}
        onSave={pages.saveDraft}
        onCancel={() => onNavigate("pages")}
      />
    );
  }

  if (currentTab === "pages_edit") {
    return (
      <PagesEditView
        key={editingId ? `pages-edit-${editingId}` : "pages-new"}
        initialItem={pages.items.find((p) => p.id === editingId)}
        allPages={pages.items}
        onSave={pages.saveDraft}
        onCancel={() => onNavigate("pages")}
      />
    );
  }

  if (currentTab === "accounts") {
    return <AccountManagementView />;
  }

  return null;
};
