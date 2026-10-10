export type PublicPage = "portfolio" | "commissions";

export function legacyDestination(
  pathname: string,
  hash: string,
): string | null {
  if (pathname.replace(/\/$/, "") === "/encomendas")
    return hash === "#processo" ? "/#processo" : "/#encomendar";
  return null;
}
