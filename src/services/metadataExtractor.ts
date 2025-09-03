// src/services/metadataExtractor.ts

export interface VehicleMetadata {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
    wheelBrand?: string;
    wheelModel?: string;
    wheelSize?: string;
    tireSize?: string;
    suspension?: string;
    owner?: string;
    description?: string;
}

export interface ProductMetadata {
    brand?: string;
    model?: string;
    size?: string;
    finish?: string;
    type?: 'wheel' | 'tire' | 'suspension' | 'other';
    description?: string;
}

export class MetadataExtractor {
    /**
     * Extract vehicle metadata from Custom Wheel Offset gallery pages
     */
    static extractVehicleMetadata(url: string, document: Document): VehicleMetadata {
        const metadata: VehicleMetadata = {};

        try {
            // Extract from page title
            const title = document.title;
            if (title) {
                // Pattern: "2019 Toyota Tacoma - 18x9 XD Wheels XD135 Grenade..."
                const titleMatch = title.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9]+)/);
                if (titleMatch) {
                    metadata.year = titleMatch[1];
                    metadata.make = titleMatch[2];
                    metadata.model = titleMatch[3];
                }
            }

            // Extract from breadcrumb navigation
            const breadcrumbs = document.querySelectorAll('nav a, .breadcrumb a');
            breadcrumbs.forEach((link: any) => {
                const text = link.textContent?.trim();
                if (text && text.match(/^\d{4}/)) {
                    const parts = text.split(' ');
                    if (parts.length >= 3) {
                        metadata.year = parts[0];
                        metadata.make = parts[1];
                        metadata.model = parts[2];
                    }
                }
            });

            // Extract vehicle specifications from tables
            const tables = document.querySelectorAll('table');
            tables.forEach(table => {
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length >= 2) {
                        const label = cells[0]?.textContent?.trim().toLowerCase() || '';
                        const value = cells[1]?.textContent?.trim() || '';

                        if (label.includes('wheel') && label.includes('front')) {
                            metadata.wheelSize = value;
                        } else if (label.includes('tire') && label.includes('front')) {
                            metadata.tireSize = value;
                        } else if (label.includes('suspension')) {
                            metadata.suspension = value;
                        }
                    }
                });
            });

            // Extract wheel brand from headings
            const headings = document.querySelectorAll('h1, h2, h3, h4');
            headings.forEach(heading => {
                const text = heading.textContent?.trim();
                if (text && (text.includes('XD') || text.includes('Fuel') || text.includes('Method'))) {
                    // Extract brand and model from wheel headings
                    const wheelMatch = text.match(/(XD|Fuel|Method|Black\s+Rhino|Vision|Rotiform)\s+([A-Za-z0-9\s]+)/i);
                    if (wheelMatch) {
                        metadata.wheelBrand = wheelMatch[1];
                        metadata.wheelModel = wheelMatch[2].trim();
                    }
                }
            });

            // Extract owner information
            const instagramLinks = document.querySelectorAll('a[href*="instagram.com"]');
            if (instagramLinks.length > 0) {
                const ownerLink = instagramLinks[0] as HTMLAnchorElement;
                metadata.owner = ownerLink.textContent?.trim().replace('@', '');
            }

            // Generate description
            metadata.description = this.generateVehicleDescription(metadata);

        } catch (error) {
            console.error('Error extracting vehicle metadata:', error);
        }

        return metadata;
    }

    /**
     * Extract product metadata from wheel/product URLs and page content
     */
    static extractProductMetadata(url: string, document?: Document): ProductMetadata {
        const metadata: ProductMetadata = {};

        try {
            // Extract from URL patterns
            if (url.includes('wheels-compressed')) {
                metadata.type = 'wheel';
                
                // Pattern: /wheels-compressed/brandname/modelname/
                const urlParts = url.split('/');
                const wheelsIndex = urlParts.findIndex(part => part.includes('wheels'));
                
                if (wheelsIndex >= 0 && urlParts.length > wheelsIndex + 2) {
                    const brandPart = urlParts[wheelsIndex + 1];
                    const modelPart = urlParts[wheelsIndex + 2];
                    
                    // Clean up brand names
                    metadata.brand = this.formatBrandName(brandPart);
                    
                    // Clean up model names
                    if (modelPart) {
                        const modelMatch = modelPart.match(/^([^_]+)/);
                        if (modelMatch) {
                            metadata.model = this.formatModelName(modelMatch[1]);
                        }
                    }
                }
                
                // Extract finish from filename
                const filename = url.split('/').pop() || '';
                if (filename.includes('black')) metadata.finish = 'Black';
                else if (filename.includes('white')) metadata.finish = 'White';
                else if (filename.includes('machined')) metadata.finish = 'Machined';
                else if (filename.includes('chrome')) metadata.finish = 'Chrome';
                else if (filename.includes('bronze')) metadata.finish = 'Bronze';

            } else if (url.includes('tire')) {
                metadata.type = 'tire';
            }

            // If document is provided, extract additional metadata from page
            if (document) {
                // Extract product details from page content
                const productTitles = document.querySelectorAll('h1, h2, h3');
                productTitles.forEach(title => {
                    const text = title.textContent?.trim();
                    if (text && !metadata.brand) {
                        // Try to extract brand from product titles
                        const brands = ['XD', 'Fuel', 'Method', 'Black Rhino', 'Vision', 'Rotiform', 'American Racing'];
                        for (const brand of brands) {
                            if (text.toLowerCase().includes(brand.toLowerCase())) {
                                metadata.brand = brand;
                                break;
                            }
                        }
                    }
                });
            }

            // Generate description
            metadata.description = this.generateProductDescription(metadata);

        } catch (error) {
            console.error('Error extracting product metadata:', error);
        }

        return metadata;
    }

    /**
     * Generate detailed vehicle description for AI
     */
    private static generateVehicleDescription(metadata: VehicleMetadata): string {
        const parts: string[] = [];

        if (metadata.year && metadata.make && metadata.model) {
            parts.push(`This is a ${metadata.year} ${metadata.make} ${metadata.model}`);
        } else {
            parts.push('This is a vehicle');
        }

        if (metadata.wheelBrand && metadata.wheelModel) {
            parts.push(`equipped with ${metadata.wheelBrand} ${metadata.wheelModel} wheels`);
        } else if (metadata.wheelBrand) {
            parts.push(`with ${metadata.wheelBrand} wheels`);
        }

        if (metadata.wheelSize) {
            parts.push(`wheel size: ${metadata.wheelSize}`);
        }

        if (metadata.tireSize) {
            parts.push(`tire size: ${metadata.tireSize}`);
        }

        if (metadata.suspension) {
            parts.push(`suspension: ${metadata.suspension}`);
        }

        const description = parts.join(', ');
        return description + '. The image shows the vehicle\'s wheel and tire setup clearly.';
    }

    /**
     * Generate detailed product description for AI
     */
    private static generateProductDescription(metadata: ProductMetadata): string {
        const parts: string[] = [];

        if (metadata.type === 'wheel') {
            parts.push('This is a wheel/rim');
        } else if (metadata.type === 'tire') {
            parts.push('This is a tire');
        } else {
            parts.push('This is an automotive product');
        }

        if (metadata.brand && metadata.model) {
            parts.push(`${metadata.brand} ${metadata.model}`);
        } else if (metadata.brand) {
            parts.push(`made by ${metadata.brand}`);
        }

        if (metadata.finish) {
            parts.push(`with ${metadata.finish.toLowerCase()} finish`);
        }

        if (metadata.size) {
            parts.push(`size: ${metadata.size}`);
        }

        return parts.join(' ');
    }

    /**
     * Format brand name for display
     */
    private static formatBrandName(brandPart: string): string {
        const brandMap: { [key: string]: string } = {
            'lockoffroadwheels': 'Lock Off Road',
            'xdwheels': 'XD Wheels',
            'fueloffroad': 'Fuel Off-Road',
            'methodwheels': 'Method Race Wheels',
            'blackrhino': 'Black Rhino',
            'visionwheel': 'Vision Wheel',
            'rotiform': 'Rotiform',
            'americanracing': 'American Racing'
        };

        const normalized = brandPart.toLowerCase().replace(/[-_]/g, '');
        return brandMap[normalized] || brandPart.charAt(0).toUpperCase() + brandPart.slice(1);
    }

    /**
     * Format model name for display
     */
    private static formatModelName(modelPart: string): string {
        return modelPart
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Extract metadata from current page (for use in content script)
     */
    static extractCurrentPageMetadata(): { vehicle: VehicleMetadata; products: ProductMetadata[] } {
        const vehicle = this.extractVehicleMetadata(window.location.href, document);
        
        const products: ProductMetadata[] = [];
        
        // Find all product images on the page
        const productImages = document.querySelectorAll('img[src*="wheels-compressed"]');
        productImages.forEach((img: any) => {
            if (img.src) {
                const productMetadata = this.extractProductMetadata(img.src, document);
                products.push(productMetadata);
            }
        });

        return { vehicle, products };
    }
}
