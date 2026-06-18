import ShopDetailClient from "@/components/shop/ShopDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ShopDetailClient productId={id} />;
}
