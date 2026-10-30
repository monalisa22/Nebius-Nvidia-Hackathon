"use client";

import { useActionState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export type ActionState = { message: string; error: boolean };

export function AiForm({ action, children, className = "evidence-form" }: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "", error: false });
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      <fieldset disabled={pending}>{children}</fieldset>
      {pending && <p className="action-feedback" role="status"><LoaderCircle size={15} className="spinning" />Waiting for model response...</p>}
      {!pending && state.message && <p className={`action-feedback ${state.error ? "error" : "success"}`} role={state.error ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}
