export interface DeployTriggerResult {
  success: boolean;
  message: string;
  stagingUrl?: string;
}

export async function triggerNetlifyStagingPreview(
  draftId: string,
  authorEmail: string
): Promise<DeployTriggerResult> {
  const hookUrl = import.meta.env.PUBLIC_NETLIFY_STAGING_HOOK_URL;
  const stagingBaseUrl =
    import.meta.env.PUBLIC_STAGING_URL || "https://preview--cwts-staging.netlify.app";

  if (!hookUrl) {
    console.warn("⚠️ PUBLIC_NETLIFY_STAGING_HOOK_URL is not set in .env. Mocking staging trigger.");
    return {
      success: true,
      message: "Staging build simulated (Configure PUBLIC_NETLIFY_STAGING_HOOK_URL for real builds).",
      stagingUrl: `${stagingBaseUrl}?draft=${encodeURIComponent(draftId)}`,
    };
  }

  try {
    const url = `${hookUrl}?trigger_title=${encodeURIComponent(`Staging Preview for ${draftId} by ${authorEmail}`)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        environment: "staging",
        triggeredBy: authorEmail,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Netlify returned ${response.status}: ${response.statusText}`);
    }

    return {
      success: true,
      message: "Staging preview deployment triggered successfully on Netlify!",
      stagingUrl: stagingBaseUrl,
    };
  } catch (err: any) {
    console.error("Failed to trigger Netlify staging preview:", err);
    return {
      success: false,
      message: err.message || "Failed to contact Netlify build hook",
    };
  }
}

export async function triggerNetlifyProductionDeploy(
  releaseId: string,
  authorEmail: string
): Promise<DeployTriggerResult> {
  const hookUrl = import.meta.env.PUBLIC_NETLIFY_PROD_HOOK_URL;
  const productionBaseUrl = import.meta.env.PUBLIC_SITE_URL || "https://cwts.edu";

  if (!hookUrl) {
    console.warn("⚠️ PUBLIC_NETLIFY_PROD_HOOK_URL is not set in .env. Mocking production trigger.");
    return {
      success: true,
      message: "Production build simulated (Configure PUBLIC_NETLIFY_PROD_HOOK_URL for real builds).",
      stagingUrl: productionBaseUrl,
    };
  }

  try {
    const url = `${hookUrl}?trigger_title=${encodeURIComponent(`Production Release ${releaseId} by ${authorEmail}`)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        releaseId,
        environment: "production",
        triggeredBy: authorEmail,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Netlify returned ${response.status}: ${response.statusText}`);
    }

    return {
      success: true,
      message: "Production release deployment triggered successfully on Netlify!",
      stagingUrl: productionBaseUrl,
    };
  } catch (err: any) {
    console.error("Failed to trigger Netlify production build:", err);
    return {
      success: false,
      message: err.message || "Failed to contact Netlify build hook",
    };
  }
}
