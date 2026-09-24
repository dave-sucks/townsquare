/**
 * The one shape every place-returning tool emits (docs/AGENT_CHAT_REBUILD.md §6).
 * PlaceListRenderer and the chat ↔ map bridge read only this. Type-only so
 * client components can import it without pulling server code.
 */

export type PlaceRow = {
  kind: "place";
  /** Townsquare Place.id; null for a Google result not yet persisted. */
  placeId: string | null;
  googlePlaceId: string;
  name: string;
  /** Google formatted address (the save controls need it). */
  address?: string;
  emoji?: string | null;
  /** Humanized primaryType (lib/places/category.ts). */
  category?: string;
  neighborhood?: string | null;
  lat: number;
  lng: number;
  priceLevel?: string | null;
  /** First photoRef, served via /api/places/photo. */
  photoRef?: string | null;
  /** Top tags, best first. */
  tags?: { slug: string; displayName: string }[];
  /** Creators who posted it. */
  creators?: { id: string; username: string; avatar?: string | null; isFollowed: boolean }[];
  postCount?: number;
  latestPost?: {
    reviewId: string;
    caption?: string;
    mediaUrl?: string;
    url?: string;
    postedAt?: string;
    likes?: number;
    creator: string;
  };
  mySave?: { saved: boolean; hasBeen: boolean; rating?: number | null; listIds: string[] };
  distanceMi?: number;
  /** One line the tool computes, e.g. "3 creators you follow · 12 posts". */
  why?: string;
};

/** One creator post about a place (get_place's feed). */
export type PlacePost = {
  reviewId: string;
  creator: { id: string; username: string; avatar?: string | null; isFollowed: boolean };
  caption?: string;
  mediaUrl?: string;
  url?: string;
  postedAt?: string;
  likes?: number;
};

/** The creator a get_creator answer is about. */
export type CreatorHeader = {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
  isFollowed: boolean;
  postCount: number;
  placeCount: number;
  followerCount: number;
};

export type PlaceListData = {
  query: string;
  scope: string;
  places: PlaceRow[];
  total: number;
  truncated: boolean;
  /** get_place: the place's AI summary and recent posts, shown expanded. */
  aiSummary?: string | null;
  posts?: PlacePost[];
  /** get_creator: header above the creator's places. */
  creator?: CreatorHeader;
};
