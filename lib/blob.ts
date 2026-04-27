import { put } from "@vercel/blob";

export async function uploadGarment(
  file: File,
  userId: string,
  type: "top_garment" | "bottom_garment" | "dress"
): Promise<string> {
  const filename = `${Date.now()}-${file.name}`;
  const blob = await put(`garments/${userId}/${type}/${filename}`, file, {
    access: "public",
  });
  return blob.url;
}
