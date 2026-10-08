import { describe, expect, it } from "vitest";
import {
  configSchema,
  defaultConfig,
  quote,
  type Service,
} from "../src/domain";
const ids = Array.from(
  { length: 10 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
);
const service: Service = {
  id: ids[0],
  name: "Retrato",
  description: "",
  basePrice: 10000,
  questions: [
    {
      id: ids[1],
      label: "Fundo",
      help: "",
      type: "single",
      required: true,
      manualReview: false,
      samples: [],
      condition: null,
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
    {
      id: ids[4],
      label: "Detalhes",
      help: "",
      type: "multiple",
      required: true,
      manualReview: false,
      samples: [],
      condition: { questionId: ids[1], optionId: ids[3] },
      options: [
        {
          id: ids[5],
          label: "Flores",
          price: 1000,
          samples: [],
          manualReview: false,
        },
        {
          id: ids[6],
          label: "Luzes",
          price: 2000,
          samples: [],
          manualReview: false,
        },
      ],
    },
  ],
};
describe("commission pricing and questionnaire validation", () => {
  it("adds selected options in integer centavos", () =>
    expect(
      quote(service, { [ids[1]]: ids[3], [ids[4]]: [ids[5], ids[6]] }).total,
    ).toBe(18000));
  it("marks custom complexity for manual review", () =>
    expect(
      quote(service, { [ids[1]]: ids[3], [ids[4]]: [ids[5]] }).manualReview,
    ).toBe(true));
  it("ignores hidden answers and their price", () => {
    const q = quote(service, { [ids[1]]: ids[2], [ids[4]]: [ids[5]] });
    expect(q.total).toBe(10000);
    expect(q.answers[ids[4]]).toBeUndefined();
  });
  it("does not require hidden questions", () =>
    expect(() => quote(service, { [ids[1]]: ids[2] })).not.toThrow());
  it("requires visible answers", () =>
    expect(() => quote(service, { [ids[1]]: ids[3] })).toThrow("Responda"));
  it("rejects a removed or fabricated option", () =>
    expect(() => quote(service, { [ids[1]]: ids[8] })).toThrow("não existe"));
  it("rejects repeated add-ons", () =>
    expect(() =>
      quote(service, { [ids[1]]: ids[3], [ids[4]]: [ids[5], ids[5]] }),
    ).toThrow("duas vezes"));
  it("rejects unknown questions", () =>
    expect(() => quote(service, { [ids[9]]: "malicious" })).toThrow(
      "desconhecidas",
    ));
  it("rejects mismatched answer types", () =>
    expect(() => quote(service, { [ids[1]]: [ids[2]] })).toThrow("uma opção"));
  it("keeps historical labels and amounts independent of future edits", () => {
    const original = quote(service, { [ids[1]]: ids[2] });
    const changed = structuredClone(service);
    changed.questions[0].options[0].label = "Outra opção";
    changed.basePrice = 99900;
    expect(original.snapshot[0].answer).toBe("Simples");
    expect(original.total).toBe(10000);
  });
  it("rejects circular or forward conditions", () => {
    const cfg = structuredClone(defaultConfig);
    cfg.services = [structuredClone(service)];
    cfg.services[0].questions[0].condition = {
      questionId: ids[4],
      optionId: ids[5],
    };
    expect(configSchema.safeParse(cfg).success).toBe(false);
  });
  it("rejects duplicate identifiers", () => {
    const cfg = structuredClone(defaultConfig);
    cfg.services = [structuredClone(service)];
    cfg.services[0].questions[0].options[1].id = ids[2];
    expect(configSchema.safeParse(cfg).success).toBe(false);
  });
  it("requires a configured service and contact when opening the agenda", () =>
    expect(
      configSchema.safeParse({ ...defaultConfig, accepting: true }).success,
    ).toBe(false));
  it("rejects negative prices", () => {
    const cfg = structuredClone(defaultConfig);
    cfg.services = [{ ...service, basePrice: -1 }];
    expect(configSchema.safeParse(cfg).success).toBe(false);
  });
  it("rejects invalid calendar dates", () => {
    const s = structuredClone(service);
    s.questions = [{ ...s.questions[0], type: "date", options: [] }];
    expect(() => quote(s, { [ids[1]]: "2026-02-31" })).toThrow("Data inválida");
  });
});
