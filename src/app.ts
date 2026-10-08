import React from "react";
import { createRoot } from "react-dom/client";

// Style của shell (rất mỏng — giao diện thật của từng trang nằm trong iframe)
import "@/css/shell.css";

// Mount the app — EduCareLink Zalo Mini App
// Shell mỏng: iframe full-screen chạy nguyên bản giao diện gốc
// (copy y xì từ educarelink-backend-4-12-2026, xem src/public/pages)
import Layout from "@/components/layout";

import appConfig from "../app-config.json";

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig as any;
}

const root = createRoot(document.getElementById("app")!);
root.render(React.createElement(Layout));
