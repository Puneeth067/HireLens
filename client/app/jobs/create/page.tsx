// client/src/app/jobs/create/page.tsx
import JobForm from '@/components/forms/job-form';

export default function CreateJobPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <JobForm />
      </div>
    </div>
  );
}