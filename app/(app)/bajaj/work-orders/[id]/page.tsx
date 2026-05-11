import { WorkOrderDetailPage } from "@/components/bajaj/WorkOrderDetailPage";

export const dynamic = "force-dynamic";

export default async function WorkOrderDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkOrderDetailPage workOrderId={id} />;
}
