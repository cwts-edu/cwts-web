import React, { useState, useEffect, useCallback } from "react";
import {
  getAllMediaCollections,
  getMediaCollectionConfig,
  type MediaCollectionConfig,
  type MediaItem,
} from "../config/mediaCollections";
import { listMediaItems, uploadMediaFile, deleteMediaFile, resolveMediaPreviewUrl } from "../services/storageService";
import { ImageCropperModal } from "../components/media/ImageCropperModal";

export const MediaLibraryView: React.FC = () => {
  const collections = getAllMediaCollections();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("news-thumbnails");
  const activeConfig = getMediaCollectionConfig(selectedCollectionId);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload and Cropper State
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listMediaItems(activeConfig);
      setItems(data);
    } catch (err: any) {
      console.warn("Could not load media items:", err);
      setError(err.message || "Failed to load collection items");
    } finally {
      setIsLoading(false);
    }
  }, [activeConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeConfig.type === "image" && activeConfig.aspectRatio) {
      setCropFile(file);
    } else {
      handleDirectUpload(file);
    }
    e.target.value = "";
  };

  const handleDirectUpload = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadPercent(10);
    try {
      await uploadMediaFile(file, activeConfig, file.name, (pct) => setUploadPercent(pct));
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropAndUpload = async (blob: Blob, customFilename: string) => {
    try {
      await uploadMediaFile(blob, activeConfig, customFilename, (pct) => setUploadPercent(pct));
      setCropFile(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to upload cropped image");
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (item.isLocalFixture) {
      alert("Built-in local repository fixtures cannot be deleted from cloud storage.");
      return;
    }

    if (confirm(`Are you sure you want to delete '${item.name}' from Firebase Storage?`)) {
      try {
        await deleteMediaFile(item.id);
        await loadData();
      } catch (err: any) {
        alert(`Failed to delete item: ${err.message}`);
      }
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.siteRelativePath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Media Asset Library</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
              Firebase Storage
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse, upload, crop, and manage site media collections. Files are stored directly in Cloud Storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer transition flex items-center gap-2">
            <span>{activeConfig.aspectRatio ? "✂️ Upload & Crop" : "⬆️ Upload File"}</span>
            <input
              type="file"
              accept={activeConfig.allowedMimeTypes.join(",")}
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Collection Switcher Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {collections.map((c) => {
          const isSelected = c.id === selectedCollectionId;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCollectionId(c.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 border ${
                isSelected
                  ? "bg-purple-600 text-white border-purple-500 shadow-md"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{c.type === "image" ? "🖼️" : "📄"}</span>
              <span>{c.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Collection Info Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{activeConfig.title}</span>
            <span className="text-xs text-purple-300 font-mono">/{activeConfig.collectionPath}</span>
          </div>
          <p className="text-xs text-slate-400">
            {activeConfig.description || "Collection storage folder."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {activeConfig.targetDimensions && (
            <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-purple-300">
              📐 {activeConfig.targetDimensions.width} × {activeConfig.targetDimensions.height} px
            </div>
          )}
          {activeConfig.aspectRatioLabel && (
            <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300">
              🔒 {activeConfig.aspectRatioLabel}
            </div>
          )}
          <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
            📁 {items.length} file{items.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Search & Upload Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search by name or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 rounded-xl border border-slate-800 transition flex items-center gap-1.5"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications / Errors */}
      {error && (
        <div className="p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Main Grid View */}
      {isLoading ? (
        <div className="py-24 text-center text-xs text-slate-400">
          <div className="animate-spin text-3xl mb-3">🌀</div>
          Loading {activeConfig.title} assets...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl text-center space-y-4">
          <div className="text-4xl">📂</div>
          <p className="text-xs text-slate-400">No assets found in this collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-purple-500/60 rounded-2xl overflow-hidden p-3 flex flex-col justify-between space-y-3 transition duration-200 shadow-lg group"
            >
              {/* Media Preview Box */}
              <div className="aspect-[200/110] rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 flex items-center justify-center relative">
                {activeConfig.type === "image" ? (
                  <img
                    src={resolveMediaPreviewUrl(item.downloadUrl || item.siteRelativePath)}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                    <span className="text-3xl">📄</span>
                    <span className="text-[10px] font-mono uppercase bg-slate-800 px-2 py-0.5 rounded text-purple-300">
                      PDF Document
                    </span>
                  </div>
                )}

                {item.isLocalFixture && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/90 text-slate-300 border border-slate-700 text-[10px] font-mono">
                    Local Fixture
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-white truncate" title={item.name}>
                  {item.name}
                </div>
                <div className="text-[11px] font-mono text-purple-400 truncate" title={item.siteRelativePath}>
                  {item.siteRelativePath}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                  <span>{formatSize(item.size)}</span>
                  <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ""}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(item.siteRelativePath, item.id)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 rounded-lg transition"
                    title="Copy site relative path"
                  >
                    {copiedId === item.id ? "✓ Copied" : "📋 Path"}
                  </button>

                  <a
                    href={item.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 rounded-lg transition"
                    title="Open in new tab"
                  >
                    ↗ View
                  </a>
                </div>

                {!item.isLocalFixture && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
                    title="Delete from Storage"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cropper Modal */}
      {cropFile && (
        <ImageCropperModal
          isOpen={Boolean(cropFile)}
          file={cropFile}
          collectionConfig={activeConfig}
          onCropAndUpload={handleCropAndUpload}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  );
};
