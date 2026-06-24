import { env } from "@lets_work/env/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type UploadFolder =
  | "avatars"
  | "portfolio"
  | "certifications"
  | "videos"
  | "job-attachments";

export function createUploadSignature(folder: UploadFolder) {
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    timestamp,
    folder: `letswork/${folder}`,
  };

  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET);

  return {
    timestamp,
    signature,
    folder: params.folder,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
  };
}

export { cloudinary };
