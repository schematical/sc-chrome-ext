// src/services/compositingService.ts

export interface CompositeImageRequest {
    sceneUrl: string;
    productUrl: string;
    dropPosition: Array<{
        xPercent: number;
        yPercent: number;
    }>;
    sceneDescription: string;
    productDescription: string;
}

export interface CompositeImageResponse {
    finalImageUrl: string;
    debugImageUrl: string;
    finalPrompt: string;
}

export interface CompositeError {
    error: string;
    details?: string;
    status?: number;
}

export class CompositingService {
    private static readonly API_BASE_URL = 'http://localhost:3000';
    private static readonly COMPOSITE_ENDPOINT = '/api/scene';

    /**
     * Check if the compositing service is available
     */
    static async isServiceAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.API_BASE_URL}/health`, {
                method: 'GET',
                timeout: 5000
            } as any);
            return response.ok;
        } catch (error) {
            console.log('Compositing service not available:', error);
            return false;
        }
    }

    /**
     * Validate the request payload before sending
     */
    static validateRequest(request: CompositeImageRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!request.sceneUrl || !this.isValidUrl(request.sceneUrl)) {
            errors.push('Valid scene URL is required');
        }

        if (!request.productUrl || !this.isValidUrl(request.productUrl)) {
            errors.push('Valid product URL is required');
        }

        if (!request.dropPosition) {
            errors.push('Drop position is required');
        } else if (!Array.isArray(request.dropPosition) || request.dropPosition.length === 0) {
            errors.push('dropPosition must be a non-empty array of coordinates');
        } else {
            // Validate each point in the array
            request.dropPosition.forEach((point, index) => {
                if (typeof point.xPercent !== 'number' || 
                    point.xPercent < 0 || 
                    point.xPercent > 100) {
                    errors.push(`Point ${index + 1}: xPercent must be a number between 0 and 100`);
                }
                if (typeof point.yPercent !== 'number' || 
                    point.yPercent < 0 || 
                    point.yPercent > 100) {
                    errors.push(`Point ${index + 1}: yPercent must be a number between 0 and 100`);
                }
            });
        }

        if (!request.sceneDescription || request.sceneDescription.trim().length === 0) {
            errors.push('Scene description is required');
        }

        if (!request.productDescription || request.productDescription.trim().length === 0) {
            errors.push('Product description is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate composite image using the API
     */
    static async generateComposite(request: CompositeImageRequest): Promise<CompositeImageResponse> {
        // Validate request
        const validation = this.validateRequest(request);
        if (!validation.valid) {
            throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
        }

        try {
            console.log('Sending composite request:', request);

            const response = await fetch(`${this.API_BASE_URL}${this.COMPOSITE_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetails = errorJson.message || errorJson.error || errorDetails;
                } catch {
                    if (errorText) {
                        errorDetails = errorText;
                    }
                }

                throw new Error(`API Error: ${errorDetails}`);
            }

            const result: CompositeImageResponse = await response.json();
            
            console.log('Composite generation successful:', result);
            return result;

        } catch (error) {
            console.error('Error generating composite:', error);
            
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Unable to connect to compositing service. Make sure the service is running on localhost:3000.');
            }
            
            throw error;
        }
    }

    /**
     * Convert pixel coordinates to percentage for API
     */
    static convertCoordinatesToPercentage(
        pixelX: number,
        pixelY: number,
        imageWidth: number,
        imageHeight: number
    ): { xPercent: number; yPercent: number } {
        return {
            xPercent: Math.round((pixelX / imageWidth) * 100 * 100) / 100, // Round to 2 decimal places
            yPercent: Math.round((pixelY / imageHeight) * 100 * 100) / 100
        };
    }

    /**
     * Extract detailed descriptions from page elements and metadata
     */
    static async generateDescriptions(vehicleImageUrl: string, productUrl: string): Promise<{
        sceneDescription: string;
        productDescription: string;
    }> {
        try {
            // Import metadata extractor
            const { MetadataExtractor } = await import('./metadataExtractor');
            
            // Extract metadata from current page
            const pageMetadata = MetadataExtractor.extractCurrentPageMetadata();
            
            // Generate scene description using enhanced metadata
            let sceneDescription = "This is a vehicle image";
            if (pageMetadata.vehicle) {
                sceneDescription = pageMetadata.vehicle.description || "This is a vehicle image with custom wheels and modifications";
            }
            
            // Generate product description using enhanced metadata
            let productDescription = "This is an automotive product";
            
            // If we're on a product page, use the page's product metadata
            if (pageMetadata.productMetadata && pageMetadata.productMetadata.description) {
                productDescription = pageMetadata.productMetadata.description;
            } else {
                // Fallback: Extract product metadata from URL (for non-product pages)
                const productMetadata = MetadataExtractor.extractProductMetadata(productUrl, document);
                if (productMetadata.description) {
                    productDescription = productMetadata.description;
                }
            }
            
            // Fallback to stored vehicle data if page metadata is incomplete
            if (sceneDescription === "This is a vehicle image") {
                const { VehicleStorage } = await import('../utils/vehicleStorage');
                const vehicleData = await VehicleStorage.getVehicleData();
                
                if (vehicleData?.info) {
                    const info = vehicleData.info;
                    const parts: string[] = [];
                    
                    if (info.yearMakeModel) {
                        parts.push(`This is a ${info.yearMakeModel}`);
                    }
                    
                    if (info.wheels?.brand) {
                        parts.push(`with ${info.wheels.brand} wheels`);
                    }
                    
                    if (info.wheels?.frontSize || info.wheels?.rearSize) {
                        const sizes = [info.wheels.frontSize, info.wheels.rearSize].filter(Boolean);
                        if (sizes.length > 0) {
                            parts.push(`wheel size: ${sizes.join(' / ')}`);
                        }
                    }
                    
                    if (info.suspension?.type) {
                        parts.push(`suspension: ${info.suspension.type}`);
                    }
                    
                    if (parts.length > 0) {
                        sceneDescription = parts.join(', ') + '. The image shows the vehicle\'s wheel and tire setup clearly.';
                    }
                }
            }
            
            return {
                sceneDescription,
                productDescription
            };
            
        } catch (error) {
            console.error('Error generating descriptions:', error);
            return {
                sceneDescription: "This is a vehicle image with custom wheels and modifications",
                productDescription: "This is an automotive wheel/rim product"
            };
        }
    }

    /**
     * Simple URL validation
     */
    private static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}
