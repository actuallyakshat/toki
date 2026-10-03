import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { HalftonePhoto } from "@/components/landing/halftone-photo";
import { LandingRail } from "@/components/landing/landing-rail";
import { Demo } from "@/components/landing/demo";
import { LandingNav } from "@/components/landing/nav";
import { TokiButtonLink } from "@/components/shared/buttons";
import { Wordmark } from "@/components/shared/wordmark";
import { faviconUrl, formatMoney, formatTime } from "@/lib/format";

const GITHUB = "https://github.com/actuallyakshat/toki";
const PHOTO = "/landing/lisbon.jpg";

const STORES = [
  { name: "Amazon.in", url: "https://www.amazon.in", tilt: "-rotate-[6deg]" },
  { name: "Flipkart", url: "https://www.flipkart.com", tilt: "rotate-[4deg]" },
  { name: "Myntra", url: "https://www.myntra.com", tilt: "rotate-[5deg]" },
];

const STEPS = [
  {
    title: "Press Add on any store",
    body: "The Chrome extension reads the product page you are on and saves its title, image and price to your list. You can also paste a link on the website.",
  },
  {
    title: "Your own browser checks the price",
    body: "Prices update when the Toki extension runs in your browser. Toki has no scraping servers. The store sees an ordinary visit from you, and large Indian retailers do not block it.",
  },
  {
    title: "You get one email per drop",
    body: "Set a target price, or ask for any drop or a percentage drop. Toki sends one email for each new low and never repeats a price you already heard about.",
  },
];

const PILLARS = [
  {
    title: "Your browser does the checking",
    body: "No scraping servers and no proxies. Prices are read by the extension during ordinary visits, so stores see you, not a bot.",
  },
  {
    title: "Your salary can stay on your device",
    body: "Keep your income local and Toki does the hours maths in your browser. The server never sees the number.",
  },
  {
    title: "MIT licensed",
    body: "A Go API, a Next.js website and a Chrome extension in one repository. Read it, fork it, or send a pull request.",
  },
  {
    title: "Yours to run",
    body: "Postgres in Docker, the API on port 8080 and the website on port 3000. Your wishlist never has to leave your machine.",
  },
];

const HEADPHONES = 2_999_000;
const SALARIES = [6_000_000, 12_000_000, 24_000_000];

/* One type scale for every section, after Synara. */
const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const eyebrow = "label text-text-faint";
const heading = "text-[1.65rem] leading-[1.12] sm:text-[2rem]";
const body = "mt-5 max-w-2xl text-[15px] leading-[1.7] text-text-muted sm:text-[16px]";
const cellTitle = "text-[15px] font-medium";
const cellBody = "mt-3 text-[13px] leading-relaxed text-text-muted sm:text-[13.5px]";

const primaryButton = "h-10 gap-2 px-5 text-[13px] font-medium hover:bg-accent-hover";
const outlineButton = "h-10 gap-2 border-border bg-transparent px-5 text-[13px] font-medium hover:bg-surface-sunk";

