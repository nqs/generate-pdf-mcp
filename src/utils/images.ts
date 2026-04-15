/**
 * Detect image format from magic bytes.
 * PNG starts with 0x89504E47, JPG starts with 0xFFD8FF.
 */
export function detectImageFormat(data: Uint8Array): "png" | "jpg" {
  if (
    data.length >= 4 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return "png";
  }

  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return "jpg";
  }

  // Default to png if unknown
  return "png";
}

/**
 * Decode a base64 string to Uint8Array.
 * Handles data URI prefix if present (e.g., data:image/png;base64,...).
 */
export function decodeBase64(base64: string): Uint8Array {
  let raw = base64;

  // Strip data URI prefix
  const commaIndex = raw.indexOf(",");
  if (commaIndex !== -1 && raw.startsWith("data:")) {
    raw = raw.slice(commaIndex + 1);
  }

  const binaryString = atob(raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch an image URL and return its bytes.
 * Throws on non-200 responses.
 */
export async function fetchImageAsBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image from ${url}: ${response.status} ${response.statusText}`
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

