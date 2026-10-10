import { z } from "zod";
import type { CSSProperties } from "react";

export const themePresets = [
  {
    preset: "rosa-noturno",
    name: "Rosa Noturno",
    group: "Suaves",
    background: "#171318",
    text: "#E9E1E8",
    accent: "#C69AB2",
  },
  {
    preset: "floresta-suave",
    name: "Floresta Suave",
    group: "Suaves",
    background: "#111815",
    text: "#E0E8E2",
    accent: "#96B39F",
  },
  {
    preset: "ardosia",
    name: "Ardósia",
    group: "Suaves",
    background: "#141820",
    text: "#E1E6EF",
    accent: "#9DAFCB",
  },
  {
    preset: "neon-magenta",
    name: "Neon Magenta",
    group: "Neon",
    background: "#140D18",
    text: "#F7ECFA",
    accent: "#FF55CC",
  },
  {
    preset: "neon-ciano",
    name: "Neon Ciano",
    group: "Neon",
    background: "#09171B",
    text: "#E7F7FA",
    accent: "#27E5F5",
  },
  {
    preset: "neon-lima",
    name: "Neon Lima",
    group: "Neon",
    background: "#11160C",
    text: "#EEF6E6",
    accent: "#BAF73C",
  },
] as const;

export const defaultTheme = {
  preset: themePresets[0].preset,
  background: themePresets[0].background,
  text: themePresets[0].text,
  accent: themePresets[0].accent,
};
const hex = z
  .string()
  .regex(
    /^#[\da-f]{6}$/i,
    "Use uma cor hexadecimal com seis dígitos, como #171318.",
  );

function luminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function buttonText(accent: string): string {
  return contrastRatio(accent, "#000000") >= contrastRatio(accent, "#FFFFFF")
    ? "#000000"
    : "#FFFFFF";
}

export const publicThemeSchema = z
  .object({
    preset: z.enum([
      "rosa-noturno",
      "floresta-suave",
      "ardosia",
      "neon-magenta",
      "neon-ciano",
      "neon-lima",
      "custom",
    ]),
    background: hex,
    text: hex,
    accent: hex,
  })
  .superRefine((theme, ctx) => {
    if (
      ![theme.background, theme.text, theme.accent].every(
        (color) => hex.safeParse(color).success,
      )
    )
      return;
    for (const field of ["text", "accent"] as const) {
      if (contrastRatio(theme[field], theme.background) < 4.5) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field === "text" ? "Texto" : "Destaque"}: o contraste com o fundo deve ser de pelo menos 4,5:1.`,
        });
      }
    }
  });
export type PublicTheme = z.infer<typeof publicThemeSchema>;

export function themeStyle(input: PublicTheme): CSSProperties {
  const parsed = publicThemeSchema.safeParse(input);
  const theme = parsed.success ? parsed.data : defaultTheme;
  const dark = luminance(theme.background) < 0.18;
  return {
    "--background": theme.background,
    "--ink": theme.text,
    "--muted": theme.text,
    "--accent": theme.accent,
    "--rose": theme.accent,
    "--surface": theme.background,
    "--elevated": theme.background,
    "--button-ink": buttonText(theme.accent),
    colorScheme: dark ? "dark" : "light",
  } as CSSProperties;
}
