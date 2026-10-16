import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  configSchema,
  defaultConfig,
  mediaIds,
  presentationDefaults,
  richTextSchema,
} from "../src/domain";
import {
  RichTextContent,
  normalizeRichText,
  RichTextEditor,
} from "../src/RichText";

describe("configurable presentation", () => {
  it("preserves legacy biographies and accepts safe formatted biographies", () => {
    const oldText = "Primeira linha\nSegunda linha";
    const legacy = configSchema.parse({ ...defaultConfig, artistBio: oldText });
    expect(normalizeRichText(legacy.artistBio)).toEqual([
      { type: "paragraph", spans: [{ text: oldText }] },
    ]);
    expect(normalizeRichText("")).toEqual([]);
    const biography = [
      { type: "heading", spans: [{ text: "Minha história" }] },
      { type: "paragraph", spans: [{ text: "Artista", bold: true }] },
    ];
    const parsed = configSchema.parse({
      ...defaultConfig,
      artistBio: biography,
    });
    expect(parsed.artistBio).toEqual(biography);
    expect(
      configSchema.safeParse({
        ...defaultConfig,
        artistBio: [{ type: "script", spans: [] }],
      }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...defaultConfig,
        artistBio: [
          { type: "paragraph", spans: [{ text: "a".repeat(10001) }] },
        ],
      }).success,
    ).toBe(false);
    const editor = renderToStaticMarkup(
      createElement(RichTextEditor, {
        label: "Sobre o artista",
        value: normalizeRichText(parsed.artistBio),
        onChange: () => {},
      }),
    );
    expect(editor).toContain('aria-label="Sobre o artista"');
    expect(editor).toContain('aria-label="Formatação: Sobre o artista"');
  });
  it("loads legacy configurations with default copy and no main image", () => {
    const legacy = Object.fromEntries(
      Object.entries(defaultConfig).filter(
        ([key]) => !(key in presentationDefaults),
      ),
    );
    const parsed = configSchema.parse(legacy);
    for (const [key, value] of Object.entries(presentationDefaults))
      expect(parsed[key as keyof typeof parsed]).toEqual(value);
  });
  it("includes a main image outside the gallery in publication and deletion protection", () => {
    const mainImageId = "00000000-0000-4000-8000-000000000001";
    const config = configSchema.parse({ ...defaultConfig, mainImageId });
    expect(config.gallery).toEqual([]);
    expect(mediaIds(config)).toEqual([mainImageId]);
    expect(mediaIds({ ...config, mainImageId: null })).toEqual([]);
  });
  it("allows optional labels, subtitle and an empty process while keeping titles required", () => {
    expect(
      configSchema.safeParse({
        ...defaultConfig,
        carouselLabel: "",
        portfolioSubtitle: "",
        processContent: [],
      }).success,
    ).toBe(true);
    expect(
      configSchema.safeParse({ ...defaultConfig, portfolioTitle: " " }).success,
    ).toBe(false);
    const parsed = configSchema.parse({
      ...defaultConfig,
      commissionTitle: "",
      commissionIntro: "Old text",
    });
    expect(parsed).not.toHaveProperty("commissionTitle");
    expect(parsed).not.toHaveProperty("commissionIntro");
  });
  it("rejects executable HTML structure and unrecognized attributes in rich text", () => {
    for (const value of [
      [{ type: "script", spans: [{ text: "alert(1)" }] }],
      [
        {
          type: "paragraph",
          spans: [{ text: "hello", html: "<img onerror=alert(1)>" }],
        },
      ],
      [{ type: "paragraph", spans: [{ text: "hello" }], onClick: "alert(1)" }],
    ])
      expect(richTextSchema.safeParse(value).success).toBe(false);
  });
  it("bounds total rich-text size across individual blocks", () => {
    expect(
      richTextSchema.safeParse([
        { type: "paragraph", spans: [{ text: "a".repeat(6000) }] },
        { type: "paragraph", spans: [{ text: "b".repeat(6000) }] },
      ]).success,
    ).toBe(false);
  });
  it("escapes literal HTML while rendering permitted formatting and grouped lists", () => {
    const value = richTextSchema.parse([
      { type: "heading", spans: [{ text: "Meu processo" }] },
      {
        type: "bullet",
        spans: [{ text: "<script>alert(1)</script>", bold: true }],
      },
      { type: "bullet", spans: [{ text: "Segundo passo", italic: true }] },
      { type: "paragraph", spans: [{ text: "Final", underline: true }] },
    ]);
    const html = renderToStaticMarkup(
      createElement(RichTextContent, { value }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html.match(/<ul>/g)).toHaveLength(1);
    expect(html).toContain("<em>Segundo passo</em>");
    expect(html).toContain("<u>Final</u>");
  });
});

