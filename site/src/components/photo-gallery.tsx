"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PublicAlbum } from "../../scripts/photography-model";
export function PhotoGallery({ album }: { album: PublicAlbum }) {
  const [index, setIndex] = useState<number | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLAnchorElement | null>(null);
  const photo = index === null ? null : album.photos[index];
  useEffect(() => {
    function sync() {
      const i = album.photos.findIndex((p) => p.href === location.pathname);
      setIndex(i < 0 ? null : i);
    }
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [album.photos]);
  useEffect(() => {
    if (photo) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      trigger.current?.focus();
    }
  }, [photo]);
  function close() {
    if (history.state?.photoAlbum === album.href) history.back();
    else {
      setIndex(null);
    }
  }
  function step(delta: number) {
    if (index === null) return;
    const next = index + delta;
    if (next < 0 || next >= album.photos.length) return;
    history.replaceState(
      { ...history.state, photoAlbum: album.href },
      "",
      album.photos[next].href,
    );
    setIndex(next);
  }
  return (
    <>
      <div className="photo-grid">
        {album.photos.map((p, i) => (
          <figure className="photo-tile" key={p.id}>
            <a
              href={p.href}
              data-photo-link
              data-photo-id={p.id}
              onClick={(e) => {
                if (
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey ||
                  e.button !== 0
                )
                  return;
                e.preventDefault();
                trigger.current = e.currentTarget;
                history.pushState(
                  { ...history.state, photoAlbum: album.href },
                  "",
                  p.href,
                );
                setIndex(i);
              }}
            >
              <Image
                src={p.image.src}
                width={p.image.width}
                height={p.image.height}
                sizes="(max-width: 639px) 90vw, 400px"
                alt={p.alt}
              />
            </a>
            <figcaption>
              <p>
                {p.caption}
                <br />
                Photograph: {p.creator}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="viewer"
        data-testid="photo-viewer"
        aria-labelledby="viewer-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
      >
        {photo && (
          <div className="viewer-inner">
            <div className="viewer-top">
              <h2 id="viewer-title" style={{ fontSize: 18, margin: 0 }}>
                {album.title}
              </h2>
              <button onClick={close} autoFocus aria-label="Close viewer">
                Close ×
              </button>
            </div>
            <div className="viewer-photo">
              <Image
                src={photo.image.src}
                width={photo.image.width}
                height={photo.image.height}
                sizes="95vw"
                alt={photo.alt}
              />
            </div>
            <div className="viewer-bottom">
              <button onClick={() => step(-1)} disabled={index === 0}>
                ← Previous photo
              </button>
              <p aria-live="polite">
                {(index ?? 0) + 1} of {album.photos.length} · {photo.caption}
                <br />
                Photograph: {photo.creator}
              </p>
              <button
                onClick={() => step(1)}
                disabled={index === album.photos.length - 1}
              >
                Next photo →
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
