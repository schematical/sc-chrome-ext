// src/utils/vehicleStorage.ts

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
    meshyModelId?: string;
    extractedAt: number;
}

export class VehicleStorage {
    private static readonly STORAGE_KEY = 'vehicleData';

    /**
     * Store vehicle data in chrome.storage.local
     */
    static async setVehicleData(images: string[], vehicleInfo: any): Promise<boolean> {
        try {
            const vehicleData: VehicleData = {
                images,
                info: vehicleInfo,
                extractedAt: Date.now()
            };

            await chrome.storage.local.set({
                [this.STORAGE_KEY]: vehicleData
            });

            console.log('Vehicle data stored successfully:', vehicleData);
            return true;
        } catch (error) {
            console.error('Error storing vehicle data:', error);
            return false;
        }
    }

    /**
     * Get stored vehicle data from chrome.storage.local
     */
    static async getVehicleData(): Promise<VehicleData | null> {
        try {
            const result = await chrome.storage.local.get([this.STORAGE_KEY]);
            return result[this.STORAGE_KEY] || null;
        } catch (error) {
            console.error('Error retrieving vehicle data:', error);
            return null;
        }
    }

    /**
     * Clear stored vehicle data
     */
    static async clearVehicleData(): Promise<boolean> {
        try {
            await chrome.storage.local.remove([this.STORAGE_KEY]);
            console.log('Vehicle data cleared successfully');
            return true;
        } catch (error) {
            console.error('Error clearing vehicle data:', error);
            return false;
        }
    }

    /**
     * Check if vehicle data exists
     */
    static async hasVehicleData(): Promise<boolean> {
        try {
            const data = await this.getVehicleData();
            return data !== null;
        } catch (error) {
            console.error('Error checking vehicle data:', error);
            return false;
        }
    }

    /**
     * Get vehicle images only
     */
    static async getVehicleImages(): Promise<string[]> {
        try {
            const data = await this.getVehicleData();
            return data?.images || [];
        } catch (error) {
            console.error('Error retrieving vehicle images:', error);
            return [];
        }
    }

    /**
     * Get vehicle info only
     */
    static async getVehicleInfo(): Promise<VehicleData['info'] | null> {
        try {
            const data = await this.getVehicleData();
            return data?.info || null;
        } catch (error) {
            console.error('Error retrieving vehicle info:', error);
            return null;
        }
    }

    /**
     * Add image to existing vehicle data
     */
    static async addImageToVehicle(imageUrl: string): Promise<boolean> {
        try {
            const existingData = await this.getVehicleData();
            
            if (!existingData) {
                console.error('No vehicle data exists. Please set a vehicle first.');
                return false;
            }

            // Check if image already exists
            if (existingData.images.includes(imageUrl)) {
                console.log('Image already exists in vehicle data');
                return true;
            }

            // Add the new image
            existingData.images.push(imageUrl);
            
            // Update the storage
            await chrome.storage.local.set({
                [this.STORAGE_KEY]: existingData
            });

            console.log('Image added to vehicle data successfully:', imageUrl);
            return true;
        } catch (error) {
            console.error('Error adding image to vehicle data:', error);
            return false;
        }
    }

    /**
     * Save product position to vehicle data
     */
    static async saveProductPosition(position: ProductPosition): Promise<boolean> {
        try {
            const existingData = await this.getVehicleData();
            
            if (!existingData) {
                console.error('No vehicle data exists. Please set a vehicle first.');
                return false;
            }

            // Initialize products array if it doesn't exist
            if (!existingData.products) {
                existingData.products = [];
            }

            // Remove any existing position for the same product on the same image
            existingData.products = existingData.products.filter(p => 
                !(p.productUrl === position.productUrl && p.vehicleImageUrl === position.vehicleImageUrl)
            );

            // Add the new position
            existingData.products.push(position);
            
            // Update the storage
            await chrome.storage.local.set({
                [this.STORAGE_KEY]: existingData
            });

            console.log('Product position saved successfully:', position);
            return true;
        } catch (error) {
            console.error('Error saving product position:', error);
            return false;
        }
    }

    /**
     * Get product positions for a specific vehicle image
     */
    static async getProductPositions(vehicleImageUrl?: string): Promise<ProductPosition[]> {
        try {
            const data = await this.getVehicleData();
            if (!data?.products) return [];

            if (vehicleImageUrl) {
                return data.products.filter(p => p.vehicleImageUrl === vehicleImageUrl);
            }
            
            return data.products;
        } catch (error) {
            console.error('Error retrieving product positions:', error);
            return [];
        }
    }

    /**
     * Remove a specific product position
     */
    static async removeProductPosition(positionId: string): Promise<boolean> {
        try {
            const existingData = await this.getVehicleData();
            
            if (!existingData?.products) {
                console.log('No product positions exist');
                return true;
            }

            // Remove the position
            existingData.products = existingData.products.filter(p => p.id !== positionId);
            
            // Update the storage
            await chrome.storage.local.set({
                [this.STORAGE_KEY]: existingData
            });

            console.log('Product position removed successfully:', positionId);
            return true;
        } catch (error) {
            console.error('Error removing product position:', error);
            return false;
        }
    }

    /**
     * Clear all product positions
     */
    static async clearProductPositions(): Promise<boolean> {
        try {
            const existingData = await this.getVehicleData();
            
            if (!existingData) {
                console.log('No vehicle data exists');
                return true;
            }

            existingData.products = [];
            
            // Update the storage
            await chrome.storage.local.set({
                [this.STORAGE_KEY]: existingData
            });

            console.log('All product positions cleared successfully');
            return true;
        } catch (error) {
            console.error('Error clearing product positions:', error);
            return false;
        }
    }

    /**
     * Update the meshy model ID for the current vehicle
     */
    static async updateMeshyModelId(meshyModelId: string): Promise<boolean> {
        try {
            const existingData = await this.getVehicleData();
            
            if (!existingData) {
                // If no vehicle data exists, create a basic vehicle entry
                const basicVehicleData: VehicleData = {
                    images: [],
                    info: {
                        title: 'Vehicle',
                        url: window.location.href,
                        wheels: {},
                        tires: {},
                        suspension: {}
                    },
                    meshyModelId,
                    extractedAt: Date.now()
                };
                
                await chrome.storage.local.set({
                    [this.STORAGE_KEY]: basicVehicleData
                });
                
                console.log('Created new vehicle data with meshy model ID:', meshyModelId);
                return true;
            }

            existingData.meshyModelId = meshyModelId;
            
            // Update the storage
            await chrome.storage.local.set({
                [this.STORAGE_KEY]: existingData
            });

            console.log('Meshy model ID updated successfully:', meshyModelId);
            return true;
        } catch (error) {
            console.error('Error updating meshy model ID:', error);
            return false;
        }
    }

    /**
     * Listen for storage changes
     */
    static onStorageChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): void {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[this.STORAGE_KEY]) {
                callback(changes);
            }
        });
    }
}
