"use client";

import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/superadmin/logout", { method: "POST" });
    router.push("/superadmin/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-gray-400 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
