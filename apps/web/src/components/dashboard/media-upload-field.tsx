import { Button } from "@lets_work/ui/components/button";
import { useRef, useState } from "react";

type MediaUploadFieldProps = {
  label: string;
  accept: string;
  previewUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
};

export function MediaUploadField({
  label,
  accept,
  previewUrl,
  onUpload,
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
        accept.startsWith("video") ? (
          <video src={previewUrl} controls className="max-h-48 w-full max-w-md bg-muted" />
        ) : (
          <img src={previewUrl} alt="" className="size-24 rounded-full object-cover" />
        )
      ) : null}
      <div className="flex items-center gap-3">
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
      </div>
    </div>
  );
}
