import api from "./axios"

/**
 * Upload a file to the server.
 * @param file - The file to upload
 * @param category - One of: "venue", "avatar", "proof"
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(file: File, category: string): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("category", category)

  const res = await api.post("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data.data.url as string
}
