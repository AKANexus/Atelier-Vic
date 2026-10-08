import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Config } from "./domain";

export default function FeaturedCarousel({
  artworks,
  mediaBase,
  onOpen,
}: {
  artworks: Config["gallery"];
  mediaBase: string;
  onOpen: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const art = artworks[index];
  const multiple = artworks.length > 1;
  const move = (direction: number) =>
    setIndex(
      (current) => (current + direction + artworks.length) % artworks.length,
    );

  return (
    <div
      className="featured-carousel"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Artes em destaque"
      tabIndex={multiple ? 0 : undefined}
      onKeyDown={(event) => {
        if (!multiple || !["ArrowLeft", "ArrowRight"].includes(event.key))
          return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}
      onTouchStart={(event) => {
        const point = event.touches[0];
        touch.current = { x: point.clientX, y: point.clientY };
      }}
      onTouchCancel={() => {
        touch.current = null;
      }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start || !multiple) return;
        const point = event.changedTouches[0];
        const dx = point.clientX - start.x;
        const dy = point.clientY - start.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
          event.preventDefault();
          move(dx < 0 ? 1 : -1);
        }
      }}
    >
      <span className="featured-label">SELEÇÃO DO ARTISTA</span>
      <button
        type="button"
        className="featured-image"
        aria-label={`Ampliar ${art.title}`}
        onClick={() => onOpen(art.id)}
      >
        <img
          src={`${mediaBase}/${art.id}`}
          alt={art.alt}
          fetchPriority="high"
        />
      </button>
      <div className="featured-caption" aria-live="polite" aria-atomic="true">
        <strong>{art.title}</strong>
        <span>
          {index + 1} / {artworks.length}
        </span>
      </div>
      {multiple && (
        <div className="featured-controls">
          <button
            type="button"
            className="icon-button"
            aria-label="Arte em destaque anterior"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={19} />
          </button>
          <div className="featured-dots" aria-label="Escolher arte em destaque">
            {artworks.map((item, position) => (
              <button
                type="button"
                key={item.id}
                aria-label={`Mostrar ${item.title}`}
                aria-pressed={position === index}
                onClick={() => setIndex(position)}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Próxima arte em destaque"
            onClick={() => move(1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      )}
    </div>
  );
}
