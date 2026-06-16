export interface ExtensionAuthUserInput {
  fullName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  imageUrl?: string | null;
}

export function extensionAuthUser(user: ExtensionAuthUserInput | null | undefined) {
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  return {
    name: user?.fullName ?? user?.username ?? email ?? "User",
    email,
    imageUrl: user?.imageUrl ?? null,
  };
}
