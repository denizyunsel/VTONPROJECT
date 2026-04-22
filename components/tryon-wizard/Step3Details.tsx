"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface StyleAsset {
  id: string;
  label: string;
  imageUrl: string;
  type: string;
}

interface Props {
  selectedStyleAssets: Record<string, StyleAsset | null>;
  styleDescriptions: Record<string, string>;
  onStyleAssetChange: (type: string, asset: StyleAsset | null) => void;
  onStyleDescriptionChange: (type: string, desc: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

const ASSET_TYPES = ["LIGHTING", "POSE", "BACKGROUND", "COMPOSITION"] as const;

const TYPE_LABELS: Record<string, string> = {
  LIGHTING: "Lighting",
  POSE: "Pose",
  BACKGROUND: "Background",
  COMPOSITION: "Composition",
};

function StyleAssetSection({
  type,
  selected,
  description,
  onSelect,
  onDescriptionChange,
}: {
  type: string;
  selected: StyleAsset | null;
  description: string;
  onSelect: (asset: StyleAsset | null) => void;
  onDescriptionChange: (desc: string) => void;
}) {
  const [assets, setAssets] = useState<StyleAsset[]>([]);

  useEffect(() => {
    fetch(`/api/style-assets?type=${type}`)
      .then((r) => r.json())
      .then((data) => setAssets(data.assets || []));
  }, [type]);

  if (assets.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{TYPE_LABELS[type]}</p>
      <div className="flex gap-2 flex-wrap">
        {assets.map((asset) => {
          const isSelected = selected?.id === asset.id;
          return (
            <button
              key={asset.id}
              onClick={() => onSelect(isSelected ? null : asset)}
              className={`relative rounded overflow-hidden border-2 transition-all ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-300"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              title={asset.label}
            >
              {asset.imageUrl && asset.imageUrl !== "" ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.imageUrl}
                    alt={asset.label}
                    className="w-20 h-20 object-cover"
                  />
                  <p className="text-xs text-center py-1 bg-white truncate w-20 text-gray-600">
                    {asset.label}
                  </p>
                </>
              ) : (
                <div className={`w-24 px-3 py-3 flex items-center justify-center min-h-[3rem] transition-colors ${
                  isSelected ? "bg-blue-50" : "bg-gray-50"
                }`}>
                  <span className={`text-xs text-center leading-snug font-medium ${
                    isSelected ? "text-blue-700" : "text-gray-700"
                  }`}>
                    {asset.label}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={`Describe the ${TYPE_LABELS[type].toLowerCase()} (optional)`}
        rows={2}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}

export default function Step3Details({
  selectedStyleAssets,
  styleDescriptions,
  onStyleAssetChange,
  onStyleDescriptionChange,
  onBack,
  onSubmit,
  submitting,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Style</h2>
        <p className="text-sm text-gray-500">
          Optionally select style references.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-gray-800">
          Style References (optional)
        </p>
        {ASSET_TYPES.map((type) => (
          <StyleAssetSection
            key={type}
            type={type}
            selected={selectedStyleAssets[type] || null}
            description={styleDescriptions[type] || ""}
            onSelect={(asset) => onStyleAssetChange(type, asset)}
            onDescriptionChange={(desc) => onStyleDescriptionChange(type, desc)}
          />
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? "Generating..." : "Generate Try-On"}
        </Button>
      </div>
    </div>
  );
}
