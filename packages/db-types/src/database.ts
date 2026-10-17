export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ListingOperation = "sale" | "rent";
export type ListingStatus = "active" | "archived" | "demo";

export interface Listing {
  id: string;
  source_portal: string;
  source_external_id: string;
  operation: ListingOperation;
  title: string | null;
  price: number;
  sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  postal_code: string | null;
  city: string | null;
  ccaa: string | null;
  source_url: string;
  thumbnail_url: string | null;
  geocode_quality: number;
  property_kind: string | null;
  status: ListingStatus;
  scraped_at: string;
  created_at: string;
}

export interface ListingInvestment {
  listing_id: string;
  rent_est: number | null;
  rent_confidence: string | null;
  comparables_count: number;
  roi_gross: number | null;
  computed_at: string | null;
}

export interface Scan {
  id: string;
  user_id: string;
  status: "pending" | "running" | "completed" | "failed";
  polygon: Json;
  filters: Json;
  operation: string;
  progress_pct: number;
  error_message: string | null;
  created_at: string;
}
