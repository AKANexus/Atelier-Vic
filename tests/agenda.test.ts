import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { onRequest } from "../functions/api/[[path]]";
import { type Env } from "../functions/_lib";
import { defaultConfig } from "../src/domain";

function setup(published = true) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const draft = {
    ...defaultConfig,
    accepting: true,
    intro: "Alteração ainda não publicada",
  };
  const live = {
    ...defaultConfig,
    accepting: true,
    intro: "Apresentação publicada",
  };
  sqlite
    .prepare(
      "INSERT INTO settings(id,draft,published,revision,version) VALUES(1,?,?,5,3)",
    )
    .run(JSON.stringify(draft), published ? JSON.stringify(live) : null);
  const db = {
    prepare(sql: string) {
      let params: (string | number | null)[] = [];
      const query = {
        bind(...values: typeof params) {
          params = values;
          return query;
        },
        async first() {
          return sqlite.prepare(sql).get(...params) || null;
        },
        async run() {
          return {
            meta: {
              changes: Number(sqlite.prepare(sql).run(...params).changes),
            },
          };
        },
      };
      return query;
    },
  } as unknown as D1Database;
  const env = {
    DB: db,
    LOCAL_DEV_AUTH: "true",
    TURNSTILE_SITE_KEY: "test",
    TURNSTILE_SECRET_KEY: "test",
  } as Env;
  async function patch(value: unknown, origin = "http://127.0.0.1:8788") {
    return await onRequest({
      request: new Request("http://127.0.0.1:8788/api/admin/config", {
        method: "PATCH",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(value),
      }),
      env,
    } as Parameters<typeof onRequest>[0]);
  }
  const row = () => sqlite.prepare("SELECT * FROM settings WHERE id=1").get()!;
  return { sqlite, env, patch, row, draft, live };
}

describe("commission availability control", () => {
  it("changes only availability atomically in draft and public configuration", async () => {
    const { sqlite, patch, row, draft, live } = setup();
    try {
      expect((await patch({ accepting: false, revision: 5 })).status).toBe(200);
      expect(JSON.parse(row().draft as string)).toEqual({
        ...draft,
        accepting: false,
      });
      expect(JSON.parse(row().published as string)).toEqual({
        ...live,
        accepting: false,
      });
      expect(row().revision).toBe(6);
      expect(row().version).toBe(4);
      expect((await patch({ accepting: true, revision: 6 })).status).toBe(200);
      expect(JSON.parse(row().published as string).accepting).toBe(true);
      expect(JSON.parse(row().draft as string).intro).toBe(draft.intro);
    } finally {
      sqlite.close();
    }
  });
  it("rejects stale, malformed and cross-origin writes without changing the agenda", async () => {
    const { sqlite, patch, row } = setup();
    try {
      const original = row();
      expect((await patch({ accepting: false, revision: 4 })).status).toBe(409);
      expect((await patch({ accepting: "false", revision: 5 })).status).toBe(
        400,
      );
      expect(
        (await patch({ accepting: false, revision: 5, intro: "Overwrite" }))
          .status,
      ).toBe(400);
      expect(
        (
          await patch(
            { accepting: false, revision: 5 },
            "https://other.example",
          )
        ).status,
      ).toBe(403);
      expect(row()).toEqual(original);
    } finally {
      sqlite.close();
    }
  });
  it("allows closing without Turnstile but requires it before opening", async () => {
    const { sqlite, patch, env, row } = setup();
    env.TURNSTILE_SECRET_KEY = "";
    try {
      expect((await patch({ accepting: false, revision: 5 })).status).toBe(200);
      expect((await patch({ accepting: true, revision: 6 })).status).toBe(400);
      expect(JSON.parse(row().published as string).accepting).toBe(false);
      env.LOCAL_DEV_AUTH = "false";
      expect((await patch({ accepting: true, revision: 6 })).status).toBe(403);
    } finally {
      sqlite.close();
    }
  });
  it("requires an existing public configuration", async () => {
    const { sqlite, patch, row } = setup(false);
    try {
      expect((await patch({ accepting: false, revision: 5 })).status).toBe(409);
      expect(row().revision).toBe(5);
      expect(row().published).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
