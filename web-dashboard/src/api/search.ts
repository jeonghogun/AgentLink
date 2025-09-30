import { apiRequest } from './client';

type SearchResponse = { titles: string[] };

export async function fetchSearchPreview(region?: string, keyword?: string, limit = 10): Promise<string[]> {
  const params = new URLSearchParams();
  if (region) {
    params.set('region', region);
  }
  if (keyword) {
    params.set('keyword', keyword);
  }
  params.set('limit', String(limit));

  const { titles } = await apiRequest<SearchResponse>(`/api/search?${params.toString()}`);
  return titles;
}
