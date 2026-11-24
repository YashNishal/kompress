import { notFound } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import type { Variant } from "@/components/landing/variants";

const IDS: Variant[] = ["0", "a", "b", "c", "d"];

/** Temporary: landing page heading variants side by side. Delete with variants.tsx. */
export const dynamicParams = false;
export function generateStaticParams() {
  return IDS.map((v) => ({ v }));
}
export const metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ v: string }> }) {
  const { v } = await params;
  if (!IDS.includes(v as Variant)) notFound();
  return <LandingPage variant={v as Variant} preview />;
}
