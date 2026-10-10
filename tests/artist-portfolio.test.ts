import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Portfolio from "../src/Portfolio";
import ThemeEditor from "../src/ThemeEditor";
import { configSchema, defaultConfig, mediaIds } from "../src/domain";
import {
  themePresets,
  defaultTheme,
  publicThemeSchema,
  contrastRatio,
  buttonText,
  themeStyle,
} from "../src/theme";
import { legacyDestination } from "../src/publicRoutes";

describe("artist theme validation", () => {
  it("provides six accessible dark presets, three muted and three neon", () => {
    expect(
      themePresets.filter((theme) => theme.group === "Suaves"),
    ).toHaveLength(3);
    expect(themePresets.filter((theme) => theme.group === "Neon")).toHaveLength(
      3,
    );
    for (const theme of themePresets) {
      expect(publicThemeSchema.safeParse(theme).success).toBe(true);
      expect(
        contrastRatio(theme.text, theme.background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(theme.accent, theme.background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(buttonText(theme.accent), theme.accent),
      ).toBeGreaterThanOrEqual(4.5);
      expect(themeStyle(theme).colorScheme).toBe("dark");
    }
  });
  it("accepts custom light themes and chooses appropriate button text", () => {
    const theme = {
      preset: "custom",
      background: "#FFFFFF",
      text: "#111111",
      accent: "#234567",
    };
    expect(publicThemeSchema.safeParse(theme).success).toBe(true);
    expect(buttonText("#000000")).toBe("#FFFFFF");
    expect(buttonText("#FFFFFF")).toBe("#000000");
  });
  it("rejects malformed colors, unsafe CSS values, and low contrast on client/server schema", () => {
    for (const color of [
      "red",
      "#FFF",
      "#FFFFFFFF",
      "#GG0000",
      "var(--ink)",
      "#123456; color:red",
    ]) {
      expect(
        publicThemeSchema.safeParse({ ...defaultTheme, accent: color }).success,
      ).toBe(false);
      expect(
        configSchema.safeParse({
          ...defaultConfig,
          publicTheme: { ...defaultTheme, accent: color },
        }).success,
      ).toBe(false);
    }
    expect(
      publicThemeSchema.safeParse({
        ...defaultTheme,
        text: defaultTheme.background,
      }).success,
    ).toBe(false);
    expect(
      publicThemeSchema.safeParse({
        ...defaultTheme,
        accent: defaultTheme.background,
      }).success,
    ).toBe(false);
    expect(
      publicThemeSchema.safeParse({
        preset: "custom",
        background: "#FFFFFF",
        text: "#777777",
        accent: "#111111",
      }).success,
    ).toBe(false);
    expect(
      publicThemeSchema.safeParse({
        preset: "custom",
        background: "#FFFFFF",
        text: "#767676",
        accent: "#111111",
      }).success,
    ).toBe(true);
  });
  it("shows actionable feedback and a safe preview for invalid drafts", () => {
    const theme = { ...defaultTheme, accent: defaultTheme.background };
    const html = renderToStaticMarkup(
      createElement(ThemeEditor, { value: theme, onChange: () => {} }),
    );
    expect(html).toContain("Ajuste as cores antes de publicar");
    expect(html).toContain('aria-invalid="true"');
    expect(themeStyle(theme)).toEqual(themeStyle(defaultTheme));
  });
});

describe("artist configuration and public destinations", () => {
  it("defaults old settings without changing saved presentation or carousel data", () => {
    const {
      publicTheme: _theme,
      artistBio: _bio,
      mainImageAlt: _alt,
      ...legacy
    } = defaultConfig;
    const config = configSchema.parse({
      ...legacy,
      brand: "Nome salvo",
      headline: "Título salvo",
    });
    expect(config.publicTheme).toEqual(defaultTheme);
    expect(config.artistBio).toBe("");
    expect(config.mainImageAlt).toBe("");
    expect(config.brand).toBe("Nome salvo");
    expect(config.headline).toBe("Título salvo");
    expect(config.featuredArtIds).toEqual(legacy.featuredArtIds);
  });
  it("bounds biography and banner description and protects banner media", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      configSchema.safeParse({ ...defaultConfig, artistBio: "a".repeat(3001) })
        .success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...defaultConfig,
        mainImageAlt: "a".repeat(201),
      }).success,
    ).toBe(false);
    expect(
      mediaIds(configSchema.parse({ ...defaultConfig, mainImageId: id })),
    ).toContain(id);
  });
  it("keeps a single portfolio page and maps the retired route to the modal", () => {
    expect(legacyDestination("/", "#encomendar")).toBeNull();
    expect(legacyDestination("/", "#processo")).toBeNull();
    expect(legacyDestination("/encomendas", "")).toBe("/#encomendar");
    expect(legacyDestination("/encomendas/", "#processo")).toBe("/#processo");
    expect(legacyDestination("/", "#trabalhos")).toBeNull();
    expect(legacyDestination("/admin", "#processo")).toBeNull();
  });
  it("keeps quote controls off the portfolio and preserves artist content and image names", () => {
    const config = {
      ...defaultConfig,
      brand: "Victor",
      artistBio: "Biografia do artista",
      mainImageId: "00000000-0000-4000-8000-000000000001",
      mainImageAlt: "Banner ilustrado",
      gallery: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          title: "Obra existente",
          alt: "Paisagem ilustrada",
          description: "História da obra",
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(Portfolio, { preview: config, page: "portfolio" }),
    );
    expect(html).toContain("Biografia do artista");
    expect(html).toContain("Banner ilustrado");
    expect(html).toContain("Ver Obra existente");
    expect(html).toContain('href="#encomendar"');
    expect(html).not.toContain("Como funciona a encomenda");
    expect(html).toContain("Encomende uma arte");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Visualizar");
    expect(html).not.toContain("featured-carousel");
    expect(html.indexOf('class="artist-banner"')).toBeLessThan(
      html.indexOf('class="artist-introduction"'),
    );
    expect(html.indexOf('id="trabalhos"')).toBeLessThan(
      html.indexOf('id="sobre"'),
    );
  });
  it("renders only onboarding in an accessible modal over the portfolio", () => {
    const config = {
      ...defaultConfig,
      email: "artist@example.test",
      accepting: true,
      services: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Retrato",
          description: "",
          basePrice: 10000,
          questions: [],
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(Portfolio, { preview: config, page: "commissions" }),
    );
    expect(html).toContain("Disponível para encomendas");
    expect(html).toContain("<form");
    expect(html).toContain("Retrato");
    expect(html).toContain('id="trabalhos"');
    expect(html).toContain('class="commission-modal" role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Prefere falar direto?");
    expect(html).not.toContain("Informações sobre encomendas");
    expect(html.indexOf("Encomende uma arte")).toBeLessThan(
      html.indexOf("Prefere falar direto?"),
    );

    const closed = renderToStaticMarkup(
      createElement(Portfolio, {
        preview: { ...config, accepting: false },
        page: "commissions",
      }),
    );
    expect(closed).toContain("Agenda fechada");
    expect(closed).not.toContain("<form");
  });
});
