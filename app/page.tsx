import { renderAnubandh } from "./anubandh-page";
export const dynamic = "force-dynamic";
export default async function Page() {
  return renderAnubandh("today");
}
