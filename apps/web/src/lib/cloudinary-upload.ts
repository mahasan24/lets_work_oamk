import { env } from "@lets_work/env/web";

import { jobsApi, type UploadSignature as JobUploadSignature } from "./jobs-api";
import { profileApi, type UploadSignature } from "./profile-api";

type ProfileUploadFolder = "avatars" | "portfolio" | "certifications" | "videos";

export async function uploadToCloudinary(
  file: File,
  folder: ProfileUploadFolder,
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

async function uploadWithSignature(file: File, signature: UploadSignature | JobUploadSignature) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message ?? "Upload failed");
  }

  const data = (await response.json()) as { secure_url: string };
  return data.secure_url;
}

export async function uploadJobAttachment(file: File) {
  const signature = await jobsApi.getUploadSignature();
  const url = await uploadWithSignature(file, signature);
  return {
    id: crypto.randomUUID(),
    url,
    fileName: file.name,
    mimeType: file.type || null,
  };
}

export async function uploadProposalAttachment(file: File) {
  const { proposalsApi } = await import("./proposals-api");
  const signature = await proposalsApi.getUploadSignature();
  const url = await uploadWithSignature(file, signature);
  return {
    id: crypto.randomUUID(),
    url,
    fileName: file.name,
    mimeType: file.type || null,
  };
}

export type { UploadSignature };
