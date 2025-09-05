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

export interface WheelSpecs {
    brand?: string;
    model?: string;
    size?: string;
    offset?: string;
    boltPattern?: string;
    centerBore?: string;
    construction?: string;
    finish?: string;
    loadRating?: string;
    backspacing?: string;
    diameter?: string;
    width?: string;
    [key: string]: string | undefined; // Allow for other dynamic specs
}

export interface ProductMetadata {
    brand?: string;
    model?: string;
    size?: string;
    finish?: string;
    type?: 'wheel' | 'tire' | 'suspension' | 'other';
    wheelSpecs?: WheelSpecs;
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
     * Extract wheel specifications from the "Wheel Specs" section
     */
    static extractWheelSpecs(document: Document): WheelSpecs {
        const specs: WheelSpecs = {};

        try {
            // Look for wheel spec items with the specific class structure
            const wheelSpecItems = document.querySelectorAll('.wheel-spec-item');
            
            wheelSpecItems.forEach(item => {
                // Get the spec type from the class list (e.g., "Brand", "Model", "Color")
                const classList = Array.from(item.classList);
                const specType = classList.find(className => className !== 'wheel-spec-item');
                
                // Get the value from data-value attribute or text content
                let value = item.getAttribute('data-value');
                if (!value) {
                    // Fallback to extracting from text content if no data-value
                    const textContent = item.textContent?.trim() || '';
                    const colonIndex = textContent.indexOf(':');
                    if (colonIndex > -1) {
                        value = textContent.substring(colonIndex + 1).trim();
                        // Remove any link text artifacts
                        value = value.replace(/^\s*\n\s*/, '').replace(/\s*\n\s*$/, '');
                    }
                }

                if (specType && value) {
                    // Map spec types to our interface properties
                    const lowerSpecType = specType.toLowerCase();
                    
                    switch (lowerSpecType) {
                        case 'brand':
                            specs.brand = value;
                            break;
                        case 'model':
                            specs.model = value;
                            break;
                        case 'size':
                        case 'wheelsize':
                            specs.size = value;
                            break;
                        case 'offset':
                            specs.offset = value;
                            break;
                        case 'boltpattern':
                        case 'boltcircle':
                            specs.boltPattern = value;
                            break;
                        case 'centerbore':
                        case 'center_bore':
                            specs.centerBore = value;
                            break;
                        case 'construction':
                        case 'type':
                            specs.construction = value;
                            break;
                        case 'finish':
                        case 'color':
                            specs.finish = value;
                            break;
                        case 'loadrating':
                        case 'load_rating':
                            specs.loadRating = value;
                            break;
                        case 'backspacing':
                            specs.backspacing = value;
                            break;
                        case 'diameter':
                            specs.diameter = value;
                            break;
                        case 'width':
                            specs.width = value;
                            break;
                        case 'partnumber':
                        case 'part_number':
                            specs['partNumber'] = value;
                            break;
                        default:
                            // Store any other specs with the original spec type as key
                            specs[specType] = value;
                            break;
                    }
                }
            });

            // Fallback: Also try to extract specs from tables if wheel-spec-item approach didn't find anything
            if (Object.keys(specs).length === 0) {
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td, th');
                        if (cells.length >= 2) {
                            const label = cells[0]?.textContent?.trim().toLowerCase() || '';
                            const value = cells[1]?.textContent?.trim() || '';

                            if (label.includes('offset') && !specs.offset) {
                                specs.offset = value;
                            } else if (label.includes('bolt pattern') && !specs.boltPattern) {
                                specs.boltPattern = value;
                            } else if (label.includes('center bore') && !specs.centerBore) {
                                specs.centerBore = value;
                            } else if (label.includes('construction') && !specs.construction) {
                                specs.construction = value;
                            } else if (label.includes('load rating') && !specs.loadRating) {
                                specs.loadRating = value;
                            }
                        }
                    });
                });
            }

        } catch (error) {
            console.error('Error extracting wheel specs:', error);
        }

        return specs;
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
                        const brands = ['XD', 'Fuel', 'Method', 'Black Rhino', 'Vision', 'Rotiform', 'American Racing', 'Rough Country', 'Lock Off Road'];
                        for (const brand of brands) {
                            if (text.toLowerCase().includes(brand.toLowerCase())) {
                                metadata.brand = brand;
                                break;
                            }
                        }
                    }
                });

                // Extract wheel specifications if this is a wheel product
                if (metadata.type === 'wheel') {
                    metadata.wheelSpecs = this.extractWheelSpecs(document);
                    
                    // Use wheel specs to fill in missing metadata
                    if (!metadata.brand && metadata.wheelSpecs.brand) {
                        metadata.brand = metadata.wheelSpecs.brand;
                    }
                    if (!metadata.model && metadata.wheelSpecs.model) {
                        metadata.model = metadata.wheelSpecs.model;
                    }
                    if (!metadata.size && metadata.wheelSpecs.size) {
                        metadata.size = metadata.wheelSpecs.size;
                    }
                    if (!metadata.finish && metadata.wheelSpecs.finish) {
                        metadata.finish = metadata.wheelSpecs.finish;
                    }
                }
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
        console.log("metadata", metadata);
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
            parts.push('This is a wheel(AKA rim) for a vehicle ');
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

        // Add finish information - prioritize wheel specs finish over basic metadata
        let finishToUse = metadata.finish;
        if (metadata.wheelSpecs?.finish) {
            finishToUse = metadata.wheelSpecs.finish;
        }
        
        if (finishToUse) {
            parts.push(`with ${finishToUse.toLowerCase()} finish`);
        }

        return parts.join(', ');
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
            'americanracing': 'American Racing',
            'roughcountry': 'Rough Country',
            'methodracewheels': 'Method Race Wheels',
            'lockoffroad': 'Lock Off Road',
            'visionwheels': 'Vision Wheel',
            'fuelfoffroad': 'Fuel Off-Road'
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
     * Detect if the current page is a product page (vs vehicle gallery page)
     */
    static isProductPage(): boolean {
        const url = window.location.href;
        
        // Product pages have paths like /buy-wheel-offset/ or contain wheel specs
        const isProductPageUrl = url.includes('/buy-wheel-offset/') || 
                                 url.includes('/buy-tire/') || 
                                 url.includes('/buy-suspension/');
        
        // Also check for wheel specs section which is only on product pages
        const hasWheelSpecs = document.querySelector('.wheel-spec-item') !== null ||
                             (document.querySelector('h4')?.textContent?.toLowerCase().includes('wheel specs') ?? false);
        
        // Vehicle gallery pages have different patterns
        const isGalleryPage = url.includes('/wheel-offset-gallery/') ||
                             url.includes('/gallery/');
        
        return (isProductPageUrl || hasWheelSpecs) && !isGalleryPage;
    }

    /**
     * Extract metadata from current page (for use in content script)
     */
    static extractCurrentPageMetadata(): { vehicle: VehicleMetadata; productMetadata: ProductMetadata | null } {
        const vehicle = this.extractVehicleMetadata(window.location.href, document);
        
        let productMetadata: ProductMetadata | null = null;
        
        // If we're on a product page, extract the page metadata as product metadata
        if (this.isProductPage()) {
            // Extract product metadata from the current page
            productMetadata = this.extractProductMetadata(window.location.href, document);
            
            // Also extract wheel specs if available
            if (!productMetadata.wheelSpecs) {
                productMetadata.wheelSpecs = this.extractWheelSpecs(document);
            }
            
            // Use wheel specs to enhance product metadata
            if (productMetadata.wheelSpecs) {
                const specs = productMetadata.wheelSpecs;
                if (!productMetadata.brand && specs.brand) {
                    productMetadata.brand = specs.brand;
                }
                if (!productMetadata.model && specs.model) {
                    productMetadata.model = specs.model;
                }
                if (!productMetadata.size && specs.size) {
                    productMetadata.size = specs.size;
                }
                if (!productMetadata.finish && specs.finish) {
                    productMetadata.finish = specs.finish;
                }
            }
            
            // Set type based on URL if not already set
            if (!productMetadata.type) {
                if (window.location.href.includes('wheel')) {
                    productMetadata.type = 'wheel';
                } else if (window.location.href.includes('tire')) {
                    productMetadata.type = 'tire';
                } else if (window.location.href.includes('suspension')) {
                    productMetadata.type = 'suspension';
                }
            }
            
            // Regenerate description with all the enhanced data
            productMetadata.description = this.generateProductDescription(productMetadata);
        }

        return { vehicle, productMetadata };
    }
}
