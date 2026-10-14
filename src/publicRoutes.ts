export type PublicPage = "portfolio" | "about" | "contact" | "category";
export interface PublicRoute {
  page: PublicPage;
  categoryId?: string;
  serviceId?: string;
  hash?: string;
}
export function publicRoute(pathname: string, search = ""): PublicRoute {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/sobre") return { page: "about" };
  if (path === "/contato")
    return {
      page: "contact",
      serviceId: new URLSearchParams(search).get("servico") || undefined,
    };
  if (path.startsWith("/portfolio/"))
    return { page: "category", categoryId: path.slice(11) };
  return { page: "portfolio" };
}
export function publicHref(route: PublicRoute): string {
  const path =
    route.page === "about"
      ? "/sobre"
      : route.page === "contact"
        ? `/contato${route.serviceId ? `?servico=${encodeURIComponent(route.serviceId)}` : ""}`
        : route.page === "category"
          ? `/portfolio/${encodeURIComponent(route.categoryId || "")}`
          : "/";
  return path + (route.hash || "");
}
export function legacyDestination(
  pathname: string,
  hash: string,
): string | null {
  if (pathname === "/" && hash === "#sobre") return "/sobre";
  if (
    pathname.replace(/\/$/, "") === "/encomendas" ||
    (pathname === "/" &&
      ["#encomendar", "#contato", "#processo"].includes(hash))
  )
    return hash === "#processo" ? "/contato#processo" : "/contato";
  return null;
}
