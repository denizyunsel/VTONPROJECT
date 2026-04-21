"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Image as ImageIcon, Plus } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  slug: string;
  _count: { users: number; styleAssets: number };
}

export default function SuperAdminPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", promptEndpoint: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/superadmin/brands")
      .then((r) => r.json())
      .then((d) => setBrands(d.brands || []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/superadmin/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const { brand } = await res.json();
      setBrands((prev) => [...prev, { ...brand, _count: { users: 0, styleAssets: 0 } }]);
      setForm({ name: "", slug: "", promptEndpoint: "" });
      setShowForm(false);
    } else {
      const d = await res.json();
      setError(d.error || "Failed");
    }
    setCreating(false);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Brands</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm px-3 py-1.5 rounded hover:bg-gray-700"
        >
          <Plus className="w-4 h-4" />
          New Brand
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-5 space-y-3 max-w-lg"
        >
          <h2 className="font-medium text-sm">Create Brand</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Koton"
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="koton"
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Prompt Endpoint (optional)</label>
            <input
              value={form.promptEndpoint}
              onChange={(e) => setForm((f) => ({ ...f, promptEndpoint: e.target.value }))}
              placeholder="https://..."
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {brands.length === 0 ? (
        <p className="text-sm text-gray-400">No brands yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/superadmin/brands/${brand.id}`}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-400 transition-colors"
            >
              <h2 className="font-semibold text-gray-900">{brand.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{brand.slug}</p>
              <div className="flex gap-4 mt-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {brand._count.users} users
                </span>
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {brand._count.styleAssets} assets
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
