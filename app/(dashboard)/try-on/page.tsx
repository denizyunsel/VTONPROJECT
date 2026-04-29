"use client";

import { useState } from "react";
import Step1Upload, { type GarmentImage } from "@/components/tryon-wizard/Step1Upload";
import Step2Model from "@/components/tryon-wizard/Step2Model";
import Step3Details from "@/components/tryon-wizard/Step3Details";
import Step4Result from "@/components/tryon-wizard/Step4Result";

interface StyleAsset {
  id: string;
  label: string;
  imageUrl: string;
  type: string;
}

interface WizardState {
  garmentMode: "separates" | "dress";
  topGarmentImages: GarmentImage[];
  bottomGarmentImages: GarmentImage[];
  topDescription: string;
  bottomDescription: string;
  dressImages: GarmentImage[];
  dressDescription: string;
  selectedModelId: string | null;
  productDetails: string;
  selectedStyleAssets: Record<string, StyleAsset | null>;
  styleDescriptions: Record<string, string>;
  resolution: "1K" | "2K" | "4K";
  jobId: string | null;
}

const STEPS = ["Upload", "Model", "Details", "Result"];

export default function TryOnPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<WizardState>({
    garmentMode: "separates",
    topGarmentImages: [],
    bottomGarmentImages: [],
    topDescription: "",
    bottomDescription: "",
    dressImages: [],
    dressDescription: "",
    selectedModelId: null,
    productDetails: "",
    selectedStyleAssets: {},
    styleDescriptions: {},
    resolution: "1K",
    jobId: null,
  });

  function update(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const selectedAssetIds = Object.fromEntries(
        Object.entries(state.selectedStyleAssets)
          .filter(([, v]) => v !== null)
          .map(([k, v]) => [k, v!.id])
      );

      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: state.selectedModelId,
          garmentMode: state.garmentMode,
          topGarmentImages: state.topGarmentImages,
          bottomGarmentImages: state.bottomGarmentImages,
          topDescription: state.topDescription,
          bottomDescription: state.bottomDescription,
          dressImages: state.dressImages,
          dressDescription: state.dressDescription,
          productDetails: state.productDetails,
          selectedStyleAssets: selectedAssetIds,
          styleDescriptions: state.styleDescriptions,
          resolution: state.resolution,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start job");

      update({ jobId: data.jobId });
      setStep(4);
    } catch (err) {
      console.error(err);
      alert("Failed to start try-on. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setState({
      garmentMode: "separates",
      topGarmentImages: [],
      bottomGarmentImages: [],
      topDescription: "",
      bottomDescription: "",
      dressImages: [],
      dressDescription: "",
      selectedModelId: null,
      productDetails: "",
      selectedStyleAssets: {},
      styleDescriptions: {},
      resolution: "1K",
      jobId: null,
    });
    setStep(1);
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isActive = n === step;
          const isDone = n < step;
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    isActive
                      ? "border-blue-500 bg-blue-500 text-white"
                      : isDone
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-300 text-gray-400"
                  }`}
                >
                  {n}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    isActive ? "text-blue-600 font-medium" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-16 mx-2 mb-4 ${
                    isDone ? "bg-blue-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {step === 1 && (
          <Step1Upload
            garmentMode={state.garmentMode}
            topGarmentImages={state.topGarmentImages}
            bottomGarmentImages={state.bottomGarmentImages}
            topDescription={state.topDescription}
            bottomDescription={state.bottomDescription}
            dressImages={state.dressImages}
            dressDescription={state.dressDescription}
            onGarmentModeChange={(mode) => update({ garmentMode: mode })}
            onTopChange={(images) => update({ topGarmentImages: images })}
            onBottomChange={(images) => update({ bottomGarmentImages: images })}
            onTopDescriptionChange={(val) => update({ topDescription: val })}
            onBottomDescriptionChange={(val) => update({ bottomDescription: val })}
            onDressChange={(images) => update({ dressImages: images })}
            onDressDescriptionChange={(val) => update({ dressDescription: val })}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Model
            selectedModelId={state.selectedModelId}
            onSelect={(id) => update({ selectedModelId: id })}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Details
            selectedStyleAssets={state.selectedStyleAssets}
            styleDescriptions={state.styleDescriptions}
            resolution={state.resolution}
            onStyleAssetChange={(type, assets) =>
              update({
                selectedStyleAssets: {
                  ...state.selectedStyleAssets,
                  [type]: assets,
                },
              })
            }
            onStyleDescriptionChange={(type, desc) =>
              update({
                styleDescriptions: {
                  ...state.styleDescriptions,
                  [type]: desc,
                },
              })
            }
            onResolutionChange={(res) => update({ resolution: res })}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
        {step === 4 && state.jobId && (
          <Step4Result jobId={state.jobId} onRetry={handleRetry} />
        )}
      </div>
    </div>
  );
}
