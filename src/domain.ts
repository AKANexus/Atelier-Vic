import { z } from "zod";
import { defaultTheme, publicThemeSchema } from "./theme";

const id = z.string().uuid();
const cents = z.number().int().min(0).max(100_000_000);
export const optionSchema = z.object({
  id,
  label: z.string().trim().min(1).max(150),
  price: cents,
  samples: z.array(id).max(3),
  manualReview: z.boolean(),
});
export const questionSchema = z.object({
  id,
  label: z.string().trim().min(1).max(200),
  help: z.string().max(500),
  type: z.enum(["single", "multiple", "short", "long", "date"]),
  required: z.boolean(),
  manualReview: z.boolean(),
  options: z.array(optionSchema).max(30),
  samples: z.array(id).max(3),
  condition: z.object({ questionId: id, optionId: id }).nullable(),
});
export const richTextSchema = z
  .array(
    z
      .object({
        type: z.enum([
          "paragraph",
          "heading",
          "subheading",
          "quote",
          "bullet",
          "number",
        ]),
        spans: z
          .array(
            z
              .object({
                text: z.string().max(10000),
                bold: z.boolean().optional(),
                italic: z.boolean().optional(),
                underline: z.boolean().optional(),
              })
              .strict(),
          )
          .max(500),
      })
      .strict(),
  )
  .max(100)
  .superRefine((blocks, ctx) => {
    if (
      blocks.reduce(
        (count, block) =>
          count + block.spans.reduce((n, span) => n + span.text.length, 0),
        0,
      ) > 10000
    )
      ctx.addIssue({
        code: "custom",
        message: "O texto formatado deve ter até 10.000 caracteres.",
      });
  });
export type RichText = z.infer<typeof richTextSchema>;
export const defaultProcess: RichText = [
  { type: "heading", spans: [{ text: "Do primeiro papo à arte final" }] },
  { type: "subheading", spans: [{ text: "Você imagina. A gente cria." }] },
  {
    type: "number",
    spans: [
      { text: "Conte sua ideia. ", bold: true },
      {
        text: "Escolha o tipo de arte e os detalhes que fazem a diferença para você.",
      },
    ],
  },
  {
    type: "number",
    spans: [
      { text: "Vamos conversar. ", bold: true },
      {
        text: "Receba uma estimativa inicial. O artista confirma o orçamento e combina os próximos passos.",
      },
    ],
  },
  {
    type: "number",
    spans: [
      { text: "Veja ganhar vida. ", bold: true },
      {
        text: "Acompanhe a criação pelo contato combinado e aprove os detalhes da sua encomenda.",
      },
    ],
  },
];
export const presentationDefaults = {
  mainImageId: null as string | null,
  mainImageAlt: "",
  artistBio: "",
  publicTheme: defaultTheme,
  carouselLabel: "Seleção do artista",
  portfolioTitle: "Um pouco do meu universo",
  portfolioSubtitle: "Traços que contam histórias.",
  processContent: defaultProcess,
};

