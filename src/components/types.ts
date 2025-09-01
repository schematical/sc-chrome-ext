/**
 * Type definitions for vehicle gallery components
 */

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ProductPosition {
  id: string;
  productUrl: string;
  vehicleImageUrl: string;
  position: { x: number; y: number };
  timestamp: number;
  name?: string;
}

export interface VehicleData {
  images: string[];
  info: {
    title: string;
    url: string;
    yearMakeModel?: string;
    owner?: string;
    wheels: {
      brand?: string;
      frontSize?: string;
      rearSize?: string;
      frontOffset?: string;
      rearOffset?: string;
    };
    tires: {
      frontSize?: string;
      rearSize?: string;
    };
    suspension: {
      type?: string;
    };
  };
  products?: ProductPosition[];
  extractedAt: number;
}
