import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only a 429 (Too Many Requests) is worth retrying, with react-query's backoff.
      retry: (failureCount, error) =>
        isAxiosError(error) && error.response?.status === 429 && failureCount < 3,
      refetchOnWindowFocus: false,
    },
  },
});
