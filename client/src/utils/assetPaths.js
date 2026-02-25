const BASE_URL = import.meta.env.BASE_URL || "/";
const NORMALIZED_BASE = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;

export const assetUrl = (path) => `${NORMALIZED_BASE}${String(path || "").replace(/^\/+/, "")}`;
