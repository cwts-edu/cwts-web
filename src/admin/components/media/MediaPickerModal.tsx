import React, { useState, useEffect, useCallback } from "react";
import {
  getMediaCollectionConfig,
  type MediaCollectionConfig,
  type MediaItem,
} from "../../config/mediaCollections";
import { listMediaItems, uploadMediaFile, resolveMediaPreviewUrl } from "../../services/storageService";
import { ImageCropperModal } from "./ImageCropperModal";

interface Props {
  isOpen: boolean;
  collectionId: string;
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
  title?: string;
}

export const MediaPickerModal: React.FC<Props> = ({
  isOpen,
  collectionId,
  onSelect,
  onClose,
  title,
}) => {
  const collectionConfig = getMediaCollectionConfig(collectionId);

  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  // Cropper state for images
  const [cropFile, setCropFile] = useState<File | null>(null);

  // Upload state for files (PDFs)
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listMediaItems(collectionConfig);
      setItems(data);
    } catch (err: any) {
      console.warn("Error loading media items:", err);
      setError(err.message || "Could not load media items");
    } finally {
      setIsLoading(false);
    }
  }, [collectionConfig]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setSelectedItem(null);
      setError(null);
    }
  }, [isOpen, loadItems]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (collectionConfig.type === "image" && collectionConfig.aspectRatio) {
      setCropFile(file);
    } else {
      handleDirectFileUpload(file);
    }
    // Reset file input value
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (collectionConfig.type === "image" && collectionConfig.aspectRatio) {
      setCropFile(file);
    } else {
      handleDirectFileUpload(file);
    }
  };

  const handleDirectFileUpload = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadPercent(10);
    try {
      const uploadedItem = await uploadMediaFile(
        file,
        collectionConfig,
        file.name,
        (pct) => setUploadPercent(pct)
      );
      onSelect(uploadedItem);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
      setIsUploading(false);
    }
  };

  const handleCropAndUpload = async (blob: Blob, customFilename: string) => {
    const uploadedItem = await uploadMediaFile(
      blob,
      collectionConfig,
      customFilename,
      (pct) => setUploadPercent(pct)
    );
    setCropFile(null);
    onSelect(uploadedItem);
    onClose();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.siteRelativePath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-base font-bold">
                {collectionConfig.type === "image" ? "🖼️" : "📄"}
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {title || `${collectionConfig.title} Library`}
                </h3>
                <p className="text-xs text-slate-400">
                  Folder: <span className="font-mono text-purple-300">/{collectionConfig.collectionPath}</span>
                  {collectionConfig.aspectRatioLabel && ` • ${collectionConfig.aspectRatioLabel}`}
                </p>
              </div>
            </div>

            {/* Tab switchers & Close */}
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    activeTab === "library"
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Browse Library ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    activeTab === "upload"
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Upload New
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Search bar & notification */}
          {activeTab === "library" && (
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Filter by filename or path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-4 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              <button
                type="button"
                onClick={loadItems}
                disabled={isLoading}
                title="Refresh library"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-xl transition flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          )}

          {/* Main Area */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60">
            {error && (
              <div className="mb-4 p-3.5 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-xs">
                {error}
              </div>
            )}

            {/* TAB 1: Library Browser */}
            {activeTab === "library" && (
              <>
                {isLoading ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    <div className="animate-spin text-2xl mb-2">🌀</div>
                    Loading {collectionConfig.title} from Firebase Storage...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400 space-y-3">
                    <div className="text-3xl">📂</div>
                    <p>No media files found in this collection folder.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("upload")}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition text-xs inline-flex items-center gap-2"
                    >
                      <span>⬆️</span>
                      <span>Upload the First Asset</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredItems.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          onDoubleClick={() => {
                            onSelect(item);
                            onClose();
                          }}
                          className={`group relative rounded-xl border p-2 cursor-pointer transition flex flex-col justify-between overflow-hidden bg-slate-900 ${
                            isSelected
                              ? "border-purple-500 ring-2 ring-purple-500/30 bg-purple-950/20"
                              : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                          }`}
                        >
                          {/* Thumbnail / Document Preview */}
                          <div className="aspect-[200/110] rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800/80 mb-2 relative">
                            {collectionConfig.type === "image" ? (
                              <img
                                src={resolveMediaPreviewUrl(item.downloadUrl || item.siteRelativePath)}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                onError={(e) => {
                                  // Fallback placeholder if image load fails
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                                <span className="text-2xl">📄</span>
                                <span className="text-[10px] font-mono uppercase bg-slate-800 px-1.5 py-0.5 rounded text-purple-300">
                                  PDF
                                </span>
                              </div>
                            )}

                            {item.isLocalFixture && (
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700 text-[9px] font-mono">
                                Built-in
                              </span>
                            )}
                          </div>

                          {/* File info */}
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-white truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span>{formatFileSize(item.size)}</span>
                              <span>
                                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* TAB 2: Upload Dropzone */}
            {activeTab === "upload" && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 bg-slate-900/40 transition cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center text-3xl">
                  {collectionConfig.type === "image" ? "✂️" : "⬆️"}
                </div>

                <div className="space-y-1 max-w-sm">
                  <p className="text-sm font-bold text-white">
                    Drag and drop your {collectionConfig.type === "image" ? "image" : "document"} here
                  </p>
                  <p className="text-xs text-slate-400">
                    {collectionConfig.type === "image"
                      ? collectionConfig.aspectRatio
                        ? `Select an image to open the crop & scale editor (${collectionConfig.aspectRatioLabel || "standard aspect"}).`
                        : "Upload image in original natural dimensions (no forced crop)."
                      : "Upload downloadable document to Firebase Storage."}
                  </p>
                </div>

                <label className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer transition inline-flex items-center gap-2">
                  <span>Browse File on Computer</span>
                  <input
                    type="file"
                    accept={collectionConfig.allowedMimeTypes.join(",")}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                {isUploading && (
                  <div className="w-full max-w-md space-y-2 pt-4">
                    <div className="flex justify-between text-xs text-purple-200">
                      <span>Uploading to Firebase Storage...</span>
                      <span>{uploadPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          {activeTab === "library" && (
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="text-xs text-slate-400 truncate max-w-md font-mono">
                {selectedItem ? (
                  <span className="text-purple-300">Selected: {selectedItem.siteRelativePath}</span>
                ) : (
                  <span>Select an asset to use in your document</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedItem}
                  onClick={() => {
                    if (selectedItem) {
                      onSelect(selectedItem);
                      onClose();
                    }
                  }}
                  className="px-6 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl shadow-lg transition"
                >
                  ✓ Choose Selected Asset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Cropper Modal Layer */}
      {cropFile && (
        <ImageCropperModal
          isOpen={Boolean(cropFile)}
          file={cropFile}
          collectionConfig={collectionConfig}
          onCropAndUpload={handleCropAndUpload}
          onCancel={() => setCropFile(null)}
        />
      )}
    </>
  );
};
