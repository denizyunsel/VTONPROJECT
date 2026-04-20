"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface AIModel {
  id: string;
  name: string;
  thumbnailUrl: string;
  imageUrl: string;
}

interface Props {
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Step2Model({
  selectedModelId,
  onSelect,
  onBack,
  onNext,
}: Props) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => setModels(data.models || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Select AI Model</h2>
        <p className="text-sm text-gray-500">
          Choose the AI model to wear your garments.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading models...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => onSelect(model.id)}
              className={`rounded-lg overflow-hidden border-2 transition-all text-left ${
                selectedModelId === model.id
                  ? "border-blue-500 ring-2 ring-blue-300"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={model.thumbnailUrl}
                alt={model.name}
                className="w-full h-40 object-cover"
              />
              <div className="p-2">
                <p className="text-sm font-medium">{model.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!selectedModelId}>
          Next
        </Button>
      </div>
    </div>
  );
}
