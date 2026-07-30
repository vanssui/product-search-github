export const APP_CONFIG = Object.freeze({
  backendUrl: String(import.meta.env.VITE_BACKEND_URL || '').trim(),
  pageSize: 60,
  snapshotPageSize: 100,
  refreshVisibleMs: 150_000,
  refreshHiddenMs: 300_000,
  detailDesktopBreakpoint: 900
});
