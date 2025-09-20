import { Suspense } from 'react'
import PageWrapper from '@/components/ui/page-wrapper'
import { JobsPageSkeleton } from '@/components/ui/skeleton'
import JobsPageContent from './page-content'

// Main component wrapped with PageWrapper only (DashboardLayout is in root layout)
export default function JobsPage() {
  return (
    <PageWrapper 
      pageName="Jobs"
      loadingType="jobs"
    >
      <Suspense fallback={<JobsPageSkeleton />}>
        <JobsPageContent />
      </Suspense>
    </PageWrapper>
  );
}