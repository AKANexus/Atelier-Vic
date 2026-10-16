import { describe, expect, it } from "vitest";
import {
  configSchema,
  defaultConfig,
  portfolioCategories,
  type Config,
  type Media,
} from "../src/domain";
import {
  addArtwork,
  moveArtwork,
  removeArtwork,
  reorderArtwork,
} from "../src/portfolioOperations";

const ids = Array.from(
  { length: 12 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
const [catA, catB, a, b, c, d, other, fresh, fresh2] = ids;
const art = (id: string, categoryId?: string | null) => ({
  id,
  categoryId,
  title: id,
  alt: "Ilustração",
  description: "Descrição",
  en: { title: "Artwork", description: "Description", alt: "Illustration" },
});
const config: Config = {
  ...defaultConfig,
  categories: [
    { id: catA, name: "Retratos", coverImageId: a, serviceId: null },
    { id: catB, name: "Paisagens", coverImageId: b, serviceId: null },
  ],
  gallery: [art(a, catA), art(b, catB), art(other), art(c, catA), art(d, catB)],
  featuredArtIds: [a, b],
};
const media: Media[] = [a, b, fresh, fresh2].map((id) => ({
  id,
  title: `Imagem ${id}`,
  state: "ready",
  bytes: 100,
  created_at: "2026-10-16",
}));
const works = (cfg: Config, id: string) =>
  portfolioCategories(cfg)
    .find((category) => category.id === id)!
    .works.map((item) => item.id);

describe("portfolio organization", () => {
  it("reorders only the selected category slots and matches public order after serialization", () => {
    const next = reorderArtwork(config, catA, c, a);
    expect(next.gallery.map((item) => item.id)).toEqual([c, b, other, a, d]);
    expect(next.gallery[1]).toBe(config.gallery[1]);
    expect(next.gallery[2]).toBe(config.gallery[2]);
    expect(next.gallery[4]).toBe(config.gallery[4]);
    expect(
      works(configSchema.parse(JSON.parse(JSON.stringify(next))), catA),
    ).toEqual([c, a]);
    expect(works(next, catB)).toEqual([b, d]);
    expect(config.gallery.map((item) => item.id)).toEqual([a, b, other, c, d]);
  });
  it("does nothing for invalid, cross-category, or unchanged destinations", () => {
    expect(reorderArtwork(config, catA, a, b)).toBe(config);
    expect(reorderArtwork(config, catA, a, a)).toBe(config);
    expect(reorderArtwork(config, catA, fresh, c)).toBe(config);
    expect(
      reorderArtwork({ ...config, gallery: [] }, catA, a, c).gallery,
    ).toEqual([]);
  });
  it("supports legacy uncategorized works and automatic cover order", () => {
    const legacy = {
      ...config,
      gallery: [art(a), art(b, catB), art(c, null)],
      categories: config.categories.map((category) => ({
        ...category,
        coverImageId: null,
      })),
    };
    const next = reorderArtwork(legacy, null, c, a);
    expect(works(next, "outros")).toEqual([c, a]);
    const autoCover = reorderArtwork(
      { ...config, categories: legacy.categories },
      catA,
      c,
      a,
    );
    expect(portfolioCategories(autoCover)[0].coverImageId).toBe(c);
  });
  it("moves selected works to the destination end, preserving metadata and featured IDs", () => {
    const next = moveArtwork(config, [a, c], catB);
    expect(works(next, catB)).toEqual([b, d, a, c]);
    expect(next.gallery.find((item) => item.id === a)).toEqual({
      ...config.gallery[0],
      categoryId: catB,
    });
    expect(next.featuredArtIds).toEqual(config.featuredArtIds);
    expect(next.categories[0].coverImageId).toBeNull();
    expect(next.categories[1].coverImageId).toBe(b);
    expect(moveArtwork(next, [a], catB)).toBe(next);
  });
  it("removes from a category to the end of Outros trabalhos without unpublishing", () => {
    const next = moveArtwork(config, [a], null);
    expect(works(next, "outros")).toEqual([other, a]);
    expect(next.gallery).toHaveLength(config.gallery.length);
    expect(next.featuredArtIds).toContain(a);
    expect(next.categories[0].coverImageId).toBeNull();
  });
  it("adds multiple ready images once, without moving existing works implicitly", () => {
    const next = addArtwork(
      config,
      [...media, { ...media[0], id: ids[10], state: "pending" }],
      [fresh, fresh2, fresh, a, b, ids[10]],
      catA,
    );
    expect(works(next, catA)).toEqual([a, c, fresh, fresh2]);
    expect(works(next, catB)).toEqual([b, d]);
    expect(next.gallery.at(-1)).toEqual({
      id: fresh2,
      categoryId: catA,
      title: `Imagem ${fresh2}`,
      alt: `Imagem ${fresh2}`,
      description: "",
    });
    expect(configSchema.safeParse(next).success).toBe(true);
  });
  it("enforces the portfolio limit without partially applying a selection", () => {
    const full = {
      ...config,
      gallery: Array.from({ length: 499 }, (_, i) =>
        art(`existing-${i}`, catA),
      ),
    };
    expect(addArtwork(full, media, [fresh, fresh2], catA)).toBe(full);
    expect(addArtwork(full, media, [fresh], catA).gallery).toHaveLength(500);
  });
  it("removes portfolio references without modifying the media library", () => {
    const before = structuredClone(media);
    const next = removeArtwork(config, a);
    expect(next.gallery.some((item) => item.id === a)).toBe(false);
    expect(next.featuredArtIds).toEqual([b]);
    expect(next.categories.map((category) => category.coverImageId)).toEqual([
      null,
      b,
    ]);
    expect(media).toEqual(before);
  });
});
