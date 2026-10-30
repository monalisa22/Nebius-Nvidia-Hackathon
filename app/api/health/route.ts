import { NextResponse } from "next/server";

import { aiStatus } from "@/lib/anubandh/ai";
import { getStore } from "@/lib/anubandh/store";

export async function GET() {
  const store = getStore();
  store.one("SELECT 1");
  const provider = aiStatus();
  const heartbeat =
    Number(
      store.one<{ value: string }>(
        "SELECT value FROM settings WHERE key='heartbeat'",
      )?.value,
    ) || null;
  return NextResponse.json(
    {
      status: provider.configured ? "ok" : "configuration_required",
      database: "sqlite",
      provider: provider.mode,
      model: provider.model,
      connectivity: "not_checked",
      application: "anubandh",
      monitor:
        heartbeat && Date.now() - heartbeat < 180000
          ? "worker_connected"
          : "worker_offline",
    },
    { status: provider.configured ? 200 : 503 },
  );
}
