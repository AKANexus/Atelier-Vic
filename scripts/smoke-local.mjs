import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8788";
const ids = Array.from({ length: 6 }, () => crypto.randomUUID());
async function call(path, method = "GET", value, expected = 200, headers = {}) {
  const response = await fetch(`${origin}/api/${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(value instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(value
      ? { body: value instanceof FormData ? value : JSON.stringify(value) }
      : {}),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  assert.equal(
    response.headers.get("cache-control"),
    path.startsWith("media/") && expected === 200
      ? "public, max-age=86400, immutable"
      : "no-store",
  );
  return data;
}
const start = await call("admin/config");
assert.equal((await call("admin/session")).local, true);
await call(
  "admin/config",
  "PUT",
  { config: start.draft, revision: start.revision },
  403,
  { Origin: "https://evil.example" },
);
const image = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
);
const form = new FormData();
form.set("title", "Imagem local de teste");
form.set("image", new Blob([image], { type: "image/webp" }), "test.webp");
form.set("thumbnail", new Blob([image], { type: "image/webp" }), "test.webp");
const uploaded = await call("admin/media", "POST", form, 201);
await call(`media/${uploaded.id}`, "GET", undefined, 404);
const config = structuredClone(start.draft);
config.brand = "Ateliê de teste";
config.email = "artist@example.test";
config.accepting = true;
config.services = [
  {
    id: ids[0],
    name: "Retrato de teste",
    description: "Configuração local para verificação.",
    basePrice: 10000,
    questions: [
      {
        id: ids[1],
        label: "Fundo",
        help: "",
        type: "single",
        required: true,
        manualReview: false,
        condition: null,
        samples: [uploaded.id],
        options: [
          {
            id: ids[2],
            label: "Simples",
            price: 0,
            samples: [],
            manualReview: false,
          },
          {
            id: ids[3],
            label: "Detalhado",
            price: 5000,
            samples: [],
            manualReview: true,
          },
        ],
      },
    ],
  },
];
config.gallery = [
  {
    id: uploaded.id,
    title: "Teste local",
    alt: "Arte de teste local",
    description: "",
  },
];
config.featuredArtIds = [uploaded.id];
await call(
  "admin/config",
  "PUT",
  {
    config: { ...config, featuredArtIds: [crypto.randomUUID()] },
    revision: start.revision,
  },
  400,
);
const saved = await call("admin/config", "PUT", {
  config,
  revision: start.revision,
});
await call("admin/config", "PUT", { config, revision: start.revision }, 409);
const publication = await call("admin/publish", "POST", {
  revision: saved.revision,
});
assert.deepEqual((await call("config")).config.featuredArtIds, [uploaded.id]);
assert.deepEqual((await call("admin/config")).draft.featuredArtIds, [
  uploaded.id,
]);
await call(`admin/media/${uploaded.id}`, "DELETE", {}, 409);
const mediaResponse = await fetch(`${origin}/api/media/${uploaded.id}`);
assert.equal(mediaResponse.status, 200);
assert.equal(mediaResponse.headers.get("content-type"), "image/webp");
const base = {
  serviceId: ids[0],
  version: publication.version,
  answers: { [ids[1]]: ids[3] },
};
assert.equal((await call("estimate", "POST", base)).total, 15000);
await call(
  "estimate",
  "POST",
  { ...base, answers: { [ids[1]]: crypto.randomUUID() } },
  400,
);
await call(
  "estimate",
  "POST",
  { ...base, version: publication.version - 1 },
  409,
);
const submission = {
  ...base,
  key: crypto.randomUUID(),
  name: "Cliente fictício",
  email: "customer@example.test",
  phone: "5511999999999",
  request: "Pedido somente para teste local.",
  referenceLinks: ["https://example.com/reference"],
  consent: true,
  turnstile: "XXXX.DUMMY.TOKEN.XXXX",
};
const lead = await call("leads", "POST", submission, 201);
const retry = await call("leads", "POST", submission);
assert.equal(retry.id, lead.id);
await call("leads", "POST", { ...submission, name: "Outro cliente" }, 409);
assert.equal((await call("admin/notifications")).attention, 1);
let current = (await call(`admin/leads/${lead.id}`)).lead;
const oldRevision = current.revision;
for (const status of [
  "accepted",
  "production",
  "waiting",
  "approved",
  "paid",
  "rejected",
]) {
  await call(`admin/leads/${lead.id}`, "PATCH", {
    status,
    attention: false,
    notes: "Nota privada",
    finalPrice: 16000,
    revision: current.revision,
  });
  current = (await call(`admin/leads/${lead.id}`)).lead;
  assert.equal(current.status, status);
  assert.equal(current.is_job, 1);
  assert.equal(current.snapshot.total, 15000);
}
await call(
  `admin/leads/${lead.id}`,
  "PATCH",
  {
    status: "new",
    attention: true,
    notes: "",
    finalPrice: null,
    revision: oldRevision,
  },
  409,
);
assert.equal((await call("admin/notifications")).attention, 0);
assert.ok(current.paid_at);
assert.equal((await call("admin/leads?search=fictício")).leads.length, 1);
const invalidMain = await call("admin/config", "PUT", {
  config: { ...config, mainImageId: crypto.randomUUID() },
  revision: publication.revision,
});
await call("admin/publish", "POST", { revision: invalidMain.revision }, 400);
const mainOnly = await call("admin/config", "PUT", {
  config: {
    ...start.draft,
    mainImageId: uploaded.id,
    portfolioSubtitle: "",
    carouselLabel: "Destaques",
    processContent: [
      { type: "heading", spans: [{ text: "Meu processo", bold: true }] },
    ],
  },
  revision: invalidMain.revision,
});
const mainPublication = await call("admin/publish", "POST", {
  revision: mainOnly.revision,
});
const mainPublic = (await call("config")).config;
assert.equal(mainPublic.mainImageId, uploaded.id);
assert.equal(mainPublic.portfolioSubtitle, "");
assert.equal(mainPublic.processContent[0].spans[0].bold, true);
assert.equal((await fetch(`${origin}/api/media/${uploaded.id}`)).status, 200);
await call(`admin/media/${uploaded.id}`, "DELETE", {}, 409);
const savedAgain = await call("admin/config", "PUT", {
  config: start.draft,
  revision: mainPublication.revision,
});
await call("admin/publish", "POST", { revision: savedAgain.revision });
assert.equal((await call("leads", "POST", submission)).id, lead.id);
await call("leads", "POST", { ...submission, key: crypto.randomUUID() }, 409);
await call(`admin/leads/${lead.id}`, "DELETE", {});
await call(`admin/leads/${lead.id}`, "GET", undefined, 404);
await call(`admin/media/${uploaded.id}`, "DELETE", {});
console.log(
  "Local integration checks passed: publishing, image privacy, estimates, Turnstile submission, idempotency, attention, statuses, stale edits, search, main-image privacy, rich-text copy and deletion.",
);
