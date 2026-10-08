import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { deliver } from "../workers/notifications";
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare(sql: string) {
      let params: (string | number | null)[] = [];
      const query = {
        bind(...values: (string | number | null)[]) {
          params = values;
          return query;
        },
        async run() {
          const result = sqlite.prepare(sql).run(...params);
          return { meta: { changes: Number(result.changes) } };
        },
        async first() {
          return sqlite.prepare(sql).get(...params) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...params) };
        },
      };
      return query;
    },
  } as unknown as D1Database;
  sqlite
    .prepare(
      "INSERT INTO leads(id,idempotency_key,fingerprint,name,email,reference_links,service_name,config_version,estimate,manual_review,snapshot,created_at,updated_at) VALUES('lead','key','hash','Cliente','customer@example.test','[]','Arte',1,10000,0,'{}','2026-01-01','2026-01-01')",
    )
    .run();
  sqlite
    .prepare(
      "INSERT INTO outbox(id,lead_id,kind,next_attempt,created_at) VALUES('event','lead','new_lead','2026-01-01','2026-01-01')",
    )
    .run();
  return { sqlite, db };
}
describe("email outbox", () => {
  it("sends only to the configured artist and does not resend completed events", async () => {
    const { sqlite, db } = database();
    const send = vi.fn(async (_message: { to: string }) => ({}));
    const env = {
      DB: db,
      EMAIL: { send },
      EMAIL_ENABLED: "true",
      FROM_EMAIL: "notifications@art.example",
      NOTIFICATION_TO: "artist@example.test",
      ADMIN_URL: "https://art.example/admin",
    };
    await deliver(env);
    await deliver(env);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "artist@example.test" });
    expect(sqlite.prepare("SELECT state FROM outbox").get()!.state).toBe(
      "sent",
    );
    sqlite.close();
  });
  it("retries failures and stops after five attempts without losing the lead", async () => {
    const { sqlite, db } = database();
    const send = vi.fn(async () => {
      throw new Error("temporary failure");
    });
    const env = {
      DB: db,
      EMAIL: { send },
      EMAIL_ENABLED: "true",
      FROM_EMAIL: "notifications@art.example",
      NOTIFICATION_TO: "artist@example.test",
      ADMIN_URL: "https://art.example/admin",
    };
    for (let i = 0; i < 5; i++) {
      sqlite.prepare("UPDATE outbox SET next_attempt='2026-01-01'").run();
      await deliver(env);
    }
    const row = sqlite.prepare("SELECT state,attempts FROM outbox").get()!;
    expect(row.state).toBe("failed");
    expect(row.attempts).toBe(5);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM leads").get()!.n).toBe(1);
    sqlite.close();
  });
  it("keeps email disabled before domain configuration", async () => {
    const { sqlite, db } = database();
    const send = vi.fn(async () => ({}));
    await deliver({ DB: db, EMAIL: { send }, EMAIL_ENABLED: "false" });
    expect(send).not.toHaveBeenCalled();
    sqlite.close();
  });
});
