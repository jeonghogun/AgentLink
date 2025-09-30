import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchStore, updateStore } from '../api/stores';

const STORE_QUERY_KEY = ['store'];

export function useStoreQuery() {
  return useQuery({
    queryKey: STORE_QUERY_KEY,
    queryFn: fetchStore,
  });
}

export function useUpdateStoreMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStore,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: STORE_QUERY_KEY });
      if (result.title_preview) {
        toast.success(`새로운 타이틀: ${result.title_preview}`);
      } else {
        toast.success('스토어 정보가 저장되었습니다.');
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      toast.error(message);
    },
  });
}

