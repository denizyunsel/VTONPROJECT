"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type GarmentMode = "separates" | "dress";

export type GarmentView =
  | "front"
  | "front_detail"
  | "back"
  | "back_detail"
  | "side"
  | "side_detail";

export interface GarmentImage {
  url: string;
  view: GarmentView;
}

const VIEW_LABELS: Record<GarmentView, string> = {
  front: "Ön",
  front_detail: "Ön Detay",
  back: "Arka",
  back_detail: "Arka Detay",
  side: "Yan",
  side_detail: "Yan Detay",
};

// [main view, detail view] pairs
const VIEW_PAIRS: [GarmentView, GarmentView][] = [
  ["front", "front_detail"],
  ["back", "back_detail"],
  ["side", "side_detail"],
];

interface Props {
  garmentMode: GarmentMode;
  topGarmentImages: GarmentImage[];
  bottomGarmentImages: GarmentImage[];
  topDescription: string;
  bottomDescription: string;
  dressImages: GarmentImage[];
  dressDescription: string;
  onGarmentModeChange: (mode: GarmentMode) => void;
  onTopChange: (images: GarmentImage[]) => void;
  onBottomChange: (images: GarmentImage[]) => void;
  onTopDescriptionChange: (val: string) => void;
  onBottomDescriptionChange: (val: string) => void;
  onDressChange: (images: GarmentImage[]) => void;
  onDressDescriptionChange: (val: string) => void;
  onNext: () => void;
}

function ViewUploadZone({
  view,
  images,
  allImages,
  onAllImages,
  uploadType,
}: {
  view: GarmentView;
  images: GarmentImage[];
  allImages: GarmentImage[];
  onAllImages: (images: GarmentImage[]) => void;
  uploadType: string;
}) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (files: File[]) => {
      setUploading(true);
      const newImages: GarmentImage[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", uploadType);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (data.url) newImages.push({ url: data.url, view });
        } catch {
          console.error("Upload failed for", file.name);
        }
      }
      onAllImages([...allImages, ...newImages]);
      setUploading(false);
    },
    [allImages, onAllImages, view, uploadType]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  function remove(url: string) {
    onAllImages(allImages.filter((i) => i.url !== url));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-gray-600">{VIEW_LABELS[view]}</p>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors min-h-[60px] flex items-center justify-center ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p className="text-xs text-gray-500">Yükleniyor...</p>
        ) : (
          <p className="text-xs text-gray-400">
            {isDragActive ? "Bırak" : "Sürükle veya tıkla"}
          </p>
        )}
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {images.map((img) => (
            <div key={img.url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={view} className="w-full h-14 object-cover rounded" />
              <button
                onClick={() => remove(img.url)}
                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GarmentViewSection({
  label,
  images,
  onImages,
  uploadType,
  descriptionValue,
  descriptionPlaceholder,
  onDescriptionChange,
}: {
  label: string;
  images: GarmentImage[];
  onImages: (images: GarmentImage[]) => void;
  uploadType: string;
  descriptionValue: string;
  descriptionPlaceholder: string;
  onDescriptionChange: (val: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">{label}</p>
      <div className="space-y-2">
        {VIEW_PAIRS.map(([mainView, detailView]) => (
          <div key={mainView} className="grid grid-cols-2 gap-3">
            <ViewUploadZone
              view={mainView}
              images={images.filter((i) => i.view === mainView)}
              allImages={images}
              onAllImages={onImages}
              uploadType={uploadType}
            />
            <ViewUploadZone
              view={detailView}
              images={images.filter((i) => i.view === detailView)}
              allImages={images}
              onAllImages={onImages}
              uploadType={uploadType}
            />
          </div>
        ))}
      </div>
      <textarea
        rows={2}
        placeholder={descriptionPlaceholder}
        value={descriptionValue}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export default function Step1Upload({
  garmentMode,
  topGarmentImages,
  bottomGarmentImages,
  topDescription,
  bottomDescription,
  dressImages,
  dressDescription,
  onGarmentModeChange,
  onTopChange,
  onBottomChange,
  onTopDescriptionChange,
  onBottomDescriptionChange,
  onDressChange,
  onDressDescriptionChange,
  onNext,
}: Props) {
  const canProceed =
    garmentMode === "dress"
      ? dressImages.length > 0 && dressDescription.trim().length > 0
      : topGarmentImages.length > 0 &&
        bottomGarmentImages.length > 0 &&
        topDescription.trim().length > 0 &&
        bottomDescription.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Upload Garments</h2>
        <p className="text-sm text-gray-500">
          Her görüş açısı için ana görsel ve detay görseli ekleyebilirsiniz.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onGarmentModeChange("separates")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            garmentMode === "separates"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
          }`}
        >
          Top + Bottom
        </button>
        <button
          type="button"
          onClick={() => onGarmentModeChange("dress")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            garmentMode === "dress"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
          }`}
        >
          Dress
        </button>
      </div>

      {garmentMode === "separates" ? (
        <>
          <GarmentViewSection
            label="Top Garment"
            images={topGarmentImages}
            onImages={onTopChange}
            uploadType="top_garment"
            descriptionValue={topDescription}
            descriptionPlaceholder="Describe the top garment (e.g. oversized white linen shirt with rolled sleeves)"
            onDescriptionChange={onTopDescriptionChange}
          />
          <GarmentViewSection
            label="Bottom Garment"
            images={bottomGarmentImages}
            onImages={onBottomChange}
            uploadType="bottom_garment"
            descriptionValue={bottomDescription}
            descriptionPlaceholder="Describe the bottom garment (e.g. high-waist wide-leg black trousers)"
            onDescriptionChange={onBottomDescriptionChange}
          />
        </>
      ) : (
        <GarmentViewSection
          label="Dress"
          images={dressImages}
          onImages={onDressChange}
          uploadType="dress"
          descriptionValue={dressDescription}
          descriptionPlaceholder="Describe the dress (e.g. midi-length black satin slip dress with thin straps)"
          onDescriptionChange={onDressDescriptionChange}
        />
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </div>
  );
}
