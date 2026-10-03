"use client";

import { ProductCard, type CardData } from "@/components/shared/product-card";
import { retailerName } from "@/lib/format";
import type { Income } from "@/lib/format";
import type { Mode } from "@/lib/mode";
import type { Item } from "@/lib/types";

export function toCardData(item: Item): CardData {
  const { product } = item;
  return {
    title: product.title,
    imageUrl: product.image_url,
    retailer: retailerName(product.retailer, product.url),
    url: product.url,
    priceMinor: product.current_price_minor,
    currency: product.currency,
    changeMinor: item.stats.change_since_added_minor,
    coolingUntil: item.cooling_until,
    inStock: product.in_stock,
  };
}

interface Props {
  item: Item;
  index: number;
  mode: Mode;
  income: Income | null;
  onOpen: (id: string) => void;
}

/** Every card gets the same image box, so a row of cards lines up. Retailer images are cropped to fill it. */
export const UNIFORM_IMAGE = "aspect-[4/3] [&_img]:h-full [&_img]:object-cover";

export function ItemCard({ item, index, mode, income, onOpen }: Props) {
  return (
    <ProductCard
      data={toCardData(item)}
      mode={mode}
      income={income}
      index={index}
      onOpen={() => onOpen(item.id)}
      imageClassName={UNIFORM_IMAGE}
      className="h-full"
    />
  );
}
