/**
 * Utility to crop an image using canvas and output a 256x256 WebP blob.
 */

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates an image element from a source URL.
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

/**
 * Crops the given image source at the specified pixel coordinates,
 * resizes to 256x256, and returns a WebP Blob.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop
): Promise<Blob> {
  const image = await createImage(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Set output size to 256x256
  const OUTPUT_SIZE = 256;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  // Draw the cropped area scaled to 256x256
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  // Convert to WebP blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create image blob"));
        }
      },
      "image/webp",
      0.85
    );
  });
}