describe("rich-text contact templates", () => {
  const render = (text: string, contactEmail?: string) =>
    renderToStaticMarkup(
      createElement(RichTextContent, {
        value: [{ type: "paragraph", spans: [{ text }] }],
        context: { contactEmail },
      }),
    );
  it("renders web links and rejects unsafe or invalid destinations", () => {
    const html = render(
      "<template=link url=https://seusite.com/path?q=1&x=2>Meu site</template>",
    );
    expect(html).toContain('href="https://seusite.com/path?q=1&amp;x=2"');
    expect(html).toContain("Meu site");
    expect(html).not.toContain("&lt;template");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "ftp://site.test",
      "invalido",
    ]) {
      const invalid = render(`<template=link url=${url}>Meu site</template>`);
      expect(invalid).not.toContain("<a ");
      expect(invalid).toContain("Meu site");
    }
  });
  it("preserves formatting across link template spans", () => {
    const html = renderToStaticMarkup(
      createElement(RichTextContent, {
        value: [
          {
            type: "paragraph",
            spans: [
              { text: "<template=link url=https://example.test>Meu " },
              { text: "site", bold: true },
              { text: "</template>" },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('href="https://example.test/"');
    expect(html).toContain("<strong>site</strong>");
  });
  it("puts insertion tools in a separate toolbar row", () => {
    const html = renderToStaticMarkup(
      createElement(RichTextEditor, {
        value: [],
        onChange: () => {},
        templates: ["contato", "link"],
      }),
    );
    expect(html.match(/class="rich-text-toolbar"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Inserir link"');
  });
  it("resolves the current email and includes the mail icon with the custom label", () => {
    const text = "Antes <template=contato>Escreva para mim</template> depois";
    const html = render(text, "artist@example.test");
    expect(html).toContain('href="mailto:artist@example.test"');
    expect(html).toContain("lucide-mail");
    expect(html).toContain("Escreva para mim");
    expect(html).toContain("Antes ");
    expect(html).toContain(" depois");
    expect(html).not.toContain("&lt;template");
    expect(render(text, "new@example.test")).toContain(
      'href="mailto:new@example.test"',
    );
  });
  it("keeps formatting when template markers cross span boundaries", () => {
    const html = renderToStaticMarkup(
      createElement(RichTextContent, {
        value: [
          {
            type: "bullet",
            spans: [
              { text: "Veja <template=con" },
              { text: "tato>Meu ", italic: true },
              { text: "contato", bold: true },
              { text: "</template> aqui", underline: true },
            ],
          },
        ],
        context: { contactEmail: "artist@example.test" },
      }),
    );
    expect(html).toContain('href="mailto:artist@example.test"');
    expect(html).toContain("<em>Meu </em>");
    expect(html).toContain("<strong>contato</strong>");
    expect(html).toContain("<u> aqui</u>");
    expect(html).toContain("<ul>");
  });
  it("renders labels as plain text without a valid contact email", () => {
    for (const email of [undefined, "", "javascript:alert(1)", "bad email"]) {
      const html = render("<template=contato>Meu contato</template>", email);
      expect(html).toContain("Meu contato");
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("<svg");
      expect(html).not.toContain("&lt;template");
    }
  });
  it("preserves unknown, incomplete and nested templates as escaped literal text", () => {
    for (const text of [
      "<template=futuro>Texto</template>",
      "<template=contato>Texto",
      "<template=contato><template=contato>Texto</template></template>",
      "<template=constructor>Texto</template>",
    ]) {
      const html = render(text, "artist@example.test");
      expect(html).not.toContain("<a ");
      expect(html).toContain("&lt;template=");
    }
  });
  it("escapes HTML inside labels and supports multiple contact templates", () => {
    const html = render(
      "<template=contato><img src=x onerror=alert(1)></template> e <template=contato>Outro contato</template>",
      "artist@example.test",
    );
    expect(html.match(/href="mailto:artist@example.test"/g)).toHaveLength(2);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });
  it("stores template markers as ordinary rich text without schema changes", () => {
    const value = [
      {
        type: "paragraph",
        spans: [{ text: "<template=contato>Meu texto</template>" }],
      },
    ];
    expect(richTextSchema.parse(value)).toEqual(value);
  });
  it("offers the contact tool only in editors that enable it", () => {
    const props = { value: [], onChange: () => {} };
    expect(
      renderToStaticMarkup(createElement(RichTextEditor, props)),
    ).not.toContain("Inserir link de contato");
    const editor = renderToStaticMarkup(
      createElement(RichTextEditor, { ...props, templates: ["contato"] }),
    );
    expect(editor).toContain('aria-label="Inserir link de contato"');
    const disabled = renderToStaticMarkup(
      createElement(RichTextEditor, {
        ...props,
        templates: ["contato"],
        disabled: true,
      }),
    );
    expect(disabled).toMatch(
      /aria-label="Inserir link de contato"[^>]*disabled=""/,
    );
  });
});
