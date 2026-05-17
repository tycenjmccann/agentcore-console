import { useEffect, useState } from 'react';
import { ApiAvailabilityResponse } from '@/types';

export function useModelAvailability() {
  const [availability, setAvailability] = useState<ApiAvailabilityResponse>({
    openAiAvailable: false,
    geminiAvailable: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAvailability() {
      try {
        const response = await fetch('/api/models/availability');
        if (!response.ok) {
          throw new Error('Failed to fetch model availability');
        }
        const data = await response.json();
        setAvailability(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchAvailability();
  }, []);

  return { availability, loading, error };
}
