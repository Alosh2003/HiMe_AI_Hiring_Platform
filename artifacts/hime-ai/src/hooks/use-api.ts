import { useCallback, useEffect, useState } from 'react';

interface UseApiOptions<T> {
  immediate?: boolean;
  initialData?: T;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
  setData: (data: T | null) => void;
}

export function useApi<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiOptions<T> = {},
): UseApiResult<T> {
  const { immediate = true, initialData } = options;
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    loader()
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'An error occurred');
      })
      .finally(() => setLoading(false));
  }, deps);

  useEffect(() => {
    if (immediate) {
      reload();
    }
  }, [reload, immediate]);

  return { data, loading, error, reload, setData };
}
