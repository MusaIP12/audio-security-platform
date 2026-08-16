const API_BASE = "http://127.0.0.1:8000/api";

export async function convertFile(formData: FormData) {
  const response = await fetch(`${API_BASE}/convert`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Conversion failed");
  }

  return data;
}

export async function classifyUpload(formData: FormData) {
  const response = await fetch(`${API_BASE}/classify-upload`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Classification failed");
  }

  return data;
}

export function buildDownloadUrl(path: string) {
  return `${API_BASE}/download?path=${encodeURIComponent(path)}`;
}