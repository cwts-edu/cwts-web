import React, { useState, useEffect, useRef, useCallback } from "react";
import type { MediaCollectionConfig } from "../../config/mediaCollections";
import { sanitizeFileName } from "../../services/storageService";

interface Props {
  isOpen: boolean;
  file: File | null;
  collectionConfig: MediaCollectionConfig;
  onCropAndUpload: (blob: Blob, customFilename: string) => Promise<void>;
  onCancel: () => void;
}

interface CropRect {
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  width: number; // percentage 0 - 100
  height: number; // percentage 0 - 100
}

export const ImageCropperModal: React.FC<Props> = ({
  isOpen,
  file,
  collectionConfig,
  onCropAndUpload,
  onCancel,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [customFilename, setCustomFilename] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 10, y: 10, width: 80, height: 80 });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDraggingRef = useRef<{ isMoving: boolean; handle: string | null; startX: number; startY: number; startCrop: CropRect } | null>(null);

  // Target aspect ratio (e.g. 400 / 220 = 1.81818...)
  const targetAspect = collectionConfig.aspectRatio || (collectionConfig.targetDimensions
    ? collectionConfig.targetDimensions.width / collectionConfig.targetDimensions.height
    : 16 / 9);

  const targetWidth = collectionConfig.targetDimensions?.width || 400;
  const targetHeight = collectionConfig.targetDimensions?.height || 220;

  // Load image when file changes
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }

    const defaultName = sanitizeFileName(file.name, ".jpg");
    setCustomFilename(defaultName);
    setZoom(1);
    setError(null);
    setIsUploading(false);
    setUploadPercent(0);

    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // When natural dimensions are loaded, calculate optimal initial crop box
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNaturalDimensions({ width: nw, height: nh });

    const imgAspect = nw / nh;
    let cropW = 80;
    let cropH = 80;

    if (imgAspect > targetAspect) {
      // Image is wider than target aspect -> crop height drives width
      cropH = 80;
      cropW = (cropH / imgAspect) * targetAspect;
    } else {
      // Image is taller than target aspect -> crop width drives height
      cropW = 80;
      cropH = (cropW * imgAspect) / targetAspect;
    }

    setCropRect({
      x: (100 - cropW) / 2,
      y: (100 - cropH) / 2,
      width: cropW,
      height: cropH,
    });
  };

  // Mouse & Touch Dragging Handlers for Crop Box and Handles
  const handlePointerDown = (e: React.PointerEvent, handle: string | null = null) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = {
      isMoving: handle === null,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropRect },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    if (container.width === 0 || container.height === 0) return;

    const dx = ((e.clientX - isDraggingRef.current.startX) / container.width) * 100;
    const dy = ((e.clientY - isDraggingRef.current.startY) / container.height) * 100;
    const { startCrop, handle, isMoving } = isDraggingRef.current;

    if (isMoving) {
      let newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + dx));
      let newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + dy));
      setCropRect((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (handle) {
      // Corner resizing with aspect ratio constraint
      const imgAspect = naturalDimensions ? naturalDimensions.width / naturalDimensions.height : 1;
      let newW = startCrop.width;
      let newH = startCrop.height;
      let newX = startCrop.x;
      let newY = startCrop.y;

      if (handle === "se") {
        newW = Math.max(15, Math.min(100 - startCrop.x, startCrop.width + dx));
        newH = (newW * imgAspect) / targetAspect;
        if (startCrop.y + newH > 100) {
          newH = 100 - startCrop.y;
          newW = (newH / imgAspect) * targetAspect;
        }
      } else if (handle === "nw") {
        const delta = Math.min(dx, dy);
        newW = Math.max(15, startCrop.width - delta);
        newH = (newW * imgAspect) / targetAspect;
        newX = startCrop.x + (startCrop.width - newW);
        newY = startCrop.y + (startCrop.height - newH);
        if (newX < 0 || newY < 0) return;
      }

      setCropRect({ x: newX, y: newY, width: newW, height: newH });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isDraggingRef.current = null;
    }
  };

  // Perform offscreen canvas cropping and downsampling
  const handleCropAndUpload = async () => {
    if (!imageRef.current || !naturalDimensions) return;
    setError(null);
    setIsUploading(true);
    setUploadPercent(10);

    try {
      const img = imageRef.current;
      const nw = naturalDimensions.width;
      const nh = naturalDimensions.height;

      // Source image pixel bounding box
      const sx = (cropRect.x / 100) * nw;
      const sy = (cropRect.y / 100) * nh;
      const sWidth = (cropRect.width / 100) * nw;
      const sHeight = (cropRect.height / 100) * nh;

      // Create target resolution canvas
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Could not initialize 2D canvas context");

      // High-quality bicubic smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw cropped area scaled to target resolution
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

      const quality = collectionConfig.quality || 0.9;
      const mimeType = "image/jpeg";

      setUploadPercent(30);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to generate image blob from canvas"));
          },
          mimeType,
          quality
        );
      });

      setUploadPercent(60);

      // Perform upload
      const cleanName = sanitizeFileName(customFilename.trim(), ".jpg");
      await onCropAndUpload(blob, cleanName);

      setUploadPercent(100);
    } catch (err: any) {
      console.error("Crop & Upload failed:", err);
      setError(err.message || "Failed to crop and upload image");
      setIsUploading(false);
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-base font-bold">
              ✂️
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Crop & Scale Image</h3>
              <p className="text-xs text-slate-400">
                {collectionConfig.title} • Target:{" "}
                <span className="font-mono text-purple-300">
                  {targetWidth} × {targetHeight} px
                </span>{" "}
                ({collectionConfig.aspectRatioLabel || "Locked Aspect"})
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="text-slate-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            ✕ Cancel
          </button>
        </div>

        {/* Workspace Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-950/50">
          {error && (
            <div className="p-3.5 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* Interactive Cropper Area */}
          <div className="flex flex-col items-center justify-center">
            <div
              ref={containerRef}
              className="relative select-none bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner max-h-[50vh] flex items-center justify-center cursor-crosshair touch-none"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {imageSrc && (
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop Source"
                  onLoad={onImageLoad}
                  className="max-h-[50vh] max-w-full object-contain pointer-events-none"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                />
              )}

              {/* Dimmed Overlay & Bright Crop Window */}
              {naturalDimensions && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow: `0 0 0 9999px rgba(10, 15, 30, 0.7)`,
                    left: `${cropRect.x}%`,
                    top: `${cropRect.y}%`,
                    width: `${cropRect.width}%`,
                    height: `${cropRect.height}%`,
                  }}
                />
              )}

              {/* Active Crop Box with Grid & Handles */}
              {naturalDimensions && (
                <div
                  className="absolute border-2 border-purple-400 bg-purple-500/10 cursor-move pointer-events-auto"
                  style={{
                    left: `${cropRect.x}%`,
                    top: `${cropRect.y}%`,
                    width: `${cropRect.width}%`,
                    height: `${cropRect.height}%`,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, null)}
                >
                  {/* 3x3 Rule-of-Thirds Grid */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                    <div className="border-r border-b border-purple-300/50" />
                    <div className="border-r border-b border-purple-300/50" />
                    <div className="border-b border-purple-300/50" />
                    <div className="border-r border-b border-purple-300/50" />
                    <div className="border-r border-b border-purple-300/50" />
                    <div className="border-b border-purple-300/50" />
                    <div className="border-r border-purple-300/50" />
                    <div className="border-r border-purple-300/50" />
                    <div />
                  </div>

                  {/* Corner Resize Handles */}
                  <div
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-purple-600 rounded-sm cursor-nwse-resize shadow"
                    onPointerDown={(e) => handlePointerDown(e, "nw")}
                  />
                  <div
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-purple-600 rounded-sm cursor-nwse-resize shadow"
                    onPointerDown={(e) => handlePointerDown(e, "se")}
                  />

                  {/* Live Dimension Badge */}
                  <div className="absolute bottom-1 right-2 bg-slate-900/90 text-purple-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-purple-500/30">
                    {targetWidth} × {targetHeight}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls: Zoom & Filename */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Filename
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder="e.g. 2026-summer-newsletter.jpg"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Zoom / Magnification</label>
                <span className="text-[11px] font-mono text-purple-300">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 p-3.5 bg-purple-950/40 border border-purple-500/30 rounded-xl">
              <div className="flex items-center justify-between text-xs font-semibold text-purple-200">
                <span>Processing and uploading to Firebase Storage...</span>
                <span>{uploadPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>💡 Drag crop box to frame • Corner handles resize</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropAndUpload}
              disabled={isUploading}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "✂️ Crop & Upload to Storage"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
