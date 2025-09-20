'use client'

import { Suspense } from 'react'
import { FormSkeleton } from '@/components/ui/skeleton'
import RankingPageClient from './page-client'

export default function RankingPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={8} showActions={true} />}>
      <RankingPageClient />
    </Suspense>
  )
}
