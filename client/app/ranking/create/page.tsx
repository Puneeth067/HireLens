'use client'

import { Suspense } from 'react'
import { FormSkeleton } from '@/components/ui/skeleton'
import CreateRankingPageContent from './page-content'

// Main component that wraps the content in Suspense
export default function CreateRankingPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={8} showActions={true} />}>
      <CreateRankingPageContent />
    </Suspense>
  )
}
