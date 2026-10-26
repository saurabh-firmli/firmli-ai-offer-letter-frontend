import classes from "./Illustrations.module.css";

/*
 * Drawings for the full-screen states (StatusScreen): inline SVG in the theme's colors, so no image
 * files and no extra package. Decorative only, hidden from screen readers (the title says it all).
 */

const SIZE = { width: 280, height: 210, viewBox: "0 0 280 210", "aria-hidden": true } as const;

/** A browser window with an error, its cable pulled out: "something broke, we're on it". */
export function ErrorIllustration() {
  return (
    <svg {...SIZE}>
      <ellipse className={classes.blob} cx="140" cy="105" rx="130" ry="95" />

      <g className={classes.float}>
        {/* The window */}
        <rect className={classes.paper} x="50" y="30" width="180" height="120" rx="12" />
        <path className={classes.bar} d="M51 42a11 11 0 0 1 11-11h156a11 11 0 0 1 11 11v10H51z" />
        <circle className={classes.dotRed} cx="66" cy="42" r="4" />
        <circle className={classes.dotYellow} cx="80" cy="42" r="4" />
        <circle className={classes.dotGreen} cx="94" cy="42" r="4" />
        <rect className={classes.lineStrong} x="68" y="68" width="70" height="8" rx="4" />
        <rect className={classes.line} x="68" y="84" width="110" height="6" rx="3" />
        <rect className={classes.line} x="68" y="96" width="90" height="6" rx="3" />
        <rect className={classes.line} x="68" y="108" width="100" height="6" rx="3" />

        {/* The error badge */}
        <circle className={classes.dangerSoft} cx="196" cy="118" r="26" />
        <circle className={classes.danger} cx="196" cy="118" r="17" />
        <rect className={classes.white} x="194" y="108" width="4" height="12" rx="2" />
        <circle className={classes.white} cx="196" cy="126" r="2.4" />
      </g>

      {/* The pulled cable: plug on the left, socket on the right, sparks between */}
      <path className={classes.cable} d="M20 185c30 0 40-14 70-14h22" />
      <rect className={classes.plug} x="110" y="163" width="22" height="16" rx="4" />
      <rect className={classes.plug} x="132" y="166" width="8" height="3" rx="1.5" />
      <rect className={classes.plug} x="132" y="173" width="8" height="3" rx="1.5" />
      <path className={classes.spark} d="M152 160l6-6M156 171h9M152 182l6 6" />
      <rect className={classes.plug} x="172" y="163" width="16" height="16" rx="4" />
      <path className={classes.cable} d="M188 171h22c30 0 40 14 60 14" />
    </svg>
  );
}

/** A laptop and a server with the link between them cut: "we can't reach the server". */
export function OfflineIllustration() {
  return (
    <svg {...SIZE}>
      <ellipse className={classes.blob} cx="140" cy="105" rx="130" ry="95" />

      {/* The laptop */}
      <rect className={classes.paper} x="28" y="70" width="80" height="54" rx="6" />
      <rect className={classes.bar} x="36" y="78" width="64" height="38" rx="3" />
      <rect className={classes.lineStrong} x="44" y="88" width="34" height="6" rx="3" />
      <rect className={classes.line} x="44" y="100" width="46" height="5" rx="2.5" />
      <path className={classes.paper} d="M18 128h100l-8 10H26z" />

      {/* The server: three stacked units with lights */}
      <g className={classes.float}>
        {[56, 86, 116].map((y) => (
          <g key={y}>
            <rect className={classes.paper} x="180" y={y} width="72" height="26" rx="6" />
            <circle className={classes.dotGreen} cx="194" cy={y + 13} r="3.5" />
            <rect className={classes.line} x="206" y={y + 10} width="34" height="6" rx="3" />
          </g>
        ))}
      </g>

      {/* The link, cut in the middle */}
      <path className={classes.dashed} d="M110 104h28M150 104h28" />
      <circle className={classes.dangerSoft} cx="144" cy="104" r="20" />
      <circle className={classes.danger} cx="144" cy="104" r="13" />
      <path
        className={classes.accentStroke}
        style={{ stroke: "var(--mantine-color-white)" }}
        d="M139 99l10 10M149 99l-10 10"
      />
    </svg>
  );
}

