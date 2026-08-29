import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { getProduct } from "@/services/product.service";
import { Avatar, Badge } from "@/components/ui";
import { mediaUrl } from "@/lib/utils";
import { BuyPanel } from "@/components/product/buy-panel";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isValidObjectId(id)) return { title: "Product" };
  const data = await getProduct(id);
  if (!data) return { title: "Product not found" };
  return { title: data.product.name, description: data.product.description?.slice(0, 150) };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  const data = await getProduct(id);
  if (!data || data.product.status !== "active") notFound();

  const { product, business } = data;
  const inStock = product.available && (product.stock === null || product.stock > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-surface-2">
          {product.imageKeys[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(product.imageKeys[0])!} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🛍</div>
          )}
        </div>

        <div>
          <Link href={`/b/${business.username}`} className="mb-3 flex items-center gap-2 hover:opacity-80">
            <Avatar src={business.logoKey ? mediaUrl(business.logoKey) : null} name={business.name} size={32} />
            <span className="text-sm font-semibold">{business.name}</span>
            {business.verification === "verified" && <Badge tone="primary">✓</Badge>}
          </Link>

          <h1 className="text-xl font-bold">{product.name}</h1>
          <p className="mt-1 text-2xl font-extrabold text-primary">
            ${(product.priceCents / 100).toFixed(2)} <span className="text-sm font-medium text-muted">{product.currency}</span>
          </p>
          {!inStock && <p className="mt-1 text-sm font-semibold text-danger">Out of stock</p>}

          {product.description && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{product.description}</p>
          )}

          <BuyPanel
            productId={String(product._id)}
            name={product.name}
            priceCents={product.priceCents}
            currency={product.currency}
            inStock={inStock}
          />
        </div>
      </div>
    </div>
  );
}
