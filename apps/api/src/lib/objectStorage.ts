import path from "path";
import { randomUUID } from "crypto";
import cloudinary from "./cloudinary";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getResourceTypeFromMime(mimeType: string): "image" | "video" | "raw" | "auto" {
    const normalized = (mimeType || "").toLowerCase();
    if (normalized.startsWith("image/")) return "image";
    if (normalized.startsWith("video/")) return "video";
    if (
      normalized === "application/pdf" ||
      normalized === "application/msword" ||
      normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      normalized === "application/zip" ||
      normalized === "application/octet-stream"
    ) {
      return "raw";
    }
    return "auto";
  }

  getPublicId(filename: string): string {
    const baseName = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${baseName}-${randomUUID().slice(0, 8)}`;
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    folder: string,
    resourceType: "image" | "video" | "raw" | "auto" = "auto"
  ): Promise<string> {
    const public_id = this.getPublicId(filename);
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      public_id,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result || !result.secure_url) {
          reject(new Error("Cloudinary upload did not return a secure URL"));
          return;
        }
        resolve(result.secure_url);
      });

      uploadStream.on("error", reject);
      uploadStream.end(buffer);
    });
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath) return rawPath;
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      return rawPath;
    }
    return rawPath;
  }
}
