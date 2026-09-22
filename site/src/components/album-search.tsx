"use client";
import { useState } from "react";

export function AlbumSearch() {
  const [query, setQuery] = useState("");
  const [count, setCount] = useState<number | null>(null);
  function search(text: string) {
    setQuery(text);
    let matches = 0;
    document.querySelectorAll<HTMLElement>("[data-album-title]").forEach((card) => {
      card.hidden = !card.dataset.albumTitle!.toLowerCase().includes(text.toLowerCase());
      if (!card.hidden) matches++;
    });
    setCount(matches);
  }
  return (
    <>
      <div className="filters album-search">
        <label>
          <span className="sr-only">Search collections</span>
          <input type="search" value={query} placeholder="Search collections" onChange={(e) => search(e.target.value)} />
        </label>
        <button onClick={() => search("")}>Reset search</button>
      </div>
      {count === 0 && <p role="status">No matching albums.</p>}
    </>
  );
}
