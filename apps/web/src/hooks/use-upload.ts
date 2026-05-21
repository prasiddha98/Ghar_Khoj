import { useState } from "react";
import { getApiUrl } from "@/lib/customFetch";

interface UploadResult {
  objectPath: string;
  url: string;
}

function getAuthHeader() {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("ghar_khoj_jwt");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const headers: Record<string, string> = {
    "Content-Type": file.type || "application/octet-stream",
    "X-File-Name": file.name,
    ...(getAuthHeader() ?? {}),
  };

  const uploadUrl = getApiUrl("/api/storage/uploads");
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!uploadRes.ok) {
    if (uploadRes.status === 401) {
      throw new Error("Upload unauthorized. Please sign in again.");
    }
    const text = await uploadRes.text();
    throw new Error(`Upload failed: ${uploadRes.status} ${text}`);
  }

  const data = (await uploadRes.json()) as { objectPath: string };
  if (!data?.objectPath) {
    throw new Error("Upload response did not include objectPath");
  }

  return { objectPath: data.objectPath, url: data.objectPath };
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
        setUploadedCount((c) => c + 1);
      }
      return results;
    } finally {
      setUploading(false);
    }
  };

  return { uploadAll, uploading, uploadedCount, total };
}
