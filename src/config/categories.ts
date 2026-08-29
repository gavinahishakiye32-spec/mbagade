export interface CategoryDef {
  slug: string;
  name: string;
  icon: string;
}

export const BUSINESS_CATEGORIES: CategoryDef[] = [
  { slug: "food", name: "Food & Restaurants", icon: "utensils" },
  { slug: "fashion", name: "Fashion & Apparel", icon: "shirt" },
  { slug: "technology", name: "Technology & Electronics", icon: "cpu" },
  { slug: "education", name: "Education & Training", icon: "graduation-cap" },
  { slug: "beauty", name: "Beauty & Personal Care", icon: "sparkles" },
  { slug: "automotive", name: "Automotive", icon: "car" },
  { slug: "real-estate", name: "Real Estate", icon: "building" },
  { slug: "travel", name: "Travel & Tourism", icon: "plane" },
  { slug: "hotels", name: "Hotels & Hospitality", icon: "bed" },
  { slug: "health", name: "Health & Wellness", icon: "heart-pulse" },
  { slug: "professional", name: "Professional Services", icon: "briefcase" },
  { slug: "construction", name: "Construction & Trades", icon: "hammer" },
  { slug: "retail", name: "Retail & Shopping", icon: "shopping-bag" },
  { slug: "agriculture", name: "Agriculture", icon: "sprout" },
  { slug: "finance", name: "Finance & Insurance", icon: "landmark" },
  { slug: "entertainment", name: "Entertainment & Events", icon: "music" },
  { slug: "logistics", name: "Logistics & Transport", icon: "truck" },
  { slug: "other", name: "Other Business", icon: "store" },
];

export const CATEGORY_SLUGS = BUSINESS_CATEGORIES.map((c) => c.slug);

export function categoryName(slug: string): string {
  return BUSINESS_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
