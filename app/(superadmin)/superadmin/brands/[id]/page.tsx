"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Trash2, Upload, ArrowLeft, Plus } from "lucide-react";

interface StyleAsset {
  id: string;
  label: string;
  promptDescription: string | null;
  imageUrl: string;
  type: string;
}

interface BrandUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AIModel {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  promptEndpoint: string;
  styleAssets: StyleAsset[];
  users: BrandUser[];
}

const ASSET_TYPES = ["LIGHTING", "POSE", "BACKGROUND", "COMPOSITION"] as const;
type AssetType = (typeof ASSET_TYPES)[number];

const TYPE_LABELS: Record<AssetType, string> = {
  LIGHTING: "Lighting",
  POSE: "Pose",
  BACKGROUND: "Background",
  COMPOSITION: "Composition",
};

function AssetCard({
  asset,
  brandId,
  onImageUpdate,
  onImageClear,
  onDelete,
  onPromptDescUpdate,
}: {
  asset: StyleAsset;
  brandId: string;
  onImageUpdate: (id: string, imageUrl: string) => void;
  onImageClear: () => void;
  onDelete: (id: string) => void;
  onPromptDescUpdate: (id: string, promptDescription: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [desc, setDesc] = useState(asset.promptDescription || "");
  const [saving, setSaving] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `/api/superadmin/brands/${brandId}/style-assets/${asset.id}`,
      { method: "PATCH", body: fd }
    );
    if (res.ok) {
      const { asset: updated } = await res.json();
      onImageUpdate(asset.id, updated.imageUrl);
    }
    e.target.value = "";
  }

  function handleClearImage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    fetch(`/api/superadmin/brands/${brandId}/style-assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearImage: true }),
    }).then((res) => { if (res.ok) onImageClear(); });
  }

  async function handleSaveDesc() {
    setSaving(true);
    const res = await fetch(`/api/superadmin/brands/${brandId}/style-assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptDescription: desc.trim() || null }),
    });
    if (res.ok) onPromptDescUpdate(asset.id, desc.trim() || null);
    setSaving(false);
  }

  return (
    <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 4 }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div
          style={{ width: 72, height: 72, border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
          onClick={() => fileRef.current?.click()}
        >
          {asset.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.imageUrl} alt={asset.label} style={{ width: 72, height: 72, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
              <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", lineHeight: 1.3 }}>{asset.label}</span>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", margin: 0 }}>{asset.label}</p>
          {asset.imageUrl && (
            <button type="button" onClick={handleClearImage} className="text-xs text-red-500 underline cursor-pointer bg-transparent border-0 p-0 text-left hover:text-red-700">
              Görseli kaldır
            </button>
          )}
          <button type="button" onClick={() => onDelete(asset.id)} className="text-xs text-red-400 underline cursor-pointer bg-transparent border-0 p-0 text-left hover:text-red-600">
            Sil
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ fontSize: 10, color: "#6b7280" }}>Prompt açıklaması</label>
          <button
            type="button"
            onClick={handleSaveDesc}
            disabled={saving}
            style={{ fontSize: 11, background: "#1f2937", color: "white", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", opacity: saving ? 0.5 : 1 }}
          >
            {saving ? "..." : "Kaydet"}
          </button>
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Prompta gidecek ayrıntılı açıklama..."
          rows={3}
          style={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 4, padding: "4px 6px", resize: "vertical", width: "100%" }}
        />
      </div>
    </div>
  );
}

