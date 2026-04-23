import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/DownloadButton";
import { ImageIcon, Plus } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:           { label: "Pending",          className: "bg-gray-100 text-gray-500" },
  GENERATING_PROMPT: { label: "Building prompt",  className: "bg-amber-100 text-amber-700" },
  PROCESSING:        { label: "Processing",        className: "bg-blue-100 text-blue-700" },
  COMPLETED:         { label: "Completed",         className: "bg-emerald-100 text-emerald-700" },
  FAILED:            { label: "Failed",            className: "bg-red-100 text-red-600" },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const jobs = await prisma.tryOnJob.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { aiModel: { select: { name: true } } },
    // seed is a top-level scalar, no extra include needed
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">History</h1>
          <p className="text-sm text-gray-400 mt-0.5">{jobs.length} try-on{jobs.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/try-on">
          <Button className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            New Try-On
          </Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white rounded-xl border border-gray-200">
          <ImageIcon className="w-10 h-10 mb-4 text-gray-300" />
          <p className="text-base font-medium text-gray-500 mb-1">No try-ons yet</p>
          <p className="text-sm mb-6">Upload your first garment to get started.</p>
          <Link href="/try-on">
            <Button>Start your first try-on</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {jobs.map((job) => {
            const cfg = STATUS_CONFIG[job.status] ?? { label: job.status, className: "bg-gray-100 text-gray-500" };
            const dateStr = new Date(job.createdAt).toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const filename = `tryon-${job.id.slice(0, 8)}.jpg`;

            return (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="relative aspect-[3/4] bg-gray-50">
                  {job.resultUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={job.resultUrl}
                        alt="Try-on result"
                        className="w-full h-full object-cover"
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs">
                        {job.status === "FAILED" ? "Failed" : "Processing…"}
                      </span>
                    </div>
                  )}

                  <span className={`absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="px-3 py-2.5 space-y-1">
                  {job.productDetails && (
                    <p className="text-sm font-medium text-gray-800 truncate leading-snug">
                      {job.productDetails}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">{job.aiModel.name}</p>
<div className="flex items-center justify-between pt-0.5">
                    <p className="text-xs text-gray-400">{dateStr}</p>
                    {job.resultUrl && (
                      <DownloadButton url={job.resultUrl} filename={filename} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
