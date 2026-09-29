export function getUploadErrorMessage(error: any): string {
  const data = error?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) {
    const text = message.map((entry: any) => typeof entry === "string" ? entry : entry?.value)
      .filter((value: unknown) => typeof value === "string" && value.trim()).join("; ");
    if (text) return text;
  }
  if (typeof message === "string" && message.trim()) return message;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  return error?.message || "Unable to upload files. Please try again.";
}
