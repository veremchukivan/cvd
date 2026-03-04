import { useQuery } from '@tanstack/react-query';
import { fetchCountryDetails } from '../api/map';
import { CountryDetailsQuery, CountryDetailsResponse } from '../types/map';

export function useCountryDetails(query: CountryDetailsQuery | null) {
  return useQuery<CountryDetailsResponse>({
    queryKey: ['country-details', query],
    queryFn: () => {
      if (!query) throw new Error('Country query missing');
      return fetchCountryDetails(query);
    },
    enabled: Boolean(query?.iso3),
    staleTime: 5 * 60 * 1000,
  });
}
