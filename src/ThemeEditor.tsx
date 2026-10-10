import {
  themePresets,
  publicThemeSchema,
  contrastRatio,
  type PublicTheme,
} from "./theme";

export default function ThemeEditor({
  value,
  onChange,
}: {
  value: PublicTheme;
  onChange: (value: PublicTheme) => void;
}) {
  const validation = publicThemeSchema.safeParse(value);
  return (
    <section className="panel theme-settings">
      <h2>Cores do site</h2>
      <p className="muted">
        Escolha uma paleta ou personalize as cores. O contraste mínimo é 4,5:1
        para manter a leitura confortável.
      </p>
      {["Suaves", "Neon"].map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          <div className="theme-presets">
            {themePresets
              .filter((preset) => preset.group === group)
              .map((preset) => (
                <button
                  type="button"
                  key={preset.preset}
                  aria-pressed={value.preset === preset.preset}
                  onClick={() =>
                    onChange({
                      preset: preset.preset,
                      background: preset.background,
                      text: preset.text,
                      accent: preset.accent,
                    })
                  }
                >
                  <span className="theme-swatches" aria-hidden="true">
                    {[preset.background, preset.text, preset.accent].map(
                      (color) => (
                        <span key={color} style={{ backgroundColor: color }} />
                      ),
                    )}
                  </span>
                  {preset.name}
                </button>
              ))}
          </div>
        </fieldset>
      ))}
      <p className="muted">
        {value.preset === "custom"
          ? "Cores personalizadas. Escolha uma paleta acima para restaurar suas cores."
          : "Alterar uma cor cria uma paleta personalizada."}
      </p>
      <div className="theme-colors">
        {(
          [
            ["background", "Fundo"],
            ["text", "Texto"],
            ["accent", "Destaque"],
          ] as const
        ).map(([field, label]) => {
          const validHex = /^#[\da-f]{6}$/i.test(value[field]);
          const issues = validation.success
            ? []
            : validation.error.issues.filter(
                (issue) => issue.path[0] === field,
              );
          const update = (color: string) =>
            onChange({ ...value, preset: "custom", [field]: color });
          return (
            <div key={field} className="theme-color">
              <label>
                {label}
                <input
                  type="color"
                  aria-label={`Escolher cor: ${label}`}
                  value={validHex ? value[field] : "#000000"}
                  onChange={(event) => update(event.target.value)}
                />
              </label>
              <label>
                Hexadecimal: {label}
                <input
                  type="text"
                  value={value[field]}
                  maxLength={7}
                  spellCheck={false}
                  aria-invalid={issues.length > 0}
                  aria-describedby={`theme-${field}-feedback`}
                  onChange={(event) => update(event.target.value)}
                />
              </label>
              <div id={`theme-${field}-feedback`} aria-live="polite">
                {issues.map((issue) => (
                  <p className="error" key={issue.message}>
                    {issue.message}
                  </p>
                ))}
                {field !== "background" &&
                  validHex &&
                  /^#[\da-f]{6}$/i.test(value.background) && (
                    <small>
                      Contraste com o fundo:{" "}
                      {contrastRatio(value[field], value.background).toFixed(2)}
                      :1
                    </small>
                  )}
              </div>
            </div>
          );
        })}
      </div>
      {!validation.success && (
        <p className="error" role="status">
          Ajuste as cores antes de publicar. A prévia usa Rosa Noturno
          enquanto a combinação estiver inválida.
        </p>
      )}
    </section>
  );
}
