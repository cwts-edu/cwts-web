import React, { useState } from "react";
import JSZip from "jszip";
import { db, storage } from "../config/firebase";
import { collection, getDocs, doc, writeBatch, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../context/AuthContext";
import type { AuditUser } from "../../libs/content/types";

interface PackageManifest {
  format: "cwts-cms-package";
  version: string;
  collection: string;
  exportedAt: string;
  documentsCount: number;
  assetsCount: number;
  assetBaseFolder?: string;
}

interface LoadedPackage {
  file: File;
  manifest: PackageManifest;
  documents: any[];
  zip: JSZip;
}

interface Props {
  onRefreshData?: () => Promise<void>;
}

function cleanFirestoreData(input: any): any {
  if (input === undefined) return null;
  if (input === null || typeof input !== "object") return input;

  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && key !== "") {
      result[key] = cleanFirestoreData(value);
    }
  }
  return result;
}

export const BackupRestoreView: React.FC<Props> = ({ onRefreshData }) => {
  const { user } = useAuth();

  // Export State
  const [exportCollection, setExportCollection] = useState<string>("faculty");
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Import State
  const [loadedPackage, setLoadedPackage] = useState<LoadedPackage | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const [resultMessage, setResultMessage] = useState<{ success: boolean; text: string } | null>(null);

  const getAudit = (): AuditUser => ({
    uid: user?.uid || "admin",
    email: user?.email || "admin@cwts.edu",
    displayName: user?.displayName || user?.email || "CWTS Admin",
    timestamp: new Date().toISOString(),
  });

  // 1. Export Handler (Backup)
  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus(`Querying documents for '${exportCollection}'...`);
    setResultMessage(null);

    try {
      const snap = await getDocs(collection(db, exportCollection));
      const documents: any[] = [];
      const assetPaths = new Set<string>();

      snap.forEach((d) => {
        const data = d.data();
        if (data.status !== "deleted") {
          documents.push({ id: d.id, ...data });

          if (Array.isArray(data.referencedAssets)) {
            data.referencedAssets.forEach((p: string) => assetPaths.add(p.replace(/^\/+/, "")));
          }
          if (data.photo) assetPaths.add(String(data.photo).replace(/^\/+/, ""));
          if (data.thumbnail) assetPaths.add(String(data.thumbnail).replace(/^\/+/, ""));
          if (data.file) assetPaths.add(String(data.file).replace(/^\/+/, ""));
        }
      });

      setExportStatus(`Found ${documents.length} documents and ${assetPaths.size} assets. Creating package...`);

      const zip = new JSZip();

      // manifest.json
      const manifest: PackageManifest = {
        format: "cwts-cms-package",
        version: "1.0",
        collection: exportCollection,
        exportedAt: new Date().toISOString(),
        documentsCount: documents.length,
        assetsCount: assetPaths.size,
      };

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      zip.file("documents.json", JSON.stringify(documents, null, 2));

      // Download and package assets from Firebase Storage
      const assetsFolder = zip.folder("assets");
      let assetDownloadedCount = 0;
      let failedAssetsCount = 0;

      for (const assetPath of assetPaths) {
        setExportStatus(`Downloading asset [${assetDownloadedCount + 1}/${assetPaths.size}]: ${assetPath}...`);
        try {
          const fileRef = ref(storage, assetPath);
          let arrayBuffer: ArrayBuffer | null = null;

          try {
            arrayBuffer = await getBytes(fileRef);
          } catch {
            try {
              const downloadUrl = await getDownloadURL(fileRef);
              const res = await fetch(downloadUrl);
              if (res.ok) {
                arrayBuffer = await res.arrayBuffer();
              }
            } catch {}
          }

          if (arrayBuffer) {
            assetsFolder?.file(assetPath, arrayBuffer);
            assetDownloadedCount++;
          } else {
            failedAssetsCount++;
          }
        } catch (e) {
          console.warn(`Could not fetch storage file ${assetPath} during export:`, e);
          failedAssetsCount++;
        }
      }

      setExportStatus("Compressing ZIP archive...");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

      // Trigger browser download
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `cwts-${exportCollection}-package-${dateStr}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      if (failedAssetsCount > 0 && assetDownloadedCount === 0 && assetPaths.size > 0) {
        setResultMessage({
          success: true,
          text: `⚠️ Package exported (${documents.length} docs), but ${failedAssetsCount} media files could not be downloaded directly due to Firebase Storage CORS. Apply cors.json to cwts-cms.firebasestorage.app to enable direct media downloading.`,
        });
      } else if (failedAssetsCount > 0) {
        setResultMessage({
          success: true,
          text: `⚠️ Package exported with ${documents.length} docs and ${assetDownloadedCount} assets (${failedAssetsCount} assets failed).`,
        });
      } else {
        setResultMessage({
          success: true,
          text: `✅ Package exported successfully: '${filename}' (${documents.length} docs, ${assetDownloadedCount} assets).`,
        });
      }
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: `❌ Export failed: ${err.message || String(err)}`,
      });
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  };

  // 2. Parse Uploaded Package File
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResultMessage(null);
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file("manifest.json");
      const docsFile = zip.file("documents.json");

      if (!manifestFile || !docsFile) {
        throw new Error("Invalid CWTS package: 'manifest.json' or 'documents.json' not found inside archive.");
      }

      const manifestText = await manifestFile.async("string");
      const docsText = await docsFile.async("string");

      const manifest = JSON.parse(manifestText) as PackageManifest;
      const documents = JSON.parse(docsText) as any[];

      setLoadedPackage({
        file,
        manifest,
        documents,
        zip,
      });
    } catch (err: any) {
      setLoadedPackage(null);
      setResultMessage({
        success: false,
        text: `❌ Could not read package: ${err.message || String(err)}`,
      });
    }
  };

  // 3. Restore / Seed Collection from Package
  const handleRestore = async () => {
    if (!loadedPackage) return;
    const { manifest, documents, zip } = loadedPackage;

    if (
      !confirm(
        `⚠️ Warning: This will completely REPLACE the entire '${manifest.collection}' collection in Firestore with the ${documents.length} document(s) from this package and upload bundled media assets. All existing '${manifest.collection}' records will be cleared. Continue?`
      )
    ) {
      return;
    }

    setIsImporting(true);
    setResultMessage(null);
    const audit = getAudit();

    try {
      // Step A: Purge all existing documents in the target collection to ensure complete replacement
      setImportProgress({
        current: 0,
        total: documents.length,
        status: `Purging existing '${manifest.collection}' documents for clean replacement...`,
      });

      const existingSnap = await getDocs(collection(db, manifest.collection));
      const existingDocs = existingSnap.docs;

      if (existingDocs.length > 0) {
        const DELETE_BATCH_SIZE = 50;
        for (let i = 0; i < existingDocs.length; i += DELETE_BATCH_SIZE) {
          const chunk = existingDocs.slice(i, i + DELETE_BATCH_SIZE);
          const delBatch = writeBatch(db);
          for (const d of chunk) {
            delBatch.delete(d.ref);
          }
          await delBatch.commit();
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Step B: Upload all bundled assets to Firebase Storage
      const assetEntries: JSZip.JSZipObject[] = [];
      zip.folder("assets")?.forEach((relPath, fileObj) => {
        if (!fileObj.dir) {
          assetEntries.push(fileObj);
        }
      });

      let assetsUploaded = 0;
      for (let i = 0; i < assetEntries.length; i++) {
        const item = assetEntries[i];
        const rawPath = item.name.replace(/^assets\//, "");

        setImportProgress({
          current: i + 1,
          total: assetEntries.length + documents.length,
          status: `Uploading asset [${i + 1}/${assetEntries.length}]: ${rawPath}...`,
        });

        const buffer = await item.async("arraybuffer");
        const fileRef = ref(storage, rawPath);
        await uploadBytes(fileRef, buffer);
        assetsUploaded++;

        // Yield to browser UI loop
        await new Promise((r) => setTimeout(r, 0));
      }

      // Step B: Write documents to Firestore
      const BATCH_SIZE = 20;
      let docsWritten = 0;

      for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        const chunk = documents.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const docData of chunk) {
          const docId = docData.id || docData.slug || `doc_${Date.now()}`;
          const cleanData = { ...docData };
          delete cleanData.id;

          const sanitized = cleanFirestoreData(cleanData);

          const docRef = doc(db, manifest.collection, docId);
          batch.set(docRef, {
            ...sanitized,
            status: "published",
            version: sanitized.version || 1,
            publishedVersion: sanitized.publishedVersion || 1,
            publishedBy: audit,
            updatedBy: audit,
            updatedAt: new Date().toISOString(),
          });

          // Snapshot version 1
          const verRef = doc(db, manifest.collection, docId, "versions", "1");
          batch.set(verRef, {
            version: 1,
            status: "published",
            data: sanitized,
            body: sanitized.body || "",
            bodyHtml: sanitized.bodyHtml || sanitized.zh?.bodyHtml || "",
            publishedBy: audit,
            createdAt: new Date().toISOString(),
          });
        }

        await batch.commit();
        docsWritten += chunk.length;

        setImportProgress({
          current: assetEntries.length + docsWritten,
          total: assetEntries.length + documents.length,
          status: `Writing Firestore documents [${docsWritten}/${documents.length}]...`,
        });

        await new Promise((r) => setTimeout(r, 0));
      }

      setResultMessage({
        success: true,
        text: `🎉 Collection '${manifest.collection}' replaced successfully: ${docsWritten} documents written, ${assetsUploaded} assets uploaded.`,
      });

      setLoadedPackage(null);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: `❌ Restore failed: ${err.message || String(err)}`,
      });
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Database Backup & Restore</h2>
        <p className="text-sm text-slate-400 mt-1">
          Export and restore self-contained collection packages (<span className="font-mono text-purple-300">.zip</span>)
          containing Firestore documents, localized content, and Cloud Storage media assets.
        </p>
      </div>

      {resultMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-lg ${
            resultMessage.success
              ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border border-rose-500/40 text-rose-300"
          }`}
        >
          <span>{resultMessage.text}</span>
          <button onClick={() => setResultMessage(null)} className="opacity-60 hover:opacity-100 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Grid: Export vs Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 1. Export Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-xl">
                📤
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Export Collection Backup</h3>
                <p className="text-xs text-slate-400">Download a full ZIP package with data and storage assets.</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300">Select Collection to Backup</label>
              <select
                value={exportCollection}
                onChange={(e) => setExportCollection(e.target.value)}
                disabled={isExporting}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
              >
                <option value="faculty">🎓 Faculty & Adjunct Professors</option>
                <option value="news">📰 News Articles</option>
                <option value="jobs">💼 Job Postings</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed">
              💡 The generated package contains all published documents and downloads all referenced images and PDFs from Firebase Cloud Storage into a single portable <code className="text-purple-300">.zip</code>.
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            {exportStatus && (
              <div className="text-xs text-purple-300 flex items-center gap-2 font-mono">
                <span className="animate-spin">⏳</span>
                <span>{exportStatus}</span>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
            >
              {isExporting ? "Generating Package..." : "📥 Download Backup (.zip)"}
            </button>
          </div>
        </div>

        {/* 2. Import / Restore Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-xl">
                📥
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Restore / Seed from Package</h3>
                <p className="text-xs text-slate-400">Recreate collection documents and upload media assets.</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300">Select Package File (.zip)</label>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                disabled={isImporting}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-purple-300 hover:file:bg-slate-700 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-1"
              />
            </div>

            {/* Loaded Package Preview */}
            {loadedPackage && (
              <div className="p-4 bg-indigo-950/30 border border-indigo-500/40 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-indigo-200">
                  <span>Package: {loadedPackage.manifest.collection}</span>
                  <span className="font-mono text-[10px] uppercase bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300">
                    Ready
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1 font-mono text-[11px]">
                  <div>📄 Documents: {loadedPackage.manifest.documentsCount}</div>
                  <div>🖼️ Assets: {loadedPackage.manifest.assetsCount}</div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            {isImporting && importProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-indigo-300 font-medium">
                  <span className="truncate">{importProgress.status}</span>
                  <span>
                    {importProgress.total > 0
                      ? `${Math.round((importProgress.current / importProgress.total) * 100)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        importProgress.total > 0
                          ? Math.round((importProgress.current / importProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleRestore}
              disabled={!loadedPackage || isImporting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
            >
              {isImporting ? "Restoring Collection..." : "🚀 Restore / Seed Collection (1-Click)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
