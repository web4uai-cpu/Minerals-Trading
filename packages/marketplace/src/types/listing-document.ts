export interface ListingDocument {
  listingId: string;
  sellerOrgId: string;
  sellerLegalName: string;
  mineralId: string;
  mineralName: string;
  grade: Record<string, number>;
  quantityAvailable: number;
  unit: string;
  askPriceInPaise: number;
  location: {
    district: string;
    state: string;
    lat?: number;
    lng?: number;
  };
  dispatchLeadDays: number;
  sellerTrustScore: number;
  createdAt: string;
}
