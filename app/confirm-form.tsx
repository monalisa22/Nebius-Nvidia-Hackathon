"use client";

import type { ReactNode } from "react";

export function ConfirmForm({ action, question, children, className }: {
  action: (data: FormData) => Promise<void>;
  question: string;
  children: ReactNode;
  className?: string;
}) {
  return <form action={action} className={className} onSubmit={(event) => {
    if (!window.confirm(question)) event.preventDefault();
  }}>{children}</form>;
}
