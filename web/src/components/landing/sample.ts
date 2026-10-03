import type { CardData } from "@/components/shared/product-card";
import type { Income } from "@/lib/format";

/** The demo uses a fixed salary so the toggle works without an account. */
export const DEMO_INCOME: Income = { monthly_income_minor: 12_000_000, hours_per_week: 45 };

export const DEMO_CARDS: (CardData & { imageClassName: string })[] = [
  {
    title: "Aurora over-ear wireless headphones",
    imageUrl: "/demo/headphones.svg",
    retailer: "Amazon.in",
    url: "https://www.amazon.in",
    priceMinor: 2_999_000,
    currency: "INR",
    changeMinor: -200_000,
    imageClassName: "aspect-square",
  },
  {
    title: "Tenkeyless mechanical keyboard, hot-swappable",
    imageUrl: "/demo/keyboard.svg",
    retailer: "Flipkart",
    url: "https://www.flipkart.com",
    priceMinor: 1_249_900,
    currency: "INR",
    changeMinor: 0,
    imageClassName: "aspect-square",
  },
  {
    title: "Mirrorless camera body with 24 MP sensor",
    imageUrl: "/demo/camera.svg",
    retailer: "Amazon.in",
    url: "https://www.amazon.in",
    priceMinor: 8_499_000,
    currency: "INR",
    changeMinor: 50_000,
    imageClassName: "aspect-square",
  },
  {
    title: "Brass desk lamp with dimmable warm light",
    imageUrl: "/demo/lamp.svg",
    retailer: "Pepperfry",
    url: "https://www.pepperfry.com",
    priceMinor: 649_900,
    currency: "INR",
    changeMinor: -50_000,
    imageClassName: "aspect-square",
  },
];
