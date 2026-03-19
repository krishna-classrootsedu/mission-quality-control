import { action } from "./_generated/server";
import { v } from "convex/values";

// Parse a PPTX file via the VPS microservice.
// Frontend uploads file to Convex storage first, then calls this action.
// This keeps the parser URL and API key server-side only.
export const parsePptx = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const parserUrl = process.env.PARSER_URL;
    const parserApiKey = process.env.PARSER_API_KEY;
    if (!parserUrl || !parserApiKey) {
      throw new Error("Parser not configured");
    }

    // Get the file from Convex storage
    const fileUrl = await ctx.storage.getUrl(storageId);
    if (!fileUrl) {
      throw new Error("File not found in storage");
    }

    // Download the file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error("Failed to download file from storage");
    }
    const fileBlob = await fileResponse.blob();

    // Send to parser as multipart form data
    const formData = new FormData();
    formData.append("file", fileBlob, "upload.pptx");

    const parserResponse = await fetch(`${parserUrl}/parse-pptx`, {
      method: "POST",
      headers: { "X-API-Key": parserApiKey },
      body: formData,
    });

    if (!parserResponse.ok) {
      const text = await parserResponse.text();
      throw new Error(`Parser error (${parserResponse.status}): ${text}`);
    }

    const parsed = await parserResponse.json();
    return parsed;
  },
});
