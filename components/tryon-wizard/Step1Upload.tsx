"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  topGarmentUrls: string[];
  bottomGarmentUrls: string[];
  topDescription: string;
  bottomDescription: string;
  onTopChange: (urls: string[]) => void;
  onBottomChange: (urls: string[]) => void;
  onTopDescriptionChange: (val: string) => void;
  onBottomDescriptionChange: (val: string) => void;
  onNext: () => void;
}

function UploadZone({
  label,
  urls,
  onUrls,
  type,
}: {
  label: string;
  urls: string[];
  onUrls: (urls: string[]) => void;
  type: "top_garment" | "bottom_garment";
}) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (files: File[]) => {
      setUploading(true);
      const newUrls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.url) newUrls.push(data.url);
        } catch {
          console.error("Upload failed for", file.name);
        }
      }
      onUrls([...urls, ...newUrls]);
      setUploading(false);
    },
    [urls, onUrls, type]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  function remove(url: string) {
    onUrls(urls.filter((u) => u !== url));
  }

  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">{label}</p>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p className="text-sm text-gray-500">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-sm text-blue-600">Drop images here</p>
        ) : (
          <p className="text-sm text-gray-500">
            Drag & drop images here, or click to select
          </p>
        )}
      </div>
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {urls.map((url) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="garment"
                className="w-full h-20 object-cover rounded"
              />
              <button
                onClick={() => remove(url)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Step1Upload({
  topGarmentUrls,
  bottomGarmentUrls,
  topDescription,
  bottomDescription,
  onTopChange,
  onBottomChange,
  onTopDescriptionChange,
  onBottomDescriptionChange,
  onNext,
}: Props) {
  const canProceed =
    topGarmentUrls.length > 0 &&
    bottomGarmentUrls.length > 0 &&
    topDescription.trim().length > 0 &&
    bottomDescription.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Upload Garments</h2>
        <p className="text-sm text-gray-500">
          Upload at least one top and one bottom garment image.
        </p>
      </div>

      <div className="space-y-3">
        <UploadZone
          label="Top Garment"
          urls={topGarmentUrls}
          onUrls={onTopChange}
          type="top_garment"
        />
        <textarea
          rows={2}
          placeholder="Describe the top garment (e.g. oversized white linen shirt with rolled sleeves)"
          value={topDescription}
          onChange={(e) => onTopDescriptionChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-3">
        <UploadZone
          label="Bottom Garment"
          urls={bottomGarmentUrls}
          onUrls={onBottomChange}
          type="bottom_garment"
        />
        <textarea
          rows={2}
          placeholder="Describe the bottom garment (e.g. high-waist wide-leg black trousers)"
          value={bottomDescription}
          onChange={(e) => onBottomDescriptionChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </div>
  );
}
