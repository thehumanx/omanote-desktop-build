const PRODUCTION_APP_URL = "https://omanote.iambishistha.com";

export function getAppUrl(): string {
  return PRODUCTION_APP_URL;
}

export function getConvexUrl(): string {
  const envUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!envUrl) {
    throw new Error("Missing production VITE_CONVEX_URL for extension build");
  }
  return envUrl;
}
