// Interactive markdoc-md demo for the markdoc-md overview page: one template, its generated form,
// and the rendered result, updating live. It plays a short fill-in sequence when it scrolls into
// view; any interaction stops the sequence and hands control to the reader.
//
// The output mirrors what DynamicMarkdocRenderer produces for the template shown in the
// "Vorlage" panel (checked against the package), so keep both in sync when changing either.

export const LiveTemplate = () => {
  const COLORS = {
    calc: "#cb4b16",
    condition: "#859900",
    info: "#268bd2",
    switch: "#859900",
  };
  const BORDER = "rgba(147, 161, 161, 0.55)";
  const EMPTY = {
    Alter: "",
    Diabetes: false,
    Hypertonie: false,
    Klassifikation: "",
    Strategie: "",
  };
  const STRATEGIES = { Frequenz: "Frequenzkontrolle", Rhythmus: "Rhythmuskontrolle" };
  // Each step sets one input, like a person filling the form.
  const SCRIPT = [
    {
      field: "Klassifikation",
      value: "persistierend",
      note: "info: Der eingetragene Text erscheint im Ergebnis.",
    },
    {
      field: "Alter",
      value: "68",
      note: "Alter ≥ 65 zählt 1 Punkt. Der Score rechnet sofort neu.",
    },
    {
      field: "Hypertonie",
      value: true,
      note: "Checkbox an: andere Formulierung, +1 Punkt, Antikoagulation „empfohlen“.",
    },
    { field: "Diabetes", value: true, note: "Noch ein Punkt. Die Bedingung ≥ 2 bleibt erfüllt." },
    {
      field: "Strategie",
      value: "Frequenz",
      note: "switch: Die Auswahl setzt eine feste Formulierung ein.",
    },
    {
      field: "Alter",
      value: "79",
      note: "Alter ≥ 75 zählt doppelt. Eine Eingabe geändert, alles bleibt stimmig.",
    },
    {
      field: "Alter",
      value: "",
      note: "Alter fehlt: Der Score zeigt „…“ statt einer falschen Zahl.",
    },
  ];

  const [values, setValues] = useState(EMPTY);
  const [active, setActive] = useState(null);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [flash, setFlash] = useState({});
  const rootRef = useRef(null);
  const startedRef = useRef(false);

  const age =
    values.Alter === "" || Number.isNaN(Number(values.Alter)) ? null : Number(values.Alter);
  const parts = [
    { label: "Hypertonie", points: values.Hypertonie ? 1 : 0 },
    { label: "Diabetes", points: values.Diabetes ? 1 : 0 },
    { label: "Alter ≥ 65", points: age === null ? null : age >= 65 ? 1 : 0 },
    { label: "Alter ≥ 75", points: age === null ? null : age >= 75 ? 1 : 0 },
  ];
  const score = age === null ? null : parts.reduce((sum, part) => sum + part.points, 0);
  const anticoagulation =
    score !== null && score >= 2
      ? "empfohlen"
      : score !== null && score >= 1
        ? "erwägen"
        : "nicht empfohlen";

  // Flash every rendered value whose text changed, so the reader sees what one input affects.
  const outputs = {
    Alter: values.Alter,
    Antikoagulation: anticoagulation,
    Diabetes: String(values.Diabetes),
    Hypertonie: String(values.Hypertonie),
    Klassifikation: values.Klassifikation,
    Score: score === null ? "…" : String(score),
    Strategie: values.Strategie,
  };
  const outputKey = JSON.stringify(outputs);
  const previous = useRef(outputs);
  useEffect(() => {
    const changed = {};
    for (const key of Object.keys(outputs)) {
      if (previous.current[key] !== outputs[key]) changed[key] = Date.now();
    }
    previous.current = outputs;
    if (Object.keys(changed).length > 0) setFlash((current) => ({ ...current, ...changed }));
  }, [outputKey]);

  // Start the sequence once, the first time the demo is mostly visible.
  useEffect(() => {
    const node = rootRef.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!node || typeof IntersectionObserver === "undefined" || reduced) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !startedRef.current) {
          startedRef.current = true;
          setPlaying(true);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(
      () => {
        const next = step + 1;
        if (next >= SCRIPT.length) {
          setValues(EMPTY);
          setActive(null);
          setStep(-1);
          return;
        }
        const { field, value } = SCRIPT[next];
        setValues((current) => ({ ...current, [field]: value }));
        setActive(field);
        setStep(next);
      },
      step === -1 ? 1200 : 2800,
    );
    return () => clearTimeout(timer);
  }, [playing, step]);

  const stop = () => {
    setPlaying(false);
    setStep(-1);
  };
  const update = (field, value) => {
    stop();
    setValues((current) => ({ ...current, [field]: value }));
    setActive(field);
  };
  const replay = () => {
    setValues(EMPTY);
    setActive(null);
    setStep(-1);
    setPlaying(true);
  };

  // Which parts of the template each input feeds, for highlighting.
  const FEEDS = {
    Alter: ["Alter", "calc", "condition"],
    Diabetes: ["Diabetes", "calc", "condition"],
    Hypertonie: ["Hypertonie", "calc", "condition"],
    Klassifikation: ["Klassifikation"],
    Strategie: ["Strategie"],
  };
  const lit = (id) => active !== null && FEEDS[active]?.includes(id);

  const tag = (id, kind, text) => (
    <span
      style={{
        backgroundColor: lit(id) ? `${COLORS[kind]}30` : "transparent",
        borderRadius: "0.25rem",
        boxShadow: lit(id) ? `0 0 0 1px ${COLORS[kind]}` : "none",
        color: COLORS[kind],
        transition: "background-color 250ms, box-shadow 250ms",
      }}
    >
      {text}
    </span>
  );

  const badge = (key, kind, text) => (
    <span
      className={flash[key] ? "mdscribe-flash" : undefined}
      key={`${key}-${flash[key] ?? 0}`}
      style={{
        backgroundColor: COLORS[kind],
        borderRadius: "0.375rem",
        color: "#fff",
        display: "inline-block",
        lineHeight: 1.45,
        minWidth: "1.5rem",
        opacity: text ? 0.9 : 0.3,
        padding: "0 0.3rem",
      }}
    >
      {text || "\u00a0"}
    </span>
  );

  const panel = (title, children) => (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: "0.75rem",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${BORDER}`,
          fontSize: "0.68rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          opacity: 0.7,
          padding: "0.35rem 0.8rem",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "0.7rem 0.85rem" }}>{children}</div>
    </div>
  );

  const fieldRow = (field, kind, label, control) => (
    <label
      key={field}
      style={{
        alignItems: "center",
        backgroundColor: active === field ? `${COLORS[kind]}22` : "transparent",
        borderRadius: "0.45rem",
        display: "grid",
        fontSize: "0.84rem",
        gap: "0.5rem",
        gridTemplateColumns: "auto 1fr auto",
        padding: "0.32rem 0.45rem",
        transition: "background-color 250ms",
      }}
    >
      <code
        style={{
          color: COLORS[kind],
          fontSize: "0.68rem",
          minWidth: "3.4rem",
          whiteSpace: "nowrap",
        }}
      >
        {kind}
      </code>
      <span>{label}</span>
      {control}
    </label>
  );

  const inputStyle = {
    background: "transparent",
    border: `1px solid ${BORDER}`,
    borderRadius: "0.35rem",
    color: "inherit",
    fontSize: "0.82rem",
    padding: "0.1rem 0.35rem",
  };

  const checkbox = (field) => (
    <input
      checked={values[field]}
      onChange={(event) => update(field, event.target.checked)}
      style={{ accentColor: COLORS.switch, height: "1rem", width: "1rem" }}
      type="checkbox"
    />
  );

  return (
    <figure className="not-prose" ref={rootRef} style={{ margin: "1.25rem 0 1.75rem" }}>
      {panel(
        "1 · Vorlage: einmal geschrieben",
        <pre
          style={{
            background: "transparent",
            fontSize: "0.72rem",
            lineHeight: 1.65,
            margin: 0,
            overflowWrap: "anywhere",
            padding: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {"**Vorhofflimmern**\n- **Klassifikation:** "}
          {tag("Klassifikation", "info", '{% info "Klassifikation" /%}')}
          {"\n- **Risikoprofil:** "}
          {tag("Alter", "info", '{% info "Alter" type="number" unit="Jahre" renderUnit=true /%}')}
          {", "}
          {tag(
            "Hypertonie",
            "switch",
            '{% switch "Hypertonie" type="checkbox" %}{% case "true" %}arterielle Hypertonie{% /case %}{% case "false" %}keine Hypertonie{% /case %}{% /switch %}',
          )}
          {", "}
          {tag(
            "Diabetes",
            "switch",
            '{% switch "Diabetes" type="checkbox" %}{% case "true" %}Diabetes mellitus{% /case %}{% case "false" %}kein Diabetes{% /case %}{% /switch %}',
          )}
          {"\n- **CHA₂DS₂-VA:** "}
          {tag(
            "calc",
            "calc",
            '{% calc "CHA2DS2_VA" formula="[Hypertonie] + [Diabetes] + ([Alter] >= 65) + ([Alter] >= 75)" unit="Punkte" renderUnit=true %}{% /calc %}',
          )}
          {"\n- **Antikoagulation:** "}
          {tag(
            "condition",
            "condition",
            '{% condition "CHA2DS2_VA" %}{% case gte=2 %}empfohlen{% /case %}{% case gte=1 %}erwägen{% /case %}{% case default=true %}nicht empfohlen{% /case %}{% /condition %}',
          )}
          {"\n- **Strategie:** "}
          {tag(
            "Strategie",
            "switch",
            '{% switch "Strategie" %}{% case "Frequenz" %}Frequenzkontrolle{% /case %}{% case "Rhythmus" %}Rhythmuskontrolle{% /case %}{% /switch %}',
          )}
        </pre>,
      )}

      <div
        aria-hidden="true"
        style={{ fontSize: "0.75rem", opacity: 0.65, padding: "0.35rem 0", textAlign: "center" }}
      >
        ↓ markdoc-md erkennt die Eingaben und rendert den Text ↓
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
        }}
      >
        {panel(
          "2 · Eingaben: automatisch erzeugt",
          <div style={{ display: "grid", gap: "0.1rem" }}>
            {fieldRow(
              "Klassifikation",
              "info",
              "Klassifikation",
              <input
                onChange={(event) => update("Klassifikation", event.target.value)}
                placeholder="Text"
                style={{ ...inputStyle, width: "8.5rem" }}
                value={values.Klassifikation}
              />,
            )}
            {fieldRow(
              "Alter",
              "info",
              "Alter (Jahre)",
              <input
                max={110}
                min={0}
                onChange={(event) => update("Alter", event.target.value)}
                placeholder="Zahl"
                style={{ ...inputStyle, width: "4.5rem" }}
                type="number"
                value={values.Alter}
              />,
            )}
            {fieldRow("Hypertonie", "switch", "Hypertonie", checkbox("Hypertonie"))}
            {fieldRow("Diabetes", "switch", "Diabetes", checkbox("Diabetes"))}
            {fieldRow(
              "Strategie",
              "switch",
              "Strategie",
              <select
                onChange={(event) => update("Strategie", event.target.value)}
                style={{ ...inputStyle, width: "8.5rem" }}
                value={values.Strategie}
              >
                <option value="">–</option>
                <option value="Frequenz">Frequenz</option>
                <option value="Rhythmus">Rhythmus</option>
              </select>,
            )}
          </div>,
        )}

        {panel(
          "3 · Ergebnis: immer stimmig",
          <div style={{ fontSize: "0.88rem", lineHeight: 1.95 }}>
            <div style={{ fontWeight: 600 }}>Vorhofflimmern</div>
            <ul style={{ listStyle: "disc", margin: 0, paddingLeft: "1.2rem" }}>
              <li>
                <strong>Klassifikation:</strong>{" "}
                {badge("Klassifikation", "info", values.Klassifikation)}
              </li>
              <li>
                <strong>Risikoprofil:</strong>{" "}
                {badge("Alter", "info", age === null ? "" : `${age} Jahre`)},{" "}
                {badge(
                  "Hypertonie",
                  "switch",
                  values.Hypertonie ? "arterielle Hypertonie" : "keine Hypertonie",
                )}
                ,{" "}
                {badge(
                  "Diabetes",
                  "switch",
                  values.Diabetes ? "Diabetes mellitus" : "kein Diabetes",
                )}
              </li>
              <li>
                <strong>CHA₂DS₂-VA:</strong>{" "}
                {badge("Score", "calc", `${score === null ? "…" : score} Punkte`)}
              </li>
              <li>
                <strong>Antikoagulation:</strong>{" "}
                {badge("Antikoagulation", "condition", anticoagulation)}
              </li>
              <li>
                <strong>Strategie:</strong>{" "}
                {badge("Strategie", "switch", STRATEGIES[values.Strategie] ?? "")}
              </li>
            </ul>
            <div
              style={{
                borderTop: `1px dashed ${BORDER}`,
                fontSize: "0.72rem",
                lineHeight: 1.55,
                marginTop: "0.5rem",
                opacity: 0.85,
                paddingTop: "0.4rem",
              }}
            >
              <span style={{ color: COLORS.calc, fontWeight: 600 }}>calc: </span>
              {parts.map((part, index) => (
                <span key={part.label}>
                  {index > 0 ? " + " : ""}
                  {part.points === null ? "?" : part.points}
                  <span style={{ opacity: 0.7 }}> ({part.label})</span>
                </span>
              ))}
              {" = "}
              <strong>{score === null ? "…" : score}</strong>
            </div>
          </div>,
        )}
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          fontSize: "0.8rem",
          gap: "0.5rem 0.75rem",
          justifyContent: "space-between",
          marginTop: "0.6rem",
        }}
      >
        <span aria-live="polite" style={{ flex: "1 1 18rem", minHeight: "1.2rem", opacity: 0.85 }}>
          {playing && step >= 0
            ? `Schritt ${step + 1}/${SCRIPT.length} · ${SCRIPT[step].note}`
            : playing
              ? "Leere Vorlage: noch nichts eingetragen."
              : "Ihr Zug: Ändern Sie eine Eingabe und beobachten Sie, was sich im Ergebnis mitändert."}
        </span>
        <button
          onClick={playing ? stop : replay}
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: "999px",
            cursor: "pointer",
            fontSize: "0.78rem",
            padding: "0.2rem 0.8rem",
          }}
          type="button"
        >
          {playing ? "⏸ Selbst ausprobieren" : "▶ Demo abspielen"}
        </button>
      </div>
    </figure>
  );
};
