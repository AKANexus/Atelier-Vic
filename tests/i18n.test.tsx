import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  configSchema,
  defaultConfig,
  localizedConfig,
  quote,
  serviceCurrency,
  type Service,
} from "../src/domain";
import { hostLanguage, languageDestination, languageCookie, readLanguage, translateError } from "../src/i18n";
import Portfolio from "../src/Portfolio";
import { onRequest } from "../functions/api/[[path]]";
import type { Env } from "../functions/_lib";
const sid = "00000000-0000-4000-8000-000000000001";
const qid = "00000000-0000-4000-8000-000000000002";
const oid = "00000000-0000-4000-8000-000000000003";
const service: Service = {
  id: sid,
  name: "Retrato",
  en: { name: "Portrait" },
  description: "Descrição",
  basePrice: 10000,
  basePriceUsd: 2500,
  questions: [
    {
      id: qid,
      label: "Fundo",
      en: { label: "Background" },
      help: "",
      required: true,
      manualReview: false,
      type: "single",
      condition: null,
      samples: [],
      options: [
        {
          id: oid,
          label: "Simples",
          en: { label: "Simple" },
          price: 1000,
          priceUsd: 0,
          samples: [],
          manualReview: false,
        },
      ],
    },
  ],
};
const config = {
  ...defaultConfig,
  accepting: true,
  email: "artist@example.test",
  services: [service],
};
afterEach(() => vi.unstubAllGlobals());
describe("language and pricing", () => {
  it("selects production language by host and preserves deep links when switching", () => {
    expect(hostLanguage("en.vsama.com.br")).toBe("en-US");
    expect(hostLanguage("vsama.com.br")).toBe("pt-BR");
    expect(hostLanguage("preview.pages.dev")).toBeUndefined();
    expect(languageDestination("https://vsama.com.br/contato?servico=abc#form", "en-US")).toBe("https://en.vsama.com.br/contato?servico=abc#form");
    expect(languageDestination("https://en.vsama.com.br/sobre", "pt-BR")).toBe("https://vsama.com.br/sobre");
    expect(languageDestination("http://localhost:8788/", "en-US")).toBeNull();
  });
  it("defaults to Portuguese and persists an exact valid language", () => {
    for (const cookie of [
      "",
      "site_language=invalid",
      "other_site_language=en-US",
      "site_language=en-US-extra",
    ])
      expect(readLanguage(cookie)).toBe("pt-BR");
    expect(readLanguage("other=yes; site_language=en-US")).toBe("en-US");
    expect(languageCookie("en-US", true)).toBe(
      "site_language=en-US; Max-Age=31536000; Path=/; SameSite=Lax; Secure",
    );
    expect(languageCookie("pt-BR", false)).not.toContain("Secure");
  });
  it("retains old configurations and falls back per field, including empty rich text", () => {
    expect(configSchema.parse(defaultConfig).en).toBeUndefined();
    const translated = configSchema.parse({
      ...config,
      en: {
        brand: "Artist",
        headline: "  ",
        artistBio: [{ type: "paragraph", spans: [{ text: " " }] }],
        processContent: [
          { type: "paragraph", spans: [{ text: "Contact me", bold: true }] },
        ],
      },
      artistBio: "Biografia",
    });
    const english = localizedConfig(translated, "en-US");
    expect(english.brand).toBe("Artist");
    expect(english.headline).toBe(config.headline);
    expect(english.artistBio).toBe("Biografia");
    expect(english.processContent[0].spans[0]).toEqual({
      text: "Contact me",
      bold: true,
    });
    expect(english.services[0].name).toBe("Portrait");
    expect(english.services[0].description).toBe("Descrição");
    expect(localizedConfig(translated, "pt-BR").brand).toBe(config.brand);
  });
  it("uses explicitly configured USD including zero, otherwise falls back for the entire service", () => {
    expect(quote(service, { [qid]: oid }, true, "en-US")).toMatchObject({
      total: 2500,
      currency: "USD",
      snapshot: [{ question: "Background", answer: "Simple" }],
    });
    expect(quote(service, { [qid]: oid })).toMatchObject({
      total: 11000,
      currency: "BRL",
      locale: "pt-BR",
    });
    const incomplete = structuredClone(service);
    incomplete.questions[0].options[0].priceUsd = null;
    expect(quote(incomplete, { [qid]: oid }, true, "en-US")).toMatchObject({
      total: 11000,
      currency: "BRL",
    });
    expect(serviceCurrency({ ...service, basePriceUsd: null }, "en-US")).toBe(
      "BRL",
    );
    expect(
      quote({ ...service, basePriceUsd: 0 }, { [qid]: oid }, true, "en-US")
        .total,
    ).toBe(0);
    expect(
      configSchema.safeParse({
        ...config,
        services: [{ ...service, basePriceUsd: -1 }],
      }).success,
    ).toBe(false);
  });
  it("renders English navigation and prices with a Portuguese content fallback", () => {
    const html = renderToStaticMarkup(
      createElement(Portfolio, {
        preview: config,
        page: "contact",
        initialLocale: "en-US",
      }),
    );
    expect(html).toContain("Commissions");
    expect(html).toContain("Portrait");
    expect(html).toContain("$25.00");
    expect(html).toContain("English (United States)");
    expect(html).toContain('lang="en-US"');
    expect(translateError("Responda: Background", "en-US")).toBe(
      "Please answer: Background",
    );
  });
});
function setup() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of ["0001_initial.sql", "0002_lead_locale_currency.sql"])
    sqlite.exec(
      readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
    );
  sqlite
    .prepare(
      "INSERT INTO settings(id,draft,published,revision,version) VALUES(1,?,?,1,1)",
    )
    .run(JSON.stringify(config), JSON.stringify(config));
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
        async all() {
          return { results: sqlite.prepare(sql).all(...params) };
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
    async batch(queries: { run: () => Promise<unknown> }[]) {
      const results = [];
      for (const query of queries) results.push(await query.run());
      return results;
    },
  };
  const env = {
    DB: db,
    LOCAL_DEV_AUTH: "true",
    TURNSTILE_SECRET_KEY: "test",
    TURNSTILE_SITE_KEY: "test",
  } as unknown as Env;
  async function call(path: string, data?: unknown, method = "POST") {
    return onRequest({
      request: new Request(`http://127.0.0.1:8788/api/${path}`, {
        method,
        headers: {
          Origin: "http://127.0.0.1:8788",
          "Content-Type": "application/json",
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      env,
    } as Parameters<typeof onRequest>[0]);
  }
  return { sqlite, call };
}
describe("bilingual request API", () => {
  it("calculates on the server, freezes currency and preserves it on retries and admin edits", async () => {
    const { sqlite, call } = setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true })),
    );
    try {
      const base = {
        serviceId: sid,
        answers: { [qid]: oid },
        version: 1,
        locale: "en-US",
      };
      const estimate = await call("estimate", base);
      expect(estimate.status).toBe(200);
      expect(await estimate.json()).toMatchObject({
        total: 2500,
        currency: "USD",
      });
      const submission = {
        ...base,
        key: crypto.randomUUID(),
        name: "Test Customer",
        email: "customer@example.test",
        phone: "",
        request: "",
        referenceLinks: [],
        consent: true,
        turnstile: "test",
      };
      const response = await call("leads", {
        ...submission,
        currency: "BRL",
        estimate: 1,
      });
      expect(response.status).toBe(201);
      const lead = (await response.json()) as {
        id: string;
        estimate: number;
        currency: string;
        locale: string;
      };
      expect(lead).toMatchObject({
        estimate: 2500,
        currency: "USD",
        locale: "en-US",
      });
      const stored = sqlite
        .prepare("SELECT * FROM leads WHERE id=?")
        .get(lead.id)!;
      expect(JSON.parse(stored.snapshot as string).currency).toBe("USD");
      sqlite
        .prepare("UPDATE settings SET version=2,published=? WHERE id=1")
        .run(JSON.stringify(defaultConfig));
      expect(await (await call("leads", submission)).json()).toEqual(lead);
      expect(
        (await call("leads", { ...submission, locale: "pt-BR" })).status,
      ).toBe(409);
      expect(
        (
          await call(
            `admin/leads/${lead.id}`,
            {
              status: "accepted",
              attention: false,
              notes: "",
              finalPrice: 3000,
              revision: 0,
            },
            "PATCH",
          )
        ).status,
      ).toBe(200);
      const updated = (await (
        await call(`admin/leads/${lead.id}`, undefined, "GET")
      ).json()) as { lead: { currency: string; final_price: number } };
      expect(updated.lead).toMatchObject({
        currency: "USD",
        final_price: 3000,
      });
    } finally {
      sqlite.close();
    }
  });
  it("accepts old clients as Portuguese/BRL and rejects invalid locales", async () => {
    const { sqlite, call } = setup();
    try {
      const base = { serviceId: sid, answers: { [qid]: oid }, version: 1 };
      expect(await (await call("estimate", base)).json()).toMatchObject({
        total: 11000,
        currency: "BRL",
        locale: "pt-BR",
      });
      expect((await call("estimate", { ...base, locale: "fr" })).status).toBe(
        400,
      );
    } finally {
      sqlite.close();
    }
  });
});

