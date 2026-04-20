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
  onStyleAssetChange: (type: string, asset: StyleAsset | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

const ASSET_TYPES = ["LIGHTING", "POSE", "BACKGROUND", "STYLE"] as const;

function StyleAssetSection({
  type,
  selected,
  onSelect,
}: {
  type: string;
  selected: StyleAsset | null;
  onSelect: (asset: StyleAsset | null) => void;
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
      <p className="text-sm font-medium text-gray-700">
        {type.charAt(0) + type.slice(1).toLowerCase()}
      </p>
      <div className="flex gap-2 flex-wrap">
        {assets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => onSelect(selected?.id === asset.id ? null : asset)}
            className={`relative rounded overflow-hidden border-2 transition-all ${
              selected?.id === asset.id
                ? "border-blue-500 ring-2 ring-blue-300"
                : "border-gray-200 hover:border-gray-400"
            }`}
            title={asset.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.imageUrl}
              alt={asset.label}
              className="w-16 h-16 object-cover"
            />
            <p className="text-xs text-center py-0.5 bg-white truncate w-16">
              {asset.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Step3Details({
  selectedStyleAssets,
  onStyleAssetChange,
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
            onSelect={(asset) => onStyleAssetChange(type, asset)}
          />
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Generating..." : "Generate Try-On"}
        </Button>
      </div>
    </div>
  );
}
