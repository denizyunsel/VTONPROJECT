import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import AdminLogoutButton from "@/components/AdminLogoutButton";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) redirect("/superadmin/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-wide text-sm">
            Virtual Try-On — Admin
          </span>
          <AdminLogoutButton />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
