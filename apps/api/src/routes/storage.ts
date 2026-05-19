import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { authRequired } from "../middlewares/auth";
import fs from "fs";
import path from "path";

import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

function detectContentType(filePath: string): string | undefined {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return "image/png";
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return "image/jpeg";
    }
    if (buffer.slice(0, 6).toString() === "GIF87a" || buffer.slice(0, 6).toString() === "GIF89a") {
      return "image/gif";
    }
    if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") {
      return "image/webp";
    }

    return undefined;
  } catch {
    return undefined;
  }
}

const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), 'local-storage');

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", authRequired, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * PUT /storage/local-upload/:id
 *
 * Handle local file uploads for development.
 */
router.put("/storage/local-upload/:id", authRequired, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Ensure directory exists
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
    
    const filePath = path.join(LOCAL_STORAGE_DIR, id);
    req.log.info({ filePath }, "Uploading file to local storage");
    
    const writeStream = fs.createWriteStream(filePath);
    const metadataPath = `${filePath}.json`;
    let responseSent = false;
    
    const sendResponse = (status: number, data: any) => {
      if (!responseSent) {
        responseSent = true;
        res.status(status).json(data);
      }
    };
    
    req.on('error', (error) => {
      req.log.error({ err: error }, "Request stream error");
      writeStream.destroy();
      sendResponse(400, { error: "Request error during upload" });
    });
    
    writeStream.on('finish', () => {
      const contentType = typeof req.headers["content-type"] === "string"
        ? req.headers["content-type"]
        : "application/octet-stream";
      try {
        fs.writeFileSync(metadataPath, JSON.stringify({ contentType, uploadedAt: new Date().toISOString() }));
      } catch (error) {
        req.log.warn({ err: error, metadataPath }, "Failed to write local storage metadata");
      }

      req.log.info({ filePath }, "File uploaded successfully to local storage");
      sendResponse(200, { message: "File uploaded successfully" });
    });
    
    writeStream.on('error', (error) => {
      req.log.error({ err: error, filePath }, "Error writing file to local storage");
      sendResponse(500, { error: "Failed to write file" });
    });
    
    req.pipe(writeStream);
  } catch (error) {
    req.log.error({ err: error }, "Error handling file upload");
    res.status(500).json({ error: "Failed to upload file" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    if (objectPath.startsWith("/objects/local/")) {
      const objectId = objectPath.slice("/objects/local/".length);
      const filePath = path.join(LOCAL_STORAGE_DIR, objectId);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      const stat = fs.statSync(filePath);
      const metadataPath = `${filePath}.json`;
      let contentType = "application/octet-stream";

      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
          if (typeof metadata?.contentType === "string" && metadata.contentType.trim() !== "") {
            contentType = metadata.contentType;
          }
        } catch {
          // ignore and fallback to detection
        }
      }

      if (contentType === "application/octet-stream") {
        const detected = detectContentType(filePath);
        if (detected) {
          contentType = detected;
        }
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Cache-Control", "private, max-age=3600");
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

/**
 * GET /storage/download
 *
 * Download a file from storage with appropriate headers for browser download.
 * Query params:
 *   - path: The object path to download
 */
router.get("/download", async (req: Request, res: Response) => {
  try {
    const { path: objectPath } = req.query;

    if (!objectPath || typeof objectPath !== "string") {
      res.status(400).json({ error: "Missing or invalid path parameter" });
      return;
    }

    const fileBuffer = await objectStorageService.getObject(objectPath);
    
    // Determine filename from path
    const filename = objectPath.split("/").pop() || "download";
    
    // Set headers for download
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", fileBuffer.length);
    
    res.send(fileBuffer);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "File not found");
      res.status(404).json({ error: "File not found" });
      return;
    }
    req.log.error({ err: error }, "Error downloading file");
    res.status(500).json({ error: "Failed to download file" });
  }
});

export default router;
