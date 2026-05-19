'use client'

import { useState, useEffect } from 'react'
import { API_ROUTES } from '@/constants/routes'

export function useQueryQuota() {
  const [remainingQueries, setRemainingQueries] = useState<number | null>(null)

  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch(API_ROUTES.QUERY_QUOTA)
        if (!res.ok) return
        const data = (await res.json()) as { remaining: number }
        setRemainingQueries(data.remaining)
      } catch (error) {
        console.error('[useQueryQuota] fetchQuota failed:', error)
      }
    }
    void fetchQuota()
  }, [])

  return { remainingQueries, setRemainingQueries }
}
