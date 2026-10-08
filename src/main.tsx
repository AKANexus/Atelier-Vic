import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import Portfolio from "./Portfolio";
import "./styles.css";
const Admin = lazy(() => import("./Admin"));
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading">Preparando seu estúdio…</div>}>
      {window.location.pathname.startsWith("/admin") ? (
        <Admin />
      ) : (
        <Portfolio />
      )}
    </Suspense>
  </React.StrictMode>,
);