export const configSchema = z
  .object({
    brand: z.string().trim().min(1).max(100),
    headline: z.string().trim().min(1).max(180),
    intro: z.string().max(1000),
    email: z.union([z.email(), z.literal("")]),
    whatsapp: z.string().regex(/^\d{10,15}$|^$/),
    accepting: z.boolean(),
    privacy: z.string().trim().min(1).max(3000),
    featuredArtIds: z.array(id).max(5).default([]),
    mainImageId: id.nullable().default(null),
    mainImageAlt: z.string().trim().max(200).default(""),
    artistBio: z.union([z.string().max(3000), richTextSchema]).default(""),
    publicTheme: publicThemeSchema.default(defaultTheme),
    carouselLabel: z
      .string()
      .trim()
      .max(100)
      .default(presentationDefaults.carouselLabel),
    portfolioTitle: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .default(presentationDefaults.portfolioTitle),
    portfolioSubtitle: z
      .string()
      .trim()
      .max(300)
      .default(presentationDefaults.portfolioSubtitle),
    processContent: richTextSchema.default(defaultProcess),
    categories: z
      .array(
        z.object({
          id,
          name: z.string().trim().min(1).max(100),
          coverImageId: id.nullable().default(null),
          serviceId: id.nullable().default(null),
        }),
      )
      .max(100)
      .default([]),
    gallery: z
      .array(
        z.object({
          id,
          title: z.string().trim().min(1).max(150),
          description: z.string().max(500),
          categoryId: id.nullable().default(null),
          alt: z.string().trim().min(1).max(200),
        }),
      )
      .max(500),
    services: z
      .array(
        z.object({
          id,
          name: z.string().trim().min(1).max(100),
          description: z.string().max(500),
          basePrice: cents,
          questions: z.array(questionSchema).max(50),
        }),
      )
      .max(20),
  })
  .superRefine((config, ctx) => {
    if (
      new Set(config.featuredArtIds).size !== config.featuredArtIds.length ||
      config.featuredArtIds.some(
        (artId) => !config.gallery.some((art) => art.id === artId),
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["featuredArtIds"],
        message:
          "Escolha até cinco artes diferentes do portfólio para destacar.",
      });
    const categoryIds = new Set(
      config.categories.map((category) => category.id),
    );
    if (categoryIds.size !== config.categories.length)
      ctx.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Categorias repetidas.",
      });
    for (const category of config.categories)
      if (
        category.serviceId &&
        !config.services.some((service) => service.id === category.serviceId)
      )
        ctx.addIssue({
          code: "custom",
          path: ["categories"],
          message: "O serviço da categoria não existe.",
        });
    for (const art of config.gallery)
      if (art.categoryId && !categoryIds.has(art.categoryId))
        ctx.addIssue({
          code: "custom",
          path: ["gallery"],
          message: "A categoria da obra não existe.",
        });
    const all = new Set<string>();
    for (const service of config.services) {
      if (all.has(service.id))
        ctx.addIssue({ code: "custom", message: "Identificadores repetidos." });
      all.add(service.id);
      const previous = new Map<string, z.infer<typeof questionSchema>>();
      for (const q of service.questions) {
        if (all.has(q.id))
          ctx.addIssue({
            code: "custom",
            message: "Identificadores repetidos.",
          });
        all.add(q.id);
        if (["single", "multiple"].includes(q.type) && !q.options.length)
          ctx.addIssue({
            code: "custom",
            message: `Adicione opções em "${q.label}".`,
          });
        if (!["single", "multiple"].includes(q.type) && q.options.length)
          ctx.addIssue({
            code: "custom",
            message: "Perguntas de texto e data não podem ter opções.",
          });
        if (q.condition) {
          const parent = previous.get(q.condition.questionId);
          if (
            !parent ||
            !parent.options.some((o) => o.id === q.condition!.optionId)
          )
            ctx.addIssue({
              code: "custom",
              message:
                "A condição deve usar uma opção de uma pergunta anterior.",
            });
        }
        for (const o of q.options) {
          if (all.has(o.id))
            ctx.addIssue({
              code: "custom",
              message: "Identificadores repetidos.",
            });
          all.add(o.id);
        }
        previous.set(q.id, q);
      }
    }
    if (config.accepting && (!config.services.length || !config.email))
      ctx.addIssue({
        code: "custom",
        message:
          "Para abrir pedidos, configure um serviço e seu e-mail de contato.",
      });
  });

export type Config = Omit<z.infer<typeof configSchema>, "gallery"> & {
  gallery: (Omit<
    z.infer<typeof configSchema>["gallery"][number],
    "categoryId"
  > & { categoryId?: string | null })[];
};
export type Service = Config["services"][number];
export type Question = Service["questions"][number];
export type Answers = Record<string, string | string[]>;
export const statuses = {
  new: "Novo lead",
  rejected: "Rejeitado",
  accepted: "Aceito",
  production: "Em produção",
  waiting: "Aguardando resposta do cliente",
  approved: "Aprovado",
  paid: "Pago",
} as const;
export type Status = keyof typeof statuses;
export const statusSchema = z.enum([
  "new",
  "rejected",
  "accepted",
  "production",
  "waiting",
  "approved",
  "paid",
]);
export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100,
  );
export const defaultConfig: Config = {
  ...presentationDefaults,
  brand: "Seu estúdio",
  headline: "Uma ideia sua. Uma arte única.",
  intro:
    "Arte digital feita com cuidado, do primeiro traço ao último detalhe. Conheça o trabalho e conte o que você imagina.",
  email: "",
  whatsapp: "",
  accepting: false,
  privacy:
    "Usaremos seu nome, e-mail e as informações do pedido para preparar um orçamento e conversar sobre a encomenda. Você pode solicitar a exclusão desses dados pelo contato do estúdio.",
  categories: [],
  gallery: [],
  featuredArtIds: [],
  services: [],
};

