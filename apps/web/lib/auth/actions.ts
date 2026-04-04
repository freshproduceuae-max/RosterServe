"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { signInSchema, signUpSchema } from "./schemas";

export type AuthActionResult = { error: string } | { success: true } | { redirectTo: string } | undefined;

export async function signInAction(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      error: "The email or password you entered is incorrect. Please try again.",
    };
  }

  // Return redirectTo instead of calling redirect() to avoid the Next.js 15
  // useActionState + redirect() RSC refresh loop.
  return { redirectTo: "/dashboard" };
}

export async function signUpAction(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { siteUrl } = getPublicEnv();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return {
      error: "Something went wrong creating your account. Please try again.",
    };
  }

  return { success: true };
}
