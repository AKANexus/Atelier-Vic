import { createRemoteJWKSet, jwtVerify } from "jose";
import { defaultConfig, type Config } from "../src/domain";

export interface Env {
  DB: D1Database;
  MEDIA: KVNamespace;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  EMAIL_ENABLED?: string;
  LOCAL_DEV_AUTH?: string;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
export function localDev(request: Request, env: Env) {
  const url = new URL(request.url);
  return (
    env.LOCAL_DEV_AUTH === "true" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.port === "8788"
  );
}
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function requireAdmin(request: Request, env: Env) {
  const allowed = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (localDev(request, env)) return allowed[0] || "developer@example.test";
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !allowed.length)
    throw new HttpError(403, "Acesso administrativo ainda não configurado.");
  if (
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
      env.ACCESS_TEAM_DOMAIN,
    )
  )
    throw new HttpError(403, "Configuração de acesso inválida.");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token)
    throw new HttpError(401, "Entre pelo Cloudflare Access para continuar.");
  try {
    if (!keys.has(env.ACCESS_TEAM_DOMAIN))
      keys.set(
        env.ACCESS_TEAM_DOMAIN,
        createRemoteJWKSet(
          new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`),
        ),
      );
    const { payload } = await jwtVerify(
      token,
      keys.get(env.ACCESS_TEAM_DOMAIN)!,
      { issuer: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD },
    );
    if (
      typeof payload.email !== "string" ||
      !allowed.includes(payload.email.toLowerCase())
    )
      throw new Error("Identity denied");
    return payload.email.toLowerCase();
  } catch {
    throw new HttpError(
      403,
      "Sessão inválida, expirada ou sem permissão. Entre novamente.",
    );
  }
}
export function sameOrigin(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    throw new HttpError(403, "Origem do pedido inválida.");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site")
    throw new HttpError(403, "Pedido externo bloqueado.");
}
export async function boundedBytes(request: Request, max: number) {
  if (Number(request.headers.get("Content-Length") || 0) > max)
    throw new HttpError(413, "Arquivo ou pedido grande demais.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Arquivo ou pedido grande demais.");
    }
    chunks.push(chunk.value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function readJson(
  request: Request,
  max = 32 * 1024,
): Promise<unknown> {
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    throw new HttpError(415, "Envie dados JSON.");
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBytes(request, max)),
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "JSON inválido.");
  }
}
export interface Settings {
  draft: string;
  published: string | null;
  revision: number;
  version: number;
  updated_at: string;
}
export async function settings(
  env: Env,
  initialize = false,
): Promise<Settings> {
  if (initialize)
    await env.DB.prepare("INSERT OR IGNORE INTO settings(id,draft) VALUES(1,?)")
      .bind(JSON.stringify(defaultConfig))
      .run();
  const row = await env.DB.prepare(
    "SELECT draft,published,revision,version,updated_at FROM settings WHERE id=1",
  ).first<Settings>();
  return (
    row || {
      draft: JSON.stringify(defaultConfig),
      published: null,
      revision: 0,
      version: 0,
      updated_at: "",
    }
  );
}
export function published(row: Settings): Config {
  return row.published
    ? { ...defaultConfig, ...JSON.parse(row.published) }
    : defaultConfig;
}
export async function hash(text: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
  return [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function adminShell(context: EventContext<Env, string, unknown>) {
  try {
    await requireAdmin(context.request, context.env);
    const url = new URL("/index.html", context.request.url);
    const response = await context.env.ASSETS.fetch(
      new Request(url, { method: "GET" }),
    );
    const result = new Response(response.body, response);
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch (error) {
    return new Response(
      error instanceof HttpError
        ? error.message
        : "Não foi possível verificar sua sessão.",
      {
        status: error instanceof HttpError ? error.status : 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }
}
