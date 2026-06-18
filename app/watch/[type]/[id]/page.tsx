import WatchClient from "@/components/watch/WatchClient";

interface PageProps {
  params: Promise<{
    type: "movie" | "tv";
    id: string;
  }>;
}

export default async function WatchPage({ params }: PageProps) {
  const { type, id } = await params;
  return <WatchClient type={type} mediaId={Number(id)} />;
}
