import { DashboardSkeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <DashboardSkeleton showStats={true} showCharts={true} showTable={false} />
    </div>
  );
}