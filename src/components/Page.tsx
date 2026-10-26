import { ReactNode } from "react";
import { Stack } from "@mantine/core";

/**
 * The outer frame of every page: the same padding and spacing everywhere, and a maximum width so
 * lines and tables stay readable on very wide screens.
 */
export default function Page({ children }: { children: ReactNode }) {
  return (
    <Stack p={{ base: "md", sm: 32 }} gap="lg" maw={1680} mx="auto" w="100%">
      {children}
    </Stack>
  );
}
