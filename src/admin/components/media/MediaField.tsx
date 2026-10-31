import React, { useState } from "react";
import { getMediaCollectionConfig, type MediaItem } from "../../config/mediaCollections";
import { MediaPickerModal } from "./MediaPickerModal";
import { ImageCropperModal } from "./ImageCropperModal";
import { uploadMediaFile, resolveMediaPreviewUrl } from "../../services/storageService";

interface Props {
  collectionId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

export const MediaField: React.FC<Props> = ({
  collectionId,
  label,
  value,
  onChange,
  required = false,
  placeholder,
  helpText,
}) => {
  const collectionConfig = getMediaCollectionConfig(collectionId);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  const handleSelectMedia = (item: MediaItem) => {
    // We prefer the site-relative path (e.g. /images/news/...) for clean static builds,
    // or fallback to item.downloadUrl
    onChange(item.siteRelativePath || item.downloadUrl);
  };

  const handleDirectFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (collectionConfig.type === "image") {
      setCropFile(file);
    } else {
      uploadMediaFile(file, collectionConfig, file.name).then((item) => {
        handleSelectMedia(item);
      });
    }
    e.target.value = "";
  };

  const handleCropAndUpload = async (blob: Blob, customFilename: string) => {
    const uploadedItem = await uploadMediaFile(blob, collectionConfig, customFilename);
    handleSelectMedia(uploadedItem);
    setCropFile(null);
  };

  const isImage = collectionConfig.type === "image";
  const hasValue = Boolean(value && value.trim() !== "" && value !== "/images/news/");

  return (
    <div className="space-y-2">
      {/* Label and Manual Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-[11px] text-purple-400 hover:text-purple-300 transition"
        >
          {showManualInput ? "Hide manual path" : "Edit path manually"}
        </button>
      </div>

      {/* Main Preview & Action Container */}
      <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
        {hasValue ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Image / PDF Thumbnail Preview */}
            <div className="w-full sm:w-48 aspect-[200/110] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 relative group">
              {isImage ? (
                <img
                  src={resolveMediaPreviewUrl(value)}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback in case path cannot be loaded in local preview
                    (e.target as HTMLElement).style.opacity = "0.5";
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                  <span className="text-2xl">📄</span>
                  <span className="text-[10px] font-mono text-purple-300">PDF Document</span>
                </div>
              )}
            </div>

            {/* Value details & Action Buttons */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <div className="text-xs font-mono font-semibold text-purple-300 truncate" title={value}>
                  {value}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Collection: <span className="text-slate-300">{collectionConfig.title}</span>
                  {collectionConfig.aspectRatioLabel && ` (${collectionConfig.aspectRatioLabel})`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
                >
                  <span>📂</span>
                  <span>Choose Another</span>
                </button>

                <label className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-xs font-semibold text-purple-200 rounded-lg border border-purple-500/40 transition cursor-pointer flex items-center gap-1.5">
                  <span>{isImage ? "✂️" : "⬆️"}</span>
                  <span>{isImage ? "Upload & Crop New" : "Upload New PDF"}</span>
                  <input
                    type="file"
                    accept={collectionConfig.allowedMimeTypes.join(",")}
                    onChange={handleDirectFileSelect}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition"
                >
                  ✕ Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state prompt */
          <div className="py-6 px-4 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-slate-900/30">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20 mx-auto flex items-center justify-center text-lg">
              {isImage ? "🖼️" : "📄"}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">
                No {isImage ? "image" : "document"} selected
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isImage
                  ? `Choose an existing thumbnail or upload and crop to ${collectionConfig.aspectRatioLabel || "400×220"}.`
                  : "Choose an existing document from the library or upload a new PDF."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl border border-slate-700 shadow transition flex items-center gap-1.5"
              >
                <span>📂</span>
                <span>Choose from Library</span>
              </button>

              <label className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white rounded-xl shadow-lg cursor-pointer transition flex items-center gap-1.5">
                <span>{isImage ? "✂️" : "⬆️"}</span>
                <span>{isImage ? "Upload & Crop" : "Upload File"}</span>
                <input
                  type="file"
                  accept={collectionConfig.allowedMimeTypes.join(",")}
                  onChange={handleDirectFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Manual input override */}
        {showManualInput && (
          <div className="pt-2 border-t border-slate-800 space-y-1">
            <label className="text-[11px] text-slate-400">Direct Path or URL</label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || `/${collectionConfig.collectionPath}/example.jpg`}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-purple-500 transition"
            />
          </div>
        )}
      </div>

      {helpText && <p className="text-[11px] text-slate-400">{helpText}</p>}

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isPickerOpen}
        collectionId={collectionId}
        onSelect={handleSelectMedia}
        onClose={() => setIsPickerOpen(false)}
      />

      {/* Direct Cropper Modal (when Upload & Crop button is clicked) */}
      {cropFile && (
        <ImageCropperModal
          isOpen={Boolean(cropFile)}
          file={cropFile}
          collectionConfig={collectionConfig}
          onCropAndUpload={handleCropAndUpload}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  );
};
