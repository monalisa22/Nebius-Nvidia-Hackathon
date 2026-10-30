"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { TogetherlyBrand } from "./ui/togetherly-brand";

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="route-error">
      <div className="account-brand">
        <TogetherlyBrand tagline={false} />
      </div>
      <h1>Your family space could not be opened</h1>
      <p>Please try again in a moment.</p>
      <div className="button-row">
        <button className="button primary" onClick={retry}>
          <RefreshCw size={18} />
          Try again
        </button>
        <Link className="button secondary" href="/">
          Back to your day
        </Link>
      </div>
    </main>
  );
}
