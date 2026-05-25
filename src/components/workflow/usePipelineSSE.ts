'use client';

import { useState } from 'react';

export function usePipelineSSE() {
  const [events] = useState<unknown[]>([]);
  return { events };
}
