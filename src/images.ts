export async function compressImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("A imagem original deve ter até 20 MiB.");
  const image = await createImageBitmap(file);
  async function variant(max: number, limit: number) {
    let width = Math.min(max, image.width);
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width);
      canvas.height = Math.max(
        1,
        Math.round((image.height * width) / image.width),
      );
      if (canvas.height > max) {
        canvas.width = Math.max(
          1,
          Math.round((canvas.width * max) / canvas.height),
        );
        canvas.height = max;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("Seu navegador não conseguiu preparar a imagem.");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(
          resolve,
          "image/webp",
          Math.max(0.5, 0.86 - attempt * 0.06),
        ),
      );
      if (blob?.type !== "image/webp")
        throw new Error("Este navegador não suporta a conversão para WebP.");
      if (blob.size <= limit) return blob;
      width *= 0.8;
    }
    throw new Error(
      "Não foi possível reduzir a imagem ao limite. Tente uma imagem menor.",
    );
  }
  try {
    return {
      image: await variant(1600, 500 * 1024),
      thumbnail: await variant(320, 64 * 1024),
    };
  } finally {
    image.close();
  }
}
