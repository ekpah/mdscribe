// Shared visual helpers for the template and markdoc-md documentation.
// Badge colors match what the MDScribe renderer draws for each tag
// (Solarized blue, green, and orange from packages/design-system).
//
// Mintlify renders an exported component empty when another exported component in this file
// uses it, so components here share constants, never each other.

const BADGE_COLORS = {
  calc: "#cb4b16",
  condition: "#859900",
  info: "#268bd2",
  switch: "#859900",
};

const MUTED_BORDER = "rgba(147, 161, 161, 0.55)";

/** One rendered tag value, drawn like the badge in the MDScribe document view. */
export const Value = ({ kind = "info", title, children }) => (
  <span
    style={{
      backgroundColor: BADGE_COLORS[kind] ?? BADGE_COLORS.info,
      borderRadius: "0.375rem",
      boxDecorationBreak: "clone",
      color: "#fff",
      opacity: 0.9,
      padding: "0 0.25rem",
      WebkitBoxDecorationBreak: "clone",
    }}
    title={title}
  >
    {children}
  </span>
);

/** A framed preview of what a template renders to. */
export const Rendered = ({ title = "Ergebnis", children }) => (
  <div
    className="not-prose mdscribe-rendered"
    style={{
      border: `1px solid ${MUTED_BORDER}`,
      borderRadius: "0.75rem",
      margin: "0.75rem 0 1.5rem",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        borderBottom: `1px solid ${MUTED_BORDER}`,
        fontSize: "0.7rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        opacity: 0.7,
        padding: "0.35rem 0.9rem",
        textTransform: "uppercase",
      }}
    >
      {title}
    </div>
    <div style={{ fontSize: "0.95rem", lineHeight: 1.75, padding: "0.75rem 1rem" }}>{children}</div>
  </div>
);

