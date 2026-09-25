import content from "@/content-data/photography-public.json";
import type { PublicPhotography, PublicAlbum } from "../../scripts/photography-model";

export const photography = content as PublicPhotography;
export const albums: PublicAlbum[] = photography.albums;
