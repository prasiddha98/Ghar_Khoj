import express, { Router, type IRouter, type Request, type Response } from "express";
import { authRequired } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function getFolderFromContentType(contentType: string, explicitFolder?: string) {
  if (explicitFolder && explicitFolder.trim().length > 0) {
    return explicitFolder;
  }

  const normalized = contentType.toLowerCase();
  if (normalized.startsWith("image/")) return "uploads/images";
  if (normalized.startsWith("video/")) return "uploads/videos";
  if (normalized === "application/pdf") return "uploads/documents";
  if (normalized.startsWith("text/")) return "uploads/text";
  return "uploads/raw";
}

router.put(
  "/storage/uploads",
  authRequired,
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req: Request, res: Response) => {
    try {
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: "No file content was provided" });
      }

      const contentType = typeof req.headers["content-type"] === "string"
        ? req.headers["content-type"]
        : "application/octet-stream";
      const filename = typeof req.headers["x-file-name"] === "string"
        ? req.headers["x-file-name"]
        : `upload-${Date.now()}`;
      const explicitFolder = typeof req.query.folder === "string" ? req.query.folder : undefined;
      const folder = getFolderFromContentType(contentType, explicitFolder);
      const resourceType = objectStorageService.getResourceTypeFromMime(contentType);

      const objectPath = await objectStorageService.uploadBuffer(buffer, filename, folder, resourceType);
      return res.json({ objectPath });
    } catch (error) {
      console.error("Error uploading file to Cloudinary", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  },
);

export default router;
