import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Portfolio from "../src/Portfolio";
import {
  configSchema,
  defaultConfig,
  mediaIds,
  portfolioCategories,
} from "../src/domain";
import {
  legacyDestination,
  publicRoute,
  publicHref,
} from "../src/publicRoutes";
const ids = Array.from(
  { length: 6 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const service = {
  id: ids[4],
  name: "Retrato",
  description: "",
  basePrice: 10000,
  questions: [],
};
const config = configSchema.parse({
  ...defaultConfig,
  email: "artist@example.test",
  accepting: true,
  categories: [
    {
      id: ids[0],
      name: "Personagens",
      coverImageId: ids[3],
      serviceId: service.id,
    },
    { id: ids[1], name: "Paisagens" },
  ],
  gallery: [
    {
      id: ids[2],
      title: "Personagem A",
      alt: "Personagem ilustrado",
      description: "",
      categoryId: ids[0],
    },
    { id: ids[5], title: "Obra antiga", alt: "Arte antiga", description: "" },
  ],
  services: [service],
});
const render = (
  page: "portfolio" | "category" | "contact",
  categoryId?: string,
  serviceId?: string,
) =>
  renderToStaticMarkup(
    createElement(Portfolio, { preview: config, page, categoryId, serviceId }),
  );
describe("portfolio categories", () => {
  it("normalizes legacy configuration without removing artwork", () => {
    const { categories: _categories, ...legacy } = defaultConfig;
    const parsed = configSchema.parse({
      ...legacy,
      gallery: [{ id: ids[2], title: "Antiga", alt: "Arte", description: "" }],
    });
    expect(parsed.categories).toEqual([]);
    expect(parsed.gallery[0].categoryId).toBeNull();
    expect(portfolioCategories(parsed)[0].name).toBe("Outros trabalhos");
  });
  it("rejects dangling category/service references and duplicate category ids", () => {
    expect(
      configSchema.safeParse({
        ...config,
        categories: [...config.categories, config.categories[0]],
      }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...config,
        categories: [{ ...config.categories[0], serviceId: ids[5] }],
      }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...config,
        gallery: [{ ...config.gallery[0], categoryId: ids[5] }],
      }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...config,
        gallery: [{ ...config.gallery[0], categoryId: [ids[0], ids[1]] }],
      }).success,
    ).toBe(false);
  });
  it("uses custom covers and falls back to the first work while retaining gallery order", () => {
    const categories = portfolioCategories(config);
    expect(categories[0].coverImageId).toBe(ids[3]);
    expect(categories[0].works.map((art) => art.id)).toEqual([ids[2]]);
    expect(categories.at(-1)?.works.map((art) => art.id)).toEqual([ids[5]]);
    expect(
      portfolioCategories({
        ...config,
        categories: [{ ...config.categories[0], coverImageId: null }],
      })[0].coverImageId,
    ).toBe(ids[2]);
    expect(mediaIds(config)).toContain(ids[3]);
    const { categories: _categories, ...legacy } = config;
    expect(() => mediaIds(legacy as typeof config)).not.toThrow();
  });
  it("shows named category covers instead of individual works, hiding empty categories", () => {
    const html = render("portfolio");
    expect(html).toContain(`href="/portfolio/${ids[0]}"`);
    expect(html).toContain("Outros trabalhos");
    expect(html).not.toContain("Paisagens");
    expect(html).not.toContain("Ver Personagem A");
    expect(html).not.toContain("<form");
  });
  it("limits the category gallery without quote calls to action", () => {
    const html = render("category", ids[0]);
    expect(html).toContain("Ver Personagem A");
    expect(html).not.toContain("Ver Obra antiga");
    expect(html).not.toContain("Solicitar orçamento");
    expect(html).toContain("Voltar ao portfólio");
    expect(html).not.toContain("<form");
    expect(render("category", ids[1])).toContain(
      "Novos trabalhos nesta categoria",
    );
    expect(render("category", "missing")).toContain("Categoria não encontrada");
  });
  it("preselects only valid service ids and renders contact without a dialog", () => {
    const html = render("contact", undefined, service.id);
    expect(html).toMatch(/name="service"[^>]*checked=""/);
    expect(html).toContain("<h1>Encomendas</h1>");
    expect(html).toContain("<form");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("inert=");
    expect(render("contact", undefined, "invalid")).not.toContain('checked=""');
  });
  it("resolves public routes and redirects legacy contact/process links", () => {
    expect(publicRoute(`/portfolio/${ids[0]}/`)).toEqual({
      page: "category",
      categoryId: ids[0],
    });
    expect(publicRoute("/contato/", `?servico=${service.id}`)).toEqual({
      page: "contact",
      serviceId: service.id,
    });
    expect(publicHref({ page: "contact", serviceId: service.id })).toBe(
      `/contato?servico=${service.id}`,
    );
    expect(legacyDestination("/", "#contato")).toBe("/contato");
    expect(legacyDestination("/encomendas", "#processo")).toBe(
      "/contato#processo",
    );
  });
});
