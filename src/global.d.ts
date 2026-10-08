/**
 * Khai báo kiểu toàn cục cho runtime bootstrap (edc-bootstrap.js chèn vào
 * <head> mọi trang) và app-config của shell.
 */
export {};

declare global {
  interface Window {
    /** Cấu hình ZMP app (từ app-config.json) */
    APP_CONFIG: Record<string, unknown>;
    /** Origin API: '' ở dev (proxy), https://educarelink-backend.onrender.com ở prod */
    __API_ORIGIN: string;
    /** Base API đầy đủ: __API_ORIGIN + '/api' */
    API_BASE: string;
    /** Map path Django -> file .html (edc-bootstrap.js) */
    __edcToPage: (url: string) => string;
  }
}
