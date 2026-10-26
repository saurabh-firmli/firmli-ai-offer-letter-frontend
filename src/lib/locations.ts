import { useQuery } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse } from "../types";

// Countries / states / cities: master data shared by all tenants. It doesn't change while the
// app runs, so each list is fetched once (staleTime: Infinity).

export interface ICountry {
  id: number;
  name: string;
  iso2: string;
  phoneCode: string | null;
  currencyCode: string | null;
}

export interface IState {
  id: number;
  name: string;
  code: string;
}

export interface ICity {
  id: number;
  name: string;
}

const getList = async <T>(path: string, params?: Record<string, number | null>) => {
  const { data } = await api.get<IApiResponse<T[]>>(path, { params });
  return data.data;
};

/** All countries; pass enabled = false until the dropdown is actually shown (e.g. a closed modal). */
export const useCountries = (enabled = true) =>
  useQuery({
    queryKey: ["countries"],
    queryFn: () => getList<ICountry>("/locations/countries"),
    enabled,
    staleTime: Infinity,
  });

/** States of one country; waits until a country is picked. */
export const useStates = (countryId: number | null) =>
  useQuery({
    queryKey: ["states", countryId],
    queryFn: () => getList<IState>("/locations/states", { countryId }),
    enabled: Boolean(countryId),
    staleTime: Infinity,
  });

/** Cities of one state; waits until a state is picked. */
export const useCities = (stateId: number | null) =>
  useQuery({
    queryKey: ["cities", stateId],
    queryFn: () => getList<ICity>("/locations/cities", { stateId }),
    enabled: Boolean(stateId),
    staleTime: Infinity,
  });
