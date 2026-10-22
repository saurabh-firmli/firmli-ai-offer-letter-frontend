import { useQuery } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse, IHealthStatus } from "../types";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<IHealthStatus>>("/health");
      return data.data;
    },
    refetchInterval: 30_000,
  });
}
