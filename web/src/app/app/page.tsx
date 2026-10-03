"use client";

import { useState } from "react";
import { WishlistHeader } from "@/components/app/wishlist-header";
import { WishlistView, type ViewKind } from "@/components/app/wishlist-view";

export default function WishlistPage() {
  const [view, setView] = useState<ViewKind>("grid");
  return (
    <>
      <WishlistHeader view={view} onViewChange={setView} />
      <WishlistView view={view} />
    </>
  );
}