/** Copy beside a photo-backed card, after Synara's SplitShowcase. */
function Showcase({
  kicker,
  title,
  description,
  reverse = false,
  children,
}: {
  kicker: string;
  title: string;
  description: ReactNode;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 py-16 sm:gap-10 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-12 xl:gap-16">
      <div className={`min-w-0 ${reverse ? "lg:order-2" : ""}`}>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-highlight">{kicker}</p>
        <h3 className="text-[1.35rem] font-medium leading-[1.15] tracking-[-0.035em] sm:text-[1.5rem]">{title}</h3>
        <div className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-text-muted sm:text-[16px]">{description}</div>
      </div>
      <HalftonePhoto src={PHOTO} className={`flex items-center justify-center p-4 sm:p-8 ${reverse ? "lg:order-1" : ""}`}>
        <div className="w-full sm:w-4/5">{children}</div>
      </HalftonePhoto>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <main>
        {/* The photo runs behind the nav and hero, edge to edge, and fades into the page below the demo. */}
        <HalftonePhoto
          src={PHOTO}
          className="rounded-none"
          overlayClassName="bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--bg)_55%,transparent)_0%,color-mix(in_oklab,var(--bg)_20%,transparent)_45%,color-mix(in_oklab,var(--bg)_30%,transparent)_75%,var(--bg)_100%)]"
        >
        <LandingNav />
        <section id="top" aria-labelledby="hero-title" className="scroll-mt-0 pb-16 pt-6 sm:pb-24 sm:pt-10">
          <div className={container}>
            <ul aria-label="Stores with a built-in reader" className="mb-8 flex flex-wrap items-center gap-2 sm:mb-10">
              {STORES.map((store) => (
                <li
                  key={store.name}
                  title={store.name}
                  className={`inline-flex size-[38px] items-center justify-center rounded-xl border border-border bg-surface-sunk backdrop-blur-md ${store.tilt}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faviconUrl(store.url)} alt={store.name} width={18} height={18} className="size-[18px] rounded-[4px]" />
                </li>
              ))}
            </ul>

            <h1 id="hero-title" className="text-[1.5rem] leading-[1.12] sm:text-[2rem] sm:leading-[1.08]">
              Know what it costs in hours, not rupees.
            </h1>
            <p className="mt-5 max-w-xl text-[13px] leading-[1.6] text-text-muted sm:text-[14px]">
              Toki is a wishlist that tracks prices from your own browser, emails you when they drop, and shows every price as the hours of work it takes to earn.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <TokiButtonLink href="/signup" className={primaryButton}>
                Start a wishlist
                <ArrowRight className="size-4" aria-hidden />
              </TokiButtonLink>
              <TokiButtonLink href={GITHUB} variant="outline" target="_blank" rel="noreferrer" className={outlineButton}>
                Star on GitHub
                <ArrowUpRight className="size-4" aria-hidden />
              </TokiButtonLink>
            </div>
            <p className="mt-4 text-[12px] text-text-muted">Free and open source. Built-in readers for Amazon.in, Flipkart and Myntra; other stores work through standard product data.</p>

            <div className="mt-10 rounded-[var(--radius-frame)] bg-background p-4 shadow-lift sm:mt-14 sm:p-6">
              <Demo />
            </div>
          </div>
        </section>
        </HalftonePhoto>

        <section id="how" className="scroll-mt-6 border-t border-border py-14 sm:py-20">
          <div className={container}>
            <p className={eyebrow}>How it works</p>
            <h2 className={`${heading} mt-3`}>A wishlist that watches prices so you do not have to.</h2>
            <p className={body}>Save a product once. Toki keeps an eye on the price and tells you when it is worth buying.</p>

            <ol className="mt-12 grid grid-cols-1 border-t border-border md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="border-b border-border p-6 transition-colors duration-[var(--dur-base)] hover:bg-surface-sunk sm:p-7 md:[&:not(:last-child)]:border-r"
                >
                  <span className="font-mono text-[12px] tabular-nums text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className={`${cellTitle} mt-3`}>{step.title}</h3>
                  <p className={cellBody}>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="time" className="scroll-mt-6 border-t border-border py-14 sm:py-20">
          <div className={container}>
            <p className={eyebrow}>Hours of work</p>
            <h2 className={`${heading} mt-3 max-w-2xl`}>The same price is a different amount of your life.</h2>
            <p className={body}>
              Enter your monthly in-hand salary and the hours you work in a week. Toki divides each price by your hourly pay.
            </p>

            <Showcase
              kicker="01 / time view"
              title="See the price the way you pay for it"
              description={
                <p>
                  Under an hour Toki shows minutes. From one working day up it shows workdays. The same headphones cost very different amounts of a month, depending on who is buying.
                </p>
              }
            >
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-background shadow-card">
                <div className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-3.5">
                  <span className="text-[13px] font-medium">Aurora headphones</span>
                  <span className="text-[13px] tabular-nums text-text-muted">{formatMoney(HEADPHONES)}</span>
                </div>
                <dl className="divide-y divide-border">
                  {SALARIES.map((salary) => (
                    <div key={salary} className="flex items-baseline justify-between gap-4 px-5 py-4">
                      <dt className="text-[13px] text-text-muted">{formatMoney(salary)} a month</dt>
                      <dd className="figure text-[17px]">
                        {formatTime(HEADPHONES, { monthly_income_minor: salary, hours_per_week: 45 })}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Showcase>

            <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2">
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="border-b border-border p-6 transition-colors duration-[var(--dur-base)] hover:bg-surface-sunk sm:p-7 sm:[&:nth-child(odd)]:border-r"
                >
                  <h3 className={cellTitle}>{pillar.title}</h3>
                  <p className={cellBody}>{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="self-host" className="scroll-mt-6 border-t border-border py-14 sm:py-20">
          <div className={container}>
            <p className={eyebrow}>Self-host</p>
            <h2 className={`${heading} mt-3 max-w-2xl`}>Run Toki on your own machine.</h2>
            <p className={body}>You need Docker, Go and pnpm. Three commands and your wishlist is running locally.</p>

            <Showcase
              kicker="02 / self-host"
              title="Postgres, the API and the website"
              reverse
              description={
                <p>
                  Postgres runs in Docker, the API on port 8080 and the website on port 3000. Set{" "}
                  <code className="font-mono text-[13px] text-text">API_ORIGIN</code> for the website when the API is not on localhost:8080.
                </p>
              }
            >
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-background shadow-card">
                <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                  <span className="size-2.5 rounded-full bg-border" />
                  <span className="size-2.5 rounded-full bg-border" />
                  <span className="size-2.5 rounded-full bg-border" />
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-7 text-text-muted">
                  <code>{`docker compose up -d
(cd server && go run ./cmd/toki) &
(cd web && pnpm install && pnpm dev)`}</code>
                </pre>
              </div>
            </Showcase>
          </div>
        </section>

        <section className="border-t border-border py-16 sm:py-24">
          <div className={`${container} text-center`}>
            <p className={eyebrow}>Open-source wishlist</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-[2rem] leading-[1.08] tracking-[-0.045em] sm:text-[3rem]">
              Know what it costs in hours, not rupees.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-[14px] leading-[1.7] text-text-muted sm:text-[16px]">
              Start with one product and one store. Add targets, drop alerts and the time view when you want them.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <TokiButtonLink href="/signup" className={primaryButton}>
                Start a wishlist
                <ArrowRight className="size-4" aria-hidden />
              </TokiButtonLink>
              <p className="text-[11px] text-text-faint">Free, MIT licensed, and self-hostable.</p>
            </div>
          </div>
        </section>
      </main>

      <LandingRail />

      <footer className="border-t border-border py-8">
        <div className={`${container} flex flex-col gap-3 text-[12px] text-text-faint sm:flex-row sm:items-center sm:justify-between`}>
          <Wordmark />
          <span>Made for people who get paid in rupees and spend them in hours.</span>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="text-highlight transition-colors hover:text-text">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
