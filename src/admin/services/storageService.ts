import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getMetadata,
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
    const result = await listAll(folderRef);

    const promises = result.items.map(async (itemRef) => {
      try {
        const [downloadUrl, meta] = await Promise.all([
          getDownloadURL(itemRef),
          getMetadata(itemRef).catch(() => null),
        ]);

        const fileName = itemRef.name;

        const mediaItem: MediaItem = {
          id: `${collectionConfig.collectionPath}/${fileName}`,
          name: fileName,
          collectionId: collectionConfig.id,
          collectionPath: collectionConfig.collectionPath,
          filePath: fileName,
          siteRelativePath: `/${collectionConfig.collectionPath}/${fileName}`,
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

    const resolved = await Promise.all(promises);
    for (const item of resolved) {
      if (item) items.push(item);
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
  const cleanFilename = sanitizeFileName(originalName, defaultExt);

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
