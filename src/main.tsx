import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import Portfolio from "./Portfolio";
import PreviewNotice from "./PreviewNotice";
import { legacyDestination, publicRoute } from "./publicRoutes";
import "./styles.css";
import "./public.css";
import "./preview.css";
function redirectLegacyLink() {
  const legacy = legacyDestination(
    window.location.pathname,
    window.location.hash,
  );
  if (legacy) window.location.replace(legacy);
}
redirectLegacyLink();
window.addEventListener("hashchange", redirectLegacyLink);
const Admin = lazy(() => import("./Admin"));
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading">Preparando seu estúdio…</div>}>
      {window.location.pathname.startsWith("/admin") ? (
        <Admin />
      ) : (
        <Portfolio
          {...publicRoute(window.location.pathname, window.location.search)}
        />
      )}
    </Suspense>
    <PreviewNotice />
  </React.StrictMode>,
);
