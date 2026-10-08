import { z } from "zod";
import {
  configSchema,
  mediaIds,
  quote,
  statusSchema,
  type Config,
} from "../../src/domain";
import {
  boundedBytes,
  hash,
  HttpError,
  json,
  localDev,
  published,
  readJson,
  requireAdmin,
  sameOrigin,
  settings,
  type Env,
} from "../_lib";

const answersSchema = z.record(
  z.string().uuid(),
  z.union([z.string().max(3000), z.array(z.string().uuid()).max(30)]),
);
const estimateSchema = z.object({
  serviceId: z.string().uuid(),
  version: z.number().int(),
  answers: answersSchema,
});
const submissionSchema = estimateSchema.extend({
  key: z.string().uuid(),
  name: z.string().trim().min(2).max(150),
  email: z.email().max(254),
  phone: z.string().max(30),
  request: z.string().trim().max(3000),
  referenceLinks: z
    .array(
      z
        .url()
        .max(1000)
        .refine((s) => new URL(s).protocol === "https:", "Use links HTTPS."),
    )
    .max(5),
  consent: z.literal(true),
  turnstile: z.string().min(1).max(2048),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join(" "),
    );
  return result.data;
}
function decodeLead(row: Record<string, unknown>) {
  const { fingerprint: _f, idempotency_key: _k, ...safe } = row;
  return {
    ...safe,
    reference_links: JSON.parse(String(row.reference_links)),
    snapshot: JSON.parse(String(row.snapshot)),
  };
}
function validId(id: string | undefined) {
  return parse(z.string().uuid(), id);
}
function estimate(config: Config, data: z.infer<typeof estimateSchema>) {
  const service = config.services.find((s) => s.id === data.serviceId);
  if (!service)
    throw new HttpError(400, "O serviço selecionado não está disponível.");
  try {
    return { service, result: quote(service, data.answers) };
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Respostas inválidas.",
    );
  }
}
async function publicConfig(env: Env) {
  const row = await settings(env);
  return {
    config: published(row),
    version: row.version,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
  };
}
async function verifyTurnstile(request: Request, env: Env, token: string) {
  if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY)
    throw new HttpError(
      503,
      "Novos pedidos temporariamente indisponíveis. Entre em contato com o estúdio.",
    );
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!response.ok)
    throw new HttpError(503, "Verificação indisponível. Tente novamente.");
  const verdict = (await response.json()) as {
    success: boolean;
    hostname?: string;
    action?: string;
  };
  if (
    !verdict.success ||
    (!localDev(request, env) &&
      (verdict.hostname !== new URL(request.url).hostname ||
        verdict.action !== "quote"))
  )
    throw new HttpError(400, "Refaça a verificação de segurança para enviar.");
}
async function throttle(request: Request, env: Env) {
  const now = Math.floor(Date.now() / 1000);
  const key = await hash(
    `${env.TURNSTILE_SECRET_KEY}:${request.headers.get("CF-Connecting-IP") || "local"}:${Math.floor(now / 3600)}`,
  );
  const result = await env.DB.prepare(
    "INSERT INTO rate_buckets(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count",
  )
    .bind(key, now + 7200)
    .first();
  if (!result)
    throw new HttpError(
      429,
      "Muitos pedidos nesta hora. Tente mais tarde ou entre em contato.",
    );
  await env.DB.prepare(
    "DELETE FROM rate_buckets WHERE key IN (SELECT key FROM rate_buckets WHERE expires_at<? LIMIT 100)",
  )
    .bind(now)
    .run();
}
function webp(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  return (
    bytes.length >= 16 &&
    decoder.decode(bytes.slice(0, 4)) === "RIFF" &&
    decoder.decode(bytes.slice(8, 12)) === "WEBP"
  );
}
async function uploadMedia(request: Request, env: Env) {
  const bytes = await boundedBytes(request, 580 * 1024);
  const form = await new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: bytes,
  }).formData();
  const file = form.get("image");
  const thumb = form.get("thumbnail");
  const title = parse(z.string().trim().min(1).max(150), form.get("title"));
  if (!(file instanceof File) || !(thumb instanceof File))
    throw new HttpError(400, "Envie a imagem e sua miniatura.");
  if (file.size > 500 * 1024 || thumb.size > 64 * 1024)
    throw new HttpError(413, "Imagem ou miniatura acima do limite.");
  const imageBytes = new Uint8Array(await file.arrayBuffer());
  const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
  if (!webp(imageBytes) || !webp(thumbBytes))
    throw new HttpError(400, "As imagens devem estar em formato WebP.");
  const id = crypto.randomUUID();
  const size = file.size + thumb.size;
  const reserved = await env.DB.prepare(
    "INSERT INTO media(id,title,bytes) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM media)<500 AND (SELECT COALESCE(SUM(bytes),0) FROM media)+?<=314572800",
  )
    .bind(id, title, size, size)
    .run();
  if (!reserved.meta.changes)
    throw new HttpError(
      409,
      "Limite de 500 imagens ou 300 MiB atingido. Remova imagens sem uso antes de enviar.",
    );
  // CODEX: Reserve metadata before KV writes. Failed uploads retain their reservation until explicit cleanup.
  await env.MEDIA.put(`${id}/image`, imageBytes, {
    metadata: { contentType: "image/webp" },
  });
  await env.MEDIA.put(`${id}/thumbnail`, thumbBytes, {
    metadata: { contentType: "image/webp" },
  });
  await env.DB.prepare("UPDATE media SET state='ready' WHERE id=?")
    .bind(id)
    .run();
  return json({ id, title, bytes: size }, 201);
}
async function mediaResponse(
  request: Request,
  env: Env,
  id: string,
  privateMedia = false,
) {
  validId(id);
  if (!privateMedia && !mediaIds(published(await settings(env))).includes(id))
    throw new HttpError(404, "Imagem não publicada.");
  const variant =
    new URL(request.url).searchParams.get("size") === "thumbnail"
      ? "thumbnail"
      : "image";
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const key = new Request(
    new URL(`/api/media/${id}?size=${variant}`, request.url),
    { method: "GET" },
  );
  if (!privateMedia) {
    const cached = await cache.match(key);
    if (cached) return cached;
  }
  const bytes = await env.MEDIA.get(`${id}/${variant}`, "arrayBuffer");
  if (!bytes)
    throw new HttpError(
      404,
      "Imagem ainda indisponível. Aguarde alguns segundos após o envio.",
    );
  const response = new Response(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": privateMedia
        ? "no-store"
        : "public, max-age=86400, immutable",
    },
  });
  if (!privateMedia) await cache.put(key, response.clone());
  return response;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const path = url.pathname
      .replace(/^\/api\//, "")
      .split("/")
      .filter(Boolean);
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { status: 405 });
    if (path[0] === "admin") {
      const actor = await requireAdmin(request, env);
      if (!["GET", "HEAD"].includes(method)) sameOrigin(request);
      if (path[1] === "session" && method === "GET")
        return json({
          email: actor,
          local: localDev(request, env),
          emailEnabled: env.EMAIL_ENABLED === "true",
          turnstileConfigured:
            !!env.TURNSTILE_SECRET_KEY && !!env.TURNSTILE_SITE_KEY,
        });
      if (path[1] === "config" && method === "GET") {
        const row = await settings(env, true);
        return json({
          draft: JSON.parse(row.draft),
          published: row.published ? JSON.parse(row.published) : null,
          revision: row.revision,
          version: row.version,
        });
      }
      if (path[1] === "config" && method === "PUT") {
        const data = parse(
          z.object({ config: configSchema, revision: z.number().int().min(0) }),
          await readJson(request, 512 * 1024),
        );
        const result = await env.DB.prepare(
          "UPDATE settings SET draft=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1 AND revision=?",
        )
          .bind(JSON.stringify(data.config), data.revision)
          .run();
        if (!result.meta.changes)
          throw new HttpError(
            409,
            "O rascunho mudou em outra sessão. Recarregue antes de salvar.",
          );
        return json({ revision: data.revision + 1 });
      }
      if (path[1] === "publish" && method === "POST") {
        const data = parse(
          z.object({ revision: z.number().int() }),
          await readJson(request),
        );
        const row = await settings(env);
        const config = parse(configSchema, JSON.parse(row.draft));
        if (row.revision !== data.revision)
          throw new HttpError(
            409,
            "O rascunho mudou. Recarregue antes de publicar.",
          );
        const ready = await env.DB.prepare(
          "SELECT id FROM media WHERE state='ready'",
        ).all<{ id: string }>();
        const ids = new Set(ready.results.map((m) => m.id));
        if (mediaIds(config).some((id) => !ids.has(id)))
          throw new HttpError(
            400,
            "O rascunho contém uma imagem ausente ou incompleta.",
          );
        if (
          config.accepting &&
          (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY)
        )
          throw new HttpError(
            400,
            "Configure o Turnstile antes de abrir novos pedidos.",
          );
        const result = await env.DB.prepare(
          "UPDATE settings SET published=draft,version=version+1,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1 AND revision=?",
        )
          .bind(data.revision)
          .run();
        if (!result.meta.changes)
          throw new HttpError(
            409,
            "O rascunho mudou. Recarregue antes de publicar.",
          );
        return json({ revision: row.revision + 1, version: row.version + 1 });
      }
      if (path[1] === "media" && method === "GET") {
        if (path[2]) return await mediaResponse(request, env, path[2], true);
        const media = await env.DB.prepare(
          "SELECT * FROM media ORDER BY created_at DESC",
        ).all();
        return json({ media: media.results });
      }
      if (path[1] === "media" && method === "POST")
        return await uploadMedia(request, env);
      if (path[1] === "media" && path[2] && method === "DELETE") {
        const id = validId(path[2]);
        const row = await settings(env);
        if (
          mediaIds(JSON.parse(row.draft)).includes(id) ||
          mediaIds(published(row)).includes(id)
        )
          throw new HttpError(
            409,
            "Remova a imagem do rascunho e da versão publicada antes de excluí-la.",
          );
        await env.MEDIA.delete(`${id}/image`);
        await env.MEDIA.delete(`${id}/thumbnail`);
        await env.DB.prepare("DELETE FROM media WHERE id=?").bind(id).run();
        return json({ deleted: true });
      }
      if (path[1] === "notifications" && method === "GET") {
        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM leads WHERE attention=1",
        ).first<{ count: number }>();
        const failures = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM outbox WHERE state='failed'",
        ).first<{ count: number }>();
        return json({
          attention: count?.count || 0,
          emailFailures: failures?.count || 0,
        });
      }
      if (
        path[1] === "notifications" &&
        path[2] === "retry" &&
        method === "POST"
      ) {
        if (env.EMAIL_ENABLED !== "true")
          throw new HttpError(
            409,
            "Notificações por e-mail estão desativadas.",
          );
        await env.DB.prepare(
          "UPDATE outbox SET state='pending',attempts=0,last_error=NULL,next_attempt=? WHERE state='failed'",
        )
          .bind(new Date().toISOString())
          .run();
        return json({ retried: true });
      }
      if (path[1] === "leads" && !path[2] && method === "GET") {
        const page = Math.max(
          0,
          Math.min(10000, Number(url.searchParams.get("page") || 0) || 0),
        );
        const filter = url.searchParams.get("status");
        const attention = url.searchParams.get("attention") === "true";
        const search = (url.searchParams.get("search") || "").slice(0, 100);
        const clauses: string[] = [];
        const params: (string | number)[] = [];
        if (filter) {
          clauses.push("status=?");
          params.push(parse(statusSchema, filter));
        }
        if (attention) clauses.push("attention=1");
        if (search) {
          clauses.push(
            "(instr(lower(name),lower(?))>0 OR instr(lower(email),lower(?))>0)",
          );
          params.push(search, search);
        }
        const result = await env.DB.prepare(
          `SELECT * FROM leads ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?`,
        )
          .bind(...params, Math.floor(page) * 50)
          .all<Record<string, unknown>>();
        return json({
          leads: result.results.slice(0, 50).map(decodeLead),
          more: result.results.length > 50,
        });
      }
      if (path[1] === "leads" && path[2]) {
        const id = validId(path[2]);
        const lead = await env.DB.prepare("SELECT * FROM leads WHERE id=?")
          .bind(id)
          .first<Record<string, unknown>>();
        if (!lead) throw new HttpError(404, "Pedido não encontrado.");
        if (method === "GET") {
          const history = await env.DB.prepare(
            "SELECT actor,message,created_at FROM history WHERE lead_id=? ORDER BY created_at DESC",
          )
            .bind(id)
            .all();
          return json({ lead: decodeLead(lead), history: history.results });
        }
        if (method === "PATCH") {
          const data = parse(
            z.object({
              status: statusSchema,
              attention: z.boolean(),
              notes: z.string().max(10000),
              finalPrice: z.number().int().min(0).max(100_000_000).nullable(),
              revision: z.number().int().min(0),
            }),
            await readJson(request),
          );
          if (data.revision !== lead.revision)
            throw new HttpError(
              409,
              "O pedido mudou em outra sessão. Reabra antes de salvar.",
            );
          const now = new Date().toISOString();
          const isJob =
            Number(lead.is_job) === 1 ||
            !["new", "rejected"].includes(data.status);
          const statements = [
            env.DB.prepare(
              "UPDATE leads SET status=?,attention=?,notes=?,final_price=?,paid_at=?,is_job=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?",
            ).bind(
              data.status,
              Number(data.attention),
              data.notes,
              data.finalPrice,
              data.status === "paid" ? lead.paid_at || now : lead.paid_at,
              Number(isJob),
              now,
              id,
              data.revision,
            ),
            env.DB.prepare(
              "INSERT INTO history(id,lead_id,actor,message,created_at) SELECT ?,?,?,?,? WHERE changes()=1",
            ).bind(
              crypto.randomUUID(),
              id,
              actor,
              lead.status === data.status
                ? "Dados e atenção atualizados."
                : `Status: ${lead.status} → ${data.status}`,
              now,
            ),
          ];
          if (!lead.is_job && isJob && env.EMAIL_ENABLED === "true")
            statements.push(
              env.DB.prepare(
                "INSERT OR IGNORE INTO outbox(id,lead_id,kind,next_attempt,created_at) SELECT ?,?,'new_job',?,? WHERE changes()=1",
              ).bind(crypto.randomUUID(), id, now, now),
            );
          const result = await env.DB.batch(statements);
          if (!result[0].meta.changes)
            throw new HttpError(409, "O pedido mudou. Reabra antes de salvar.");
          return json({ updated: true });
        }
        if (method === "DELETE") {
          await env.DB.prepare("DELETE FROM leads WHERE id=?").bind(id).run();
          return json({ deleted: true });
        }
      }
      throw new HttpError(404, "Rota administrativa não encontrada.");
    }
    if (path[0] === "config" && method === "GET")
      return json(await publicConfig(env));
    if (path[0] === "media" && path[1] && method === "GET")
      return await mediaResponse(request, env, path[1]);
    if ((path[0] === "estimate" || path[0] === "leads") && method === "POST") {
      sameOrigin(request);
      const raw = await readJson(request);
      const data =
        path[0] === "leads"
          ? parse(submissionSchema, raw)
          : parse(estimateSchema, raw);
      let fingerprint = "";
      if (path[0] === "leads") {
        const submission = data as z.infer<typeof submissionSchema>;
        fingerprint = await hash(
          JSON.stringify({
            name: submission.name,
            email: submission.email,
            phone: submission.phone,
            request: submission.request,
            referenceLinks: submission.referenceLinks,
            version: submission.version,
            serviceId: submission.serviceId,
            answers: Object.fromEntries(
              Object.entries(submission.answers).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
            ),
          }),
        );
        const previous = await env.DB.prepare(
          "SELECT id,fingerprint,estimate FROM leads WHERE idempotency_key=?",
        )
          .bind(submission.key)
          .first<{ id: string; fingerprint: string; estimate: number }>();
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new HttpError(
              409,
              "Este envio já foi usado para outro pedido. Recarregue para iniciar um novo.",
            );
          return json({ id: previous.id, estimate: previous.estimate });
        }
      }
      const config = await publicConfig(env);
      if (!config.config.accepting)
        throw new HttpError(
          409,
          "A agenda está fechada no momento. Entre em contato com o estúdio.",
        );
      if (config.version !== data.version)
        throw new HttpError(
          409,
          "O formulário mudou. Recarregue a página para usar a versão atual.",
        );
      const { service, result } = estimate(config.config, data);
      if (path[0] === "estimate") return json(result);
      const submission = data as z.infer<typeof submissionSchema>;
      await verifyTurnstile(request, env, submission.turnstile);
      await throttle(request, env);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const statements = [
        env.DB.prepare(
          "INSERT INTO leads(id,idempotency_key,fingerprint,name,email,phone,request,reference_links,service_name,config_version,estimate,manual_review,snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          id,
          submission.key,
          fingerprint,
          submission.name,
          submission.email,
          submission.phone,
          submission.request,
          JSON.stringify(submission.referenceLinks),
          service.name,
          submission.version,
          result.total,
          Number(result.manualReview),
          JSON.stringify(result),
          now,
          now,
        ),
        env.DB.prepare(
          "INSERT INTO history(id,lead_id,actor,message,created_at) VALUES(?,?,?,?,?)",
        ).bind(
          crypto.randomUUID(),
          id,
          "customer",
          "Pedido recebido pelo site.",
          now,
        ),
      ];
      if (env.EMAIL_ENABLED === "true")
        statements.push(
          env.DB.prepare(
            "INSERT INTO outbox(id,lead_id,kind,next_attempt,created_at) VALUES(?,?,'new_lead',?,?)",
          ).bind(crypto.randomUUID(), id, now, now),
        );
      try {
        await env.DB.batch(statements);
      } catch (error) {
        const duplicate = await env.DB.prepare(
          "SELECT id,fingerprint FROM leads WHERE idempotency_key=?",
        )
          .bind(submission.key)
          .first<{ id: string; fingerprint: string }>();
        if (duplicate?.fingerprint === fingerprint)
          return json({ id: duplicate.id, estimate: result.total });
        throw error;
      }
      return json({ id, estimate: result.total }, 201);
    }
    throw new HttpError(404, "Rota não encontrada.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    // Never log requests, contacts, tokens or database error text.
    console.error(
      "api_failure",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        error:
          "Serviço temporariamente indisponível. Tente novamente mais tarde.",
      },
      503,
    );
  }
};
