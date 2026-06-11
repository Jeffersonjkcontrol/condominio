"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginState = { erro?: string } | undefined;

export async function autenticar(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { erro: "E-mail ou senha inválidos." };
    }
    throw error; // redirect de sucesso é tratado pelo framework
  }
  return undefined;
}

export async function sair() {
  await signOut({ redirectTo: "/login" });
}
