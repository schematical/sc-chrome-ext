// src/utils/vehicleStorage.ts

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
