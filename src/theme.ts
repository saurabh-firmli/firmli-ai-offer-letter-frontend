import { MantineColorsTuple, createTheme } from "@mantine/core";

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
];

const fontFamily =
  "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const theme = createTheme({
  primaryColor: "primary",
  colors: { primary },
  fontFamily,
  headings: { fontFamily },
  defaultRadius: "md",
});
