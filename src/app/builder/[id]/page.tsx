import { MiniBoxBuilder } from "@/components/builder/MiniBoxBuilder";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MiniBoxBuilder initialId={id} />;
}
