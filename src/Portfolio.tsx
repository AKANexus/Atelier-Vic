import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Palette,
  Sparkles,
  X,
} from "lucide-react";
import { api, body } from "./api";
import { themeStyle } from "./theme";
import { type PublicPage } from "./publicRoutes";
import { RichTextContent, normalizeRichText } from "./RichText";
import {
  defaultConfig,
  money,
  quote,
  visible,
  type Answers,
  type Config,
  type Question,
} from "./domain";

interface Turnstile {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let turnstileScript: Promise<void> | undefined;
function loadTurnstile() {
  if (!turnstileScript)
    turnstileScript = new Promise<void>((resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.onload = () => resolve();
      script.onerror = () => {
        turnstileScript = undefined;
        reject(
          new Error("Não foi possível carregar a verificação de segurança."),
        );
      };
      document.head.appendChild(script);
    });
  return turnstileScript;
}
function SecurityCheck({
  siteKey,
  onToken,
  reset,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  reset: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    loadTurnstile()
      .then(() => {
        if (disposed || !root.current || !window.turnstile) return;
        widget.current = window.turnstile.render(root.current, {
          sitekey: siteKey,
          action: "quote",
          theme: "dark",
          size: "compact",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(""),
          "error-callback": () => {
            callback.current("");
            setError("A verificação falhou. Tente novamente.");
          },
        });
      })
      .catch((error) => setError(error.message));
    return () => {
      disposed = true;
      if (widget.current && window.turnstile)
        window.turnstile.remove(widget.current);
    };
  }, [siteKey]);
  useEffect(() => {
    if (reset && widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      callback.current("");
    }
  }, [reset]);
  return (
    <>
      <div ref={root} />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
function Samples({ ids }: { ids: string[] }) {
  const base = window.location.pathname.startsWith("/admin")
    ? "/api/admin/media"
    : "/api/media";
  return ids.length ? (
    <div className="answer-samples">
      {ids.map((id) => (
        <a
          key={id}
          href={`${base}/${id}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir exemplo em tamanho maior"
        >
          <img
            src={`${base}/${id}?size=thumbnail`}
            alt="Exemplo desta opção"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  ) : null;
}
function QuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: Question;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  return (
    <fieldset className="question">
      <legend>
        {q.label}
        {q.required && <span className="required"> *</span>}
      </legend>
      {q.help && <p className="muted">{q.help}</p>}
      <Samples ids={q.samples} />
      {q.type === "single" || q.type === "multiple" ? (
        <div className="answer-options">
          {q.options.map((option) => {
            const checked = Array.isArray(value)
              ? value.includes(option.id)
              : value === option.id;
            return (
              <label
                key={option.id}
                className={`answer-option ${checked ? "selected" : ""}`}
              >
                <div className="answer-option-title">
                  <input
                    type={q.type === "single" ? "radio" : "checkbox"}
                    name={q.id}
                    checked={checked}
                    onChange={() =>
                      onChange(
                        q.type === "single"
                          ? option.id
                          : checked
                            ? (Array.isArray(value) ? value : []).filter(
                                (v) => v !== option.id,
                              )
                            : [
                                ...(Array.isArray(value) ? value : []),
                                option.id,
                              ],
                      )
                    }
                  />
                  <span>{option.label}</span>
                  {option.price > 0 && <small>+ {money(option.price)}</small>}
                </div>
                <Samples ids={option.samples} />
                {option.manualReview && (
                  <small className="muted">Será avaliado pelo artista</small>
                )}
              </label>
            );
          })}
        </div>
      ) : q.type === "long" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          maxLength={3000}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      ) : (
        <input
          type={q.type === "date" ? "date" : "text"}
          value={typeof value === "string" ? value : ""}
          maxLength={300}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </fieldset>
  );
}

export default function Portfolio({
  preview,
  page: selectedPage,
  onNavigate,
}: {
  preview?: Config;
  page?: PublicPage;
  onNavigate?: (page: PublicPage, hash?: string) => void;
}) {
  const page = "portfolio";
  const [commissions, setCommissions] = useState(
    selectedPage === "commissions",
  );
  const commissionDialog = useRef<HTMLDivElement>(null);
  const commissionOpener = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>(preview || defaultConfig);
  const [version, setVersion] = useState(0);
  const [siteKey, setSiteKey] = useState("");
  const [loadError, setLoadError] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    request: "",
    references: "",
    consent: false,
  });
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    id: string;
    estimate: number;
  } | null>(null);
  const key = useRef(crypto.randomUUID());
  useEffect(() => {
    if (preview) {
      setConfig({ ...defaultConfig, ...preview });
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError("");
    api<{ config: Config; version: number; turnstileSiteKey: string }>("config")
      .then((result) => {
        if (!active) return;
        setConfig({ ...defaultConfig, ...result.config });
        setVersion(result.version);
        setSiteKey(result.turnstileSiteKey);
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preview, loadAttempt]);
  useEffect(() => {
    if (preview || loading || loadError) return;
    document.title = `${config.brand} · Portfólio`;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", config.publicTheme.background);
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", config.intro || `Portfólio de ${config.brand}`);
  }, [config, commissions, preview, loading, loadError]);
  useEffect(() => {
    if (loading || loadError || preview || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [loading, loadError, preview]);
  useEffect(() => {
    if (zoom === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setZoom(null);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setZoom((current) =>
          current === null
            ? null
            : (current +
                (event.key === "ArrowLeft" ? -1 : 1) +
                config.gallery.length) %
              config.gallery.length,
        );
      }
      if (event.key === "Tab") {
        const controls =
          dialog.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (!dialog.current?.contains(event.target as Node))
        dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("keydown", listener);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", listener);
      document.removeEventListener("focusin", keepFocus);
      opener.current?.focus();
    };
  }, [zoom !== null, config.gallery.length]);
  function openCommission() {
    commissionOpener.current = document.activeElement as HTMLElement;
    setCommissions(true);
    onNavigate?.("commissions");
  }
  function closeCommission() {
    setCommissions(false);
    setToken("");
    onNavigate?.("portfolio");
    if (!preview && window.location.hash === "#encomendar")
      window.history.replaceState(null, "", "/#contato");
  }
  useEffect(() => {
    if (selectedPage !== undefined)
      setCommissions(selectedPage === "commissions");
  }, [selectedPage]);
  useEffect(() => {
    if (preview || loading || loadError) return;
    const openFromHash = () => {
      if (window.location.hash === "#encomendar") openCommission();
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [preview, loading, loadError]);
  useEffect(() => {
    if (!commissions) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const modal = commissionDialog.current;
    modal?.querySelector<HTMLButtonElement>("button")?.focus();
    const controls = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCommission();
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0],
        last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        modal?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (!modal?.contains(event.target as Node))
        (controls()[0] || modal)?.focus();
    };
    document.addEventListener("keydown", listener);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", listener);
      document.removeEventListener("focusin", keepFocus);
      commissionOpener.current?.focus();
    };
  }, [commissions]);
  function openArt(index: number) {
    opener.current = document.activeElement as HTMLElement;
    setZoom(index);
  }
  function navLink(label: string, target: PublicPage, hash = "") {
    const href = target === "commissions" ? "#encomendar" : `/${hash}`;
    return (
      <a
        href={href}
        aria-current={target === page && !hash ? "page" : undefined}
        onClick={(event) => {
          if (target === "commissions") {
            event.preventDefault();
            openCommission();
            return;
          }
          if (!preview) return;
          event.preventDefault();
          onNavigate?.(target, hash);
        }}
      >
        {label}
      </a>
    );
  }
  const biography = normalizeRichText(config.artistBio);
  const hasBiography = biography.some((block) =>
    block.spans.some((span) => span.text.trim()),
  );
  const service = config.services.find((s) => s.id === serviceId);
  let indicative = service?.basePrice || 0;
  try {
    if (service) indicative = quote(service, answers, false).total;
  } catch {
    /* An incomplete selection is shown through form validation. */
  }
  function answer(id: string, value: string | string[]) {
    if (!service) return;
    const next = { ...answers, [id]: value };
    const cleaned: Answers = {};
    for (const q of service.questions)
      if (visible(q, cleaned) && next[q.id] !== undefined)
        cleaned[q.id] = next[q.id];
    setAnswers(cleaned);
    setError("");
  }
  function nextStep(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!service) {
      setError("Escolha o tipo de arte para continuar.");
      return;
    }
    if (step === 1) {
      try {
        quote(service, answers);
      } catch (error) {
        setError((error as Error).message);
        return;
      }
    }
    setStep(step + 1);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!service || busy || preview) return;
    if (!token) {
      setError("Conclua a verificação de segurança para enviar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api<{ id: string; estimate: number }>("leads", {
        method: "POST",
        body: body({
          key: key.current,
          version,
          serviceId,
          answers,
          ...contact,
          consent: contact.consent,
          referenceLinks: contact.references
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          turnstile: token,
        }),
      });
      setSuccess(response);
    } catch (error) {
      setError((error as Error).message);
      setReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  const mediaBase = preview ? "/api/admin/media" : "/api/media";
  if (loading || loadError)
    return (
      <div
        className="portfolio public-loading"
        style={themeStyle(defaultConfig.publicTheme)}
      >
        {loading ? (
          <p role="status">Carregando o portfólio…</p>
        ) : (
          <div role="alert">
            <p>Não foi possível carregar o site.</p>
            <button
              className="button primary"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div
      className={`portfolio ${preview ? "portfolio-preview" : ""}`}
      style={themeStyle(config.publicTheme) as CSSProperties}
    >
      <a className="skip-link" href="#conteudo" inert={commissions}>
        Ir para o conteúdo
      </a>
      <header className="public-header" inert={commissions}>
        <span className="artist-wordmark">
          {navLink(config.brand, "portfolio")}
        </span>
        <nav aria-label="Navegação principal">
          {navLink("Portfólio", "portfolio")}
          {navLink("Sobre", "portfolio", "#sobre")}
          {navLink("Contato", "portfolio", "#contato")}
        </nav>
      </header>
      <main id="conteudo" inert={commissions}>
        {config.mainImageId && (
          <div className="artist-banner">
            <img
              src={`${mediaBase}/${config.mainImageId}`}
              alt={config.mainImageAlt || config.brand}
              fetchPriority="high"
            />
          </div>
        )}
        {
          <section
            className="artist-introduction"
            aria-labelledby="artist-name"
          >
            <h1 id="artist-name">{config.brand}</h1>
            <p className="artist-specialty">{config.headline}</p>
            {config.intro && <p>{config.intro}</p>}
          </section>
        }
        {
          <>
            <section className="section gallery-section" id="trabalhos">
              <div className="section-heading">
                <div>
                  <h2>{config.portfolioTitle}</h2>
                  {config.portfolioSubtitle && (
                    <p className="portfolio-subtitle">
                      {config.portfolioSubtitle}
                    </p>
                  )}
                </div>
              </div>
              {config.gallery.length ? (
                <div className="gallery">
                  {config.gallery.map((art, index) => (
                    <button
                      key={art.id}
                      className="art-card"
                      onClick={() => openArt(index)}
                      aria-label={`Ver ${art.title}`}
                    >
                      <div className="art-image">
                        <img
                          src={`${mediaBase}/${art.id}`}
                          alt={art.alt}
                          loading="lazy"
                        />
                      </div>
                      <div className="art-caption">
                        <div>
                          <h3>{art.title}</h3>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-portfolio">
                  <Palette size={27} />
                  <p>Novos trabalhos estarão aqui em breve.</p>
                  <span>Cada peça tem sua própria história.</span>
                </div>
              )}
            </section>
            <section className="artist-about section" id="sobre">
              <h2>Sobre</h2>
              <div className="artist-biography">
                {hasBiography ? (
                  <RichTextContent value={biography} />
                ) : (
                  <p>{config.intro || config.brand}</p>
                )}
              </div>
            </section>
            <section className="artist-contact section" id="contato">
              <h2>Contato</h2>
              <div className="artist-biography" id="processo">
                <RichTextContent value={config.processContent} />
              </div>
              <div className="contact-actions">
                <a
                  href="#encomendar"
                  onClick={(event) => {
                    event.preventDefault();
                    openCommission();
                  }}
                >
                  Encomende uma arte
                </a>
                {config.email && (
                  <a className="text-link" href={`mailto:${config.email}`}>
                    <Mail size={18} />
                    Prefere falar direto?
                  </a>
                )}
                {config.whatsapp && (
                  <a
                    className="text-link"
                    href={`https://wa.me/${config.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp <ArrowUpRight size={16} />
                  </a>
                )}
              </div>
            </section>
          </>
        }
      </main>
      <footer className="public-footer" inert={commissions}>
        <span>Desenvolvido por Nexus Web Dev</span>
        <a href="/admin">
          Área do artista <ArrowUpRight size={14} />
        </a>
      </footer>
      {commissions && (
        <div
          className="commission-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCommission();
          }}
        >
          <div
            ref={commissionDialog}
            className="commission-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commission-modal-title"
            tabIndex={-1}
          >
            <div className="commission-modal-header">
              <h2 id="commission-modal-title">Encomende uma arte</h2>
              <button
                className="button ghost small"
                type="button"
                aria-label="Fechar formulário"
                onClick={closeCommission}
              >
                <X size={20} />
              </button>
            </div>
            <p className="availability">
              <span className={`dot ${config.accepting ? "" : "closed"}`} />
              {config.accepting
                ? "Disponível para encomendas"
                : "Agenda fechada"}
            </p>
            <div className="quote-card">
              {success ? (
                <div className="success">
                  <CheckCircle2 size={44} />
                  <h3>Sua ideia chegou!</h3>
                  <p>
                    O artista recebeu seu pedido e vai conversar com você pelo
                    contato informado.
                  </p>
                  <div className="estimate">
                    <small>Estimativa inicial</small>
                    <strong>{money(success.estimate)}</strong>
                  </div>
                  <small>
                    Referência do pedido: {success.id.slice(0, 8).toUpperCase()}
                  </small>
                  <p className="muted">
                    O valor final será confirmado pelo artista.
                  </p>
                </div>
              ) : !config.accepting ? (
                <div className="closed-state">
                  <Sparkles size={33} />
                  <h3>A agenda está sendo preparada.</h3>
                  <p>
                    Novas encomendas estarão disponíveis em breve. Enquanto
                    isso, conheça o portfólio ou entre em contato.
                  </p>
                </div>
              ) : (
                <>
                  <div className="form-top">
                    <span>SEU PEDIDO</span>
                    <small>{step + 1} de 3</small>
                  </div>
                  <div className="steps">
                    {["Sua arte", "Os detalhes", "Seu contato"].map(
                      (label, index) => (
                        <span
                          key={label}
                          className={step >= index ? "active" : ""}
                        >
                          <b>
                            {step > index ? <Check size={13} /> : index + 1}
                          </b>
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                  <form onSubmit={step < 2 ? nextStep : submit}>
                    {step === 0 && (
                      <>
                        <h3>O que vamos criar?</h3>
                        <p className="muted">
                          Escolha o ponto de partida da sua encomenda.
                        </p>
                        <div className="service-options">
                          {config.services.map((item) => (
                            <label
                              key={item.id}
                              className={`service-option ${serviceId === item.id ? "selected" : ""}`}
                            >
                              <input
                                type="radio"
                                name="service"
                                checked={serviceId === item.id}
                                onChange={() => {
                                  setServiceId(item.id);
                                  setAnswers({});
                                  setError("");
                                }}
                              />
                              <div>
                                <strong>{item.name}</strong>
                                <p>{item.description}</p>
                              </div>
                              <small>
                                A partir de
                                <br />
                                <b>{money(item.basePrice)}</b>
                              </small>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                    {step === 1 && service && (
                      <>
                        <h3>Vamos aos detalhes.</h3>
                        <p className="muted">
                          Pequenas escolhas deixam a arte com a sua cara.
                        </p>
                        {service.questions
                          .filter((q) => visible(q, answers))
                          .map((q) => (
                            <QuestionInput
                              key={q.id}
                              question={q}
                              value={answers[q.id]}
                              onChange={(value) => answer(q.id, value)}
                            />
                          ))}
                        {!service.questions.length && (
                          <p>
                            Este tipo de arte não exige detalhes adicionais.
                            Conte sua ideia no próximo passo.
                          </p>
                        )}
                      </>
                    )}
                    {step === 2 && (
                      <>
                        <h3>Como podemos falar com você?</h3>
                        <p className="muted">
                          Seu pedido será revisado pessoalmente pelo artista.
                        </p>
                        <label>
                          Seu nome *
                          <input
                            autoComplete="name"
                            required
                            minLength={2}
                            maxLength={150}
                            value={contact.name}
                            onChange={(e) =>
                              setContact({ ...contact, name: e.target.value })
                            }
                          />
                        </label>
                        <div className="field-row">
                          <label>
                            E-mail *
                            <input
                              type="email"
                              autoComplete="email"
                              required
                              maxLength={254}
                              value={contact.email}
                              onChange={(e) =>
                                setContact({
                                  ...contact,
                                  email: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            WhatsApp (opcional)
                            <input
                              type="tel"
                              autoComplete="tel"
                              maxLength={30}
                              value={contact.phone}
                              onChange={(e) =>
                                setContact({
                                  ...contact,
                                  phone: e.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Conte um pouco mais
                          <textarea
                            rows={4}
                            maxLength={3000}
                            placeholder="Personagens, clima, cores, prazo… o que você tem em mente?"
                            value={contact.request}
                            onChange={(e) =>
                              setContact({
                                ...contact,
                                request: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Links de referência (até 5)
                          <textarea
                            rows={2}
                            placeholder="Um link HTTPS por linha"
                            value={contact.references}
                            onChange={(e) =>
                              setContact({
                                ...contact,
                                references: e.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="privacy-note">
                          <p>{config.privacy}</p>
                          <label className="check-label">
                            <input
                              type="checkbox"
                              required
                              checked={contact.consent}
                              onChange={(e) =>
                                setContact({
                                  ...contact,
                                  consent: e.target.checked,
                                })
                              }
                            />{" "}
                            Concordo com o uso desses dados para este pedido.
                          </label>
                        </div>
                        {preview ? (
                          <p className="notice">
                            Prévia do site: o envio está desativado.
                          </p>
                        ) : siteKey ? (
                          <SecurityCheck
                            siteKey={siteKey}
                            onToken={setToken}
                            reset={reset}
                          />
                        ) : (
                          <p className="error">
                            O envio ainda está sendo configurado. Entre em
                            contato com o estúdio.
                          </p>
                        )}
                      </>
                    )}
                    {error && (
                      <p className="error notice" role="alert">
                        {error}
                      </p>
                    )}
                    {service && (
                      <div className="estimate-bar">
                        <div>
                          <small>Estimativa inicial</small>
                          <strong>{money(indicative)}</strong>
                        </div>
                        <span>
                          O artista confirma
                          <br />o orçamento final.
                        </span>
                      </div>
                    )}
                    <div className="form-actions">
                      {step > 0 && (
                        <button
                          className="button ghost"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setStep(step - 1);
                            setError("");
                          }}
                        >
                          <ChevronLeft size={17} /> Voltar
                        </button>
                      )}
                      <button
                        className="button primary"
                        type="submit"
                        disabled={
                          busy || (step === 2 && (!!preview || !siteKey))
                        }
                      >
                        {busy
                          ? "Enviando…"
                          : step === 2
                            ? "Enviar minha ideia"
                            : "Continuar"}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {zoom !== null && (
        <div
          ref={dialog}
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={config.gallery[zoom].title}
          onClick={() => setZoom(null)}
        >
          <button
            className="lightbox-close"
            onClick={() => setZoom(null)}
            aria-label="Fechar imagem"
            autoFocus
          >
            <X />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setZoom(
                (zoom + config.gallery.length - 1) % config.gallery.length,
              );
            }}
            aria-label="Imagem anterior"
          >
            <ChevronLeft />
          </button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img
              src={`${mediaBase}/${config.gallery[zoom].id}`}
              alt={config.gallery[zoom].alt}
            />
            <figcaption>
              <strong>{config.gallery[zoom].title}</strong>
              <p>{config.gallery[zoom].description}</p>
            </figcaption>
          </figure>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setZoom((zoom + 1) % config.gallery.length);
            }}
            aria-label="Próxima imagem"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
