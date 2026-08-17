"use client";

import { useActionState } from "react";

import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <style>{`
        #admin-login-email:-webkit-autofill,
        #admin-login-email:-webkit-autofill:hover,
        #admin-login-email:-webkit-autofill:focus,
        #admin-login-password:-webkit-autofill,
        #admin-login-password:-webkit-autofill:hover,
        #admin-login-password:-webkit-autofill:focus {
          -webkit-text-fill-color: #142842;
          -webkit-box-shadow: 0 0 0 1000px #fffdf8 inset;
          caret-color: #142842;
          transition: background-color 9999s ease-out;
        }
      `}</style>
      <div>
        <label className="block text-sm font-semibold text-[#344d68]" htmlFor="admin-login-email">
          Email
        </label>
        <input
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-lg border border-[#cfc5b4] bg-[#fffdf8] px-3 text-sm text-[#142842] caret-[#142842] outline-none placeholder:text-[#b8ad9b] selection:bg-[#ead9ac] selection:text-[#142842] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:cursor-not-allowed disabled:bg-[#f2f0eb]"
          id="admin-login-email"
          name="email"
          placeholder="nama@akkai.or.id"
          required
          type="email"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#344d68]" htmlFor="admin-login-password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-lg border border-[#cfc5b4] bg-[#fffdf8] px-3 text-sm text-[#142842] caret-[#142842] outline-none placeholder:text-[#b8ad9b] selection:bg-[#ead9ac] selection:text-[#142842] focus:border-[#9a7526] focus:ring-2 focus:ring-[#ead9ac] disabled:cursor-not-allowed disabled:bg-[#f2f0eb]"
          id="admin-login-password"
          name="password"
          required
          type="password"
        />
      </div>

      {state.error ? (
        <p className="rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm text-[#9b3d31]" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        className="min-h-12 w-full rounded-lg bg-[#142842] px-4 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
