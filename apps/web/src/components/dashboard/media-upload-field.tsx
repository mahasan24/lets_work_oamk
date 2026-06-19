import { Button } from "@lets_work/ui/components/button";
import { cn } from "@lets_work/ui/lib/utils";
import { useRef, useState } from "react";

type PreviewVariant = "avatar" | "video" | "card";

type MediaUploadFieldProps = {
  label: string;
  accept: string;
  previewUrl?: string | null;
  previewVariant?: PreviewVariant;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => void;
};

export function MediaUploadField({
  label,
  accept,
  previewUrl,
  previewVariant = accept.startsWith("video") ? "video" : "avatar",
  onUpload,
  onRemove,
}: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {previewUrl ? (
        previewVariant === "video" ? (
          <video
            src={previewUrl}
            controls
            className="aspect-video w-full max-w-lg bg-muted object-cover"
          />
        ) : previewVariant === "card" ? (
          <img src={previewUrl} alt="" className="aspect-video w-full max-w-xs object-cover" />
        ) : (
          <img src={previewUrl} alt="" className="size-24 rounded-full object-cover" />
        )
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? "Uploading..." : label}
        </Button>
        {previewUrl && onRemove ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MediaUploadDropzone({
  label,
  accept,
  previewUrl,
  previewVariant = "video",
  onUpload,
  className,
}: MediaUploadFieldProps & { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {previewUrl ? (
        previewVariant === "video" ? (
          <video
            src={previewUrl}
            controls
            className="aspect-video w-full bg-muted object-cover"
          />
        ) : (
          <img src={previewUrl} alt="" className="aspect-video w-full object-cover" />
        )
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex aspect-video w-full flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/30 px-6 text-center transition-colors hover:bg-muted/50",
            isDragging && "border-primary bg-primary/5",
          )}
        >
          <p className="text-sm font-medium">{isUploading ? "Uploading..." : label}</p>
          <p className="text-xs text-muted-foreground">
            Drag and drop a file here, or click to browse
          </p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {previewUrl ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? "Uploading..." : "Replace video"}
        </Button>
      ) : null}
    </div>
  );
}
