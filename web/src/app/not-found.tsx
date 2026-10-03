import { NotFoundMagnetic } from "@/components/motion/not-found";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <NotFoundMagnetic
        title="This page is not on your list"
        description="The link may be old, or the page moved. Open your wishlist, or go back to the home page."
        homeHref="/app"
        homeLabel="Open your wishlist"
        browseHref="/"
        browseLabel="Go to the home page"
      />
    </main>
  );
}
