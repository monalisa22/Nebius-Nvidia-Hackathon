import { notFound } from "next/navigation";
import { renderAnubandh } from "../anubandh-page";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ person?: string | string[] }>;
}) {
  const { view } = await params;
  if (
    ![
      "family",
      "memories",
      "calls",
      "messages",
      "choices",
      "contribute",
      "review",
      "stories",
      "activities",
      "walks",
      "capsules",
      "family-tree",
      "insights",
      "conversation",
      "rituals",
    ].includes(view)
  )
    notFound();
  const { person } = await searchParams;
  return renderAnubandh(view, typeof person === "string" ? person : undefined);
}
