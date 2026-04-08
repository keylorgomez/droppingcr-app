import { useRef } from "react";
import { ImagePlus, Trash2, Star } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Cloudinary global type ────────────────────────────────────────────────

declare global {
  interface Window {
    cloudinary: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (error: unknown, result: { event: string; info: { secure_url: string } }) => void
      ) => { open: () => void };
    };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ImageRow {
  _key: string;
  image_url: string;
  is_primary: boolean;
}

interface ImageUploadProps {
  images: ImageRow[];
  onChange: (images: ImageRow[]) => void;
  error?: string;
}

let _keyCounter = 0;
const newKey = () => String(++_keyCounter + Date.now());

// ── Component ─────────────────────────────────────────────────────────────

export default function ImageUpload({ images, onChange, error }: ImageUploadProps) {
  // Keep a ref to always have the latest images inside the widget callback
  const imagesRef = useRef<ImageRow[]>(images);
  imagesRef.current = images;

  function openWidget() {
    // Snapshot images at the moment the widget opens.
    // The callback must NEVER read imagesRef.current — by the time a second or
    // third "success" event fires, React may have already re-rendered and
    // updated the ref with previous uploads, causing duplicates.
    const baseline = imagesRef.current;
    const sessionImages: ImageRow[] = [];

    window.cloudinary.createUploadWidget(
      {
        cloudName:    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
        multiple:     true,
        resourceType: "image",
        sources:      ["local", "camera", "url"],
        maxFileSize:  5_000_000,
        clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
        cropping:     false,
        styles: {
          palette: {
            window:      "#FFFFFF",
            windowBorder:"#E5E7EB",
            tabIcon:     "#975023",
            menuIcons:   "#975023",
            textDark:    "#000011",
            textLight:   "#FFFFFF",
            link:        "#975023",
            action:      "#975023",
            inactiveTabIcon: "#9CA3AF",
            error:       "#EF4444",
            inProgress:  "#a26720",
            complete:    "#10B981",
            sourceBg:    "#F9FAFB",
          },
          fonts: { default: null, "'Poppins', sans-serif": { url: "https://fonts.googleapis.com/css?family=Poppins", active: true } },
        },
      },
      (_err, result) => {
        if (_err) return;
        if (result.event === "success") {
          const newImg: ImageRow = {
            _key:       newKey(),
            image_url:  result.info.secure_url,
            // Only the very first image (no baseline, no session yet) is primary
            is_primary: baseline.length === 0 && sessionImages.length === 0,
          };
          sessionImages.push(newImg);
          // Always rebuild from the frozen baseline + everything uploaded so far
          onChange([...baseline, ...sessionImages]);
        }
      }
    ).open();
  }

  function setPrimary(key: string) {
    onChange(images.map((img) => ({ ...img, is_primary: img._key === key })));
  }

  function removeImage(key: string) {
    const next = images.filter((img) => img._key !== key);
    if (next.length > 0 && !next.some((img) => img.is_primary)) {
      next[0].is_primary = true;
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Thumbnail gallery */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <div
              key={img._key}
              className={cn(
                "relative group rounded-xl overflow-hidden border-2 transition-all",
                img.is_primary
                  ? "border-brand-primary shadow-sm"
                  : "border-gray-100 hover:border-gray-200"
              )}
            >
              <div className="aspect-square bg-gray-50">
                <img
                  src={img.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {img.is_primary && (
                <div className="absolute top-1.5 left-1.5 bg-brand-primary rounded-full p-0.5">
                  <Star size={9} className="text-white fill-white" />
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
                              transition-opacity flex items-center justify-center gap-2">
                {!img.is_primary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(img._key)}
                    title="Marcar como principal"
                    className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center
                               hover:bg-white transition-colors"
                  >
                    <Star size={13} className="text-brand-primary" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(img._key)}
                  title="Eliminar imagen"
                  className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center
                             hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={13} className="text-gray-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {images.length > 0 && (
        <p className="text-[10px] font-poppins text-gray-400">
          La imagen con{" "}
          <Star size={9} className="inline text-brand-primary fill-brand-primary" />{" "}
          es la principal. Pasá el cursor para cambiarla o eliminarla.
        </p>
      )}

      {/* Empty state */}
      {images.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 border-2 border-dashed
                        border-gray-200 rounded-xl text-gray-400">
          <ImagePlus size={26} strokeWidth={1.4} />
          <p className="text-xs font-poppins">Aún no hay imágenes</p>
          <p className="text-[11px] font-poppins text-gray-300">
            JPG, PNG o WebP · Máx. 5 MB por imagen
          </p>
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={openWidget}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-primary
                   text-brand-primary text-sm font-poppins font-medium self-start
                   hover:bg-brand-bg transition-colors"
      >
        <ImagePlus size={16} strokeWidth={1.8} />
        {images.length === 0 ? "Subir imágenes" : "Agregar más imágenes"}
      </button>

      {error && (
        <span className="text-[11px] text-red-500 font-poppins -mt-2">{error}</span>
      )}
    </div>
  );
}
