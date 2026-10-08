interface NotifyEnv {
  DB: D1Database;
  EMAIL: {
    send(message: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }): Promise<unknown>;
  };
  EMAIL_ENABLED?: string;
  FROM_EMAIL?: string;
  NOTIFICATION_TO?: string;
  ADMIN_URL?: string;
}
export async function deliver(env: NotifyEnv) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "DELETE FROM rate_buckets WHERE key IN (SELECT key FROM rate_buckets WHERE expires_at<? LIMIT 1000)",
  )
    .bind(Math.floor(Date.now() / 1000))
    .run();
  if (
    env.EMAIL_ENABLED !== "true" ||
    !env.FROM_EMAIL ||
    !env.NOTIFICATION_TO ||
    !env.ADMIN_URL
  )
    return;
  const rows = await env.DB.prepare(
    "SELECT o.id,o.lead_id,o.kind,l.name FROM outbox o JOIN leads l ON l.id=o.lead_id WHERE o.state IN ('pending','sending') AND o.next_attempt<=? ORDER BY o.created_at LIMIT 20",
  )
    .bind(now)
    .all<{ id: string; lead_id: string; kind: string; name: string }>();
  for (const row of rows.results) {
    const lease = new Date(Date.now() + 10 * 60_000).toISOString();
    const claim = await env.DB.prepare(
      "UPDATE outbox SET state='sending',attempts=attempts+1,next_attempt=? WHERE id=? AND state IN ('pending','sending') AND next_attempt<=? RETURNING attempts",
    )
      .bind(lease, row.id, now)
      .first<{ attempts: number }>();
    if (!claim) continue;
    try {
      await env.EMAIL.send({
        from: env.FROM_EMAIL,
        to: env.NOTIFICATION_TO,
        subject:
          row.kind === "new_job"
            ? "Novo trabalho aceito no seu ateliê"
            : "Uma nova ideia chegou ao seu ateliê",
        text: `${row.kind === "new_job" ? "Um lead foi convertido em trabalho" : "Você recebeu um novo pedido"} de ${row.name}.\n\nAbra o painel protegido para consultar os detalhes: ${env.ADMIN_URL}\n\nReferência: ${row.lead_id.slice(0, 8).toUpperCase()}\nNão responda a este e-mail automático.`,
      });
      await env.DB.prepare(
        "UPDATE outbox SET state='sent',last_error=NULL WHERE id=? AND state='sending'",
      )
        .bind(row.id)
        .run();
    } catch {
      const retry = new Date(
        Date.now() + Math.min(60, 5 * 2 ** claim.attempts) * 60_000,
      ).toISOString();
      await env.DB.prepare(
        "UPDATE outbox SET state=?,next_attempt=?,last_error=? WHERE id=?",
      )
        .bind(
          claim.attempts >= 5 ? "failed" : "pending",
          retry,
          "Não foi possível entregar. Confira o remetente, destino verificado e configuração do serviço.",
          row.id,
        )
        .run();
    }
  }
}
export default {
  async scheduled(_event, env) {
    await deliver(env);
  },
} satisfies ExportedHandler<NotifyEnv>;
