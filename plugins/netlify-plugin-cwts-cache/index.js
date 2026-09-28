export default {
  async onPreBuild({ utils }) {
    try {
      const success = await utils.cache.restore(".cache/cwts-assets");
      if (success) {
        console.log("⚡ [Netlify Cache] Successfully restored .cache/cwts-assets from Netlify build cache");
      } else {
        console.log("ℹ️ [Netlify Cache] No previous .cache/cwts-assets found in Netlify build cache (first run or cache cleared)");
      }
    } catch (err) {
      console.warn("⚠️ [Netlify Cache] Error restoring .cache/cwts-assets:", err);
    }
  },

  async onPostBuild({ utils }) {
    try {
      const success = await utils.cache.save(".cache/cwts-assets");
      if (success) {
        console.log("⚡ [Netlify Cache] Successfully saved .cache/cwts-assets to Netlify build cache");
      }
    } catch (err) {
      console.warn("⚠️ [Netlify Cache] Error saving .cache/cwts-assets:", err);
    }
  },
};
