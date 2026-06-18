import PersonDetail from "@/components/person/PersonDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  return <PersonDetail personId={Number(id)} />;
}
