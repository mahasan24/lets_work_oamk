import { env } from "@lets_work/env/web";

import { profileApi, type UploadSignature } from "./profile-api";

type UploadFolder = "avatars" | "portfolio" | "certifications" | "videos";

export async function uploadToCloudinary(
  file: File,
  folder: UploadFolder,
): Promise<{ url: string; resourceType: "image" | "video" }> {
  const signature = await profileApi.getUploadSignature(folder);
  const resourceType = folder === "videos" ? "video" : "image";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);

  const endpoint =
    resourceType === "video"
      ? `https://api.cloudinary.com/v1_1/${env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`
      : `https://api.cloudinary.com/v1_1/${env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message ?? "Upload failed");
  }

  const data = (await response.json()) as { secure_url: string };
  return { url: data.secure_url, resourceType };
}

export type { UploadSignature };
