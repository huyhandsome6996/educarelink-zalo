import React from "react";
import { createRoot } from "react-dom/client";

import RootNavigator from "@/navigation/RootNavigator";
import "@/css/app.css";

const root = createRoot(document.getElementById("app")!);
root.render(<RootNavigator />);
