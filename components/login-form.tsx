"use client";

import { useActionState } from "react";
import { Input } from "@/components/chrome/input";
import { Button } from "@/components/chrome/button";
import { login, type LoginState } from "@/app/actions";

const INITIAL: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, INITIAL);

  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <Input
        name="password"
        type="password"
        placeholder="password"
        // The placeholder is the only visible label and it disappears on the
        // first keystroke, so the field needs a name that survives typing.
        aria-label="password"
        autoComplete="current-password"
        autoFocus
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "login-error" : undefined}
      />
      <Button type="submit" variant="solid" disabled={pending}>
        {pending ? "checking" : "sign in"}
      </Button>
      {/* Live region so the failure is announced, not just recoloured. */}
      <p
        id="login-error"
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-red-300"
      >
        {state.error}
      </p>
    </form>
  );
}
