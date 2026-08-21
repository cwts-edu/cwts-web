import React, { useState, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { DraftProvider } from "./context/DraftContext";
import { AuthGate } from "./components/AuthGate";
import { AdminLayout, type AdminTab } from "./components/AdminLayout";
import { AdminRouter } from "./components/AdminRouter";
import { parseAdminLocation, buildAdminUrl } from "./utils/routing";

export { parseAdminLocation, buildAdminUrl } from "./utils/routing";
export type { AdminRouteState } from "./utils/routing";

const AdminDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>(() => parseAdminLocation().tab);
  const [editingId, setEditingId] = useState<string | null>(() => parseAdminLocation().param || null);

  // Sync browser Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const route = parseAdminLocation();
      setCurrentTab(route.tab);
      setEditingId(route.param || null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleNavigate = (tab: AdminTab, param?: string, replace = false) => {
    setEditingId(param || null);
    setCurrentTab(tab);
    const targetUrl = buildAdminUrl(tab, param);
    if (replace) {
      window.history.replaceState({}, "", targetUrl);
    } else {
      window.history.pushState({}, "", targetUrl);
    }
  };

  return (
    <AdminLayout currentTab={currentTab} onNavigate={handleNavigate}>
      <AdminRouter
        currentTab={currentTab}
        editingId={editingId}
        onNavigate={handleNavigate}
        onRefreshAll={() => {}}
      />
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
