import DetailClient from "@/components/detail/Detail";

interface PageProps {
  params: Promise<{
    type: 'movie' | 'tv';
    id: string;
  }>;
}

export default async function DetailPage({ params }: PageProps) {
  const { type, id } = await params;
  const mediaId = Number(id);

  return <DetailClient type={type} mediaId={mediaId} />;
}
