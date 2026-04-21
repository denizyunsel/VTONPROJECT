"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Trash2, Upload, ArrowLeft, Plus } from "lucide-react";

interface StyleAsset {
  id: string;
  label: string;
  imageUrl: string;
  type: string;
}

interface BrandUser {
  id: string;
  email: string;
  createdAt: string;
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
  onDelete,
}: {
  asset: StyleAsset;
  brandId: string;
  onImageUpdate: (id: string, imageUrl: string) => void;
  onDelete: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div style={{ width: 104, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div
        style={{ width: 96, height: 96, border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
        onClick={() => fileRef.current?.click()}
      >
        {asset.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.imageUrl}
            alt={asset.label}
            style={{ width: 96, height: 96, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
            <span style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.3 }}>{asset.label}</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: "#4b5563", textAlign: "center", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingInline: 4 }}>
        {asset.label}
      </p>

      <button
        type="button"
        onClick={() => onDelete(asset.id)}
        style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "50%", padding: 3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        title="Delete"
      >
        <Trash2 style={{ width: 12, height: 12, color: "#ef4444" }} />
      </button>
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
      formData.append("type", type);
      const res = await fetch(`/api/superadmin/brands/${brandId}/style-assets`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const { asset } = await res.json();
      onUploaded(asset);
      setLabel("");
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
        <label className="text-xs text-gray-400">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Soft Natural Light"
          className="border border-gray-300 rounded px-2 py-1 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-gray-300"
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

  useEffect(() => {
    fetch(`/api/superadmin/brands/${brandId}`)
      .then((r) => r.json())
      .then((d) => setBrand(d.brand || null))
      .finally(() => setLoading(false));
  }, [brandId]);

  function handleAssetUploaded(asset: StyleAsset) {
    setBrand((b) => b ? { ...b, styleAssets: [...b.styleAssets, asset] } : b);
  }

  async function handleDeleteAsset(assetId: string) {
    const res = await fetch(`/api/superadmin/brands/${brandId}/style-assets/${assetId}`, { method: "DELETE" });
    if (res.ok) setBrand((b) => b ? { ...b, styleAssets: b.styleAssets.filter((a) => a.id !== assetId) } : b);
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
                      onDelete={handleDeleteAsset}
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
