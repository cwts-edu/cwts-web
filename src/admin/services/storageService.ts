import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getMetadata,
  getBytes,
  listAll,
  deleteObject,
  type SettableMetadata,
} from "firebase/storage";
import { storage } from "../config/firebase";
import type { MediaCollectionConfig, MediaItem } from "../config/mediaCollections";

/**
 * Sanitizes a filename to make it safe for URLs, Firebase Storage, and file systems.
 */
export function sanitizeFileName(rawName: string, fallbackExt?: string): string {
  const parts = rawName.split(".");
  let ext = parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : (fallbackExt || "");
  const baseName = parts.join(".");

  const cleanBase = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s\u4e00-\u9fa5\-_.]/g, "") // Keep alphanumeric, Han characters, hyphens, underscores
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const finalBase = cleanBase || `asset-${Date.now().toString(36)}`;
  return `${finalBase}${ext}`;
}

/**
 * Resolves a local or storage path to an accessible HTTP preview URL.
 * If the path is a site-relative path (e.g. /images/news/newsletter-2026A.jpg),
 * it converts it to the public Firebase Storage direct URL for immediate browser rendering.
 */
export function resolveMediaPreviewUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return "";
  const trimmed = pathOrUrl.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  const cleanPath = trimmed.replace(/^\/+/, "");
  if (
    cleanPath.startsWith("images/") ||
    cleanPath.startsWith("docs/")
  ) {
    const bucket = storage.app.options.storageBucket || "cwts-cms.firebasestorage.app";
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(cleanPath)}?alt=media`;
  }

  return trimmed;
}

/**
 * Lists all media items stored in a given Firebase Storage collection folder.
 */
export async function listMediaItems(collectionConfig: MediaCollectionConfig): Promise<MediaItem[]> {
  const items: MediaItem[] = [];

  try {
    const folderRef = ref(storage, collectionConfig.collectionPath);

    const collectItems = async (currentRef: any, relativeSubfolder: string = ""): Promise<any[]> => {
      const result = await listAll(currentRef);
      const filePromises = result.items.map(async (itemRef) => {
        try {
          const [downloadUrl, meta] = await Promise.all([
            getDownloadURL(itemRef),
            getMetadata(itemRef).catch(() => null),
          ]);

          const fileName = itemRef.name;
          const fullRelPath = relativeSubfolder
            ? `${collectionConfig.collectionPath}/${relativeSubfolder}/${fileName}`
            : `${collectionConfig.collectionPath}/${fileName}`;

          const mediaItem: MediaItem = {
            id: fullRelPath,
            name: fileName,
            collectionId: collectionConfig.id,
            collectionPath: collectionConfig.collectionPath,
            filePath: relativeSubfolder ? `${relativeSubfolder}/${fileName}` : fileName,
            siteRelativePath: `/${fullRelPath}`,
            downloadUrl,
            size: meta?.size,
            contentType: meta?.contentType || (collectionConfig.type === "image" ? "image/jpeg" : "application/pdf"),
            updatedAt: meta?.updated || meta?.timeCreated || new Date().toISOString(),
          };

          return mediaItem;
        } catch (err) {
          console.warn(`Could not load metadata for ${itemRef.name}:`, err);
          return null;
        }
      });

      const currentFiles = await Promise.all(filePromises);

      // Recursively collect from subfolders
      const subfolderPromises = result.prefixes.map(async (prefixRef) => {
        const subName = relativeSubfolder
          ? `${relativeSubfolder}/${prefixRef.name}`
          : prefixRef.name;
        return collectItems(prefixRef, subName);
      });

      const subfolderFiles = await Promise.all(subfolderPromises);
      return [...currentFiles.filter(Boolean), ...subfolderFiles.flat()];
    };

    const allCollected = await collectItems(folderRef);
    for (const item of allCollected) {
      if (item) {
        // Segregate page-covers (*.cover.jpg) and page-thumbnails (*.thumbnail.jpg)
        if (collectionConfig.id === "page-covers" && item.name.includes(".thumbnail.")) {
          continue;
        }
        if (collectionConfig.id === "page-thumbnails" && !item.name.includes(".thumbnail.")) {
          continue;
        }
        items.push(item);
      }
    }
  } catch (err) {
    console.warn(`[Firebase Storage] listAll failed for '${collectionConfig.collectionPath}':`, err);
  }

  // Sort newest first
  items.sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  return items;
}

/**
 * Uploads a file or Blob directly to Firebase Storage.
 */
export async function uploadMediaFile(
  fileOrBlob: File | Blob,
  collectionConfig: MediaCollectionConfig,
  customFilename?: string,
  onProgress?: (percent: number) => void
): Promise<MediaItem> {
  const originalName = customFilename || (fileOrBlob as File).name || `upload-${Date.now()}`;
  const defaultExt = collectionConfig.type === "image" ? ".jpg" : ".pdf";
  let cleanFilename = sanitizeFileName(originalName, defaultExt);

  if (collectionConfig.id === "page-thumbnails" && !cleanFilename.includes(".thumbnail.")) {
    cleanFilename = cleanFilename.replace(/(\.[a-zA-Z0-9]+)?$/, ".thumbnail$1");
  } else if (collectionConfig.id === "page-covers" && !cleanFilename.includes(".cover.") && !cleanFilename.includes(".thumbnail.")) {
    cleanFilename = cleanFilename.replace(/(\.[a-zA-Z0-9]+)?$/, ".cover$1");
  }

  const storagePath = `${collectionConfig.collectionPath}/${cleanFilename}`;
  const fileRef = ref(storage, storagePath);

  const metadata: SettableMetadata = {
    contentType: fileOrBlob.type || (collectionConfig.type === "image" ? "image/jpeg" : "application/pdf"),
    customMetadata: {
      collectionId: collectionConfig.id,
      uploadedAt: new Date().toISOString(),
    },
  };

  const uploadTask = uploadBytesResumable(fileRef, fileOrBlob, metadata);

  return new Promise<MediaItem>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct);
        }
      },
      (error) => {
        console.error(`Firebase Storage upload error for ${storagePath}:`, error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const meta = await getMetadata(uploadTask.snapshot.ref).catch(() => null);

          const item: MediaItem = {
            id: storagePath,
            name: cleanFilename,
            collectionId: collectionConfig.id,
            collectionPath: collectionConfig.collectionPath,
            filePath: cleanFilename,
            siteRelativePath: `/${collectionConfig.collectionPath}/${cleanFilename}`,
            downloadUrl,
            size: meta?.size || fileOrBlob.size,
            contentType: meta?.contentType || metadata.contentType,
            updatedAt: meta?.updated || meta?.timeCreated || new Date().toISOString(),
          };

          resolve(item);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Deletes a file from Firebase Storage.
 */
export async function deleteMediaFile(storagePathOrUrl: string): Promise<void> {
  try {
    let targetPath = storagePathOrUrl;
    if (targetPath.startsWith("/")) {
      targetPath = targetPath.slice(1);
    }
    const fileRef = ref(storage, targetPath);
    await deleteObject(fileRef);
  } catch (err) {
    console.error(`Failed to delete storage item ${storagePathOrUrl}:`, err);
    throw err;
  }
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".json": "application/json",
};

export function getMimeTypeFromPath(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot !== -1 ? filePath.slice(lastDot).toLowerCase() : "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

export interface DownloadedAsset {
  buffer: Uint8Array;
  contentType: string;
}

/**
 * Downloads a media asset from Cloud Storage by its site-relative path (e.g. /images/... or /docs/...).
 * Encapsulates bucket resolution, SDK credentials, and error handling.
 * Returns null if the asset does not exist in storage.
 */
export async function downloadMediaAsset(
  siteRelativePath: string
): Promise<DownloadedAsset | null> {
  const cleanPath = siteRelativePath.replace(/^\/+/, "").trim();
  if (!cleanPath) return null;

  try {
    const fileRef = ref(storage, cleanPath);
    const [meta, rawBytes] = await Promise.all([
      getMetadata(fileRef).catch(() => null),
      getBytes(fileRef),
    ]);

    const detectedMime = getMimeTypeFromPath(cleanPath);
    const contentType =
      meta?.contentType && meta.contentType !== "application/octet-stream"
        ? meta.contentType
        : detectedMime;

    return {
      buffer: new Uint8Array(rawBytes),
      contentType,
    };
  } catch (err: any) {
    if (err?.code === "storage/object-not-found") {
      return null;
    }
    console.warn(`[StorageService] Failed to download '${cleanPath}':`, err?.message || err);
    return null;
  }
}


