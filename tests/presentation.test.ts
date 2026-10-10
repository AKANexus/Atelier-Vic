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
