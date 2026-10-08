import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Config } from "./domain";

export default function FeaturedCarousel({
  artworks,
  mediaBase,
  onOpen,
  label,
  paused = false,
}: {
  artworks: Config["gallery"];
  mediaBase: string;
  onOpen: (id: string) => void;
  label: string;
  paused?: boolean;
}) {
  const multiple = artworks.length > 1;
  const [position, setPosition] = useState(multiple ? 1 : 0);
  const [animate, setAnimate] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const moving = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const touch = useRef<{ x: number; y: number } | null>(null);
  const slides = multiple
    ? [artworks[artworks.length - 1], ...artworks, artworks[0]]
    : artworks;
  const index = multiple
    ? (position - 1 + artworks.length) % artworks.length
    : 0;
  const playing =
    multiple &&
    !userPaused &&
    !hovered &&
    !focused &&
    !hidden &&
    !reduced &&
    !paused;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(settleTimer.current);
    };
  }, []);

  const finish = useCallback(
    (next: number) => {
      clearTimeout(settleTimer.current);
      if (next === 0 || next === artworks.length + 1) {
        setAnimate(false);
        setPosition(next === 0 ? artworks.length : 1);
      }
      moving.current = false;
    },
    [artworks.length],
  );
  const go = useCallback(
    (next: number) => {
      if (!multiple || moving.current) return;
      if (reduced) {
        setAnimate(false);
        setPosition(((next - 1 + artworks.length) % artworks.length) + 1);
        return;
      }
      moving.current = true;
      setAnimate(true);
      setPosition(next);
      // A hidden tab or interrupted CSS transition can skip transitionend.
      settleTimer.current = setTimeout(() => finish(next), 600);
    },
    [multiple, reduced, artworks.length, finish],
  );
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => go(position + 1), 5000);
    return () => clearInterval(timer);
  }, [playing, position, go]);

  return (
    <div
      className="featured-carousel"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Artes em destaque"
      tabIndex={multiple ? 0 : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (!multiple || !["ArrowLeft", "ArrowRight"].includes(event.key))
          return;
        event.preventDefault();
        go(position + (event.key === "ArrowLeft" ? -1 : 1));
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
          go(position + (dx < 0 ? 1 : -1));
        }
      }}
    >
      <div className="featured-stage">
        <div
          className={`featured-track ${animate && !reduced ? "is-sliding" : ""}`}
          style={{ transform: `translateX(-${position * 100}%)` }}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "transform"
            )
              finish(position);
          }}
        >
          {slides.map((art, slide) => (
            <div
              key={`${art.id}-${slide}`}
              className="featured-slide"
              aria-hidden={slide !== position}
              inert={slide !== position}
            >
              <button
                type="button"
                className="featured-image"
                aria-label={`Ampliar ${art.title}`}
                onClick={() => onOpen(art.id)}
                tabIndex={slide === position ? 0 : -1}
              >
                <img
                  src={`${mediaBase}/${art.id}`}
                  alt={art.alt}
                  fetchPriority={slide === (multiple ? 1 : 0) ? "high" : "auto"}
                />
              </button>
              <div className="featured-caption">
                {label && <span className="featured-label">{label}</span>}
                <strong>{art.title}</strong>
                {art.description && <p>{art.description}</p>}
              </div>
            </div>
          ))}
        </div>
        {multiple && (
          <div className="featured-arrows">
            <button
              type="button"
              className="icon-button"
              aria-label="Arte em destaque anterior"
              onClick={() => go(position - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Próxima arte em destaque"
              onClick={() => go(position + 1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        )}
      </div>
      <div className="featured-controls">
        <div
          className="featured-thumbnails"
          aria-label="Escolher arte em destaque"
        >
          {artworks.map((art, item) => (
            <button
              type="button"
              key={art.id}
              aria-label={`Mostrar ${art.title}`}
              aria-pressed={index === item}
              onClick={() => go(item + 1)}
            >
              <img
                src={`${mediaBase}/${art.id}?size=thumbnail`}
                alt=""
                loading="lazy"
              />
            </button>
          ))}
        </div>
        <div
          className="featured-position"
          aria-live={playing ? "off" : "polite"}
          aria-atomic="true"
        >
          {multiple && !reduced && (
            <button
              type="button"
              className="icon-button"
              aria-label={
                userPaused ? "Reproduzir carrossel" : "Pausar carrossel"
              }
              onClick={() => setUserPaused((current) => !current)}
            >
              {userPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          <span className="featured-dots" aria-hidden="true">
            {artworks.map((art, item) => (
              <i key={art.id} className={index === item ? "active" : ""} />
            ))}
          </span>
          <span>
            {index + 1} / {artworks.length}
          </span>
        </div>
      </div>
    </div>
  );
}
