import React from "react";
import type { AdminTab } from "../components/AdminLayout";

interface Props {
  onNavigate: (tab: AdminTab) => void;
  newsCount: number;
  jobsCount: number;
}

export const DashboardView: React.FC<Props> = ({ onNavigate, newsCount, jobsCount }) => {
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/20 rounded-3xl p-8 backdrop-blur shadow-xl">
        <div className="max-w-2xl space-y-3">
          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full border border-purple-400/30">
            Headless CMS Portal
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome to CWTS Content Manager
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Manage latest news announcements and church job postings. All changes are validated with schema checks and synchronized with Firestore.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* News Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl">
              📰
            </div>
            <span className="text-3xl font-extrabold text-white">{newsCount}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Latest News Articles</h3>
            <p className="text-xs text-slate-400 mt-1">Homepage news cards and featured announcements.</p>
          </div>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => onNavigate("news")}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
            >
              View Articles
            </button>
            <button
              onClick={() => onNavigate("news_new")}
              className="py-2 px-3 bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white rounded-lg transition shadow"
            >
              + Create News
            </button>
          </div>
        </div>

        {/* Jobs Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-2xl">
              💼
            </div>
            <span className="text-3xl font-extrabold text-white">{jobsCount}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Church Job Postings</h3>
            <p className="text-xs text-slate-400 mt-1">Ministry job board openings and PDF job descriptions.</p>
          </div>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => onNavigate("jobs")}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
            >
              View Job Board
            </button>
            <button
              onClick={() => onNavigate("jobs_new")}
              className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition shadow"
            >
              + Post New Job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
