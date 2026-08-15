export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (e) => reject(e));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

/**
 * Crops the given image source to the pixel area react-easy-crop reports
 * (onCropComplete's second argument) and returns the result as a File,
 * ready to hand straight to useFileUpload().
 */
export async function cropImageToFile(
  imageSrc: string,
  crop: PixelCrop,
  fileName: string,
  mimeType = 'image/jpeg'
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Failed to crop image'));
      resolve(new File([blob], fileName, { type: mimeType }));
    }, mimeType, 0.92);
  });
}
