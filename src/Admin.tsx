import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  ImagePlus,
  Images,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Palette,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, body } from "./api";
import {
  defaultConfig,
  money,
  statuses,
  type Config,
  type Lead,
  type Media,
  type Question,
  type Service,
  type Status,
} from "./domain";
import { compressImage } from "./images";
import Portfolio from "./Portfolio";
import { RichTextEditor, normalizeRichText } from "./RichText";
import ThemeEditor from "./ThemeEditor";
import { publicThemeSchema } from "./theme";
import type { PublicRoute } from "./publicRoutes";

type Tab = "leads" | "forms" | "gallery" | "portfolio" | "settings";
type Session = {
  email: string;
  local: boolean;
  emailEnabled: boolean;
  turnstileConfigured: boolean;
};
type Configuration = {
  draft: Config;
  published: Config | null;
  revision: number;
  version: number;
};
type History = { actor: string; message: string; created_at: string };
const date = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
const newQuestion = (): Question => ({
  id: crypto.randomUUID(),
  label: "Nova pergunta",
  help: "",
  type: "single",
  required: true,
  manualReview: false,
  condition: null,
  samples: [],
  options: [
    {
      id: crypto.randomUUID(),
      label: "Opção 1",
      price: 0,
      samples: [],
      manualReview: false,
    },
  ],
});
function Price({
  value,
  onChange,
  label = "Preço (R$)",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        max="1000000"
        step="0.01"
        value={value / 100}
        onChange={(event) =>
          onChange(Math.round(Number(event.target.value || 0) * 100))
        }
      />
    </label>
  );
}
function Text({
  label,
  value,
  onChange,
  max = 500,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea
          rows={3}
          maxLength={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          maxLength={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
function Toggle({
  children,
  checked,
  onChange,
}: {
  children: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="check-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}
function SamplePicker({
  media,
  selected,
  onChange,
}: {
  media: Media[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <details className="sample-picker">
      <summary>
        <Images size={15} /> Exemplos visuais ({selected.length}/3)
      </summary>
      <div className="sample-grid">
        {media
          .filter((m) => m.state === "ready")
          .map((m) => (
            <label
              key={m.id}
              className={selected.includes(m.id) ? "selected" : ""}
            >
              <img
                src={`/api/admin/media/${m.id}?size=thumbnail`}
                alt={m.title}
                loading="lazy"
              />
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                disabled={!selected.includes(m.id) && selected.length >= 3}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, m.id]
                      : selected.filter((id) => id !== m.id),
                  )
                }
              />
              <span>{m.title}</span>
            </label>
          ))}
        {!media.length && (
          <p className="muted">Envie imagens na biblioteca primeiro.</p>
        )}
      </div>
    </details>
  );
}
function QuestionEditor({
  q,
  previous,
  media,
  onChange,
  onRemove,
  moveUp,
  moveDown,
}: {
  q: Question;
  previous: Question[];
  media: Media[];
  onChange: (q: Question) => void;
  onRemove: () => void;
  moveUp?: () => void;
  moveDown?: () => void;
}) {
  return (
    <div className="question-editor">
      <div className="editor-title">
        <strong>{q.label}</strong>
        <div>
          <button
            className="icon-button"
            disabled={!moveUp}
            onClick={moveUp}
            aria-label="Mover pergunta para cima"
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="icon-button"
            disabled={!moveDown}
            onClick={moveDown}
            aria-label="Mover pergunta para baixo"
          >
            <ArrowDown size={15} />
          </button>
          <button
            className="icon-button danger"
            onClick={onRemove}
            aria-label="Excluir pergunta"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="field-row">
        <Text
          label="Pergunta"
          value={q.label}
          max={200}
          onChange={(label) => onChange({ ...q, label })}
        />
        <label>
          Tipo de resposta
          <select
            value={q.type}
            onChange={(event) => {
              const type = event.target.value as Question["type"];
              onChange({
                ...q,
                type,
                options: ["single", "multiple"].includes(type)
                  ? q.options.length
                    ? q.options
                    : newQuestion().options
                  : [],
              });
            }}
          >
            <option value="single">Escolha única</option>
            <option value="multiple">Múltipla escolha</option>
            <option value="short">Texto curto</option>
            <option value="long">Texto longo</option>
            <option value="date">Data</option>
          </select>
        </label>
      </div>
      <Text
        label="Texto de ajuda"
        value={q.help}
        onChange={(help) => onChange({ ...q, help })}
      />
      <div className="field-row">
        <Toggle
          checked={q.required}
          onChange={(required) => onChange({ ...q, required })}
        >
          Resposta obrigatória
        </Toggle>
        <Toggle
          checked={q.manualReview}
          onChange={(manualReview) => onChange({ ...q, manualReview })}
        >
          Exige avaliação do artista
        </Toggle>
      </div>
      <label>
        Quando mostrar esta pergunta
        <select
          value={
            q.condition
              ? `${q.condition.questionId}|${q.condition.optionId}`
              : ""
          }
          onChange={(event) => {
            const [questionId, optionId] = event.target.value.split("|");
            onChange({
              ...q,
              condition: questionId ? { questionId, optionId } : null,
            });
          }}
        >
          <option value="">Sempre</option>
          {previous.flatMap((parent) =>
            parent.options.map((option) => (
              <option key={option.id} value={`${parent.id}|${option.id}`}>
                {parent.label}: {option.label}
              </option>
            )),
          )}
        </select>
      </label>
      <SamplePicker
        media={media}
        selected={q.samples}
        onChange={(samples) => onChange({ ...q, samples })}
      />
      {["single", "multiple"].includes(q.type) && (
        <div className="option-editors">
          {q.options.map((option, index) => (
            <div className="option-editor" key={option.id}>
              <div className="field-row">
                <Text
                  label={`Opção ${index + 1}`}
                  value={option.label}
                  max={150}
                  onChange={(label) =>
                    onChange({
                      ...q,
                      options: q.options.map((o) =>
                        o.id === option.id ? { ...o, label } : o,
                      ),
                    })
                  }
                />
                <Price
                  label="Adicional (R$)"
                  value={option.price}
                  onChange={(price) =>
                    onChange({
                      ...q,
                      options: q.options.map((o) =>
                        o.id === option.id ? { ...o, price } : o,
                      ),
                    })
                  }
                />
                <button
                  className="icon-button danger"
                  aria-label="Excluir opção"
                  onClick={() =>
                    onChange({
                      ...q,
                      options: q.options.filter((o) => o.id !== option.id),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <Toggle
                checked={option.manualReview}
                onChange={(manualReview) =>
                  onChange({
                    ...q,
                    options: q.options.map((o) =>
                      o.id === option.id ? { ...o, manualReview } : o,
                    ),
                  })
                }
              >
                Esta opção exige avaliação
              </Toggle>
              <SamplePicker
                media={media}
                selected={option.samples}
                onChange={(samples) =>
                  onChange({
                    ...q,
                    options: q.options.map((o) =>
                      o.id === option.id ? { ...o, samples } : o,
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            className="button ghost small"
            onClick={() =>
              onChange({
                ...q,
                options: [
                  ...q.options,
                  {
                    id: crypto.randomUUID(),
                    label: `Opção ${q.options.length + 1}`,
                    price: 0,
                    samples: [],
                    manualReview: false,
                  },
                ],
              })
            }
            disabled={q.options.length >= 30}
          >
            <Plus size={15} /> Adicionar opção
          </button>
        </div>
      )}
    </div>
  );
}
function ServiceEditor({
  service: s,
  media,
  onChange,
  onRemove,
}: {
  service: Service;
  media: Media[];
  onChange: (service: Service) => void;
  onRemove: () => void;
}) {
  const update = (q: Question) =>
    onChange({
      ...s,
      questions: s.questions.map((item) => (item.id === q.id ? q : item)),
    });
  function reorder(index: number, to: number) {
    const questions = [...s.questions];
    [questions[index], questions[to]] = [questions[to], questions[index]];
    // Validation blocks publication when moving a question would break an earlier-answer dependency.
    onChange({ ...s, questions });
  }
  return (
    <details className="service-editor" open>
      <summary>
        <div>
          <ListChecks size={19} />
          <strong>{s.name}</strong>
        </div>
        <span>
          {s.questions.length} perguntas · {money(s.basePrice)}
        </span>
      </summary>
      <div className="service-editor-body">
        <div className="service-questions">
          <h2>Perguntas do pedido</h2>
          {s.questions.map((q, index) => (
            <QuestionEditor
              key={q.id}
              q={q}
              previous={s.questions.slice(0, index)}
              media={media}
              onChange={update}
              onRemove={() =>
                onChange({
                  ...s,
                  questions: s.questions.filter((item) => item.id !== q.id),
                })
              }
              moveUp={index ? () => reorder(index, index - 1) : undefined}
              moveDown={
                index < s.questions.length - 1
                  ? () => reorder(index, index + 1)
                  : undefined
              }
            />
          ))}
          <div className="editor-footer">
            <button
              className="button ghost small"
              disabled={s.questions.length >= 50}
              onClick={() =>
                onChange({ ...s, questions: [...s.questions, newQuestion()] })
              }
            >
              <Plus size={15} /> Nova pergunta
            </button>
            <button className="button ghost small danger" onClick={onRemove}>
              <Trash2 size={15} /> Remover serviço
            </button>
          </div>
        </div>
        <aside className="service-pricing">
          <h2>Serviço & preço base</h2>
          <div className="service-fields">
            <Text
              label="Nome do serviço"
              value={s.name}
              max={100}
              onChange={(name) => onChange({ ...s, name })}
            />
            <Price
              label="Preço base (R$)"
              value={s.basePrice}
              onChange={(basePrice) => onChange({ ...s, basePrice })}
            />
          </div>
          <Text
            label="Descrição"
            value={s.description}
            onChange={(description) => onChange({ ...s, description })}
          />
          <p className="muted">
            A estimativa soma o preço base e os adicionais fixos de cada
            resposta.
          </p>
        </aside>
      </div>
    </details>
  );
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [cfg, setCfg] = useState<Config>(defaultConfig);
  const [revision, setRevision] = useState(0);
  const [live, setLive] = useState<Config | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("leads");
  const [media, setMedia] = useState<Media[]>([]);
  const [notification, setNotification] = useState({
    attention: 0,
    emailFailures: 0,
  });
  const [preview, setPreview] = useState(false);
  const [previewRoute, setPreviewRoute] = useState<PublicRoute>({
    page: "portfolio",
  });
  const themeValid = publicThemeSchema.safeParse(cfg.publicTheme).success;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [initial, setInitial] = useState(true);
  const notifications = useCallback(
    async () => setNotification(await api("admin/notifications")),
    [],
  );
  const refreshMedia = useCallback(
    async () => setMedia((await api<{ media: Media[] }>("admin/media")).media),
    [],
  );
  const refreshLeads = useCallback(async () => {
    const query = new URLSearchParams({
      page: String(page),
      search,
      ...(filter ? { status: filter } : {}),
      ...(attentionOnly ? { attention: "true" } : {}),
    });
    const result = await api<{ leads: Lead[]; more: boolean }>(
      `admin/leads?${query}`,
    );
    setLeads(result.leads);
    setMore(result.more);
  }, [page, search, filter, attentionOnly]);
  useEffect(() => {
    Promise.all([
      api<Session>("admin/session"),
      api<Configuration>("admin/config"),
    ])
      .then(([s, result]) => {
        setSession(s);
        setCfg({ ...defaultConfig, ...result.draft });
        setLive(result.published);
        setRevision(result.revision);
        return Promise.all([refreshMedia(), notifications()]);
      })
      .catch((error) => setError(error.message))
      .finally(() => setInitial(false));
  }, [notifications, refreshMedia]);
  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(() => {
      refreshLeads().catch((error) => setError(error.message));
    }, 300);
    return () => clearTimeout(timeout);
  }, [session, refreshLeads]);
  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        notifications().catch(() => {});
    };
    const interval = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session, notifications]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  const change = (value: Config) => {
    setCfg(value);
    setDirty(true);
    setMessage("");
  };
  async function run(action: () => Promise<string | void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage((await action()) || "");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    publicThemeSchema.parse(cfg.publicTheme);
    const result = await api<{ revision: number }>("admin/config", {
      method: "PUT",
      body: body({ config: cfg, revision }),
    });
    setRevision(result.revision);
    setDirty(false);
    return result.revision;
  }
  async function publish() {
    publicThemeSchema.parse(cfg.publicTheme);
    const saved = dirty ? await saveDraft() : revision;
    const result = await api<{ revision: number; version: number }>(
      "admin/publish",
      { method: "POST", body: body({ revision: saved }) },
    );
    setRevision(result.revision);
    setLive(structuredClone(cfg));
    return "Site publicado. Imagens recém-enviadas podem levar até 60 segundos para aparecer.";
  }
  async function toggleAgenda() {
    if (!live) return;
    const accepting = !live.accepting;
    const result = await api<{ revision: number }>("admin/config", {
      method: "PATCH",
      body: body({ accepting, revision }),
    });
    setRevision(result.revision);
    setLive({ ...live, accepting });
    setCfg((current) => ({ ...current, accepting }));
    return accepting
      ? "Agenda aberta para novas encomendas."
      : "Agenda fechada para novas encomendas.";
  }
  async function openLead(id: string) {
    const result = await api<{ lead: Lead; history: History[] }>(
      `admin/leads/${id}`,
    );
    setDetail(result.lead);
    setHistory(result.history);
  }
  async function updateLead() {
    if (!detail) return;
    await api(`admin/leads/${detail.id}`, {
      method: "PATCH",
      body: body({
        status: detail.status,
        attention: !!detail.attention,
        notes: detail.notes,
        finalPrice: detail.final_price,
        revision: detail.revision,
      }),
    });
    await Promise.all([openLead(detail.id), refreshLeads(), notifications()]);
    return "Pedido atualizado.";
  }
  async function upload(file: File, banner = false) {
    const compressed = await compressImage(file);
    const form = new FormData();
    form.set("image", compressed.image, "sample.webp");
    form.set("thumbnail", compressed.thumbnail, "thumbnail.webp");
    form.set("title", file.name.replace(/\.[^.]+$/, "").slice(0, 150));
    const result = await api<{ id: string }>("admin/media", {
      method: "POST",
      body: form,
    });
    if (banner) change({ ...cfg, mainImageId: result.id });
    await refreshMedia();
    return banner
      ? "Banner enviado e selecionado. Confira a prévia antes de publicar."
      : "Imagem enviada. Já está disponível para usar como banner, capa, obra ou exemplo.";
  }
  async function exportLeads() {
    const all: Lead[] = [];
    let p = 0;
    let next = true;
    while (next) {
      const result = await api<{ leads: Lead[]; more: boolean }>(
        `admin/leads?page=${p++}`,
      );
      all.push(...result.leads);
      next = result.more;
    }
    const value = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), leads: all },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(value);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pedidos-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "Pedidos exportados. Guarde o arquivo em um local privado.";
  }
  if (initial)
    return (
      <div className="loading">
        <Sparkles /> Abrindo seu estúdio…
      </div>
    );
  if (!session)
    return (
      <div className="login-error">
        <Sparkles size={35} />
        <h1>Área do artista</h1>
        <p role="alert">
          {error || "Entre pelo Cloudflare Access para continuar."}
        </p>
        <a className="button primary" href="/admin">
          Tentar novamente
        </a>
        <a href="/">Voltar ao site</a>
      </div>
    );
  const titles: Record<Tab, string> = {
    leads: "Leads & trabalhos",
    forms: "Formulários & preços",
    gallery: "Galeria",
    portfolio: "Portfólio",
    settings: "Seu estúdio, do seu jeito",
  };
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <a href="/admin" className="brand">
          Painel de administração
        </a>
        <a
          className="sidebar-public-link"
          href="/"
          target="_blank"
          rel="noreferrer"
        >
          Ver site público <ArrowUpRight size={16} />
        </a>
        <div className="workspace-label">SEU ESPAÇO</div>
        <nav>
          {[
            { id: "leads", name: "Leads & trabalhos", icon: LayoutDashboard },
            { id: "forms", name: "Formulários & preços", icon: ListChecks },
            { id: "gallery", name: "Galeria", icon: Images },
            { id: "portfolio", name: "Portfólio", icon: Palette },
            { id: "settings", name: "Configurações", icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id as Tab)}
            >
              <item.icon size={18} />
              {item.name}
              {item.id === "leads" && notification.attention > 0 && (
                <span className="sidebar-count">{notification.attention}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/cdn-cgi/access/logout">
            <LogOut size={15} /> Sair do painel
          </a>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <button
              className="notification-button"
              aria-label={`${notification.attention} pedidos precisam de atenção`}
              onClick={() => {
                setTab("leads");
                setAttentionOnly(true);
                setPage(0);
              }}
            >
              <Bell size={19} />
              {notification.attention > 0 && <b>{notification.attention}</b>}
            </button>
          </div>
        </header>
        <main className="admin-content">
          <div className="admin-page-heading">
            <div>
              <span className="eyebrow">BEM-VINDO AO SEU ATELIÊ</span>
              <h1>{titles[tab]}</h1>
            </div>
            {tab !== "leads" && tab !== "gallery" && (
              <div className="toolbar">
                <button
                  className="button ghost small"
                  disabled={busy}
                  onClick={() => setPreview(true)}
                >
                  <Eye size={16} /> Prévia
                </button>
                <button
                  className="button primary small"
                  disabled={busy || !themeValid}
                  onClick={() => run(publish)}
                >
                  <Upload size={16} /> Publicar
                </button>
              </div>
            )}
          </div>
          {session.local && (
            <div className="notice">
              Ambiente local de desenvolvimento. Este acesso não funciona nos
              endereços públicos.
            </div>
          )}
          {!session.turnstileConfigured && (
            <div className="notice warning">
              <CircleHelp size={18} /> Configure o Turnstile no Cloudflare antes
              de abrir novos pedidos.
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice success-note" role="status">
              <Check size={17} />
              {message}
            </div>
          )}
          {notification.emailFailures > 0 && (
            <div className="notice warning">
              {notification.emailFailures} notificações por e-mail não foram
              enviadas. Os pedidos estão salvos.
              <button
                className="text-link"
                disabled={busy || !session.emailEnabled}
                onClick={() =>
                  run(async () => {
                    await api("admin/notifications/retry", {
                      method: "POST",
                      body: "{}",
                    });
                    await notifications();
                    return "Nova tentativa de envio programada.";
                  })
                }
              >
                Tentar novamente
              </button>
            </div>
          )}
          <fieldset className="admin-fieldset" disabled={busy}>
            {tab === "leads" && (
              <>
                <div className="stat-grid">
                  <div className="stat-card">
                    <span>
                      <Bell size={17} /> Precisam de atenção
                    </span>
                    <strong>{notification.attention}</strong>
                    <small>Ideias esperando seu próximo passo</small>
                  </div>
                  <div className="stat-card">
                    <span>
                      <ListChecks size={17} /> Agenda de encomendas
                    </span>
                    <strong className="stat-text">
                      {live?.accepting ? "Aberta" : "Fechada"}
                    </strong>
                    <small>
                      {live
                        ? "Controle a disponibilidade no site público."
                        : "Publique o site antes de abrir a agenda."}
                    </small>
                    <button
                      className="button ghost small agenda-toggle"
                      type="button"
                      disabled={busy || !live}
                      onClick={() => run(toggleAgenda)}
                    >
                      {busy
                        ? "Aguarde…"
                        : live?.accepting
                          ? "Fechar agenda"
                          : "Abrir agenda"}
                    </button>
                  </div>
                </div>
                <section className="panel leads-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Ideias em movimento</h2>
                      <p>Leads e trabalhos, do primeiro contato à entrega.</p>
                    </div>
                    <button
                      className="button ghost small"
                      onClick={() => run(exportLeads)}
                    >
                      <Download size={15} /> Exportar
                    </button>
                  </div>
                  <div className="filters">
                    <input
                      aria-label="Buscar pedidos"
                      placeholder="Buscar por nome ou e-mail…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                    <select
                      aria-label="Filtrar por status"
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Todos os status</option>
                      {Object.entries(statuses).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Toggle
                      checked={attentionOnly}
                      onChange={(value) => {
                        setAttentionOnly(value);
                        setPage(0);
                      }}
                    >
                      Só com atenção
                    </Toggle>
                  </div>
                  <div className="table-scroll">
                    <table className="leads-table">
                      <thead>
                        <tr>
                          <th>Cliente / pedido</th>
                          <th>Status</th>
                          <th>Estimativa</th>
                          <th>Recebido em</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => (
                          <tr key={lead.id}>
                            <td>
                              <button
                                className="lead-name"
                                onClick={() =>
                                  run(async () => {
                                    await openLead(lead.id);
                                    return "";
                                  })
                                }
                              >
                                {!!lead.attention && (
                                  <span className="attention-dot" />
                                )}
                                {lead.name}
                              </button>
                              <small>{lead.service_name}</small>
                            </td>
                            <td>
                              <span className={`status status-${lead.status}`}>
                                {statuses[lead.status]}
                              </span>
                            </td>
                            <td>
                              {money(lead.final_price ?? lead.estimate)}
                              {lead.final_price !== null && (
                                <small>Valor final</small>
                              )}
                            </td>
                            <td>
                              <small>{date(lead.created_at)}</small>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Abrir pedido de ${lead.name}`}
                                onClick={() =>
                                  run(async () => {
                                    await openLead(lead.id);
                                    return "";
                                  })
                                }
                              >
                                <ArrowUpRight size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!leads.length && (
                    <div className="empty-state">
                      <Sparkles size={31} />
                      <h3>
                        {search || filter || attentionOnly
                          ? "Nenhum pedido neste filtro."
                          : "Toda criação começa com uma ideia."}
                      </h3>
                      <p>
                        {search || filter || attentionOnly
                          ? "Experimente ajustar sua busca."
                          : "Quando alguém enviar um pedido pelo site, ele aparece aqui."}
                      </p>
                    </div>
                  )}
                  <div className="pagination">
                    <small>
                      Página {page + 1} · {leads.length} pedidos nesta página
                    </small>
                    <div>
                      <button
                        className="icon-button"
                        disabled={!page}
                        aria-label="Página anterior"
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={!more}
                        aria-label="Próxima página"
                        onClick={() => setPage(page + 1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
            {tab === "forms" && (
              <>
                <div className="notice">
                  <CircleHelp size={17} /> A estimativa soma o preço base e os
                  adicionais escolhidos. Perguntas condicionais usam respostas
                  anteriores. Confira a prévia e publique quando estiver pronto.
                </div>
                {cfg.services.map((s) => (
                  <ServiceEditor
                    key={s.id}
                    service={s}
                    media={media}
                    onChange={(service) =>
                      change({
                        ...cfg,
                        services: cfg.services.map((item) =>
                          item.id === service.id ? service : item,
                        ),
                      })
                    }
                    onRemove={() => {
                      if (
                        confirm(
                          `Remover "${s.name}" do rascunho? Os pedidos antigos serão preservados.`,
                        )
                      )
                        change({
                          ...cfg,
                          services: cfg.services.filter(
                            (item) => item.id !== s.id,
                          ),
                          categories: cfg.categories.map((category) =>
                            category.serviceId === s.id
                              ? { ...category, serviceId: null }
                              : category,
                          ),
                        });
                    }}
                  />
                ))}
                {!cfg.services.length && (
                  <div className="panel empty-state">
                    <ListChecks size={31} />
                    <h3>O que você gosta de criar?</h3>
                    <p>
                      Adicione um serviço, defina o preço base e personalize as
                      perguntas.
                    </p>
                  </div>
                )}
                <button
                  className="button primary"
                  disabled={cfg.services.length >= 20}
                  onClick={() =>
                    change({
                      ...cfg,
                      services: [
                        ...cfg.services,
                        {
                          id: crypto.randomUUID(),
                          name: "Novo serviço",
                          description: "",
                          basePrice: 0,
                          questions: [],
                        },
                      ],
                    })
                  }
                >
                  <Plus size={17} /> Adicionar serviço
                </button>
              </>
            )}
            {tab === "gallery" && (
              <>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Galeria de imagens</h2>
                      <p>Use no portfólio e nos exemplos do formulário.</p>
                    </div>
                    <label className="button primary small upload-button">
                      <ImagePlus size={16} /> Enviar imagem
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) run(() => upload(file));
                        }}
                      />
                    </label>
                  </div>
                  <p className="upload-guidance">
                    JPEG, PNG ou WebP · até 20 MiB por arquivo. Use o botão
                    Enviar imagem para escolher um arquivo.
                  </p>
                  <p className="muted">
                    {media.length}/500 imagens ·{" "}
                    {(
                      media.reduce((total, m) => total + m.bytes, 0) /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    / 300 MiB. Imagens são reduzidas no navegador; guarde os
                    originais.
                  </p>
                  <div className="media-library">
                    {media.map((m) => (
                      <div key={m.id} className="media-item">
                        {m.state === "ready" ? (
                          <img
                            src={`/api/admin/media/${m.id}?size=thumbnail`}
                            alt={m.title}
                            loading="lazy"
                          />
                        ) : (
                          <div className="pending-image">Envio incompleto</div>
                        )}
                        <strong>{m.title}</strong>
                        <small>{Math.round(m.bytes / 1024)} KiB</small>
                        <div>
                          <button
                            className="button ghost small"
                            disabled={
                              m.state !== "ready" ||
                              cfg.gallery.some((g) => g.id === m.id)
                            }
                            onClick={() =>
                              change({
                                ...cfg,
                                gallery: [
                                  ...cfg.gallery,
                                  {
                                    id: m.id,
                                    title: m.title,
                                    description: "",
                                    alt: m.title,
                                  },
                                ],
                              })
                            }
                          >
                            <Plus size={13} /> Portfólio
                          </button>
                          <button
                            className="icon-button danger"
                            aria-label={`Excluir ${m.title}`}
                            onClick={() => {
                              if (
                                confirm(
                                  "Excluir esta imagem permanentemente? Imagens em uso precisam ser removidas do rascunho e publicadas antes.",
                                )
                              )
                                run(async () => {
                                  await api(`admin/media/${m.id}`, {
                                    method: "DELETE",
                                  });
                                  await refreshMedia();
                                  return "Imagem excluída.";
                                });
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!media.length && (
                    <div className="empty-state">
                      <Images size={31} />
                      <h3>Um lugar para seus melhores traços.</h3>
                      <p>Envie uma imagem para começar sua biblioteca.</p>
                    </div>
                  )}
                </section>
              </>
            )}
            {tab === "portfolio" && (
              <>
                <section className="panel category-editor">
                  <div className="panel-heading">
                    <div>
                      <h2>Categorias do portfólio</h2>
                      <p>
                        Organize suas obras e escolha uma capa para cada
                        categoria.
                      </p>
                    </div>
                    <button
                      className="button ghost small"
                      onClick={() =>
                        change({
                          ...cfg,
                          categories: [
                            ...cfg.categories,
                            {
                              id: crypto.randomUUID(),
                              name: "Nova categoria",
                              coverImageId: null,
                              serviceId: null,
                            },
                          ],
                        })
                      }
                      disabled={cfg.categories.length >= 100}
                    >
                      <Plus size={16} />
                      Adicionar categoria
                    </button>
                  </div>
                  {cfg.categories.map((category, index) => (
                    <div className="category-editor-row" key={category.id}>
                      <Text
                        label="Nome da categoria"
                        value={category.name}
                        max={100}
                        onChange={(name) =>
                          change({
                            ...cfg,
                            categories: cfg.categories.map((item) =>
                              item.id === category.id
                                ? { ...item, name }
                                : item,
                            ),
                          })
                        }
                      />
                      <label>
                        Capa da categoria
                        <select
                          value={category.coverImageId || ""}
                          onChange={(event) =>
                            change({
                              ...cfg,
                              categories: cfg.categories.map((item) =>
                                item.id === category.id
                                  ? {
                                      ...item,
                                      coverImageId: event.target.value || null,
                                    }
                                  : item,
                              ),
                            })
                          }
                        >
                          <option value="">Primeira obra da categoria</option>
                          {media
                            .filter((item) => item.state === "ready")
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title}
                              </option>
                            ))}
                        </select>
                      </label>
                      {category.coverImageId && (
                        <img
                          className="category-cover-preview"
                          src={`/api/admin/media/${category.coverImageId}?size=thumbnail`}
                          alt={`Capa de ${category.name}`}
                        />
                      )}
                      <label>
                        Serviço sugerido no contato
                        <select
                          value={category.serviceId || ""}
                          onChange={(event) =>
                            change({
                              ...cfg,
                              categories: cfg.categories.map((item) =>
                                item.id === category.id
                                  ? {
                                      ...item,
                                      serviceId: event.target.value || null,
                                    }
                                  : item,
                              ),
                            })
                          }
                        >
                          <option value="">Deixar o visitante escolher</option>
                          {cfg.services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="form-actions">
                        <button
                          className="icon-button"
                          aria-label={`Mover ${category.name} para cima`}
                          disabled={!index}
                          onClick={() => {
                            const categories = [...cfg.categories];
                            [categories[index - 1], categories[index]] = [
                              categories[index],
                              categories[index - 1],
                            ];
                            change({ ...cfg, categories });
                          }}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Mover ${category.name} para baixo`}
                          disabled={index === cfg.categories.length - 1}
                          onClick={() => {
                            const categories = [...cfg.categories];
                            [categories[index + 1], categories[index]] = [
                              categories[index],
                              categories[index + 1],
                            ];
                            change({ ...cfg, categories });
                          }}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Excluir categoria ${category.name}`}
                          onClick={() =>
                            change({
                              ...cfg,
                              categories: cfg.categories.filter(
                                (item) => item.id !== category.id,
                              ),
                              gallery: cfg.gallery.map((art) =>
                                art.categoryId === category.id
                                  ? { ...art, categoryId: null }
                                  : art,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!cfg.categories.length && (
                    <p className="muted">
                      As obras sem categoria aparecem em Outros trabalhos.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Portfólio público</h2>
                      <p>
                        Escolha a categoria de cada obra e organize a ordem dos
                        trabalhos.
                      </p>
                    </div>
                  </div>
                  {cfg.gallery.map((g, index) => (
                    <div className="gallery-editor" key={g.id}>
                      <img
                        src={`/api/admin/media/${g.id}?size=thumbnail`}
                        alt={g.alt}
                      />
                      <div>
                        <Text
                          label="Título"
                          value={g.title}
                          max={150}
                          onChange={(title) =>
                            change({
                              ...cfg,
                              gallery: cfg.gallery.map((item) =>
                                item.id === g.id ? { ...item, title } : item,
                              ),
                            })
                          }
                        />
                        <Text
                          label="Descrição"
                          value={g.description}
                          onChange={(description) =>
                            change({
                              ...cfg,
                              gallery: cfg.gallery.map((item) =>
                                item.id === g.id
                                  ? { ...item, description }
                                  : item,
                              ),
                            })
                          }
                        />
                        <label>
                          Categoria
                          <select
                            value={g.categoryId || ""}
                            onChange={(event) =>
                              change({
                                ...cfg,
                                gallery: cfg.gallery.map((item) =>
                                  item.id === g.id
                                    ? {
                                        ...item,
                                        categoryId: event.target.value || null,
                                      }
                                    : item,
                                ),
                              })
                            }
                          >
                            <option value="">Outros trabalhos</option>
                            {cfg.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Text
                          label="Descrição acessível da imagem"
                          value={g.alt}
                          max={200}
                          onChange={(alt) =>
                            change({
                              ...cfg,
                              gallery: cfg.gallery.map((item) =>
                                item.id === g.id ? { ...item, alt } : item,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="vertical-actions">
                        <button
                          className="icon-button"
                          disabled={!index}
                          aria-label="Mover trabalho para cima"
                          onClick={() => {
                            const gallery = [...cfg.gallery];
                            [gallery[index], gallery[index - 1]] = [
                              gallery[index - 1],
                              gallery[index],
                            ];
                            change({ ...cfg, gallery });
                          }}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={index === cfg.gallery.length - 1}
                          aria-label="Mover trabalho para baixo"
                          onClick={() => {
                            const gallery = [...cfg.gallery];
                            [gallery[index], gallery[index + 1]] = [
                              gallery[index + 1],
                              gallery[index],
                            ];
                            change({ ...cfg, gallery });
                          }}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label="Remover do portfólio"
                          onClick={() =>
                            change({
                              ...cfg,
                              featuredArtIds: cfg.featuredArtIds.filter(
                                (id) => id !== g.id,
                              ),
                              gallery: cfg.gallery.filter(
                                (item) => item.id !== g.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!cfg.gallery.length && (
                    <p className="muted">
                      Adicione imagens da Galeria ao portfólio.
                    </p>
                  )}
                </section>
              </>
            )}
            {tab === "settings" && (
              <div className="settings-grid">
                <section className="panel">
                  <h2>Apresentação</h2>
                  <Text
                    label="Nome do artista"
                    value={cfg.brand}
                    max={100}
                    onChange={(brand) => change({ ...cfg, brand })}
                  />
                  <Text
                    label="Especialidade / título"
                    value={cfg.headline}
                    max={180}
                    onChange={(headline) => change({ ...cfg, headline })}
                  />
                  <Text
                    label="Apresentação curta"
                    multiline
                    value={cfg.intro}
                    max={1000}
                    onChange={(intro) => change({ ...cfg, intro })}
                  />
                </section>
                <section className="panel presentation-copy-settings">
                  <h2>Textos do site</h2>
                  <Text
                    label="Título do portfólio"
                    value={cfg.portfolioTitle}
                    max={180}
                    onChange={(portfolioTitle) =>
                      change({ ...cfg, portfolioTitle })
                    }
                  />
                  <Text
                    label="Subtítulo do portfólio (opcional)"
                    value={cfg.portfolioSubtitle}
                    max={300}
                    onChange={(portfolioSubtitle) =>
                      change({ ...cfg, portfolioSubtitle })
                    }
                  />
                </section>
                <section className="panel artist-about-settings">
                  <h2>Sobre o artista</h2>
                  <RichTextEditor
                    label="Sobre o artista"
                    value={normalizeRichText(cfg.artistBio)}
                    disabled={busy}
                    onChange={(artistBio) => change({ ...cfg, artistBio })}
                  />
                  <p className="muted">
                    Opcional. Sem biografia, o site usa sua apresentação curta.
                  </p>
                </section>
                <ThemeEditor
                  value={cfg.publicTheme}
                  onChange={(publicTheme) => change({ ...cfg, publicTheme })}
                />
                <section className="panel main-image-settings">
                  <h2>Banner do artista</h2>
                  <label className="button primary small upload-button">
                    <ImagePlus size={16} /> Enviar banner
                    <input
                      type="file"
                      aria-label="Enviar banner do artista"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) run(() => upload(file, true));
                      }}
                    />
                  </label>
                  <Text
                    label="Descrição acessível do banner"
                    value={cfg.mainImageAlt}
                    max={200}
                    onChange={(mainImageAlt) =>
                      change({ ...cfg, mainImageAlt })
                    }
                  />
                  <p className="muted">
                    Envie sua ilustração ou escolha uma imagem da biblioteca.
                    Recomendamos uma composição de 3:1. A imagem aparece
                    inteira, inclusive no celular, e não precisa fazer parte do
                    portfólio.
                  </p>
                  {cfg.mainImageId ? (
                    <div className="main-image-preview">
                      <img
                        src={`/api/admin/media/${cfg.mainImageId}?size=thumbnail`}
                        alt={
                          media.find((item) => item.id === cfg.mainImageId)
                            ?.title || "Imagem principal"
                        }
                      />
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => change({ ...cfg, mainImageId: null })}
                      >
                        Remover banner
                      </button>
                    </div>
                  ) : (
                    <p className="muted">Nenhum banner selecionado.</p>
                  )}
                  <details className="sample-picker">
                    <summary>
                      <Images size={16} /> Escolher imagem da biblioteca
                    </summary>
                    <div className="sample-grid main-image-options">
                      {media
                        .filter((item) => item.state === "ready")
                        .map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            aria-label={`Usar ${item.title} como banner`}
                            aria-pressed={cfg.mainImageId === item.id}
                            onClick={() =>
                              change({ ...cfg, mainImageId: item.id })
                            }
                          >
                            <img
                              src={`/api/admin/media/${item.id}?size=thumbnail`}
                              alt=""
                              loading="lazy"
                            />
                            <span>{item.title}</span>
                          </button>
                        ))}
                    </div>
                    {!media.length && (
                      <p className="muted">
                        Envie uma imagem na Galeria primeiro.
                      </p>
                    )}
                  </details>
                </section>
                <section className="panel process-settings">
                  <h2>Como entrar em contato</h2>
                  <RichTextEditor
                    value={cfg.processContent}
                    label="Como entrar em contato"
                    templates={["contato"]}
                    disabled={busy}
                    onChange={(processContent) =>
                      change({ ...cfg, processContent })
                    }
                  />
                </section>
                <section className="panel">
                  <h2>Contato</h2>
                  <Text
                    label="E-mail público para contato"
                    value={cfg.email}
                    max={254}
                    onChange={(email) => change({ ...cfg, email })}
                  />
                  <Text
                    label="WhatsApp com país e DDD (somente números)"
                    value={cfg.whatsapp}
                    max={15}
                    onChange={(whatsapp) => change({ ...cfg, whatsapp })}
                  />
                </section>
                <section className="panel privacy-settings">
                  <h2>Uso dos dados do pedido</h2>
                  <Text
                    label="Texto apresentado antes do envio"
                    multiline
                    max={3000}
                    value={cfg.privacy}
                    onChange={(privacy) => change({ ...cfg, privacy })}
                  />
                  <p className="muted">
                    Revise esse texto para refletir como você usa e conserva os
                    dados. Exclusões e exportações ficam disponíveis nos
                    pedidos.
                  </p>
                </section>
              </div>
            )}
          </fieldset>
          <footer className="admin-footer">
            <span>Desenvolvido por Nexus Web Dev</span>
            <small>Valores em BRL · Horários no fuso do seu navegador</small>
          </footer>
        </main>
      </div>
      {detail && (
        <div className="modal-overlay">
          <section
            className="lead-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-title"
          >
            <header>
              <div>
                <span className="eyebrow">
                  {detail.is_job ? "TRABALHO" : "LEAD"} ·{" "}
                  {detail.id.slice(0, 8).toUpperCase()}
                </span>
                <h2 id="lead-title">{detail.name}</h2>
              </div>
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => setDetail(null)}
                aria-label="Fechar pedido"
              >
                <X />
              </button>
            </header>
            <fieldset disabled={busy}>
              <div className="contact-links">
                <a href={`mailto:${detail.email}`}>
                  <Mail size={15} />
                  {detail.email}
                </a>
                {detail.phone && (
                  <a
                    href={`https://wa.me/${detail.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp: {detail.phone}
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
              <div className="detail-summary">
                <div>
                  <small>{detail.service_name}</small>
                  <strong>{money(detail.estimate)}</strong>
                </div>
                <div>
                  <small>Recebido em</small>
                  <strong className="detail-date">
                    {date(detail.created_at)}
                  </strong>
                  <span>
                    {detail.manual_review
                      ? "Exige avaliação manual"
                      : "Estimativa sujeita à confirmação"}
                  </span>
                </div>
              </div>
              <h3>A ideia do cliente</h3>
              <p className="preserve-lines">
                {detail.request || "Sem descrição adicional."}
              </p>
              {detail.reference_links.map((link) => (
                <a
                  className="reference-link"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  key={link}
                >
                  {link}
                  <ArrowUpRight size={14} />
                </a>
              ))}
              <dl className="answer-snapshot">
                {detail.snapshot.snapshot.map((answer, index) => (
                  <div key={index}>
                    <dt>{answer.question}</dt>
                    <dd>
                      {Array.isArray(answer.answer)
                        ? answer.answer.join(", ")
                        : answer.answer}
                    </dd>
                  </div>
                ))}
              </dl>
              <details className="price-breakdown">
                <summary>Composição da estimativa</summary>
                {detail.snapshot.breakdown.map((item, index) => (
                  <p key={index}>
                    <span>{item.label}</span>
                    <strong>{money(item.cents)}</strong>
                  </p>
                ))}
              </details>
              <div className="field-row">
                <label>
                  Status
                  <select
                    value={detail.status}
                    onChange={(event) =>
                      setDetail({
                        ...detail,
                        status: event.target.value as Status,
                      })
                    }
                  >
                    {Object.entries(statuses).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Preço final combinado (R$)
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    value={
                      detail.final_price === null
                        ? ""
                        : detail.final_price / 100
                    }
                    onChange={(event) =>
                      setDetail({
                        ...detail,
                        final_price:
                          event.target.value === ""
                            ? null
                            : Math.round(Number(event.target.value) * 100),
                      })
                    }
                  />
                </label>
              </div>
              <Toggle
                checked={!!detail.attention}
                onChange={(value) =>
                  setDetail({ ...detail, attention: Number(value) })
                }
              >
                Este pedido precisa da minha atenção
              </Toggle>
              <Text
                label="Notas internas"
                multiline
                max={10000}
                value={detail.notes}
                onChange={(notes) => setDetail({ ...detail, notes })}
              />
              <p className="muted">
                Status, aprovação e pagamento são registrados manualmente.
                Combine os detalhes com o cliente por e-mail ou WhatsApp.
              </p>
              {detail.paid_at && (
                <p className="muted">
                  Pagamento marcado em {date(detail.paid_at)}.
                </p>
              )}
              <div className="detail-actions">
                <button
                  className="button ghost small danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Excluir permanentemente este pedido, contato e histórico? Esta ação não pode ser desfeita.",
                      )
                    )
                      run(async () => {
                        await api(`admin/leads/${detail.id}`, {
                          method: "DELETE",
                        });
                        setDetail(null);
                        await Promise.all([refreshLeads(), notifications()]);
                        return "Pedido excluído.";
                      });
                  }}
                >
                  <Trash2 size={15} /> Excluir pedido
                </button>
                <button
                  className="button primary"
                  onClick={() => run(updateLead)}
                >
                  <Save size={16} />
                  {busy ? "Salvando…" : "Salvar pedido"}
                </button>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <h3>Histórico</h3>
              <div className="history">
                {history.map((event, index) => (
                  <div key={index}>
                    <span className="dot" />
                    <div>
                      <strong>{event.message}</strong>
                      <small>
                        {date(event.created_at)} ·{" "}
                        {event.actor === "customer"
                          ? "Site público"
                          : event.actor}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </section>
        </div>
      )}
      {preview && (
        <div className="preview-overlay">
          <div className="preview-toolbar">
            <strong>
              <Eye size={17} /> Prévia do site
            </strong>
            <div className="preview-pages" aria-label="Visualização da prévia">
              <button
                className="button ghost small"
                aria-pressed={["portfolio", "category"].includes(
                  previewRoute.page,
                )}
                onClick={() => setPreviewRoute({ page: "portfolio" })}
              >
                Portfólio
              </button>
              <button
                className="button ghost small"
                aria-pressed={previewRoute.page === "about"}
                onClick={() => setPreviewRoute({ page: "about" })}
              >
                Sobre
              </button>
              <button
                className="button ghost small"
                aria-pressed={previewRoute.page === "contact"}
                onClick={() => setPreviewRoute({ page: "contact" })}
              >
                Contato
              </button>
            </div>
            <span>O envio de pedidos está desativado nesta prévia.</span>
            <button
              className="button ghost small"
              onClick={() => setPreview(false)}
            >
              <X size={17} /> Fechar prévia
            </button>
          </div>
          <Portfolio
            preview={cfg}
            {...previewRoute}
            onNavigate={(route) => {
              setPreviewRoute(route);
              requestAnimationFrame(() =>
                document.getElementById("conteudo")?.scrollIntoView(),
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
