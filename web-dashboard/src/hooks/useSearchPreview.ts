import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSearchPreview } from '../api/search';

const SEARCH_KEY = (region?: string, keyword?: string) => ['search-preview', region ?? 'all', keyword ?? ''];

export function useSearchPreview(region?: string, keyword?: string) {
  return useQuery({
    queryKey: SEARCH_KEY(region, keyword),
    queryFn: () => fetchSearchPreview(region, keyword),
    enabled: Boolean(region),
  });
}

export function useInvalidateSearchPreview() {
  const queryClient = useQueryClient();
  return (region?: string, keyword?: string) => {
    queryClient.invalidateQueries({ queryKey: SEARCH_KEY(region, keyword) }).catch(() => undefined);
  };
}
