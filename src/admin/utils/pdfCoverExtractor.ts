import * as pdfjsLib from "pdfjs-dist";

// Set worker source for PDF rendering
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ExtractedCoverResult {
  coverBlob: Blob;
  coverDataUrl: string;
  width: number;
  height: number;
}

/**
 * Extracts page 1 of a PDF File/Blob as a high-quality PNG image Blob.
 * Target height matches standard CWTS newsletter covers (~528px high).
 */
export async function extractPdfCoverBlob(
  pdfFileOrBlob: File | Blob,
  targetHeight: number = 528
): Promise<ExtractedCoverResult> {
  const arrayBuffer = await pdfFileOrBlob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Render at 2x scale for retina clarity, then export
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const scale = (targetHeight * 2) / unscaledViewport.height;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create 2D canvas context for PDF rendering.");
  }

  // Draw white background
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const coverDataUrl = canvas.toDataURL("image/png", 0.95);

  const coverBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create PNG Blob from rendered PDF canvas."));
      },
      "image/png",
      0.95
    );
  });

  return {
    coverBlob,
    coverDataUrl,
    width: Math.round(viewport.width / 2),
    height: targetHeight,
  };
}
