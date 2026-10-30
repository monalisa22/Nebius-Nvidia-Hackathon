import { currentMember } from "@/lib/anubandh/auth";
import { getStore } from "@/lib/anubandh/store";
import { aiStatus } from "@/lib/anubandh/ai";
import { Anubandh } from "./ui/anubandh";
import { AccountScreen } from "./ui/account-screen";
import { CompanionService } from "@/lib/togetherly/service";
export async function renderAnubandh(view: string, initialPersonId?: string) {
  const member = await currentMember();
  if (!member) return <AccountScreen />;
  return (
    <Anubandh
      key={member.id}
      initial={{ ...getStore().snapshot(member), provider: aiStatus() }}
      initialCompanion={new CompanionService(getStore()).snapshot(member)}
      view={view}
      initialPersonId={initialPersonId}
    />
  );
}
