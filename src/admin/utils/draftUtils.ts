import type { DraftChangeItem } from "../context/DraftContext";

/**
 * Returns a human-friendly title for a draft change item.
 */
export function formatDraftChangeTitle(change: DraftChangeItem | {
  collection: string;
  documentId: string;
  data?: any;
}): string {
  // 1. Reordering items (internal _order docId)
  if (change.documentId === "_order") {
    switch (change.collection) {
      case "carousel":
        return "Carousel Slide Order Updated";
      case "faculty":
        return "Faculty Display Order Updated";
      default:
        return `${change.collection} Order Updated`;
    }
  }

  // 2. Carousel slide
  if (change.collection === "carousel") {
    const orderStr = change.data?.order ? `Slide #${change.data.order}` : "";
    const imgName = change.data?.image ? change.data.image.split("/").pop() : "";
    if (orderStr && imgName) {
      return `${orderStr} (${imgName})`;
    }
    return orderStr || imgName || change.documentId;
  }

  // 3. News, Faculty, Jobs, or standard document
  return (
    change.data?.title ||
    change.data?.zh?.name ||
    change.data?.en?.name ||
    change.documentId
  );
}
