import React, { useState, useRef } from "react";
import type { NewsletterMetadata } from "../../libs/content/schemas";
import type { NewsletterItem } from "../hooks/collections/useNewsletterController";
import {
  formatNewsletterTitle,
  formatNewsletterPdfPath,
  formatNewsletterCoverPath,
  issueToLetter,
  letterToIssue,
  ISSUE_LETTERS,
} from "../../libs/content/newsletterUtils";
import { extractPdfCoverBlob } from "../utils/pdfCoverExtractor";
import { uploadMediaFile, resolveMediaPreviewUrl } from "../services/storageService";
import { getMediaCollectionConfig } from "../config/mediaCollections";

interface Props {
  initialItem?: NewsletterItem | null;
  onSave: (docId: string, data: NewsletterMetadata) => Promise<void>;
  onCancel: () => void;
}

export const NewsletterEditView: React.FC<Props> = ({
  initialItem,
  onSave,
  onCancel,
}) => {
  const currentActive = initialItem?.draftData || initialItem?.data;

  const currentYearDefault = new Date().getFullYear();
  const [year, setYear] = useState<number>(
    currentActive?.year ?? currentYearDefault
  );
  const [issue, setIssue] = useState<number>(
    currentActive?.issue ?? 1
  );
  const [title, setTitle] = useState<string>(
    currentActive?.title || formatNewsletterTitle(currentActive?.year ?? currentYearDefault, currentActive?.issue ?? 1)
  );
  const [publishDate, setPublishDate] = useState<string>(
    currentActive?.publishDate || ""
  );

  const [pdfPath, setPdfPath] = useState<string>(currentActive?.pdfPath || "");
  const [coverImage, setCoverImage] = useState<string>(currentActive?.coverImage || "");

  // Local pending file buffers for automatic upload upon saving
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [extractedCoverBlob, setExtractedCoverBlob] = useState<Blob | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>(
    currentActive?.coverImage ? resolveMediaPreviewUrl(currentActive.coverImage) : ""
  );

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const letter = issueToLetter(issue);

  // When year or issue changes, update title and canonical paths if not customized
  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    if (!title || title.includes("第")) {
      setTitle(formatNewsletterTitle(newYear, issue));
    }
  };

  const handleIssueChange = (newIssue: number) => {
    setIssue(newIssue);
    if (!title || title.includes("第")) {
      setTitle(formatNewsletterTitle(year, newIssue));
    }
  };

  // Handle PDF file selection with automatic Page 1 cover extraction
  const handlePdfSelected = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a valid PDF file.");
      return;
    }

    setSelectedPdfFile(file);
    setIsExtracting(true);
    setStatusMessage("Extracting first page into PNG cover image...");

    try {
      const result = await extractPdfCoverBlob(file, 528);
      setExtractedCoverBlob(result.coverBlob);
      setCoverPreviewUrl(result.coverDataUrl);
      setStatusMessage("Cover image extracted successfully!");
    } catch (err: any) {
      console.error("PDF cover extraction error:", err);
      setStatusMessage("Could not auto-extract cover from PDF. You can upload a cover image manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle manual replacement cover image upload
  const handleCoverSelected = (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG/JPG/WebP).");
      return;
    }
    setExtractedCoverBlob(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage("Preparing to save...");

    try {
      const docId = `newsletter-${year}${letter}`;
      const canonicalPdfName = `newsletter-${year}${letter}.pdf`;
      const canonicalCoverName = `newsletter-${year}${letter}.pdf.cover.png`;

      const newsletterDocsConfig = getMediaCollectionConfig("newsletter-docs");
      let finalPdfPath = pdfPath || formatNewsletterPdfPath(year, issue);
      let finalCoverPath = coverImage || formatNewsletterCoverPath(year, issue);

      // 1. Upload PDF if a new file was chosen
      if (selectedPdfFile) {
        setStatusMessage("Uploading PDF document to Firebase Storage...");
        const uploadedPdf = await uploadMediaFile(
          selectedPdfFile,
          newsletterDocsConfig,
          canonicalPdfName,
          (pct) => setUploadProgress(Math.round(pct * 0.5)) // 0% - 50%
        );
        finalPdfPath = uploadedPdf.siteRelativePath;
      }

      // 2. Upload extracted cover image if available
      if (extractedCoverBlob) {
        setStatusMessage("Uploading generated cover PNG image...");
        const uploadedCover = await uploadMediaFile(
          extractedCoverBlob,
          newsletterDocsConfig,
          canonicalCoverName,
          (pct) => setUploadProgress(50 + Math.round(pct * 0.5)) // 50% - 100%
        );
        finalCoverPath = uploadedCover.siteRelativePath;
      }

      const referencedAssets: string[] = [];
      if (finalPdfPath) referencedAssets.push(finalPdfPath.replace(/^\/+/, ""));
      if (finalCoverPath) referencedAssets.push(finalCoverPath.replace(/^\/+/, ""));

      const dataToSave: NewsletterMetadata = {
        title: title.trim() || formatNewsletterTitle(year, issue),
        year,
        issue,
        issueLetter: letter,
        pdfPath: finalPdfPath,
        coverImage: finalCoverPath,
        publishDate: publishDate.trim() || undefined,
        referencedAssets,
      };

      setStatusMessage("Saving newsletter draft...");
      await onSave(docId, dataToSave);
    } catch (err: any) {
      console.error("Save error:", err);
      alert(`Failed to save newsletter: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 mb-2 font-medium"
          >
            <span>← Back to Newsletters</span>
          </button>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {initialItem ? `Edit Newsletter Issue (${initialItem.id})` : "Upload New Newsletter Issue"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload the PDF newsletter file. The cover page will be automatically rendered into a PNG image asset.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Issue Identification */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <span className="text-xl">📅</span>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Issue Details</h3>
              <p className="text-xs text-slate-400">Specify year and epoch / quarter issue number</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Year */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Year <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                value={year}
                min={2000}
                max={2050}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10) || currentYearDefault)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            {/* Issue (Quarter/Epoch) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Issue / Quarter <span className="text-rose-400">*</span>
              </label>
              <select
                value={issue}
                onChange={(e) => handleIssueChange(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {ISSUE_LETTERS.map((letCode, idx) => (
                  <option key={letCode} value={idx + 1}>
                    第{idx + 1}期 (Quarter {letCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Publish Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Publish Date (Optional)
              </label>
              <input
                type="text"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                placeholder="e.g. 2026-04-24"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Title */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Issue Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026第2期"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-purple-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Step 2: PDF Upload & Auto Cover Extraction */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                PDF Document & Cover Page Generation
              </h3>
              <p className="text-xs text-slate-400">
                Drop your PDF below. Page 1 will be automatically extracted into a cover thumbnail.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* PDF Dropzone */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Newsletter PDF File <span className="text-rose-400">*</span>
              </label>

              <div
                onClick={() => pdfInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handlePdfSelected(file);
                }}
                className="border-2 border-dashed border-slate-700 hover:border-purple-500 bg-slate-950/60 rounded-2xl p-6 text-center cursor-pointer transition hover:bg-slate-950 flex flex-col items-center justify-center min-h-[220px] space-y-2 group"
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfSelected(file);
                  }}
                />

                <span className="text-4xl group-hover:scale-110 transition">📥</span>
                <p className="text-sm font-semibold text-slate-200">
                  {selectedPdfFile ? selectedPdfFile.name : "Click or drag PDF here to upload"}
                </p>
                <p className="text-xs text-slate-500">
                  Target storage path: <code className="text-purple-300">docs/newsletter/newsletter-{year}{letter}.pdf</code>
                </p>

                {pdfPath && !selectedPdfFile && (
                  <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40">
                    Existing: {pdfPath}
                  </span>
                )}
              </div>
            </div>

            {/* Extracted Cover Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Cover Page Image (Auto-Generated)
                </label>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
                >
                  Upload Custom Cover
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverSelected(file);
                  }}
                />
              </div>

              <div className="border border-slate-800 bg-slate-950/80 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px] max-h-72 overflow-hidden relative">
                {isExtracting ? (
                  <div className="text-center space-y-3 py-8 animate-pulse">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-semibold text-purple-300">Rendering PDF Page 1...</p>
                  </div>
                ) : coverPreviewUrl ? (
                  <div className="relative group w-full h-full flex items-center justify-center">
                    <img
                      src={coverPreviewUrl}
                      alt="Cover Preview"
                      className="max-h-56 object-contain rounded-xl shadow-lg border border-slate-800"
                    />
                    <div className="absolute bottom-2 left-2 right-2 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/90 text-slate-300 border border-slate-700">
                        {canonicalCoverName(year, letter)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-600 space-y-1 py-8">
                    <span className="text-3xl block">🖼️</span>
                    <p className="text-xs">No cover image yet</p>
                    <p className="text-[11px] text-slate-700">Select a PDF on the left to extract</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Message or Progress */}
          {(statusMessage || isSaving) && (
            <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs text-purple-200">
                <span>{statusMessage}</span>
                {uploadProgress > 0 && <span>{uploadProgress}%</span>}
              </div>
              {uploadProgress > 0 && (
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || isExtracting || (!selectedPdfFile && !pdfPath)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition disabled:opacity-50 active:scale-95"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving Issue...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Newsletter Draft</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

function canonicalCoverName(year: number, letter: string): string {
  return `newsletter-${year}${letter}.pdf.cover.png`;
}
