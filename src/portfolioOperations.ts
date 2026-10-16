import type { Config, Media } from "./domain";

export type Artwork = Config["gallery"][number];
export const categoryOf = (art: Artwork) => art.categoryId || null;

// Keep other categories in their original slots, including legacy uncategorized works.
export function reorderArtwork(
  config: Config,
  categoryId: string | null,
  fromId: string,
  toId: string,
): Config {
  const works = config.gallery.filter((art) => categoryOf(art) === categoryId);
  const from = works.findIndex((art) => art.id === fromId);
  const to = works.findIndex((art) => art.id === toId);
  if (from < 0 || to < 0 || from === to) return config;
  works.splice(to, 0, works.splice(from, 1)[0]);
  let index = 0;
  return {
    ...config,
    gallery: config.gallery.map((art) =>
      categoryOf(art) === categoryId ? works[index++] : art,
    ),
  };
}

export function moveArtwork(
  config: Config,
  ids: string[],
  categoryId: string | null,
): Config {
  const moving = config.gallery.filter(
    (art) => ids.includes(art.id) && categoryOf(art) !== categoryId,
  );
  if (!moving.length) return config;
  const movedIds = new Set(moving.map((art) => art.id));
  return {
    ...config,
    gallery: [
      ...config.gallery.filter((art) => !movedIds.has(art.id)),
      ...moving.map((art) => ({ ...art, categoryId })),
    ],
    categories: config.categories.map((category) =>
      category.coverImageId &&
      movedIds.has(category.coverImageId) &&
      category.id !== categoryId
        ? { ...category, coverImageId: null }
        : category,
    ),
  };
}

export function addArtwork(
  config: Config,
  media: Media[],
  ids: string[],
  categoryId: string | null,
): Config {
  const existing = new Set(config.gallery.map((art) => art.id));
  const additions = media.filter(
    (item) =>
      item.state === "ready" && ids.includes(item.id) && !existing.has(item.id),
  );
  if (!additions.length || config.gallery.length + additions.length > 500)
    return config;
  return {
    ...config,
    gallery: [
      ...config.gallery,
      ...additions.map((item) => ({
        id: item.id,
        title: item.title,
        alt: item.title,
        description: "",
        categoryId,
      })),
    ],
  };
}

export function removeArtwork(config: Config, id: string): Config {
  return {
    ...config,
    gallery: config.gallery.filter((art) => art.id !== id),
    featuredArtIds: config.featuredArtIds.filter((item) => item !== id),
    categories: config.categories.map((category) =>
      category.coverImageId === id
        ? { ...category, coverImageId: null }
        : category,
    ),
  };
}