/** A document behind a padlock: "your role can't open this". */
export function LockedIllustration() {
  return (
    <svg {...SIZE}>
      <ellipse className={classes.blob} cx="140" cy="105" rx="130" ry="95" />

      {/* The document */}
      <rect className={classes.paper} x="70" y="34" width="110" height="140" rx="10" />
      <rect className={classes.lineStrong} x="88" y="56" width="56" height="8" rx="4" />
      <rect className={classes.line} x="88" y="74" width="74" height="6" rx="3" />
      <rect className={classes.line} x="88" y="86" width="64" height="6" rx="3" />
      <rect className={classes.line} x="88" y="98" width="70" height="6" rx="3" />

      {/* The padlock */}
      <g className={classes.float}>
        <path
          className={classes.accentStroke}
          style={{ strokeWidth: 8 }}
          d="M178 112v-14a20 20 0 0 1 40 0v14"
        />
        <rect className={classes.accent} x="164" y="110" width="68" height="54" rx="10" />
        <circle className={classes.white} cx="198" cy="132" r="7" />
        <rect className={classes.white} x="195" y="134" width="6" height="14" rx="3" />
      </g>
    </svg>
  );
}

/** A folded map with a dashed route that ends in a question mark: "this page isn't here". */
export function NotFoundIllustration() {
  return (
    <svg {...SIZE}>
      <ellipse className={classes.blob} cx="140" cy="105" rx="130" ry="95" />

      {/* The map, three folded panels */}
      <path className={classes.paper} d="M50 50l60-18 60 18 60-18v128l-60 18-60-18-60 18z" />
      <path className={classes.bar} d="M110 33v127l60 18V51z" />
      <path className={classes.dashed} d="M70 140c20-30 40-10 60-40s50-20 60-10" />
      <circle className={classes.accent} cx="70" cy="140" r="5" />

      {/* The pin, with a question mark */}
      <g className={classes.float}>
        <path
          className={classes.accent}
          d="M200 40c-15 0-26 11-26 25 0 19 26 43 26 43s26-24 26-43c0-14-11-25-26-25z"
        />
        <path
          className={classes.accentStroke}
          style={{ stroke: "var(--mantine-color-white)" }}
          d="M193 59a7 7 0 1 1 10 6c-2 1-3 3-3 5"
        />
        <circle className={classes.white} cx="200" cy="77" r="2.4" />
      </g>
    </svg>
  );
}

/** A rocket taking off: "a new version is out". */
export function UpdateIllustration() {
  return (
    <svg {...SIZE}>
      <ellipse className={classes.blob} cx="140" cy="105" rx="130" ry="95" />
      <path className={classes.dashed} d="M60 170c30-10 50-30 64-58" />

      <g className={classes.float}>
        {/* Body, window, fins and flame */}
        <path
          className={classes.paper}
          d="M170 30c-30 10-52 40-56 74l26 26c34-4 64-26 74-56 4-12 6-28 6-48-20 0-38 2-50 4z"
        />
        <circle className={classes.accent} cx="178" cy="76" r="14" />
        <circle className={classes.white} cx="178" cy="76" r="7" />
        <path className={classes.lineStrong} d="M114 104l-22 6 16-26 20-4zM140 130l-6 22 26-16 4-20z" />
        <path className={classes.danger} d="M116 128c-10 4-18 14-20 28 14-2 24-10 28-20z" />
        <path className={classes.spark} d="M210 130l6 6M220 116h8M206 146l2 8" />
      </g>
    </svg>
  );
}
