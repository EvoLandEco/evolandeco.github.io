"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";

export function LoadingImage(props: ImageProps) {
  const source = typeof props.src === "string" ? props.src : "default" in props.src ? props.src.default.src : props.src.src;
  return <ImageWithLoading key={source} {...props} />;
}

function ImageWithLoading({ onLoad, onError, alt, ...props }: ImageProps) {
  const [loading, setLoading] = useState(true);
  const checkCached = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setLoading(false);
  }, []);
  return <Image {...props} alt={alt} ref={checkCached}
    data-image-loading={loading ? "true" : undefined}
    aria-busy={loading}
    onLoad={event => { setLoading(false); onLoad?.(event); }}
    onError={event => { setLoading(false); onError?.(event); }}
  />;
}
