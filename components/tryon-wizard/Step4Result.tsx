"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Props {
  jobId: string;
  onRetry: () => void;
}

type JobStatus =
  | "PENDING"
  | "GENERATING_PROMPT"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

const STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: "Starting...",
  GENERATING_PROMPT: "Generating prompt...",
  PROCESSING: "Processing with AI...",
  COMPLETED: "Done!",
  FAILED: "Failed",
};

const STATUS_PROGRESS: Record<JobStatus, number> = {
  PENDING: 10,
  GENERATING_PROMPT: 30,
  PROCESSING: 70,
  COMPLETED: 100,
  FAILED: 100,
};

export default function Step4Result({ jobId, onRetry }: Props) {
  const [status, setStatus] = useState<JobStatus>("PENDING");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "COMPLETED" || status === "FAILED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tryon/${jobId}`);
        const data = await res.json();
        setStatus(data.status as JobStatus);
        if (data.resultUrl) setResultUrl(data.resultUrl);
        if (data.errorMessage) setErrorMessage(data.errorMessage);
      } catch {
        console.error("Polling error");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId, status]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Result</h2>
      </div>

      {status !== "COMPLETED" && status !== "FAILED" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">{STATUS_LABELS[status]}</p>
          </div>
          <Progress value={STATUS_PROGRESS[status]} className="h-2" />
        </div>
      )}

      {status === "COMPLETED" && resultUrl && (
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl}
            alt="Try-on result"
            className="w-full max-w-lg mx-auto rounded-lg shadow-md"
          />
          <div className="flex gap-3 justify-center">
            <a href={resultUrl} download="tryon-result.jpg">
              <Button>Download</Button>
            </a>
            <Button variant="outline" onClick={onRetry}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {status === "FAILED" && (
        <div className="space-y-4 text-center">
          <p className="text-red-500 font-medium">Generation failed</p>
          {errorMessage && (
            <p className="text-sm text-gray-500">{errorMessage}</p>
          )}
          <Button onClick={onRetry}>Try Again</Button>
        </div>
      )}
    </div>
  );
}