function AssetUploadRow({
  brandId,
  type,
  onUploaded,
}: {
  brandId: string;
  type: AssetType;
  onUploaded: (asset: StyleAsset) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [promptDescription, setPromptDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { setError("Enter a label."); return; }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      const file = fileRef.current?.files?.[0];
      if (file) formData.append("file", file);
      formData.append("label", label.trim());
      if (promptDescription.trim()) formData.append("promptDescription", promptDescription.trim());
      formData.append("type", type);
      const res = await fetch(`/api/superadmin/brands/${brandId}/style-assets`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const { asset } = await res.json();
      onUploaded(asset);
      setLabel("");
      setPromptDescription("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 mt-4 flex-wrap">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Label (görünen isim)</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Red Studio"
          className="border border-gray-300 rounded px-2 py-1 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Prompt açıklaması (prompta gider)</label>
        <textarea
          value={promptDescription}
          onChange={(e) => setPromptDescription(e.target.value)}
          placeholder="Ayrıntılı açıklama..."
          rows={2}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Image (optional)</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="text-sm text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
      </div>
      <button
        type="submit"
        disabled={uploading}
        className="flex items-center gap-1 bg-gray-900 text-white text-xs px-3 py-1.5 rounded hover:bg-gray-700 disabled:opacity-50"
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "Adding..." : "Add"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}

export default function BrandDetailPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", password: "" });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [models, setModels] = useState<AIModel[]>([]);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelForm, setModelForm] = useState({ name: "" });
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [creatingModel, setCreatingModel] = useState(false);
  const [modelError, setModelError] = useState("");
  const modelFileRef = useRef<HTMLInputElement>(null);

  async function loadBrand() {
    const r = await fetch(`/api/superadmin/brands/${brandId}`);
    const d = await r.json();
    setBrand(d.brand || null);
    setLoading(false);
  }

  async function loadModels() {
    const r = await fetch(`/api/superadmin/brands/${brandId}/models`);
    const d = await r.json();
    setModels(d.models || []);
  }

  useEffect(() => { loadBrand(); loadModels(); }, [brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAssetUploaded(asset: StyleAsset) {
    setBrand((b) => b ? { ...b, styleAssets: [...b.styleAssets, asset] } : b);
  }

  async function handleDeleteAsset(assetId: string) {
    const res = await fetch(`/api/superadmin/brands/${brandId}/style-assets/${assetId}`, { method: "DELETE" });
    if (res.ok) await loadBrand();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    setUserError("");
    const res = await fetch(`/api/superadmin/brands/${brandId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    if (res.ok) {
      const { user } = await res.json();
      setBrand((b) => b ? { ...b, users: [...b.users, user] } : b);
      setUserForm({ email: "", password: "" });
      setShowUserForm(false);
    } else {
      const d = await res.json();
      setUserError(d.error || "Failed");
    }
    setCreatingUser(false);
  }

  async function handleDeleteUser(userId: string) {
    const res = await fetch(`/api/superadmin/brands/${brandId}/users/${userId}`, { method: "DELETE" });
    if (res.ok) setBrand((b) => b ? { ...b, users: b.users.filter((u) => u.id !== userId) } : b);
  }

  async function handleCreateModel(e: React.FormEvent) {
    e.preventDefault();
    if (!modelFile) { setModelError("Please select an image."); return; }
    setCreatingModel(true);
    setModelError("");
    const fd = new FormData();
    fd.append("name", modelForm.name);
    fd.append("file", modelFile);
    const res = await fetch(`/api/superadmin/brands/${brandId}/models`, { method: "POST", body: fd });
    if (res.ok) {
      const { model } = await res.json();
      setModels((prev) => [...prev, model]);
      setModelForm({ name: "" });
      setModelFile(null);
      if (modelFileRef.current) modelFileRef.current.value = "";
      setShowModelForm(false);
    } else {
      const d = await res.json();
      setModelError(d.error || "Failed");
    }
    setCreatingModel(false);
  }

  async function handleDeleteModel(modelId: string) {
    const res = await fetch(`/api/superadmin/brands/${brandId}/models/${modelId}`, { method: "DELETE" });
    if (res.ok) setModels((prev) => prev.filter((m) => m.id !== modelId));
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!brand) return <p className="text-sm text-red-500">Brand not found.</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/superadmin" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Brands
        </Link>
        <h1 className="text-2xl font-semibold">{brand.name}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{brand.slug}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Style Assets</h2>
        {ASSET_TYPES.map((type) => {
          const typeAssets = brand.styleAssets.filter((a) => a.type === type);
          return (
            <div key={type} className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="font-medium text-sm text-gray-800">{TYPE_LABELS[type]}</p>
              {typeAssets.length === 0 ? (
                <p className="text-xs text-gray-400 mt-2">No assets yet.</p>
              ) : (
                <div className="flex flex-wrap gap-3 mt-3">
                  {typeAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      brandId={brandId}
                      onImageUpdate={(id, imageUrl) =>
                        setBrand((b) => b ? { ...b, styleAssets: b.styleAssets.map((a) => a.id === id ? { ...a, imageUrl } : a) } : b)
                      }
                      onImageClear={loadBrand}
                      onDelete={handleDeleteAsset}
                      onPromptDescUpdate={(id, promptDescription) =>
                        setBrand((b) => b ? { ...b, styleAssets: b.styleAssets.map((a) => a.id === id ? { ...a, promptDescription } : a) } : b)
                      }
                    />
                  ))}
                </div>
              )}
              <AssetUploadRow brandId={brand.id} type={type} onUploaded={handleAssetUploaded} />
            </div>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI Models</h2>
          <button
            onClick={() => setShowModelForm((v) => !v)}
            className="flex items-center gap-1 text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Model
          </button>
        </div>

        {showModelForm && (
          <form onSubmit={handleCreateModel} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3 max-w-sm">
            <div>
              <label className="text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={modelForm.name}
                onChange={(e) => setModelForm({ name: e.target.value })}
                placeholder="e.g. Aysegul"
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Image</label>
              <input
                ref={modelFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
                className="mt-1 text-sm text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                required
              />
            </div>
            {modelError && <p className="text-xs text-red-500">{modelError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={creatingModel} className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded hover:bg-gray-700 disabled:opacity-50">
                {creatingModel ? "Uploading..." : "Add Model"}
              </button>
              <button type="button" onClick={() => setShowModelForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        )}

        {models.length === 0 ? (
          <p className="text-sm text-gray-400">No models yet.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {models.map((model) => (
              <div key={model.id} style={{ width: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={model.thumbnailUrl}
                  alt={model.name}
                  style={{ width: 112, height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <p style={{ fontSize: 12, fontWeight: 500, color: "#374151", textAlign: "center" }}>{model.name}</p>
                <button
                  type="button"
                  onClick={() => handleDeleteModel(model.id)}
                  style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "50%", padding: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="Remove model"
                >
                  <Trash2 style={{ width: 12, height: 12, color: "#ef4444" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Users</h2>
          <button
            onClick={() => setShowUserForm((v) => !v)}
            className="flex items-center gap-1 text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add User
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={handleCreateUser} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3 max-w-sm">
            <div>
              <label className="text-xs text-gray-500">Email</label>
              <input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@brand.com"
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Password</label>
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 characters"
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
            {userError && <p className="text-xs text-red-500">{userError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={creatingUser} className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded hover:bg-gray-700 disabled:opacity-50">
                {creatingUser ? "Creating..." : "Create User"}
              </button>
              <button type="button" onClick={() => setShowUserForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        )}

        {brand.users.length === 0 ? (
          <p className="text-sm text-gray-400">No users yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {brand.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{user.email}</p>
                  <p className="text-xs text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDeleteUser(user.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete user">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
