import { getStore } from "@/lib/anubandh/store";
import { AccountScreen } from "@/app/ui/account-screen";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = getStore().inviteInfo(token);
  return (
    <AccountScreen
      invitation={
        invitation
          ? {
              token,
              name: invitation.name,
              family: getStore().family(invitation.family_id).name,
            }
          : null
      }
      invalidInvitation={!invitation}
    />
  );
}