export function featuredArt(config: Config): Config["gallery"] {
  const selected = config.featuredArtIds || [];
  return selected.length
    ? selected
        .map((artId) => config.gallery.find((art) => art.id === artId))
        .filter((art): art is Config["gallery"][number] => Boolean(art))
        .slice(0, 5)
    : config.gallery.slice(0, 5);
}

export function visible(q: Question, answers: Answers): boolean {
  if (!q.condition) return true;
  const value = answers[q.condition.questionId];
  return Array.isArray(value)
    ? value.includes(q.condition.optionId)
    : value === q.condition.optionId;
}

export function quote(service: Service, input: Answers, complete = true) {
  const known = new Set(service.questions.map((q) => q.id));
  if (Object.keys(input).some((key) => !known.has(key)))
    throw new Error("Há respostas para perguntas desconhecidas.");
  const answers: Answers = {};
  let total = service.basePrice;
  let manualReview = false;
  const breakdown = [{ label: service.name, cents: service.basePrice }];
  const snapshot: { question: string; answer: string | string[] }[] = [];
  for (const q of service.questions) {
    if (!visible(q, answers)) continue;
    const value = input[q.id];
    const empty =
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      if (complete && q.required) throw new Error(`Responda: ${q.label}`);
      continue;
    }
    if (q.type === "single" || q.type === "multiple") {
      if (q.type === "single" && typeof value !== "string")
        throw new Error("Selecione uma opção.");
      if (q.type === "multiple" && !Array.isArray(value))
        throw new Error("Selecione as opções em uma lista.");
      const selected = Array.isArray(value) ? value : [value!];
      if (new Set(selected).size !== selected.length)
        throw new Error("Uma opção não pode ser cobrada duas vezes.");
      const labels: string[] = [];
      for (const optionId of selected) {
        const option = q.options.find((o) => o.id === optionId);
        if (!option) throw new Error("Uma opção selecionada não existe mais.");
        total += option.price;
        manualReview ||= option.manualReview;
        breakdown.push({
          label: `${q.label}: ${option.label}`,
          cents: option.price,
        });
        labels.push(option.label);
      }
      answers[q.id] = value!;
      snapshot.push({
        question: q.label,
        answer: q.type === "single" ? labels[0] : labels,
      });
    } else {
      if (
        typeof value !== "string" ||
        value.length > (q.type === "long" ? 3000 : 300)
      )
        throw new Error("Resposta inválida ou longa demais.");
      if (
        q.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(new Date(value).getTime()) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw new Error("Data inválida.");
      answers[q.id] = value.trim();
      if (!answers[q.id] && complete && q.required)
        throw new Error(`Responda: ${q.label}`);
      snapshot.push({ question: q.label, answer: value.trim() });
    }
    manualReview ||= q.manualReview;
  }
  if (!Number.isSafeInteger(total) || total > 100_000_000)
    throw new Error("A estimativa excede o limite permitido.");
  return { total, answers, breakdown, snapshot, manualReview };
}

export function mediaIds(config: Config): string[] {
  return [
    ...new Set([
      ...(config.mainImageId ? [config.mainImageId] : []),
      ...config.gallery.map((i) => i.id),
      ...(config.categories || []).flatMap((category) =>
        category.coverImageId ? [category.coverImageId] : [],
      ),
      ...config.services.flatMap((s) =>
        s.questions.flatMap((q) => [
          ...q.samples,
          ...q.options.flatMap((o) => o.samples),
        ]),
      ),
    ]),
  ];
}

export interface Media {
  id: string;
  title: string;
  bytes: number;
  created_at: string;
  state: string;
}
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  request: string;
  reference_links: string[];
  service_name: string;
  config_version: number;
  estimate: number;
  manual_review: number;
  snapshot: ReturnType<typeof quote>;
  status: Status;
  attention: number;
  notes: string;
  final_price: number | null;
  paid_at: string | null;
  is_job: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

export function portfolioCategories(config: Config) {
  const categories = (config.categories || []).map((category) => {
    const works = config.gallery.filter(
      (art) => art.categoryId === category.id,
    );
    return {
      ...category,
      works,
      coverImageId: category.coverImageId || works[0]?.id || null,
    };
  });
  const works = config.gallery.filter((art) => !art.categoryId);
  categories.push({
    id: "outros",
    name: "Outros trabalhos",
    serviceId: null,
    coverImageId: works[0]?.id || null,
    works,
  });
  return categories;
}
