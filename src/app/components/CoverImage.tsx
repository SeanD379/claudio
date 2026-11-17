"use client";

import { useRef, useState, type ImgHTMLAttributes } from "react";
import { coverImageUrl } from "@/app/lib/cover-image";
import { createLoadingId, recordLoading } from "@/app/lib/loading-diagnostics";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "loading" | "fetchPriority"> & {
  src: string;
  size: number;
  priority?: boolean;
  songId?: string;
};
export function CoverImage(props: Props) {
  return <MeasuredCover key={coverImageUrl(props.src, props.size * 2)} {...props} />;
}
function MeasuredCover({ src, size, priority = false, songId, alt = "", onLoad, onError, ...props }: Props) {
  const [failed, setFailed] = useState(false);
  const measurement = useRef<{ start: number; id: string; complete: boolean } | null>(null);
  const url = coverImageUrl(src, size * 2);
  function finish(result: "success" | "failure") {
    const current = measurement.current;
    if (!current || current.complete) return;
    current.complete = true;
    recordLoading({ requestId: current.id, songId, stage: "cover-visible", elapsedMs: performance.now() - current.start,
      result, size: size * 2, ...(result === "failure" ? { errorCategory: "network" as const } : {}) });
  }
  return (
    // Direct CDN thumbnails avoid an extra server image-optimization hop.
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt} width={size} height={size}
      src={failed ? "/cover-placeholder.svg" : url}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async"
      style={{ backgroundColor: "#282828", ...props.style }}
      ref={(image) => {
        if (!image || measurement.current) return;
        measurement.current = { start: performance.now(), id: createLoadingId(), complete: false };
        recordLoading({ requestId: measurement.current.id, songId, stage: "cover-mounted", elapsedMs: 0, result: "start", size: size * 2 });
        if (image.complete) finish(image.naturalWidth > 0 ? "success" : "failure");
      }}
      onLoad={(event) => { if (!failed) { finish("success"); onLoad?.(event); } }}
      onError={(event) => { if (!failed) { finish("failure"); setFailed(true); onError?.(event); } }}
    />
  );
}
