import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const jobs = await prisma.tryOnJob.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { aiModel: { select: { name: true } } },
  });

  const statusColors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    GENERATING_PROMPT: "bg-yellow-100 text-yellow-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-600",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Try-On History</h1>
        <Link href="/try-on">
          <Button>New Try-On</Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-4">No try-ons yet</p>
          <Link href="/try-on">
            <Button>Start your first try-on</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
            >
              {job.resultUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={job.resultUrl}
                  alt="result"
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                  <span className="text-sm text-gray-400">No image</span>
                </div>
              )}
              <div className="p-3 space-y-1">
                <p className="text-sm font-medium truncate">
                  {job.productDetails}
                </p>
                <p className="text-xs text-gray-400">
                  Model: {job.aiModel.name}
                </p>
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                    statusColors[job.status] || "bg-gray-100 text-gray-500"
                  }`}
                >
                  {job.status}
                </span>
                <p className="text-xs text-gray-400">
                  {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
