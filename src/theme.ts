import {
  Badge,
  Button,
  CSSVariablesResolver,
  Input,
  InputProps,
  MantineColorsTuple,
  Paper,
  Table,
  Title,
  VariantColorsResolver,
  createTheme,
  defaultVariantColorsResolver,
  rem,
} from "@mantine/core";

/**
 * Firmli palette, same values as the Firmli app. This file is the only place with color values:
 * components use Mantine colors (color="primary", "red", ...) or the --firmli-* CSS variables below.
 */

// Brand blue, main shade 6 (#1A73E8), hover / dark shade 7.
const primary: MantineColorsTuple = [
  "#F1F7FE",
  "#E8F1FD",
  "#D1E3FA",
  "#A2C6F6",
  "#74AAF1",
  "#468EEC",
  "#1A73E8",
  "#135BB9",
  "#0E448B",
  "#092D5D",
  "#05172E",
  "#020B17",
];

export const tokens = {
  headerBg: "#0E1D3E", // dark navy: sidebar, login brand panel
  pageBg: "#FFFFFF",
  textTableHeader: "#6B7280", // small caps column titles
  textHeading: "#374151",
  border: "#D2D2D2", // default (inputs, secondary buttons)
  borderLight: "#E5E7EB", // cards, tables
  borderLighter: "#F2F2F2", // tertiary buttons
  divider: "#DADCE0",
  surfaceTableHeader: "#F9FAFB",
  surfaceMuted: "#F8F9FA", // light grey background, table row hover
  surfaceSelected: "#F0F9FF", // selected row
  surfaceHover: "#FCFCFC", // secondary button hover
};

type TToken = keyof typeof tokens;

// headerBg -> --firmli-header-bg
const toVarName = (token: string) => `--firmli-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** A token as a CSS value, e.g. cssVar("divider") -> "var(--firmli-divider)". */
export const cssVar = (token: TToken) => `var(${toVarName(token)})`;

/**
 * Puts every token on :root as a CSS variable for the CSS modules:
 * --firmli-header-bg, --firmli-page-bg, --firmli-text-table-header, --firmli-text-heading,
 * --firmli-border, --firmli-border-light, --firmli-border-lighter, --firmli-divider,
 * --firmli-surface-table-header, --firmli-surface-muted, --firmli-surface-selected, --firmli-surface-hover
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: Object.fromEntries(Object.entries(tokens).map(([token, value]) => [toVarName(token), value])),
  light: {},
  dark: {},
});

// Button variants of the Firmli app: primary (default), secondary, tertiary, danger.
const variantColorResolver: VariantColorsResolver = (input) => {
  const white = "var(--mantine-color-white)";
  const black = "var(--mantine-color-black)";

  switch (input.variant) {
    case "primary":
      return {
        background: "var(--mantine-color-primary-6)",
        hover: "var(--mantine-color-primary-7)",
        color: white,
        border: `${rem(1)} solid transparent`,
      };
    case "secondary":
      return {
        background: white,
        hover: cssVar("surfaceHover"),
        color: black,
        border: `${rem(1)} solid ${cssVar("border")}`,
      };
    case "tertiary":
      return {
        background: white,
        hover: "var(--mantine-color-primary-6)",
        hoverColor: white,
        color: black,
        border: `${rem(1)} solid ${cssVar("borderLighter")}`,
      };
    case "danger":
      return {
        background: "var(--mantine-color-red-9)",
        hover: "var(--mantine-color-red-8)",
        color: white,
        border: `${rem(1)} solid transparent`,
      };
    default:
      return defaultVariantColorsResolver(input);
  }
};

/**
 * Browser suggestions (Chrome's saved addresses, earlier entries) must never pop up over our inputs.
 * Only the login page opts back in (autoComplete="email" / "current-password"). Two parts:
 * - "off" on every input stops Chrome's list of earlier entries.
 * - Chrome's address autofill ignores "off" on fields labelled like an address (Country, State,
 *   City), so searchable dropdowns use components/SearchableSelect: a button, not a text field.
 *   Never use <Select searchable> for that reason.
 */
const NO_AUTOFILL = "off";

const fontFamily = '"Public Sans", sans-serif';

export const theme = createTheme({
  primaryColor: "primary",
  primaryShade: 6,
  colors: { primary },
  variantColorResolver,
  fontFamily,
  headings: { fontFamily },
  defaultRadius: "md", // 8px: buttons and inputs

  components: {
    Button: Button.extend({
      defaultProps: { variant: "primary", radius: "md" },
      vars: () => ({ root: { "--button-fz": rem(14) } }),
      styles: { root: { fontWeight: 500 } },
    }),
    Title: Title.extend({
      defaultProps: { c: cssVar("textHeading") },
    }),
    // Applies to every input (TextInput, Select, Textarea, date pickers...). Filled inputs keep no
    // border, and an input with an error keeps Mantine's red one (this inline value would hide it).
    Input: Input.extend({
      // InputProps leave out native <input> attributes, which Input passes on to the element.
      defaultProps: { autoComplete: NO_AUTOFILL } as Partial<InputProps & React.ComponentProps<"input">>,
      styles: (_theme, props) =>
        props.variant === "filled" || props.error
          ? {}
          : { input: { "--input-bd": cssVar("border") } as React.CSSProperties },
    }),
    // Autocomplete / Select / MultiSelect inputs get their autoComplete through these.
    ComboboxTarget: { defaultProps: { autoComplete: NO_AUTOFILL } },
    ComboboxEventsTarget: { defaultProps: { autoComplete: NO_AUTOFILL } },
    PasswordInput: { defaultProps: { autoComplete: NO_AUTOFILL } },
    // Also used by Card.
    Paper: Paper.extend({
      styles: { root: { "--paper-border-color": cssVar("borderLight") } as React.CSSProperties },
    }),
    // A badge shows its whole label (in a narrow table cell it would otherwise end in "…"), in
    // normal case: all-caps labels ("CONDITIONAL OFFER") read as shouting in tables full of them.
    Badge: Badge.extend({
      styles: {
        root: { maxWidth: "none", flexShrink: 0, textTransform: "none", fontWeight: 600, letterSpacing: 0 },
        label: { overflow: "visible" },
      },
    }),
    Table: Table.extend({
      vars: () => ({
        table: {
          "--table-border-color": cssVar("borderLight"),
          "--table-highlight-on-hover-color": cssVar("surfaceMuted"),
        },
      }),
      styles: {
        // Column titles as small grey caps on a near-white band: quiet, so the rows carry the page.
        th: {
          color: cssVar("textTableHeader"),
          backgroundColor: cssVar("surfaceTableHeader"),
          fontSize: rem(12),
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        },
      },
    }),
  },
});
