import { useState } from "react";
import { customFetchRaw, getApiUrl } from "@/lib/customFetch";

interface UploadResult {
  objectPath: string;
  url: string;
}

function getAuthHeader() {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("ghar_khoj_jwt");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function requestUploadUrl(name: string, contentType: string, size: number) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(getAuthHeader() ?? {}),
  };

  const res = await customFetchRaw("/api/storage/uploads/request-url", {
    method: "POST",
    headers,
    body: JSON.stringify({ name, contentType, size }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized. Please sign in again.");
    }
    throw new Error("Failed to get upload URL");
  }
  return res.json() as Promise<{ uploadURL: string; objectPath: string }>;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const { uploadURL, objectPath } = await requestUploadUrl(file.name, file.type, file.size);
  const headers: Record<string, string> = { "Content-Type": file.type };
  const authHeader = getAuthHeader();
  if (authHeader) {
    Object.assign(headers, authHeader);
  }

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!putRes.ok) {
    if (putRes.status === 401) {
      throw new Error("Upload unauthorized. Please sign in again.");
    }
    const text = await putRes.text();
    throw new Error(`Upload failed: ${putRes.status} ${text}`);
  }
  const objectSegment = objectPath.replace(/^\/objects\//, "");
  const url = getApiUrl(`/api/storage/objects/${objectSegment}`);
  return { objectPath, url };
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadFile(file);
      setProgress(100);
      return result;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress };
}

export function useMultiUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [total, setTotal] = useState(0);

  const uploadAll = async (files: File[]): Promise<UploadResult[]> => {
    setUploading(true);
    setTotal(files.length);
    setUploadedCount(0);
    const results: UploadResult[] = [];
    try {
      for (const file of files) {
        const result = await uploadFile(file);
        results.push(result);
        setUploadedCount(c => c + 1);
      }
      return results;
    } finally {
      setUploading(false);
    }
  };

  return { uploadAll, uploading, uploadedCount, total };
}
