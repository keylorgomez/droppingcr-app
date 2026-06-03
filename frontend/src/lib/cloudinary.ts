/**
 * Cloudinary URL helper.
 *
 * Injects transformation parameters into a Cloudinary delivery URL so images
 * are served optimized (auto-format → WebP/AVIF, auto-quality compression) and
 * sized to the display context.
 *
 * The original URL stored in the database is never modified — the transformation
 * is applied only at render time.
 */

type CloudinarySize = "thumb" | "medium" | "full";

// w_ caps the longest dimension; f_auto serves WebP/AVIF; q_auto compresses
const SIZE_PARAMS: Record<CloudinarySize, string> = {
  thumb:  "f_auto,q_auto:eco,w_400",   // thumbnails: cards, cart, list rows
  medium: "f_auto,q_auto,w_800",        // modal/sheet images
  full:   "f_auto,q_auto,w_1400",       // product detail hero + lightbox
};

export function cloudinaryUrl(url: string, size: CloudinarySize = "medium"): string {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  const params = SIZE_PARAMS[size];
  // Guard against double-injection
  if (url.includes(params)) return url;
  return url.replace("/upload/", `/upload/${params}/`);
}
