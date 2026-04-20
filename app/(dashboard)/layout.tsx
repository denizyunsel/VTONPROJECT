import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-lg">Virtual Try-On</span>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                History
              </Link>
              <Link
                href="/try-on"
                className="text-gray-600 hover:text-gray-900"
              >
                New Try-On
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
