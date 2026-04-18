import cloudinary from "../utils/cloudInary";

/**
 * Fetches ALL resources from Cloudinary (both image & raw types)
 * and returns a Map of public_id → actual bytes.
 *
 * This is the single source of truth for file sizes.
 * Paginated automatically (500 per page).
 */
export const buildCloudinaryBytesMap = async (): Promise<Map<string, number>> => {
  const bytesMap = new Map<string, number>();

  for (const resourceType of ["image", "raw"] as const) {
    let nextCursor: string | undefined;

    do {
      const result: any = await cloudinary.api.resources({
        type: "upload",
        resource_type: resourceType,
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      });

      for (const r of result.resources || []) {
        bytesMap.set(r.public_id, r.bytes || 0);
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);
  }

  return bytesMap;
};

/**
 * Gets the actual bytes for a single Cloudinary resource.
 * Returns null if the resource doesn't exist.
 */
export const getCloudinaryResourceBytes = async (
  publicId: string,
  resourceType: "image" | "raw" = "raw"
): Promise<number | null> => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });
    return result.bytes || 0;
  } catch {
    return null;
  }
};
