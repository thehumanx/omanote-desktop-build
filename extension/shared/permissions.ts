import { getAppUrl } from "./config";

const APP_URL = getAppUrl();

export const APP_HOST_ORIGINS = [`${new URL(APP_URL).origin}/*`];

type PermissionsRequest = {
  origins: string[];
};

type PermissionsApi = {
  contains(permission: PermissionsRequest): Promise<boolean>;
  request(permission: PermissionsRequest): Promise<boolean>;
};

export async function ensureAppHostPermission(
  permissionsApi: PermissionsApi | undefined = chrome.permissions,
): Promise<boolean> {
  if (!permissionsApi) return true;
  try {
    if (await permissionsApi.contains({ origins: APP_HOST_ORIGINS })) return true;
  } catch {
    return true;
  }
  try {
    return await permissionsApi.request({ origins: APP_HOST_ORIGINS });
  } catch {
    return true;
  }
}