/** Explains the badge colors. Pass `labels` to translate the captions. */
export const TagLegend = ({ labels = {} }) => {
  const items = [
    ["info", labels.info ?? "info: eingetragener Wert"],
    ["switch", labels.switch ?? "switch / condition: gewählter Text"],
    ["calc", labels.calc ?? "calc: berechnetes Ergebnis"],
  ];
  return (
    <div
      className="not-prose"
      style={{
        display: "flex",
        flexWrap: "wrap",
        fontSize: "0.85rem",
        gap: "0.5rem 1.25rem",
        margin: "0.5rem 0 1rem",
      }}
    >
      {items.map(([kind, label]) => (
        <span key={kind} style={{ alignItems: "center", display: "inline-flex", gap: "0.4rem" }}>
          <span
            style={{
              backgroundColor: BADGE_COLORS[kind],
              borderRadius: "0.25rem",
              display: "inline-block",
              height: "0.9rem",
              opacity: 0.9,
              width: "1.4rem",
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
};

/**
 * A numbered sequence of labeled boxes that wraps on narrow screens.
 * `steps` is a list of { title, text, tone } where tone is one of the badge kinds or "neutral".
 */
export const Flow = ({ steps = [], caption }) => (
  <figure className="not-prose" style={{ margin: "1rem 0 1.5rem" }}>
    <ol
      style={{
        display: "grid",
        gap: "0.5rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))",
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {steps.map((step, index) => (
        <li
          key={step.title}
          style={{
            border: `1px solid ${MUTED_BORDER}`,
            borderRadius: "0.6rem",
            borderTop: `4px solid ${BADGE_COLORS[step.tone] ?? MUTED_BORDER}`,
            margin: 0,
            padding: "0.5rem 0.65rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 600, overflowWrap: "anywhere" }}>
            <span style={{ opacity: 0.55 }}>{index + 1}.</span> {step.title}
          </div>
          {step.text ? (
            <div
              style={{
                fontSize: "0.78rem",
                lineHeight: 1.45,
                marginTop: "0.2rem",
                opacity: 0.8,
                overflowWrap: "anywhere",
              }}
            >
              {step.text}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
    {caption ? (
      <figcaption
        style={{ fontSize: "0.78rem", marginTop: "0.5rem", opacity: 0.7, textAlign: "center" }}
      >
        {caption}
      </figcaption>
    ) : null}
  </figure>
);

/** A vertical chain of layers, for data paths such as browser → server → provider. */
export const Stack = ({ layers = [], caption }) => (
  <figure className="not-prose" style={{ margin: "1rem auto 1.5rem", maxWidth: "34rem" }}>
    {layers.map((layer, index) => (
      <div key={layer.title}>
        <div
          style={{
            border: `1px solid ${MUTED_BORDER}`,
            borderLeft: `4px solid ${BADGE_COLORS[layer.tone] ?? MUTED_BORDER}`,
            borderRadius: "0.6rem",
            padding: "0.5rem 0.8rem",
          }}
        >
          <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{layer.title}</div>
          {layer.text ? (
            <div style={{ fontSize: "0.78rem", lineHeight: 1.45, opacity: 0.8 }}>{layer.text}</div>
          ) : null}
        </div>
        {index < layers.length - 1 ? (
          <div
            aria-hidden="true"
            style={{
              fontSize: "0.75rem",
              opacity: 0.65,
              padding: "0.15rem 0",
              textAlign: "center",
            }}
          >
            ↓ {layer.edge ?? ""}
          </div>
        ) : null}
      </div>
    ))}
    {caption ? (
      <figcaption
        style={{ fontSize: "0.78rem", marginTop: "0.5rem", opacity: 0.7, textAlign: "center" }}
      >
        {caption}
      </figcaption>
    ) : null}
  </figure>
);

/** A citation mark in its highlighted state (hover, or while Ctrl/Cmd is held). */
export const Cited = ({ children }) => (
  <mark
    style={{
      backgroundColor: "rgba(38, 139, 210, 0.25)",
      borderRadius: "0.125rem",
      color: "inherit",
      cursor: "pointer",
    }}
  >
    {children}
  </mark>
);

/**
 * How a condition or switch picks its case: tried top to bottom, first match wins.
 * `cases` is a list of { when, renders, fallback } shown as a ladder; `value` labels the input.
 */
export const CaseLadder = ({ value, cases = [], highlight, noMatch = "kein Treffer" }) => (
  <figure className="not-prose" style={{ margin: "1rem 0 1.5rem" }}>
    {value ? (
      <div style={{ fontSize: "0.8rem", marginBottom: "0.4rem", opacity: 0.75 }}>{value}</div>
    ) : null}
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {cases.map((item, index) => {
        const active = index === highlight;
        return (
          <li key={item.when} style={{ margin: 0 }}>
            <div
              style={{
                alignItems: "center",
                border: `1px solid ${active ? BADGE_COLORS.switch : MUTED_BORDER}`,
                borderRadius: "0.6rem",
                display: "grid",
                fontSize: "0.85rem",
                gap: "0.75rem",
                gridTemplateColumns: "minmax(7rem, 2fr) auto minmax(8rem, 3fr)",
                padding: "0.4rem 0.75rem",
              }}
            >
              <code style={{ fontSize: "0.8rem", overflowWrap: "anywhere" }}>{item.when}</code>
              <span aria-hidden="true" style={{ opacity: 0.55 }}>
                →
              </span>
              <span>
                <span
                  style={
                    active
                      ? {
                          backgroundColor: BADGE_COLORS.switch,
                          borderRadius: "0.375rem",
                          color: "#fff",
                          opacity: 0.9,
                          padding: "0 0.25rem",
                        }
                      : { opacity: 0.85 }
                  }
                >
                  {item.renders}
                </span>
              </span>
            </div>
            {index < cases.length - 1 ? (
              <div
                aria-hidden="true"
                style={{ fontSize: "0.72rem", opacity: 0.6, padding: "0.1rem 0 0.1rem 1rem" }}
              >
                ↓ {noMatch}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  </figure>
);

/**
 * A field as the MDScribe template page shows it: tinted, editable inline.
 * kind: info (blue), select (cyan, switch), condition (yellow, dashed), calc (violet).
 */
export const Field = ({ kind = "info", title, children }) => {
  const tones = {
    calc: "237, 43%, 60%",
    condition: "45, 100%, 35%",
    info: "205, 69%, 49%",
    select: "175, 59%, 40%",
  };
  const tone = tones[kind] ?? tones.info;
  return (
    <span
      style={{
        backgroundColor: `hsla(${tone}, 0.1)`,
        borderBottom: `1px ${kind === "condition" ? "dashed" : "solid"} hsla(${tone}, 0.5)`,
        borderRadius: "0.25rem",
        boxDecorationBreak: "clone",
        color: `hsl(${tone})`,
        padding: "0 0.25rem",
        WebkitBoxDecorationBreak: "clone",
      }}
      title={title}
    >
      {children}
    </span>
  );
};

/** Legend for the template page's field colors, captions in German. */
export const FieldLegend = () => {
  const items = [
    ["205, 69%, 49%", "solid", "Info: Eingabefeld"],
    ["175, 59%, 40%", "solid", "Switch: Auswahl"],
    ["45, 100%, 35%", "dashed", "Condition: Zahlenbedingung"],
    ["237, 43%, 60%", "solid", "Calc: Berechnung"],
  ];
  return (
    <div
      className="not-prose"
      style={{
        display: "flex",
        flexWrap: "wrap",
        fontSize: "0.85rem",
        gap: "0.5rem 1.25rem",
        margin: "0.5rem 0 1rem",
      }}
    >
      {items.map(([tone, line, label]) => (
        <span key={label} style={{ alignItems: "center", display: "inline-flex", gap: "0.4rem" }}>
          <span
            style={{
              backgroundColor: `hsla(${tone}, 0.15)`,
              borderBottom: `2px ${line} hsl(${tone})`,
              borderRadius: "0.25rem",
              display: "inline-block",
              height: "0.9rem",
              width: "1.4rem",
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
};