describe("translation persistence and migration", () => {
  it("round trips English content and USD through draft and publication", async () => {
    const { sqlite, call } = setup();
    try {
      const bilingual = {
        ...config,
        en: {
          brand: "Studio",
          artistBio: [
            {
              type: "paragraph",
              spans: [{ text: "English biography", italic: true }],
            },
          ],
          processContent: [
            {
              type: "paragraph",
              spans: [{ text: "<template=contato>Contact me</template>" }],
            },
          ],
        },
      };
      const save = await call(
        "admin/config",
        { config: bilingual, revision: 1 },
        "PUT",
      );
      expect(save.status).toBe(200);
      const saved = (await save.json()) as { revision: number };
      expect(
        (await call("admin/publish", { revision: saved.revision })).status,
      ).toBe(200);
      const live = (await (await call("config", undefined, "GET")).json()) as {
        config: typeof bilingual;
      };
      expect(live.config.en).toEqual(bilingual.en);
      expect(live.config.services[0].questions[0].options[0].priceUsd).toBe(0);
      expect(live.config.services[0].en?.name).toBe("Portrait");
    } finally {
      sqlite.close();
    }
  });
  it("upgrades existing leads without changing prices or snapshots", () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(
        readFileSync(
          new URL("../migrations/0001_initial.sql", import.meta.url),
          "utf8",
        ),
      );
      sqlite
        .prepare(
          "INSERT INTO leads(id,idempotency_key,fingerprint,name,email,reference_links,service_name,config_version,estimate,manual_review,snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          "legacy",
          "legacy-key",
          "fingerprint",
          "Customer",
          "customer@example.test",
          "[]",
          "Retrato",
          1,
          11000,
          0,
          '{"total":11000}',
          "2026-10-01",
          "2026-10-01",
        );
      sqlite.exec(
        readFileSync(
          new URL(
            "../migrations/0002_lead_locale_currency.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect(
        sqlite
          .prepare(
            "SELECT locale,currency,estimate,snapshot FROM leads WHERE id='legacy'",
          )
          .get(),
      ).toMatchObject({
        locale: "pt-BR",
        currency: "BRL",
        estimate: 11000,
        snapshot: '{"total":11000}',
      });
    } finally {
      sqlite.close();
    }
  });
});
