import { useQuery } from '@tanstack/react-query';
import { fetchProvincesSummary } from '../api/map';
import { ProvinceSummaryDatum } from '../types/map';

type UseCountryProvincesInput = {
  iso3?: string | null;
  countryName?: string | null;
  date?: string;
};

function normalizeIso(iso3?: string | null): string | undefined {
  const value = iso3?.trim().toUpperCase();
  return value || undefined;
}

export function useCountryProvinces(input: UseCountryProvincesInput) {
  const iso3 = normalizeIso(input.iso3);
  const countryName = input.countryName?.trim() || undefined;

  return useQuery<ProvinceSummaryDatum[]>({
    queryKey: ['country-provinces', iso3, countryName, input.date],
    queryFn: async () => {
      const response = await fetchProvincesSummary({
        metric: 'cases',
        date: input.date,
        countryIso: iso3,
        country: countryName,
      });

      if (!iso3) {
        return response.data;
      }

      // Fallback filter in case backend does not map every row by countryIso yet.
      return response.data.filter((row) => row.countryIso?.toUpperCase() === iso3);
    },
    enabled: Boolean(iso3 || countryName),
    staleTime: 5 * 60 * 1000,
  });
}
