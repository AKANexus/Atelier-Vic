import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Grip, Plus, X } from "lucide-react";
import type { Config, Media } from "./domain";
import {
  addArtwork,
  categoryOf,
  moveArtwork,
  removeArtwork,
  reorderArtwork,
  type Artwork,
} from "./portfolioOperations";

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="portfolio-dialog"
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="panel-heading">
        <h2 id={heading}>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

type Drag = {
  id: string;
  target: string | null;
  x: number;
  y: number;
  startX: number;
  startY: number;
  active: boolean;
};

export default function PortfolioEditor({
  cfg,
  media,
  change,
  selectedCategory,
  selectCategory,
  renderFields,
}: {
  cfg: Config;
  media: Media[];
  change: (config: Config) => void;
  selectedCategory: string | null;
  selectCategory: (id: string | null) => void;
  renderFields: (art: Artwork) => ReactNode;
}) {
  const categoryId = cfg.categories.some((item) => item.id === selectedCategory)
    ? selectedCategory
    : null;
  const categoryName =
    cfg.categories.find((item) => item.id === categoryId)?.name ||
    "Outros trabalhos";
  const works = cfg.gallery.filter((art) => categoryOf(art) === categoryId);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [announcement, announce] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const instructions = useId();
  const editArt = cfg.gallery.find((art) => art.id === editing);
  const available = media.filter((item) => item.state === "ready");
  const newSelection = selection.filter(
    (id) => !cfg.gallery.some((art) => art.id === id),
  );
  const moveSelection = selection.filter((id) =>
    cfg.gallery.some((art) => art.id === id && categoryOf(art) !== categoryId),
  );
  const tooMany = cfg.gallery.length + newSelection.length > 500;

  function clearDrag() {
    drag.current = null;
    setDragging(null);
    setTarget(null);
  }
  function updateTarget() {
    const current = drag.current;
    if (!current?.active) return;
    const card = document
      .elementFromPoint(current.x, current.y)
      ?.closest<HTMLElement>("[data-artwork-id]");
    current.target =
      card && grid.current?.contains(card)
        ? card.dataset.artworkId || null
        : null;
    setTarget(current.target);
  }
  useEffect(() => {
    if (!dragging) return;
    let frame: number;
    const tick = () => {
      const current = drag.current;
      if (current?.active) {
        const delta =
          current.y < 85 ? -12 : current.y > window.innerHeight - 85 ? 12 : 0;
        if (delta) {
          window.scrollBy({ top: delta, behavior: "instant" });
          updateTarget();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearDrag();
        announce("Movimentação cancelada.");
      }
    };
    window.addEventListener("keydown", cancel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", cancel);
    };
  }, [dragging]);

  function reorder(id: string, destination: string) {
    const next = reorderArtwork(cfg, categoryId, id, destination);
    if (next === cfg) return;
    change(next);
    const position =
      next.gallery
        .filter((art) => categoryOf(art) === categoryId)
        .findIndex((art) => art.id === id) + 1;
    announce(
      `${cfg.gallery.find((art) => art.id === id)?.title}: posição ${position} de ${works.length}.`,
    );
  }

  return (
    <section className="panel portfolio-organizer">
      <div className="panel-heading">
        <div>
          <h2>Organizar portfólio</h2>
          <p>
            Escolha uma categoria para organizar suas obras na ordem do site.
          </p>
        </div>
        <button
          className="button primary small"
          onClick={() => {
            setSelection([]);
            setSearch("");
            announce("");
            setPicker(true);
          }}
        >
          <Plus size={16} /> Adicionar imagens
        </button>
      </div>
      <div className="portfolio-category-toolbar">
        <label>
          Categoria
          <select
            value={categoryId || ""}
            onChange={(event) => {
              clearDrag();
              selectCategory(event.target.value || null);
            }}
          >
            {cfg.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value="">Outros trabalhos</option>
          </select>
        </label>
        <span>
          {works.length} {works.length === 1 ? "obra" : "obras"}
        </span>
      </div>
      <p id={instructions} className="muted">
        Arraste pela alça para reordenar. Com a alça em foco, use as setas para
        mudar a posição, Home para o início e End para o final. Esc cancela o
        arraste.
      </p>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      <div
        ref={grid}
        className="portfolio-sort-grid"
        aria-label={`Obras de ${categoryName}`}
      >
        {works.map((art, index) => (
          <article
            key={art.id}
            data-artwork-id={art.id}
            className={`portfolio-sort-card${dragging === art.id ? " is-dragging" : ""}${dragging && target === art.id && target !== dragging ? " is-drop-target" : ""}`}
          >
            <div className="portfolio-thumbnail">
              <img
                src={`/api/admin/media/${art.id}?size=thumbnail`}
                alt={art.alt}
                loading="lazy"
                draggable={false}
              />
              <span className="portfolio-position">{index + 1}</span>
              <button
                className="icon-button portfolio-drag-handle"
                aria-label={`Reordenar ${art.title}, posição ${index + 1} de ${works.length}`}
                aria-describedby={instructions}
                onPointerDown={(event) => {
                  if (event.button !== 0 || !event.isPrimary) return;
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = {
                    id: art.id,
                    target: art.id,
                    x: event.clientX,
                    y: event.clientY,
                    startX: event.clientX,
                    startY: event.clientY,
                    active: false,
                  };
                }}
                onPointerMove={(event) => {
                  const current = drag.current;
                  if (!current || current.id !== art.id) return;
                  current.x = event.clientX;
                  current.y = event.clientY;
                  if (
                    !current.active &&
                    Math.hypot(
                      current.x - current.startX,
                      current.y - current.startY,
                    ) > 6
                  ) {
                    current.active = true;
                    setDragging(art.id);
                  }
                  updateTarget();
                }}
                onPointerUp={(event) => {
                  const current = drag.current;
                  if (current?.active && current.target)
                    reorder(current.id, current.target);
                  clearDrag();
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={clearDrag}
                onLostPointerCapture={clearDrag}
                onKeyDown={(event) => {
                  const offset = ["ArrowRight", "ArrowDown"].includes(event.key)
                    ? 1
                    : ["ArrowLeft", "ArrowUp"].includes(event.key)
                      ? -1
                      : 0;
                  const destination =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? works.length - 1
                        : index + offset;
                  if (!offset && !["Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  clearDrag();
                  if (works[destination])
                    reorder(art.id, works[destination].id);
                }}
              >
                <Grip size={20} />
              </button>
            </div>
            <div className="portfolio-card-content">
              <h3>{art.title}</h3>
              <button
                className="button ghost small"
                onClick={() => setEditing(art.id)}
              >
                Editar obra
              </button>
              {categoryId && (
                <button
                  className="text-link"
                  onClick={() => {
                    change(moveArtwork(cfg, [art.id], null));
                    announce(`${art.title} movida para Outros trabalhos.`);
                  }}
                >
                  Remover da categoria
                </button>
              )}
              <button
                className="text-link portfolio-remove"
                onClick={() => {
                  if (
                    confirm(
                      `Retirar "${art.title}" do portfólio? O arquivo continuará na Galeria.`,
                    )
                  ) {
                    change(removeArtwork(cfg, art.id));
                    announce(`${art.title} retirada do portfólio.`);
                  }
                }}
              >
                Retirar do portfólio
              </button>
            </div>
          </article>
        ))}
      </div>
      {!works.length && (
        <div className="empty-state">
          <h3>Esta categoria ainda não tem obras.</h3>
          <p>Use Adicionar imagens para escolher arquivos da Galeria.</p>
        </div>
      )}
      {categoryId && (
        <p className="muted">
          Remover da categoria mantém a obra pública em Outros trabalhos.
        </p>
      )}
      {editArt && (
        <Dialog
          title={`Editar obra: ${editArt.title}`}
          onClose={() => setEditing(null)}
        >
          {renderFields(editArt)}
          <div className="form-actions">
            <button
              className="button primary small"
              onClick={() => setEditing(null)}
            >
              Concluir edição
            </button>
          </div>
        </Dialog>
      )}
      {picker && (
        <Dialog
          title={`Adicionar imagens — ${categoryName}`}
          onClose={() => setPicker(false)}
        >
          <label>
            Buscar por título
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <p className="muted">
            Selecione imagens da biblioteca. Obras de outra categoria serão
            movidas apenas pelo botão Mover selecionadas.
          </p>
          <div className="portfolio-picker-grid">
            {available
              .filter((item) =>
                item.title
                  .toLocaleLowerCase("pt-BR")
                  .includes(search.toLocaleLowerCase("pt-BR")),
              )
              .map((item) => {
                const art = cfg.gallery.find((work) => work.id === item.id);
                const present = !!art && categoryOf(art) === categoryId;
                const origin = art
                  ? cfg.categories.find(
                      (category) => category.id === art.categoryId,
                    )?.name || "Outros trabalhos"
                  : "Disponível na biblioteca";
                return (
                  <label
                    key={item.id}
                    className={`portfolio-picker-item${present ? " is-present" : ""}`}
                  >
                    <img
                      src={`/api/admin/media/${item.id}?size=thumbnail`}
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      <input
                        type="checkbox"
                        disabled={present}
                        checked={present || selection.includes(item.id)}
                        onChange={(event) =>
                          setSelection(
                            event.target.checked
                              ? [...selection, item.id]
                              : selection.filter((id) => id !== item.id),
                          )
                        }
                      />
                      {item.title}
                    </span>
                    <small>
                      {present ? "Já está nesta categoria" : origin}
                    </small>
                  </label>
                );
              })}
          </div>
          {!available.length && (
            <p className="muted">Envie imagens na Galeria para começar.</p>
          )}
          {!!available.length &&
            !available.some((item) =>
              item.title
                .toLocaleLowerCase("pt-BR")
                .includes(search.toLocaleLowerCase("pt-BR")),
            ) && <p>Nenhuma imagem encontrada.</p>}
          {tooMany && (
            <p role="alert">
              O portfólio permite até 500 obras. Reduza a seleção.
            </p>
          )}
          <p role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
          <div className="portfolio-picker-actions">
            <button
              className="button primary small"
              disabled={!newSelection.length || tooMany}
              onClick={() => {
                change(addArtwork(cfg, media, newSelection, categoryId));
                setSelection(
                  selection.filter((id) => !newSelection.includes(id)),
                );
                announce(
                  `${newSelection.length} imagens adicionadas a ${categoryName}.`,
                );
              }}
            >
              Adicionar selecionadas ({newSelection.length})
            </button>
            <button
              className="button ghost small"
              disabled={!moveSelection.length}
              onClick={() => {
                change(moveArtwork(cfg, moveSelection, categoryId));
                setSelection(
                  selection.filter((id) => !moveSelection.includes(id)),
                );
                announce(
                  `${moveSelection.length} obras movidas para ${categoryName}.`,
                );
              }}
            >
              Mover selecionadas para esta categoria ({moveSelection.length})
            </button>
            <button
              className="button ghost small"
              onClick={() => setPicker(false)}
            >
              Concluir
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
