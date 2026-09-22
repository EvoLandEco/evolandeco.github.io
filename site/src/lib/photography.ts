import content from "@/content-data/photography-public.json";
import samples from "@/content-data/photo-samples.json";
import type {
  PublicPhotography,
  PublicAlbum,
} from "../../scripts/photography-model";
export const photography: PublicPhotography = content;
export const sampleAlbums = samples satisfies PublicAlbum[];
export const albums: PublicAlbum[] = [...photography.albums, ...sampleAlbums];
export const isSample = (album: PublicAlbum) => album.countryCode === "";
