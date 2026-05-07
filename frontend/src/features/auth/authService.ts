import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../services/firebase";

export type AuthUser = User;

export type CreateAccountInput = {
  email: string;
  password: string;
  displayName?: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export function subscribeToAuthState(
  onChange: (user: AuthUser | null) => void,
): () => void {
  return onAuthStateChanged(auth, onChange);
}

export async function signInWithEmail(input: SignInInput): Promise<AuthUser> {
  const credential = await signInWithEmailAndPassword(
    auth,
    input.email,
    input.password,
  );
  return credential.user;
}

export async function createAccountWithEmail(
  input: CreateAccountInput,
): Promise<AuthUser> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    input.email,
    input.password,
  );

  if (input.displayName) {
    await updateProfile(credential.user, { displayName: input.displayName });
  }

  return credential.user;
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

