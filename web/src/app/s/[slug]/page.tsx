import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TokiButtonLink } from "@/components/shared/buttons";
import { ListIcon } from "@/components/shared/list-icon";
import { ProductCard } from "@/components/shared/product-card";
import { Wordmark } from "@/components/shared/wordmark";
import { retailerName } from "@/lib/format";
import { listEmojiText } from "@/lib/list-icon-value";
import { getPublicList } from "@/lib/public-api";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicList(slug);
  if (!data) return { title: "List not found" };
  const count = data.items.length;
  const description = `${count} ${count === 1 ? "item" : "items"}`;
  const title = `${listEmojiText(data.list.emoji)} ${data.list.name}`.trim();
  return {
    title,
    description,
    openGraph: { title: data.list.name, description, type: "website", siteName: "Toki" },
    twitter: { card: "summary", title, description },
  };
}

export default async function SharedList({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const data = await getPublicList(slug);
  if (!data) notFound();
  const { list, items } = data;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Wordmark />
        <TokiButtonLink href="/signup" size="sm" variant="secondary">
          Make your own list
        </TokiButtonLink>
      </header>
      <div className="pb-8 pt-8 sm:pt-14">
        <h1 className="text-[32px] leading-[1.05] sm:text-[46px]">
          <ListIcon value={list.emoji} className="mr-3 inline size-[0.8em] -translate-y-[0.05em] text-text-muted" />
          {list.name}
        </h1>
        <p className="mt-3 text-[15px] text-text-muted">
          A wishlist by {list.owner_name}, with {items.length} {items.length === 1 ? "thing" : "things"} on it.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-[15px] text-text-muted">This list has no items yet.</p>
      ) : (
        <ul className="columns-1 gap-4 min-[520px]:columns-2 lg:columns-3 xl:columns-4">
          {items.map((item, i) => (
            <li key={item.id} className="mb-4 break-inside-avoid">
              <ProductCard
                data={{
                  title: item.product.title,
                  imageUrl: item.product.image_url,
                  retailer: retailerName(item.product.retailer, item.product.url),
                  url: item.product.url,
                  priceMinor: item.product.current_price_minor,
                  currency: item.product.currency,
                  changeMinor: item.stats.change_since_added_minor,
                  inStock: item.product.in_stock,
                }}
                mode="money"
                income={null}
                index={i}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
