import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./domain";
export const english: Record<string, string> = {
  "Verificação indisponível. Tente novamente.":
    "Verification is unavailable. Please try again.",
  "Refaça a verificação de segurança para enviar.":
    "Repeat the security check to submit.",
  "Muitos pedidos nesta hora. Tente mais tarde ou entre em contato.":
    "Too many requests this hour. Try again later or contact the studio.",
  "Não foi possível carregar a verificação de segurança.":
    "Could not load the security check.",
  "A verificação falhou. Tente novamente.":
    "Verification failed. Please try again.",
  "Abrir exemplo em tamanho maior": "Open full-size example",
  "Exemplo desta opção": "Example of this option",
  "Será avaliado pelo artista": "Subject to artist review",
  Sobre: "About",
  Encomendas: "Commissions",
  "Categoria não encontrada": "Category not found",
  Portfólio: "Portfolio",
  "Escolha o tipo de arte para continuar.":
    "Choose an art service to continue.",
  "Conclua a verificação de segurança para enviar.":
    "Complete the security check to submit.",
  "Carregando o portfólio…": "Loading portfolio…",
  "Não foi possível carregar o site.": "Could not load the website.",
  "Tentar novamente": "Try again",
  "Ir para o conteúdo": "Skip to content",
  "Navegação principal": "Main navigation",
  "Voltar ao portfólio": "Back to portfolio",
  "Novos trabalhos estarão aqui em breve.": "New artwork will be here soon.",
  "Novos trabalhos nesta categoria estarão aqui em breve.":
    "New artwork in this category will be here soon.",
  "Esta categoria não existe. Explore as categorias do portfólio.":
    "This category does not exist. Explore the portfolio categories.",
  "Encomende uma arte": "Commission an artwork",
  "Disponível para encomendas": "Open for commissions",
  "Agenda fechada": "Commissions closed",
  "Sua ideia chegou!": "Your idea is here!",
  "O artista recebeu seu pedido e vai conversar com você pelo contato informado.":
    "The artist received your request and will get in touch using the contact details you provided.",
  "Estimativa inicial": "Initial estimate",
  "Referência do pedido:": "Request reference:",
  "O valor final será confirmado pelo artista.":
    "The final price will be confirmed by the artist.",
  "A agenda está sendo preparada.": "New commission slots are being prepared.",
  "Novas encomendas estarão disponíveis em breve. Enquanto isso, conheça o portfólio ou entre em contato.":
    "New commissions will be available soon. In the meantime, explore the portfolio or get in touch.",
  "SEU PEDIDO": "YOUR REQUEST",
  "de 3": "of 3",
  "Sua arte": "Your artwork",
  "Os detalhes": "The details",
  "Seu contato": "Your contact details",
  "O que vamos criar?": "What shall we create?",
  "Escolha o ponto de partida da sua encomenda.":
    "Choose the starting point for your commission.",
  "A partir de": "Starting at",
  "Vamos aos detalhes.": "Let's get into the details.",
  "Pequenas escolhas deixam a arte com a sua cara.":
    "Small choices make the artwork your own.",
  "Este tipo de arte não exige detalhes adicionais. Conte sua ideia no próximo passo.":
    "This service requires no additional details. Tell us about your idea in the next step.",
  "Como podemos falar com você?": "How can we reach you?",
  "Seu pedido será revisado pessoalmente pelo artista.":
    "Your request will be reviewed personally by the artist.",
  "Seu nome *": "Your name *",
  "E-mail *": "Email *",
  "WhatsApp (opcional)": "WhatsApp (optional)",
  "Conte um pouco mais": "Tell us a little more",
  "Personagens, clima, cores, prazo… o que você tem em mente?":
    "Characters, mood, colors, deadline… what do you have in mind?",
  "Links de referência (até 5)": "Reference links (up to 5)",
  "Um link HTTPS por linha": "One HTTPS link per line",
  "Concordo com o uso desses dados para este pedido.":
    "I agree to the use of this information for this request.",
  "Prévia do site: o envio está desativado.":
    "Website preview: submissions are disabled.",
  "O envio ainda está sendo configurado. Entre em contato com o estúdio.":
    "Submissions are still being configured. Please contact the studio.",
  "O artista confirma": "The artist confirms",
  "o orçamento final.": "the final quote.",
  Voltar: "Back",
  "Enviando…": "Sending…",
  "Enviar minha ideia": "Send my idea",
  Continuar: "Continue",
  "Desenvolvido por Nexus Web Dev": "Developed by Nexus Web Dev",
  "Área do artista": "Artist area",
  "Fechar imagem": "Close image",
  "Imagem anterior": "Previous image",
  "Próxima imagem": "Next image",
  "Outros trabalhos": "Other artwork",
  "Há respostas para perguntas desconhecidas.":
    "There are answers to unknown questions.",
  "Selecione uma opção.": "Select an option.",
  "Selecione as opções em uma lista.": "Select options from the list.",
  "Uma opção não pode ser cobrada duas vezes.":
    "An option cannot be charged twice.",
  "Uma opção selecionada não existe mais.":
    "A selected option is no longer available.",
  "Resposta inválida ou longa demais.": "The answer is invalid or too long.",
  "Data inválida.": "Invalid date.",
  "A estimativa excede o limite permitido.":
    "The estimate exceeds the allowed limit.",
  "O serviço selecionado não está disponível.":
    "The selected service is unavailable.",
  "Este envio já foi usado para outro pedido. Recarregue para iniciar um novo.":
    "This submission was already used for another request. Reload to start a new one.",
  "A agenda está fechada no momento. Entre em contato com o estúdio.":
    "Commissions are currently closed. Please contact the studio.",
  "O formulário mudou. Recarregue a página para usar a versão atual.":
    "The form has changed. Reload the page to use the current version.",
  "Novos pedidos temporariamente indisponíveis. Entre em contato com o estúdio.":
    "New requests are temporarily unavailable. Please contact the studio.",
  "Serviço temporariamente indisponível. Tente novamente mais tarde.":
    "Service temporarily unavailable. Please try again later.",
  "Use links HTTPS.": "Use HTTPS links.",
};
export function translate(text: string, locale: Locale): string {
  return locale === "en-US" ? english[text] || text : text;
}
export function translateError(text: string, locale: Locale): string {
  if (locale !== "en-US") return text;
  if (text.startsWith("Responda: ")) return "Please answer: " + text.slice(10);
  return (
    english[text] ||
    "Could not complete your request. Check the form and try again."
  );
}
export function hostLanguage(hostname: string): Locale | undefined {
  if (hostname === "en.vsama.com.br") return "en-US";
  if (hostname === "vsama.com.br") return "pt-BR";
  return undefined;
}
export function languageDestination(href: string, locale: Locale): string | null {
  const url = new URL(href);
  if (!hostLanguage(url.hostname)) return null;
  url.hostname = locale === "en-US" ? "en.vsama.com.br" : "vsama.com.br";
  return url.href;
}
export function readLanguage(cookie: string): Locale {
  return cookie.split(";").some((part) => part.trim() === "site_language=en-US")
    ? "en-US"
    : "pt-BR";
}
export function languageCookie(locale: Locale, secure: boolean): string {
  return `site_language=${locale}; Max-Age=31536000; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}
const LanguageContext = createContext<Locale>("pt-BR");
export function LanguageProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={locale}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const locale = useContext(LanguageContext);
  return {
    locale,
    t: (text: string) => translate(text, locale),
    errorText: (text: string) => translateError(text, locale),
  };
}
export function LanguageFlags({
  locale,
  onChange,
  disabled,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={locale === "en-US" ? "Language" : "Idioma"}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="Português (Brasil)"
        title="Português (Brasil)"
        aria-pressed={locale === "pt-BR"}
        onClick={() => onChange("pt-BR")}
      >
        <svg viewBox="0 0 28 20" aria-hidden="true">
          <path fill="#009b3a" d="M0 0h28v20H0z" />
          <path fill="#ffdf00" d="m14 2 12 8-12 8L2 10z" />
          <circle cx="14" cy="10" r="5" fill="#002776" />
          <path
            d="M9.2 8.5q5-1 9.4 3"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
        </svg>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="English (United States)"
        title="English (United States)"
        aria-pressed={locale === "en-US"}
        onClick={() => onChange("en-US")}
      >
        <svg viewBox="0 0 28 20" aria-hidden="true">
          <path fill="white" d="M0 0h28v20H0z" />
          {Array.from({ length: 7 }, (_, i) => (
            <path
              key={i}
              fill="#b22234"
              d={`M0 ${(i * 40) / 13}h28v${20 / 13}H0z`}
            />
          ))}
          <path fill="#3c3b6e" d="M0 0h12v10.77H0z" />
          {Array.from({ length: 9 }, (_, row) =>
            Array.from({ length: row % 2 ? 5 : 6 }, (_, col) => (
              <path
                key={`${row}-${col}`}
                fill="white"
                transform={`translate(${1 + col * 2 + (row % 2)},${0.65 + row * 1.18}) scale(.42)`}
                d="M0-1 0.3-.3 1-.3 .4.2 .6 1 0 .5-.6 1-.4.2-1-.3-.3-.3Z"
              />
            )),
          )}
        </svg>
      </button>
    </div>
  );
}
