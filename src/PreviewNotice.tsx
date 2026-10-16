import { useLayoutEffect, useRef } from "react";

export default function PreviewNotice({
  visible = import.meta.env.VITE_PREVIEW === "true",
}: {
  visible?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!visible || !ref.current) return;
    const root = document.documentElement;
    root.classList.add("preview-build");
    const measure = () =>
      root.style.setProperty(
        "--preview-notice-height",
        `${ref.current!.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      root.classList.remove("preview-build");
      root.style.removeProperty("--preview-notice-height");
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <aside
      ref={ref}
      className="preview-notice"
      aria-label="Aviso de versão Preview"
      lang="pt-BR"
    >
      <p>
        <strong>Versão Preview</strong> — pode ser alterada a qualquer momento.
      </p>
      <p>Este ambiente utiliza dados reais de produção.</p>
    </aside>
  );
}
