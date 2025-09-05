// src/main.ts
import $ from 'jquery';

class Main {
    constructor() {
        this.init();
    }

    init() {
        $(document).ready(async () => {
            // Only run text replacement on AWS console pages
            if (window.location.hostname.includes('console.aws.amazon.com')) {
                setInterval(() => {
                    this.replaceKeyWords();
                }, 2000);
            }
            
            // Set up message listener for vehicle extraction
            this.setupMessageListener();
            
            // Set up image compositing functionality
            this.setupImageCompositing();
            
       /*     this.resetEmailTable();
            this.hideErrorMessage();
            this.handleLoadEmails();
            this.handleData();*/
        });
    }
    async replaceKeyWords(){
        const searchStrings = (await  chrome.storage.local.get(["replace_text"])).replace_text.split("\n");
console.log("searchStrings", searchStrings);
   /*     $("*").contents().filter(function () {
            return this.nodeType === 3; // NodeType 3 = Text node
        }).each(function () {
            let text: any = this.nodeValue;
            searchStrings.forEach(function (searchString) {
                const mask = "X".repeat(searchString.length); // Create a mask of 'X'
                const regex = new RegExp(searchString, 'gi'); // Case-insensitive global search
                text = text.replace(regex, mask);
            });
            this.nodeValue = text;
        });*/
        const jColl = $("*").contents()/*.filter(function () {
            return this.nodeType === 3; // NodeType 3 = Text node
        });*/
        console.log("LENGTH:", jColl.length);
        jColl.each(function () {
            if(!this.nodeValue){
                return;
            }
            searchStrings.forEach( (searchString: string) => {
                if(this.nodeValue?.indexOf(searchString) === -1){
                    return;
                }
                const mask = "X".repeat(searchString.length); // Create a mask of 'X'
                const regex = new RegExp(searchString, 'gi'); // Case-insensitive global search
                // @ts-ignore
                var replaced = this.nodeValue.replace(regex, mask);
                this.nodeValue = replaced;
            });
        })
        // Array of strings to search for
        /*
        searchStrings.forEach(function (searchString) {
            const mask = "X".repeat(searchString.length); // Create a mask of 'X'
            const regex = new RegExp(searchString, 'gi'); // Case-insensitive global search
            var replaced = $("body").html().replace(regex,mask);
            $("body").html("<h1>TEST</h1>");
            // document.body.innerHTML = document.body.innerHTML.replace(regex,mask);
        });*/
        /*// Iterate over each text node in the page
        $("*").contents()/!*.filter(function () {
            console.log("this.nodeType:", this.nodeType);
            return this.nodeType === 3; // NodeType 3 = Text node
        })*!/.each(function () {
            if(!this.nodeValue){
                return;
            }
            let text: string = this.nodeValue;
            if(text.indexOf('368590945923') === -1) {
                return;
            }
            console.log("text:", text);
            searchStrings.forEach(function (searchString) {

                const mask = "X".repeat(searchString.length); // Create a mask of 'X'
                const regex = new RegExp(searchString, 'gi'); // Case-insensitive global search
                text = text.replace(regex, mask);
            });
            this.nodeValue = text;
        });*/
    }

    hideErrorMessage() {
        if ($('#olive-extension__error-msg')[0]) {
            $('#olive-extension__error-msg').removeClass('olive-extension-showing').addClass('olive-extension-hidding');
            $('#olive-extension__error-msg').html();
        }
    }

    showErrorMessage(text: string) {
        if ($('#olive-extension__error-msg')[0]) {
            $('#olive-extension__error-msg').removeClass('olive-extension-hidding').addClass('olive-extension-showing');
            $('#olive-extension__error-msg').html(text);
        }
    }

    resetEmailTable() {
        if ($('#olive-extension__email-table')[0]) {
            $('#olive-extension__email-table').empty();
        }
    }

    validateEmail(email: string) {
        if (email && email !== '') {
            return email.match(
                /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
        }

        return false;
    };

    handleLoadEmails() {
        const t = this;

        $(document).ready(() => {
            $('#olive-extension__btn').on('click', async () => {
                t.hideErrorMessage();

                const tabData = await chrome.tabs.query({ active: true, currentWindow: true });
                const tabId = tabData[0].id;

                const handleCurrentTab = () => {
                    const documentHtml = document.body.innerHTML;
                    const context = documentHtml.toString();
                    const emailsData = context.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
                    const emails: string[] = [];

                    if (emailsData && emailsData.length) {
                        for (const item of emailsData) {
                            if (
                                !item.endsWith('.png') &&
                                !item.endsWith('.jpg') &&
                                !item.endsWith('.jpeg') &&
                                !item.endsWith('.gif') &&
                                !item.endsWith('.webp')
                            ) {
                                emails.push(item);
                            }
                        }
                    }

                    if (emails && emails.length) {
                        const temp: string[] = [];

                        let html = `
                            <table>
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                    </tr>
                                </thead>

                                <tbody>
                        `;

                        for (const email of emails) {
                            if (!temp.includes(email)) {
                                temp.push(email);

                                html += `
                                    <tr>
                                        <td>${email}</td>
                                    </tr>
                                `;
                            }
                        }

                        html += `
                                </tbody>
                            </table>
                        `;

                        chrome.runtime.sendMessage(chrome.runtime.id, { type: 'EMAIL_TABLE_CONTENT', data: html });
                    } else {
                        chrome.runtime.sendMessage(chrome.runtime.id, { type: 'NO_EMAIL' });
                    }
                }

                if (tabId) {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        func: handleCurrentTab,
                    })
                }
            });
        });
    }

    handleData() {
        chrome.runtime.onMessage.addListener((request, sender) => {
            if (request && request.type) {
                switch (request.type) {
                    case 'EMAIL_TABLE_CONTENT': {
                        $('#olive-extension__email-table').html(request.data);
                        break;
                    }
                    case 'NO_EMAIL': {
                        this.showErrorMessage('No email');
                        break;
                    }
                }
            }
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'EXTRACT_VEHICLE_IMAGES') {
                this.extractVehicleImages().then((data) => {
                    sendResponse({ success: true, data });
                }).catch((error) => {
                    console.error('Error extracting vehicle images:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep message channel open for async response
            }
        });
    }

    async extractVehicleImages() {
        try {
            // Check if we're on a Custom Wheel Offset gallery page
            if (!window.location.hostname.includes('customwheeloffset.com')) {
                throw new Error('Not on a Custom Wheel Offset page');
            }

            const vehicleImages: string[] = [];
            const vehicleInfo: any = {};

            // Extract main slideshow images from the main slider container only
            const mainSliderContainer = document.getElementById('main-slider-container');
            if (mainSliderContainer) {
                // Get images with web-compressed in src
                const slideshowImages = mainSliderContainer.querySelectorAll('img[src*="web-compressed"]');
                slideshowImages.forEach((img: any) => {
                    if (img.src && img.src.includes('web-compressed')) {
                        vehicleImages.push(img.src);
                    }
                });
                
                // Also get images from links with web-compressed in href (preloaded slideshow navigation)
                const slideshowLinks = mainSliderContainer.querySelectorAll('a[href*="web-compressed"]');
                slideshowLinks.forEach((link: any) => {
                    if (link.href && link.href.includes('web-compressed')) {
                        vehicleImages.push(link.href);
                    }
                });
                
                console.log(`Found ${vehicleImages.length} web-compressed slideshow images in main-slider-container`);
            } else {
                console.warn('main-slider-container div not found, falling back to web-compressed images');
                // Fallback to all web-compressed images if the main slider container is not found
                const slideshowImages = document.querySelectorAll('img[src*="web-compressed"]');
                slideshowImages.forEach((img: any) => {
                    if (img.src && img.src.includes('web-compressed')) {
                        vehicleImages.push(img.src);
                    }
                });
                
                // Also get from links
                const slideshowLinks = document.querySelectorAll('a[href*="web-compressed"]');
                slideshowLinks.forEach((link: any) => {
                    if (link.href && link.href.includes('web-compressed')) {
                        vehicleImages.push(link.href);
                    }
                });
            }

            // Remove duplicates from vehicle images array
            const uniqueVehicleImages = [...new Set(vehicleImages)];
            console.log(`Removed ${vehicleImages.length - uniqueVehicleImages.length} duplicate image URLs`);

            // Extract vehicle information from the page
            vehicleInfo.title = document.title || '';
            vehicleInfo.url = window.location.href || '';
            
            // Extract vehicle year, make, model from breadcrumb or title
            const breadcrumbLinks = document.querySelectorAll('nav a');
            breadcrumbLinks.forEach((link: any) => {
                const text = link.textContent?.trim();
                if (text && text.match(/^\d{4}/)) { // Starts with year
                    vehicleInfo.yearMakeModel = text;
                }
            });

            // Extract wheel and tire information from the table
            const wheelInfo = this.extractWheelTireInfo();
            vehicleInfo.wheels = wheelInfo.wheels;
            vehicleInfo.tires = wheelInfo.tires;
            vehicleInfo.suspension = wheelInfo.suspension;

            // Extract owner information
            const ownerElement = document.querySelector('a[href*="instagram.com"]');
            if (ownerElement) {
                vehicleInfo.owner = ownerElement.textContent?.trim();
            }

            console.log('Extracted vehicle data:', { vehicleImages: uniqueVehicleImages, vehicleInfo });

            // Send extracted data to background script
            chrome.runtime.sendMessage({
                type: 'VEHICLE_IMAGES_EXTRACTED',
                data: uniqueVehicleImages,
                vehicleInfo: vehicleInfo
            });

            return { vehicleImages: uniqueVehicleImages, vehicleInfo };
        } catch (error) {
            console.error('Error extracting vehicle images:', error);
            throw error;
        }
    }

    extractWheelTireInfo() {
        const wheelInfo: any = { wheels: {}, tires: {}, suspension: {} };

        try {
            // Extract wheel information
            const wheelRows = document.querySelectorAll('table tr');
            wheelRows.forEach((row) => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 2) {
                    const label = cells[0]?.textContent?.trim().toLowerCase();
                    const value = cells[1]?.textContent?.trim();

                    if (label?.includes('wheel') && label?.includes('front')) {
                        wheelInfo.wheels.frontSize = value;
                    } else if (label?.includes('wheel') && label?.includes('rear')) {
                        wheelInfo.wheels.rearSize = value;
                    } else if (label?.includes('offset') && label?.includes('front')) {
                        wheelInfo.wheels.frontOffset = value;
                    } else if (label?.includes('offset') && label?.includes('rear')) {
                        wheelInfo.wheels.rearOffset = value;
                    } else if (label?.includes('tire') && label?.includes('front')) {
                        wheelInfo.tires.frontSize = value;
                    } else if (label?.includes('tire') && label?.includes('rear')) {
                        wheelInfo.tires.rearSize = value;
                    } else if (label?.includes('suspension')) {
                        wheelInfo.suspension.type = value;
                    }
                }
            });

            // Extract wheel brand and model from headings
            const wheelHeading = document.querySelector('h3');
            if (wheelHeading) {
                wheelInfo.wheels.brand = wheelHeading.textContent?.trim();
            }

        } catch (error) {
            console.error('Error extracting wheel/tire info:', error);
        }

        return wheelInfo;
    }

    setupImageCompositing() {
        // Only run on Custom Wheel Offset pages
        if (!window.location.hostname.includes('customwheeloffset.com')) {
            return;
        }

        // Setup compositing UI in specific location (for product pages)
        this.injectCompositingUI();
        
        // Setup vehicle gallery UI (for gallery pages)
        this.injectVehicleGalleryUI();
        
        // Re-inject UI when page content changes (for dynamic loading)
        const observer = new MutationObserver(() => {
            this.injectCompositingUI();
            this.injectVehicleGalleryUI();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    injectCompositingUI() {
        // Only inject on product pages, not gallery pages
        if (this.isVehicleGalleryPage()) {
            return;
        }

        // Find the specific injection point: after main-slider-container, before nav-slider
        const mainSliderContainer = document.getElementById('main-slider-container');
        const navSlider = document.getElementById('nav-slider');
        
        if (!mainSliderContainer || !navSlider) {
            console.log('Required slider elements not found for compositing UI injection');
            console.log('main-slider-container found:', !!mainSliderContainer);
            console.log('nav-slider found:', !!navSlider);
            return;
        }

        // Check if our compositing UI already exists
        const existingCompositingUI = document.getElementById('compositing-ui-container');
        if (existingCompositingUI) {
            return; // Already injected
        }

        // Create the main compositing UI container
        const compositingContainer = document.createElement('div');
        compositingContainer.id = 'compositing-ui-container';
        compositingContainer.style.cssText = `
            margin: 20px 0;
            padding: 16px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            font-family: Arial, sans-serif;
        `;

        // Add the compositing interface
        this.createCompositingInterface(compositingContainer);

        // Insert between main-slider-container and nav-slider
        const parent = mainSliderContainer.parentElement;
        if (parent) {
            parent.insertBefore(compositingContainer, navSlider);
            console.log('Compositing UI injected between main-slider-container and nav-slider');
            
            // Retry populating images after a short delay (for dynamic content)
            setTimeout(async () => {
                await this.populateImageOptions(compositingContainer);
            }, 1000);
        }
    }

    isVehicleGalleryPage(): boolean {
        return window.location.pathname.includes('/wheel-offset-gallery/');
    }

    injectVehicleGalleryUI() {
        // Only inject on vehicle gallery pages
        if (!this.isVehicleGalleryPage()) {
            return;
        }

        // Check if already injected
        const existingSetVehicleUI = document.getElementById('set-vehicle-ui-container');
        if (existingSetVehicleUI) {
            return;
        }

        // Find the Save button using multiple approaches
        let saveButton = document.querySelector('a[href*="auth/login"]') as HTMLElement;
        if (!saveButton) {
            // Try to find any save-like button
            const links = document.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent?.toLowerCase().includes('save')) {
                    saveButton = link as HTMLElement;
                    break;
                }
            }
        }
        
        if (!saveButton) {
            // Alternative: look for the heading and inject before "Explore These Products"
            const headings = document.querySelectorAll('h2');
            let exploreHeading = null;
            for (const heading of headings) {
                if (heading.textContent?.includes('Explore These Products')) {
                    exploreHeading = heading as HTMLElement;
                    break;
                }
            }
            if (!exploreHeading) {
                console.log('Could not find suitable injection point for Set Vehicle UI');
                return;
            }
        }

        // Create the Set Vehicle UI container
        const setVehicleContainer = document.createElement('div');
        setVehicleContainer.id = 'set-vehicle-ui-container';
        setVehicleContainer.style.cssText = `
            margin: 16px 0;
            padding: 12px;
            background: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 6px;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        this.createSetVehicleInterface(setVehicleContainer);

        // Insert the UI
        if (saveButton) {
            // Insert after the save button's parent container
            const saveContainer = saveButton.closest('div, p') || saveButton.parentElement;
            if (saveContainer && saveContainer.parentElement) {
                saveContainer.parentElement.insertBefore(setVehicleContainer, saveContainer.nextSibling);
                console.log('Set Vehicle UI injected after Save button');
            }
        } else {
            // Insert before "Explore These Products" section
            const headings = document.querySelectorAll('h2');
            let exploreHeading = null;
            for (const heading of headings) {
                if (heading.textContent?.includes('Explore These Products')) {
                    exploreHeading = heading as HTMLElement;
                    break;
                }
            }
            if (exploreHeading) {
                exploreHeading.parentElement?.insertBefore(setVehicleContainer, exploreHeading);
                console.log('Set Vehicle UI injected before Explore Products section');
            }
        }
    }

    createCompositingInterface(container: HTMLElement) {
        container.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px 0; color: #333; display: flex; align-items: center;">
                    🎨 AI Image Compositing
                    <span style="background: #FF6B35; color: white; font-size: 11px; padding: 2px 6px; border-radius: 3px; margin-left: 8px;">BETA</span>
                </h4>
                <p style="margin: 0; font-size: 14px; color: #666;">
                    Create realistic composite images by combining vehicle and product photos using AI.
                </p>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                    Vehicle Image:
                </label>
                <select class="vehicle-image-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="">Choose vehicle image...</option>
                </select>
            </div>

            <!-- Vehicle Image Preview (Full Width) - Clickable for Positioning -->
            <div class="vehicle-image-preview" style="margin-bottom: 16px; text-align: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; display: none;">
                <h5 style="margin: 0 0 12px 0; color: #333; font-size: 14px;">🚗 Vehicle Scene</h5>
                <div class="vehicle-image-container" style="position: relative; display: inline-block;">
                    <canvas class="vehicle-positioning-canvas" style="border: 2px solid #007bff; border-radius: 4px; cursor: crosshair; display: none;"></canvas>
                    <img class="vehicle-preview-img" style="width: 100%; max-height: 300px; object-fit: contain; border: 2px solid #007bff; border-radius: 4px;" />
                </div>
                <div class="vehicle-preview-url" style="font-size: 12px; color: #666; margin-top: 8px; word-break: break-all;"></div>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 16px; align-items: center;">
                <button class="generate-composite-btn" 
                        style="flex: 1; background: #28a745; color: white; border: none; padding: 12px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    🚀 Generate Composite
                </button>
                <button class="clear-points-btn" 
                        style="background: #dc3545; color: white; border: none; padding: 12px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    🗑️ Clear
                </button>
                <button class="advanced-toggle-btn" 
                        style="background: #17a2b8; color: white; border: none; padding: 12px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    ⚙️ Advanced
                </button>
                <button class="debug-toggle-btn" 
                        style="background: #ffc107; color: #212529; border: none; padding: 12px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    🐛 Debug
                </button>
            </div>

            <!-- Advanced Settings Panel -->
            <div class="advanced-panel" style="display: none; margin-bottom: 16px; padding: 16px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                <h5 style="margin: 0 0 16px 0; color: #333; font-size: 14px;">⚙️ Advanced Position & Description Settings</h5>
                
                <!-- Position Mode Selection -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">
                        Position Mode:
                    </label>
                    <div style="display: flex; gap: 12px;">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="radio" name="position-mode" value="point" class="position-mode-radio" checked>
                            <span>📍 Point (Single Click)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="radio" name="position-mode" value="polygon" class="position-mode-radio">
                            <span>🔷 Polygon (Multiple Points)</span>
                        </label>
                    </div>
                </div>

                <!-- Position Controls -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">
                        Product Positioning:
                    </label>
                    <div style="background: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px;">
                        <div style="margin-bottom: 8px; font-size: 12px; color: #666;">
                            Click directly on the Vehicle Scene image above to set product position
                        </div>
                        <div class="position-info" style="font-size: 12px; color: #666;">
                            <div class="position-coordinates" style="margin-bottom: 8px; font-weight: bold;"></div>
                                                    <div class="position-controls" style="display: none;">
                            <button class="clear-points-btn" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-right: 8px;">
                                🗑️ Clear Points
                            </button>
                            <button class="next-polygon-btn" style="background: #17a2b8; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-right: 8px; display: none;">
                                🔷 Next Polygon
                            </button>
                            <span class="polygon-instructions" style="font-style: italic; display: none;">
                                Click first point again to close polygon
                            </span>
                        </div>
                        </div>
                    </div>
                </div>

                <!-- Context Images -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">
                        Context Images (Optional):
                    </label>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                        Select multiple product images to include as context. Use polygon tool to outline products on each image.<br>
                        <strong>Tip:</strong> Hold Ctrl (or Cmd on Mac) to select multiple images, or Shift+click for ranges.
                    </div>
                    <select class="context-image-select" multiple="multiple" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 8px; min-height: 80px;">
                        <option value="">No context images</option>
                    </select>
                    
                    <div class="context-images-container" style="margin-bottom: 12px;">
                        <!-- Context image previews will be dynamically added here -->
                    </div>
                </div>

                <!-- Descriptions -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                            Vehicle Description:
                        </label>
                        <textarea class="vehicle-description" rows="3" 
                                  style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;"
                                  placeholder="Auto-generated from page data..."></textarea>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                            Product Description:
                        </label>
                        <textarea class="product-description" rows="3" 
                                  style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;"
                                  placeholder="Auto-generated from page data..."></textarea>
                    </div>
                </div>
            </div>

            <!-- Debug Panel -->
            <div class="debug-panel" style="display: none; margin-bottom: 16px; padding: 16px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                <h5 style="margin: 0 0 16px 0; color: #333; font-size: 14px;">🐛 Debug Information</h5>
                
                <!-- Product Image Selector (moved from main UI) -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                        Product Image:
                    </label>
                    <select class="product-image-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="">Choose product image...</option>
                    </select>
                </div>

                <!-- Product Image Preview -->
                <div class="debug-product-preview" style="text-align: center; background: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; display: none;">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #28a745; font-size: 12px;">🛞 Product Image</div>
                    <img class="product-preview-img" style="max-width: 100%; max-height: 200px; border: 2px solid #28a745; border-radius: 4px; object-fit: contain;" />
                    <div class="product-preview-url" style="font-size: 10px; color: #666; margin-top: 4px; word-break: break-all;"></div>
                </div>

                <!-- Position Debug Info -->
                <div class="position-debug-info" style="margin-top: 16px; padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #333; font-size: 12px;">📍 Position Debug Information</div>
                    <div class="position-summary" style="font-size: 11px; color: #666;">
                        No positions set yet
                    </div>
                </div>
            </div>

            <div class="composite-status" style="margin-bottom: 12px; padding: 8px; border-radius: 4px; display: none;">
            </div>

            <div class="composite-result" style="display: none;">
            </div>
        `;

        // Populate image options
        this.populateImageOptions(container);

        // Auto-generate descriptions
        this.generateDescriptionsForInterface(container);

        // Add event handlers
        this.setupInterfaceEventHandlers(container);
        
        // Update previews after setup
        this.updateImagePreviews(container);
    }

    async populateContextImageOptions(container: HTMLElement) {
        const contextImageSelect = container.querySelector('.context-image-select') as HTMLSelectElement;
        if (!contextImageSelect) return;

        // Clear existing options except the first one
        while (contextImageSelect.options.length > 1) {
            contextImageSelect.remove(1);
        }

        // Get images specifically from the main slideshow
        let allProductImages: HTMLImageElement[] = [];
        const mainSlider = document.getElementById('main-slider-container');
        if (mainSlider) {
            // Get all images from the main slideshow
            const mainSliderImages = Array.from(mainSlider.querySelectorAll('.slide img')) as HTMLImageElement[];
            
            // Filter out images with undefined src and use data-srcset as fallback
            mainSliderImages.forEach(img => {
                let imageUrl =  img.getAttribute('data-srcset') ;
                
                // If src is undefined, try data-srcset
                if (!imageUrl || imageUrl === 'undefined') {
                    imageUrl = img.getAttribute('data-srcset') || '';
                }
                
                // Only add if we have a valid URL
                if (imageUrl && imageUrl !== 'undefined' && imageUrl.length > 0) {
                    allProductImages.push(img);
                }
            });
        }

        // Add context image options
        allProductImages.forEach((img: HTMLImageElement) => {
            let imageUrl =  img.getAttribute('data-srcset') ;
                
            // If src is undefined, try data-srcset
            if (!imageUrl || imageUrl === 'undefined') {
                imageUrl = img.getAttribute('data-srcset') || '';
            }
            
            if (imageUrl && imageUrl !== 'undefined' && imageUrl.length > 0) {
                const option = document.createElement('option');
                option.value = imageUrl;
                option.textContent = `${img.alt|| imageUrl}`;
                contextImageSelect.appendChild(option);
            }
        });

        // Add event listener for context image selection (multiple selection)
        contextImageSelect.addEventListener('change', () => {
            console.log('Context image selection changed:', {
                selectedOptions: Array.from(contextImageSelect.selectedOptions).map(opt => ({ value: opt.value, text: opt.textContent })),
                multiple: contextImageSelect.multiple,
                selectedIndex: contextImageSelect.selectedIndex
            });
            this.handleContextImageSelection(container);
        });
    }

    handleContextImageSelection(container: HTMLElement) {
        const contextImageSelect = container.querySelector('.context-image-select') as HTMLSelectElement;
        const contextImagesContainer = container.querySelector('.context-images-container') as HTMLDivElement;
        
        if (!contextImageSelect || !contextImagesContainer) return;

        // Get all selected options
        const selectedOptions = Array.from(contextImageSelect.selectedOptions);
        
        // Clear existing previews
        contextImagesContainer.innerHTML = '';
        
        if (selectedOptions.length === 0) {
            return;
        }

        // Create preview for each selected image
        selectedOptions.forEach((option, index) => {
            const imageUrl = option.value;
            if (!imageUrl) return;
            
            const previewContainer = document.createElement('div');
            previewContainer.className = 'context-image-preview';
            previewContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #ffffff; border: 1px solid #dee2e6; border-radius: 4px;';
            
            const imageName = option.textContent || `Image ${index + 1}`;
            
            previewContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: bold; color: #333; font-size: 12px;">
                    ${imageName}
                </div>
                <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
                    Click on the image below to draw polygons around products
                </div>
                <div class="context-canvas-container" style="position: relative; display: inline-block;">
                    <img src="${imageUrl}" class="context-image" style="max-width: 100%; max-height: 200px; border: 2px solid #007bff; border-radius: 4px; display: block;">
                    <canvas class="context-positioning-canvas" data-image-url="${imageUrl}" style="position: absolute; top: 0; left: 0; max-width: 100%; max-height: 200px; cursor: crosshair; pointer-events: auto;"></canvas>
                    <div class="context-polygon-info" style="margin-top: 8px; font-size: 11px; color: #666;">
                        <div class="context-position-coordinates"></div>
                        <div class="context-position-controls" style="display: none;">
                            <button class="context-clear-polygons-btn" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-right: 8px;">
                                🗑️ Clear Polygons
                            </button>
                            <span class="context-polygon-instructions" style="font-style: italic;">
                                Click first point again to close polygon
                            </span>
                        </div>
                    </div>
                </div>
            `;
            
            contextImagesContainer.appendChild(previewContainer);
            
            // Setup canvas for this image
            const canvas = previewContainer.querySelector('.context-positioning-canvas') as HTMLCanvasElement;
            if (canvas) {
                this.setupContextImageCanvas(canvas, imageUrl);
            }
        });
    }

    setupContextImageCanvas(canvas: HTMLCanvasElement, imageUrl: string) {
        // Find the corresponding image element
        const container = canvas.closest('.context-canvas-container');
        const img = container?.querySelector('.context-image') as HTMLImageElement;
        
        if (!img) return;
        
        // Wait for image to load to get its dimensions
        const setupCanvas = () => {
            // Set canvas size to match the displayed image size
            const rect = img.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            
            // Initialize polygon drawing
            this.initializeContextPolygonDrawing(canvas);
        };
        
        if (img.complete) {
            setupCanvas();
        } else {
            img.onload = setupCanvas;
        }
    }

    initializeContextPolygonDrawing(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let currentPolygon: Array<{x: number, y: number}> = [];
        let allPolygons: Array<Array<{x: number, y: number}>> = [];
        let isDrawing = false;

        const drawPolygon = (polygon: Array<{x: number, y: number}>, isCurrent: boolean = false) => {
            if (polygon.length < 2) return;
            
            ctx.strokeStyle = isCurrent ? '#ff6b6b' : '#007bff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(polygon[0].x, polygon[0].y);
            
            for (let i = 1; i < polygon.length; i++) {
                ctx.lineTo(polygon[i].x, polygon[i].y);
            }
            
            if (isCurrent && polygon.length > 2) {
                ctx.closePath();
            }
            
            ctx.stroke();
            
            // Draw points
            polygon.forEach((point, index) => {
                ctx.fillStyle = index === 0 ? '#ff6b6b' : '#007bff';
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
                ctx.fill();
            });
        };

        const redrawCanvas = () => {
            // Clear canvas (transparent)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Redraw all completed polygons
            allPolygons.forEach(polygon => drawPolygon(polygon));
            
            // Draw current polygon
            if (currentPolygon.length > 0) {
                drawPolygon(currentPolygon, true);
            }
            
            // Update dataset with current polygon data
            canvas.dataset.polygons = JSON.stringify(allPolygons);
            canvas.dataset.currentPolygon = JSON.stringify(currentPolygon);
        };

        const updateContextPositionDisplay = () => {
            const container = canvas.closest('.context-image-preview');
            if (!container) return;
            
            const coordinatesDiv = container.querySelector('.context-position-coordinates') as HTMLDivElement;
            const controlsDiv = container.querySelector('.context-position-controls') as HTMLDivElement;
            
            if (coordinatesDiv) {
                const totalPoints = allPolygons.reduce((sum, polygon) => sum + polygon.length, 0) + currentPolygon.length;
                coordinatesDiv.textContent = `Polygons: ${allPolygons.length} • Total Points: ${totalPoints}`;
            }
            
            if (controlsDiv) {
                controlsDiv.style.display = (allPolygons.length > 0 || currentPolygon.length > 0) ? 'block' : 'none';
            }
        };

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (currentPolygon.length === 0) {
                // Start new polygon
                currentPolygon = [{x, y}];
                isDrawing = true;
            } else {
                // Check if clicking on first point to close polygon
                const firstPoint = currentPolygon[0];
                const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
                
                if (distance < 10 && currentPolygon.length > 2) {
                    // Close polygon
                    allPolygons.push([...currentPolygon]);
                    currentPolygon = [];
                    isDrawing = false;
                } else {
                    // Add point to current polygon
                    currentPolygon.push({x, y});
                }
            }
            
            redrawCanvas();
            updateContextPositionDisplay();
        });

        // Add clear button functionality
        const container = canvas.closest('.context-image-preview');
        if (container) {
            const clearBtn = container.querySelector('.context-clear-polygons-btn') as HTMLButtonElement;
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    currentPolygon = [];
                    allPolygons = [];
                    redrawCanvas();
                    updateContextPositionDisplay();
                });
            }
        }

        // Store polygons data for later use
        canvas.dataset.polygons = JSON.stringify(allPolygons);
        canvas.dataset.currentPolygon = JSON.stringify(currentPolygon);
        
        // Also update the display initially
        updateContextPositionDisplay();
    }

    async populateImageOptions(container: HTMLElement) {
        const vehicleSelect = container.querySelector('.vehicle-image-select') as HTMLSelectElement;
        const productSelect = container.querySelector('.product-image-select') as HTMLSelectElement;
        
        // Check for stored vehicle from gallery
        await this.addStoredVehicleToSelect(vehicleSelect);
        
        // Add stored vehicle images from vehicleData
        await this.addVehicleDataImagesToSelect(vehicleSelect);
        
        // Find vehicle images (web-compressed) - try multiple selectors
        let vehicleImages = document.querySelectorAll('img[src*="web-compressed"]');
        
        // If no web-compressed images found, try broader search
        if (vehicleImages.length === 0) {
            // Look for images in main slider container
            const mainSlider = document.getElementById('main-slider-container');
            if (mainSlider) {
                vehicleImages = mainSlider.querySelectorAll('img');
            }
        }
        
        // If still no images, search all images on page that might be vehicles
        if (vehicleImages.length === 0) {
            vehicleImages = document.querySelectorAll('img[src*="customwheeloffset"], img[src*="gallery"], img[src*="vehicle"]');
        }

        console.log(`Found ${vehicleImages.length} vehicle images on page:`, Array.from(vehicleImages).map((img: any) => img.src));

        vehicleImages.forEach((img: any) => {
            if (img.src && img.src.length > 0) {
                // Check if this image is already added from storage to avoid duplicates
                const existingOptions = Array.from(vehicleSelect.options);
                const isDuplicate = existingOptions.some(option => option.value === img.src);
                
                if (!isDuplicate) {
                    const option = document.createElement('option');
                    option.value = img.src;
                    option.textContent = img.src.split('/').pop() || img.src;
                    vehicleSelect.appendChild(option);
                }
            }
        });

        // Find product images - start with wheels-compressed
        const wheelsCompressedImages = Array.from(document.querySelectorAll('img[src*="wheels-compressed"]')) as HTMLImageElement[];
        
        // Add images from main-slider-container (these could be product images)
        let allProductImages: HTMLImageElement[] = [...wheelsCompressedImages];
        const mainSlider = document.getElementById('main-slider-container');
        if (mainSlider) {
            const mainSliderImages = Array.from(mainSlider.querySelectorAll('img')) as HTMLImageElement[];
            // Combine and deduplicate by src
            const imageUrls = new Set(allProductImages.map(img => img.src));
            mainSliderImages.forEach(img => {
                if (!imageUrls.has(img.src)) {
                    allProductImages.push(img);
                    imageUrls.add(img.src);
                }
            });
        }
        
        // If still no images, try broader search
        if (allProductImages.length === 0) {
            const broadSearchImages = Array.from(document.querySelectorAll('img[src*="wheel"], img[src*="rim"]'));
            allProductImages = broadSearchImages as HTMLImageElement[];
        }

        console.log(`Found ${allProductImages.length} product images:`, allProductImages.map((img: any) => img.src));

        allProductImages.forEach((img: HTMLImageElement) => {
            if (img.src && img.src.length > 0) {
                // Check if this image is already added to avoid duplicates
                const existingOptions = Array.from(productSelect.options);
                const isDuplicate = existingOptions.some(option => option.value === img.src);
                
                if (!isDuplicate) {
                    const option = document.createElement('option');
                    option.value = img.src;
                    option.textContent = img.src.split('/').pop() || img.src;
                    productSelect.appendChild(option);
                }
            }
        });

        // Populate context images (product images from main slideshow)
        await this.populateContextImageOptions(container);

        // Auto-select first options if available (prioritize stored vehicle)
        if (vehicleSelect.options.length > 1) {
            // Check if first option is stored vehicle
            const firstOption = vehicleSelect.options[1];
            if (firstOption && firstOption.textContent?.includes('📋 Stored:')) {
                vehicleSelect.selectedIndex = 1;
            } else {
                vehicleSelect.selectedIndex = 1;
            }
        }
        if (productSelect.options.length > 1) {
            productSelect.selectedIndex = 1;
        }

        // Add debug info to UI if no images found
        if (vehicleImages.length === 0 && allProductImages.length === 0) {
            const debugInfo = document.createElement('div');
            debugInfo.style.cssText = 'background: #fff3cd; border: 1px solid #ffeaa7; padding: 8px; border-radius: 4px; margin-top: 8px; font-size: 12px;';
            debugInfo.innerHTML = '⚠️ No images detected on this page. This feature works best on Custom Wheel Offset product gallery pages.';
            container.appendChild(debugInfo);
        }
    }

    async addStoredVehicleToSelect(vehicleSelect: HTMLSelectElement) {
        try {
            // Use VehicleStorage instead of currentVehicle
            const { VehicleStorage } = await import('./utils/vehicleStorage');
            const vehicleData = await VehicleStorage.getVehicleData();
            
            if (vehicleData && vehicleData.images && vehicleData.images.length > 0) {
                // Check if vehicle was set recently (within 24 hours)
                const hoursSinceSet = (Date.now() - vehicleData.extractedAt) / (1000 * 60 * 60);
                if (hoursSinceSet < 24) {
                    
                    // Add each stored vehicle image
                    vehicleData.images.forEach((imageUrl: string, index: number) => {
                        const option = document.createElement('option');
                        option.value = imageUrl;
                        
                        // Create a descriptive label
                        let label = `📋 Gallery: Vehicle Image ${index + 1}`;
                        if (vehicleData.info?.yearMakeModel) {
                            label = `📋 Gallery: ${vehicleData.info.yearMakeModel} (${index + 1})`;
                        }
                        
                        option.textContent = label;
                        option.style.backgroundColor = '#e3f2fd';
                        
                        // Mark the first image as main if no specific main indicator
                        if (index === 0) {
                            option.style.fontWeight = 'bold';
                        }
                        
                        // Insert stored images after the "Choose vehicle image..." option
                        vehicleSelect.appendChild(option);
                    });
                    console.log('Added stored vehicle gallery images to select:', vehicleData.images.length, 'images');
                }
            }
        } catch (error) {
            console.error('Error loading stored vehicle:', error);
        }
    }

    async addVehicleDataImagesToSelect(vehicleSelect: HTMLSelectElement) {
        try {
            const { VehicleStorage } = await import('./utils/vehicleStorage');
            const vehicleData = await VehicleStorage.getVehicleData();
            
            if (vehicleData && vehicleData.images && vehicleData.images.length > 0) {
                console.log(`Found ${vehicleData.images.length} stored vehicle images from vehicleData`);
                
                // Create separator for stored vehicle images
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '─── Stored Vehicle Images ───';
                separator.style.fontStyle = 'italic';
                separator.style.color = '#999';
                vehicleSelect.appendChild(separator);
                
                // Add each stored vehicle image
                vehicleData.images.forEach((imageUrl: string, index: number) => {
                    const option = document.createElement('option');
                    option.value = imageUrl;
                    
                    // Create a descriptive label
                    let label = `🚗 Vehicle ${index + 1}`;
                    if (vehicleData.info?.yearMakeModel) {
                        label = `🚗 ${vehicleData.info.yearMakeModel} (${index + 1})`;
                    }
                    
                    option.textContent = label;
                    option.style.backgroundColor = '#f0f8ff';
                    vehicleSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading vehicle data images:', error);
        }
    }

    async generateDescriptionsForInterface(container: HTMLElement) {
        try {
            const { CompositingService } = await import('./services/compositingService');
            
            // Generate descriptions using the current page
            const descriptions = await CompositingService.generateDescriptions(
                window.location.href, 
                window.location.href
            );

            // Fill in the textareas
            const vehicleTextarea = container.querySelector('.vehicle-description') as HTMLTextAreaElement;
            const productTextarea = container.querySelector('.product-description') as HTMLTextAreaElement;
            
            vehicleTextarea.value = descriptions.sceneDescription;
            productTextarea.value = descriptions.productDescription;
            
        } catch (error) {
            console.error('Error generating descriptions for interface:', error);
        }
    }

    clearPositionPoints(container: HTMLElement) {
        const vehicleCanvas = container.querySelector('.vehicle-positioning-canvas') as HTMLCanvasElement;
        if (vehicleCanvas) {
            // Clear the canvas dataset
            vehicleCanvas.dataset.points = JSON.stringify([]);
            vehicleCanvas.dataset.currentPolygon = JSON.stringify([]);
            vehicleCanvas.dataset.completedPolygons = JSON.stringify([]);
            
            // Redraw the canvas to clear visual elements
            const ctx = vehicleCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, vehicleCanvas.width, vehicleCanvas.height);
            }
            
            // Update the position display
            const positionCoordinates = container.querySelector('.position-coordinates') as HTMLDivElement;
            const positionControls = container.querySelector('.position-controls') as HTMLDivElement;
            
            if (positionCoordinates) {
                positionCoordinates.textContent = '';
            }
            if (positionControls) {
                positionControls.style.display = 'none';
            }
            
            // Update debug info
            this.updatePositionDebugInfo(container);
            
            console.log('Cleared all position points and polygons');
        }
    }

    startNextPolygon(container: HTMLElement) {
        const vehicleCanvas = container.querySelector('.vehicle-positioning-canvas') as HTMLCanvasElement;
        if (vehicleCanvas) {
            // Get current points and completed polygons
            const currentPoints = JSON.parse(vehicleCanvas.dataset.points || '[]');
            const completedPolygons = JSON.parse(vehicleCanvas.dataset.completedPolygons || '[]');
            
            if (currentPoints.length >= 3) {
                // Add current polygon to completed polygons
                completedPolygons.push([...currentPoints]);
                vehicleCanvas.dataset.completedPolygons = JSON.stringify(completedPolygons);
                
                // Clear current points to start new polygon
                vehicleCanvas.dataset.points = JSON.stringify([]);
                
                // Update display
                this.updateVehiclePositionDisplay(container, vehicleCanvas);
                this.updatePositionDebugInfo(container);
                
                console.log('Started new polygon. Total completed polygons:', completedPolygons.length);
            }
        }
    }

    updatePositionDebugInfo(container: HTMLElement) {
        const vehicleCanvas = container.querySelector('.vehicle-positioning-canvas') as HTMLCanvasElement;
        const positionSummary = container.querySelector('.position-summary') as HTMLDivElement;
        
        if (!vehicleCanvas || !positionSummary) return;
        
        const currentPoints = JSON.parse(vehicleCanvas.dataset.points || '[]');
        const completedPolygons = JSON.parse(vehicleCanvas.dataset.completedPolygons || '[]');
        const mode = (container.querySelector('.position-mode-radio:checked') as HTMLInputElement)?.value || 'point';
        
        let summary = '';
        
        if (mode === 'point') {
            if (currentPoints.length === 0) {
                summary = 'No points set';
            } else if (currentPoints.length === 1) {
                const p = currentPoints[0];
                summary = `Point 1: (${Math.round(p.x)}, ${Math.round(p.y)})`;
            } else {
                const p1 = currentPoints[0];
                const p2 = currentPoints[1];
                summary = `Point 1: (${Math.round(p1.x)}, ${Math.round(p1.y)}) • Point 2: (${Math.round(p2.x)}, ${Math.round(p2.y)})`;
            }
        } else {
            if (completedPolygons.length === 0 && currentPoints.length === 0) {
                summary = 'No polygons set';
            } else {
                summary = `Completed polygons: ${completedPolygons.length}`;
                if (currentPoints.length > 0) {
                    summary += ` • Current polygon: ${currentPoints.length} points`;
                }
                
                // Show rough point counts for each polygon
                if (completedPolygons.length > 0) {
                    const polygonInfo = completedPolygons.map((polygon: any[], index: number) => 
                        `P${index + 1}: ${polygon.length}pts`
                    ).join(', ');
                    summary += ` • [${polygonInfo}]`;
                }
            }
        }
        
        positionSummary.textContent = summary;
    }

    setupInterfaceEventHandlers(container: HTMLElement) {
        const generateBtn = container.querySelector('.generate-composite-btn') as HTMLButtonElement;
        const clearPointsBtn = container.querySelector('.clear-points-btn') as HTMLButtonElement;
        const advancedToggleBtn = container.querySelector('.advanced-toggle-btn') as HTMLButtonElement;
        const debugToggleBtn = container.querySelector('.debug-toggle-btn') as HTMLButtonElement;
        const vehicleSelect = container.querySelector('.vehicle-image-select') as HTMLSelectElement;
        const productSelect = container.querySelector('.product-image-select') as HTMLSelectElement;

        // Generate composite handler
        generateBtn.addEventListener('click', () => {
            this.handleInterfaceCompositeGeneration(container);
        });

        // Clear points handler
        clearPointsBtn.addEventListener('click', () => {
            this.clearPositionPoints(container);
        });

        // Next polygon handler
        const nextPolygonBtn = container.querySelector('.next-polygon-btn') as HTMLButtonElement;
        if (nextPolygonBtn) {
            nextPolygonBtn.addEventListener('click', () => {
                this.startNextPolygon(container);
            });
        }

        // Advanced toggle handler
        advancedToggleBtn.addEventListener('click', () => {
            this.toggleAdvancedPanel(container);
        });

        // Debug toggle handler
        if (debugToggleBtn) {
            debugToggleBtn.addEventListener('click', () => {
                this.toggleDebugPanel(container);
            });
        }

        // Image preview handlers
        vehicleSelect.addEventListener('change', () => {
            this.updateImagePreviews(container);
            this.setupVehicleImagePositioning(container);
        });

        productSelect.addEventListener('change', () => {
            this.updateImagePreviews(container);
        });

        // Position mode handlers
        const positionModeRadios = container.querySelectorAll('.position-mode-radio') as NodeListOf<HTMLInputElement>;
        positionModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updatePositionMode(container);
            });
        });



        // Update previews and setup positioning after initial population
        setTimeout(() => {
            this.updateImagePreviews(container);
            this.setupVehicleImagePositioning(container);
        }, 500);
    }

    async handleInterfaceCompositeGeneration(container: HTMLElement) {
        console.log('=== COMPOSITE GENERATION STARTED ===');
        console.log('Container:', container);
        
        const generateBtn = container.querySelector('.generate-composite-btn') as HTMLButtonElement;
        const statusDiv = container.querySelector('.composite-status') as HTMLElement;
        const resultDiv = container.querySelector('.composite-result') as HTMLElement;
        
        console.log('Found elements:', { generateBtn: !!generateBtn, statusDiv: !!statusDiv, resultDiv: !!resultDiv });
        
        // Prevent multiple concurrent requests
        if (generateBtn.dataset.requesting === 'true') {
            console.log('Request already in progress, ignoring duplicate click');
            return;
        }
        
        try {
            // Mark request as in progress
            generateBtn.dataset.requesting = 'true';
            // Get form values
            const vehicleSelect = container.querySelector('.vehicle-image-select') as HTMLSelectElement;
            const productSelect = container.querySelector('.product-image-select') as HTMLSelectElement;
            const vehicleTextarea = container.querySelector('.vehicle-description') as HTMLTextAreaElement;
            const productTextarea = container.querySelector('.product-description') as HTMLTextAreaElement;
            const canvas = container.querySelector('.position-canvas') as HTMLCanvasElement;

            const vehicleImageUrl = vehicleSelect.value;
            const productImageUrl = productSelect.value;
            
            if (!vehicleImageUrl || !productImageUrl) {
                throw new Error('Please select both vehicle and product images');
            }

            // Get position data from vehicle positioning canvas
            const vehicleCanvas = container.querySelector('.vehicle-positioning-canvas') as HTMLCanvasElement;
            const currentPoints = JSON.parse(vehicleCanvas?.dataset.points || '[]');
            const completedPolygons = JSON.parse(vehicleCanvas?.dataset.completedPolygons || '[]');
            const mode = (container.querySelector('.position-mode-radio:checked') as HTMLInputElement)?.value || 'point';
            
            let positionData: Array<Array<{xPercent: number, yPercent: number}>> = [];
            
            if (mode === 'point') {
                // For point mode, create separate polygons for each point
                if (currentPoints.length === 0) {
                    throw new Error('Please click on the vehicle image to set product position');
                }
                positionData = currentPoints.map((point: any) => [{
                    xPercent: Math.round((point.x / vehicleCanvas.width) * 100),
                    yPercent: Math.round((point.y / vehicleCanvas.height) * 100)
                }]); // Each point becomes its own polygon
            } else {
                // For polygon mode, combine completed polygons with current points if they form a complete polygon
                let allPolygons: Array<Array<{xPercent: number, yPercent: number}>> = [];
                
                // Add completed polygons
                completedPolygons.forEach((polygon: any[]) => {
                    if (polygon.length >= 3) {
                        const percentagePolygon = polygon.map((point: any) => ({
                            xPercent: Math.round((point.x / vehicleCanvas.width) * 100),
                            yPercent: Math.round((point.y / vehicleCanvas.height) * 100)
                        }));
                        allPolygons.push(percentagePolygon);
                    }
                });
                
                // Add current points if they form a complete polygon
                if (currentPoints.length >= 3) {
                    const currentPolygon = currentPoints.map((point: any) => ({
                        xPercent: Math.round((point.x / vehicleCanvas.width) * 100),
                        yPercent: Math.round((point.y / vehicleCanvas.height) * 100)
                    }));
                    allPolygons.push(currentPolygon);
                }
                
                if (allPolygons.length === 0) {
                    throw new Error('Please create at least one complete polygon on the vehicle image');
                }
                
                positionData = allPolygons; // Keep as array of polygons
            }

            const vehicleDescription = vehicleTextarea.value.trim();
            const productDescription = productTextarea.value.trim();

            if (!vehicleDescription || !productDescription) {
                throw new Error('Please provide both vehicle and product descriptions');
            }

            // Show loading state
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Generating...';
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#d1ecf1';
            statusDiv.style.color = '#0c5460';
            statusDiv.innerHTML = '🔄 Generating composite image...';
            resultDiv.style.display = 'none';

            // Import and use compositing service
            const { CompositingService } = await import('./services/compositingService');
            
            // Get context images if any are selected
            const contextImages: Array<{
                url: string;
                points: Array<Array<{xPercent: number, yPercent: number}>>;
            }> = [];
            
            const contextImageSelect = container.querySelector('.context-image-select') as HTMLSelectElement;
            if (contextImageSelect && contextImageSelect.selectedOptions.length > 0) {
                // Get all selected context images
                const selectedOptions = Array.from(contextImageSelect.selectedOptions);
                
                selectedOptions.forEach((option) => {
                    const imageUrl = option.value;
                    if (!imageUrl) return;
                    
                    console.log(`Processing context image: ${imageUrl}`);
                    
                    // Find the canvas for this specific image
                    const contextCanvas = container.querySelector(`.context-positioning-canvas[data-image-url="${imageUrl}"]`) as HTMLCanvasElement;
                    console.log(`Found canvas for ${imageUrl}:`, contextCanvas);
                    
                    if (contextCanvas) {
                        // Check for completed polygons
                        let polygons: Array<Array<{x: number, y: number}>> = [];
                        if (contextCanvas.dataset.polygons) {
                            console.log(`Canvas dataset polygons:`, contextCanvas.dataset.polygons);
                            polygons = JSON.parse(contextCanvas.dataset.polygons);
                        }
                        
                        // Check for incomplete polygon and close it if it has enough points
                        if (contextCanvas.dataset.currentPolygon) {
                            const currentPolygon = JSON.parse(contextCanvas.dataset.currentPolygon);
                            console.log(`Current incomplete polygon:`, currentPolygon);
                            
                            if (currentPolygon.length >= 3) {
                                // Auto-close the incomplete polygon
                                console.log(`Auto-closing incomplete polygon with ${currentPolygon.length} points`);
                                polygons.push([...currentPolygon]);
                                
                                // Update the canvas dataset to reflect the closed polygon
                                contextCanvas.dataset.polygons = JSON.stringify(polygons);
                                contextCanvas.dataset.currentPolygon = JSON.stringify([]);
                            }
                        }
                        
                        if (polygons.length > 0) {
                            // Convert canvas coordinates to percentages
                            const contextPolygons = polygons.map((polygon: Array<{x: number, y: number}>) => 
                                polygon.map((point: {x: number, y: number}) => ({
                                    xPercent: Math.round((point.x / contextCanvas.width) * 100),
                                    yPercent: Math.round((point.y / contextCanvas.height) * 100)
                                }))
                            );
                            
                            console.log(`Converted to percentages:`, contextPolygons);
                            
                            contextImages.push({
                                url: imageUrl,
                                points: contextPolygons
                            });
                        } else {
                            console.log(`No polygons found for ${imageUrl}`);
                        }
                    } else {
                        console.log(`No canvas found for ${imageUrl}`);
                    }
                });
            }

            const request = {
                sceneUrl: vehicleImageUrl,
                productUrl: productImageUrl,
                placementGeometry: positionData, // Now sends array of polygons
                sceneDescription: vehicleDescription,
                productDescription: productDescription,
                ...(contextImages.length > 0 && { contextImages })
            };

            console.log('Sending composite request from interface:', request);
            console.log('Context images collected:', contextImages);
            console.log('Context image select element:', contextImageSelect);
            console.log('Selected options:', Array.from(contextImageSelect?.selectedOptions || []));
            const response = await CompositingService.generateComposite(request);

            // Show success
            statusDiv.style.background = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.innerHTML = '✅ Composite generated successfully!';

            // Show result
            resultDiv.style.display = 'block';
            const { ConfigService } = await import('./services/configService');
            const baseUrl = await ConfigService.getApiBaseUrl();
            const fullImageUrl = response.finalImageUrl.startsWith('http') ? response.finalImageUrl : `${baseUrl}${response.finalImageUrl}`;
            const fullDebugUrl = response.debugImageUrl && !response.debugImageUrl.startsWith('data:') && !response.debugImageUrl.startsWith('http') 
                ? `${baseUrl}${response.debugImageUrl}` 
                : response.debugImageUrl;
            
            resultDiv.innerHTML = `
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: white;">
                    <h5 style="margin: 0 0 12px 0; color: #333;">🎨 Generated Composite Image:</h5>
                    <div style="text-align: center; margin-bottom: 12px;">
                        <img src="${fullImageUrl}" alt="Generated Composite" 
                             style="max-width: 100%; max-height: 400px; height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 12px;">
                        <a href="${fullImageUrl}" download="composite-image.jpg" 
                           style="display: inline-block; background: #007bff; color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; font-size: 14px;">
                            💾 Download Image
                        </a>
                        <button onclick="navigator.share({files: [new File([await fetch('${fullImageUrl}').then(r => r.blob())], 'composite.jpg')]})" 
                                style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            📤 Share
                        </button>
                        ${await this.getUpdate3DModelButton(fullImageUrl)}
                    </div>
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; font-size: 12px; color: #666; margin-bottom: 8px;">🔧 Debug Information</summary>
                        <div style="font-size: 11px; color: #666; background: #f8f9fa; padding: 8px; border-radius: 4px;">
                            <p style="margin: 0 0 8px 0;"><strong>AI Prompt:</strong> ${response.finalPrompt}</p>
                            ${fullDebugUrl ? `
                                <p style="margin: 0 0 4px 0;"><strong>Debug Image:</strong></p>
                                <img src="${fullDebugUrl}" alt="Debug" style="max-width: 200px; height: auto; border: 1px solid #ddd; border-radius: 4px;">
                            ` : ''}
                        </div>
                    </details>
                </div>
            `;

            // Add event listener for Update 3D Model button if it exists
            const update3dBtn = resultDiv.querySelector('.update-3d-model-btn') as HTMLButtonElement;
            if (update3dBtn) {
                update3dBtn.addEventListener('click', async () => {
                    const { VehicleStorage } = await import('./utils/vehicleStorage');
                    const vehicleData = await VehicleStorage.getVehicleData();
                    if (vehicleData?.meshyModelId) {
                        this.handleUpdate3DModel(update3dBtn, fullImageUrl, vehicleData.meshyModelId);
                    }
                });
            }

        } catch (error) {
            console.error('Interface composite generation error:', error);
            
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#f8d7da';
            statusDiv.style.color = '#721c24';
            statusDiv.innerHTML = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
            
        } finally {
            // Clear request flag and restore button
            generateBtn.dataset.requesting = 'false';
            generateBtn.disabled = false;
            generateBtn.textContent = '🚀 Generate Composite';
        }
    }

    addCompositingButton(img: HTMLImageElement) {
        // Mark as processed
        img.setAttribute('data-compositing-ready', 'true');
        
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'compositing-button-container';
        buttonContainer.style.cssText = `
            margin-top: 8px;
            text-align: center;
            font-family: Arial, sans-serif;
        `;

        // Create main compositing button
        const button = document.createElement('button');
        button.textContent = '🎨 Generate Composite';
        button.className = 'compositing-button';
        button.style.cssText = `
            background: #FF6B35;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: background 0.2s;
        `;

        // Add hover effect
        button.onmouseover = () => button.style.background = '#E55A2B';
        button.onmouseout = () => button.style.background = '#FF6B35';

        // Create expandable controls panel
        const controlsPanel = document.createElement('div');
        controlsPanel.className = 'compositing-controls';
        controlsPanel.style.cssText = `
            display: none;
            margin-top: 12px;
            padding: 16px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
        `;

        // Add controls content
        this.createControlsPanel(controlsPanel, img);

        // Add click handler to toggle controls
        button.addEventListener('click', () => {
            const isVisible = controlsPanel.style.display !== 'none';
            controlsPanel.style.display = isVisible ? 'none' : 'block';
            button.textContent = isVisible ? '🎨 Generate Composite' : '🎨 Hide Controls';
        });

        // Add elements to container
        buttonContainer.appendChild(button);
        buttonContainer.appendChild(controlsPanel);

        // Insert after the image
        img.parentNode?.insertBefore(buttonContainer, img.nextSibling);
    }

    createControlsPanel(panel: HTMLElement, sourceImage: HTMLImageElement) {
        const isVehicleImage = sourceImage.src.includes('web-compressed');
        const isProductImage = sourceImage.src.includes('wheels-compressed');

        panel.innerHTML = `
            <div style="margin-bottom: 12px;">
                <h4 style="margin: 0 0 8px 0; color: #333;">
                    ${isVehicleImage ? 'Vehicle Image' : 'Product Image'} Compositing
                </h4>
                <p style="margin: 0; font-size: 12px; color: #666;">
                    Image: ${sourceImage.src.split('/').pop()}
                </p>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                    ${isVehicleImage ? 'Select Product Image:' : 'Select Vehicle Image:'}
                </label>
                <select class="target-image-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="">Choose an image...</option>
                </select>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                    Drop Position:
                </label>
                <div style="display: flex; gap: 8px;">
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #666;">X % (0-100):</label>
                        <input type="number" class="x-position" min="0" max="100" value="50" 
                               style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #666;">Y % (0-100):</label>
                        <input type="number" class="y-position" min="0" max="100" value="75" 
                               style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                    Scene Description:
                </label>
                <textarea class="scene-description" rows="2" 
                          style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;"
                          placeholder="Auto-generated from page data..."></textarea>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                    Product Description:
                </label>
                <textarea class="product-description" rows="2" 
                          style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;"
                          placeholder="Auto-generated from page data..."></textarea>
            </div>

            <div style="margin-bottom: 12px;">
                <button class="generate-composite-btn" 
                        style="width: 100%; background: #28a745; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    🚀 Generate Composite Image
                </button>
            </div>

            <div class="composite-status" style="margin-top: 12px; padding: 8px; border-radius: 4px; display: none;">
            </div>

            <div class="composite-result" style="margin-top: 12px; display: none;">
            </div>
        `;

        // Populate target image options
        this.populateTargetImages(panel, isVehicleImage);

        // Auto-generate descriptions
        this.generateDescriptionsForPanel(panel, sourceImage);

        // Add generate button handler
        const generateBtn = panel.querySelector('.generate-composite-btn') as HTMLButtonElement;
        generateBtn.addEventListener('click', () => {
            this.handleCompositeGeneration(panel, sourceImage);
        });
    }

    populateTargetImages(panel: HTMLElement, sourceIsVehicle: boolean) {
        const select = panel.querySelector('.target-image-select') as HTMLSelectElement;
        
        // Find complementary images
        const targetSelector = sourceIsVehicle ? 'img[src*="wheels-compressed"]' : 'img[src*="web-compressed"]';
        const targetImages = document.querySelectorAll(targetSelector);
        
        targetImages.forEach((img: any) => {
            const option = document.createElement('option');
            option.value = img.src;
            option.textContent = img.src.split('/').pop() || img.src;
            select.appendChild(option);
        });
    }

    async generateDescriptionsForPanel(panel: HTMLElement, sourceImage: HTMLImageElement) {
        try {
            const { CompositingService } = await import('./services/compositingService');
            
            // Generate descriptions
            const descriptions = await CompositingService.generateDescriptions(
                sourceImage.src, 
                sourceImage.src
            );

            // Fill in the textareas
            const sceneTextarea = panel.querySelector('.scene-description') as HTMLTextAreaElement;
            const productTextarea = panel.querySelector('.product-description') as HTMLTextAreaElement;
            
            sceneTextarea.value = descriptions.sceneDescription;
            productTextarea.value = descriptions.productDescription;
            
        } catch (error) {
            console.error('Error generating descriptions:', error);
        }
    }

    async handleCompositeGeneration(panel: HTMLElement, sourceImage: HTMLImageElement) {
        const generateBtn = panel.querySelector('.generate-composite-btn') as HTMLButtonElement;
        const statusDiv = panel.querySelector('.composite-status') as HTMLElement;
        const resultDiv = panel.querySelector('.composite-result') as HTMLElement;
        
        // Prevent multiple concurrent requests
        if (generateBtn.dataset.requesting === 'true') {
            console.log('Request already in progress, ignoring duplicate click');
            return;
        }
        
        try {
            // Mark request as in progress
            generateBtn.dataset.requesting = 'true';
            // Get form values
            const targetSelect = panel.querySelector('.target-image-select') as HTMLSelectElement;
            const xInput = panel.querySelector('.x-position') as HTMLInputElement;
            const yInput = panel.querySelector('.y-position') as HTMLInputElement;
            const sceneTextarea = panel.querySelector('.scene-description') as HTMLTextAreaElement;
            const productTextarea = panel.querySelector('.product-description') as HTMLTextAreaElement;

            const targetImageUrl = targetSelect.value;
            if (!targetImageUrl) {
                throw new Error('Please select a target image');
            }

            const xPercent = parseFloat(xInput.value);
            const yPercent = parseFloat(yInput.value);
            const sceneDescription = sceneTextarea.value.trim();
            const productDescription = productTextarea.value.trim();

            if (!sceneDescription || !productDescription) {
                throw new Error('Please provide both scene and product descriptions');
            }

            // Show loading state
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Generating...';
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#d1ecf1';
            statusDiv.style.color = '#0c5460';
            statusDiv.innerHTML = '🔄 Generating composite image...';
            resultDiv.style.display = 'none';

            // Determine which is scene and which is product
            const isSourceVehicle = sourceImage.src.includes('web-compressed');
            const sceneUrl = isSourceVehicle ? sourceImage.src : targetImageUrl;
            const productUrl = isSourceVehicle ? targetImageUrl : sourceImage.src;

            // Import and use compositing service
            const { CompositingService } = await import('./services/compositingService');
            
            const request = {
                sceneUrl,
                productUrl,
                placementGeometry: [[{
                    xPercent,
                    yPercent
                }]],
                sceneDescription,
                productDescription
            };

            console.log('Sending composite request:', request);
            console.log('About to call CompositingService.generateComposite...');
            
            const response = await CompositingService.generateComposite(request);
            
            console.log('Composite generation completed successfully!');
            console.log('Response:', response);

            // Show success
            statusDiv.style.background = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.innerHTML = '✅ Composite generated successfully!';

            // Show result
            resultDiv.style.display = 'block';
            const { ConfigService } = await import('./services/configService');
            const baseUrl = await ConfigService.getApiBaseUrl();
            const fullImageUrl = response.finalImageUrl.startsWith('http') ? response.finalImageUrl : `${baseUrl}${response.finalImageUrl}`;
            const fullDebugUrl = response.debugImageUrl && !response.debugImageUrl.startsWith('data:') && !response.debugImageUrl.startsWith('http') 
                ? `${baseUrl}${response.debugImageUrl}` 
                : response.debugImageUrl;
            
            // Check if we have a meshy model ID to show the Update 3D Model button
            const { VehicleStorage } = await import('./utils/vehicleStorage');
            const vehicleData = await VehicleStorage.getVehicleData();
            const hasMeshyModel = vehicleData?.meshyModelId;
            
            // Debug logging
            console.log('Vehicle data for Update 3D Model button:', vehicleData);
            console.log('Has meshy model ID:', hasMeshyModel);
            console.log('Meshy model ID value:', vehicleData?.meshyModelId);
            
            const update3dButton = hasMeshyModel ? `
                <a href="#" class="update-3d-model-btn" 
                   style="display: inline-block; background: #9c27b0; color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; margin-left: 8px;">
                    🎨 Update 3D Model
                </a>
            ` : `
                <a href="#" class="update-3d-model-btn-disabled" 
                   style="display: inline-block; background: #ccc; color: #666; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; margin-left: 8px; cursor: not-allowed;">
                    🎨 Update 3D Model (No 3D Model)
                </a>
            `;

            resultDiv.innerHTML = `
                <h5 style="margin: 0 0 8px 0; color: #333;">Generated Composite:</h5>
                <img src="${fullImageUrl}" alt="Generated Composite" 
                     style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;">
                <div style="margin-bottom: 8px;">
                    <a href="${fullImageUrl}" download="composite-image.jpg" 
                       style="display: inline-block; background: #007bff; color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 12px;">
                        💾 Download Image
                    </a>
                    ${update3dButton}
                </div>
                <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; font-size: 12px; color: #666;">Debug Info</summary>
                    <div style="margin-top: 4px; font-size: 11px; color: #999;">
                        <p><strong>Final Prompt:</strong> ${response.finalPrompt}</p>
                        ${fullDebugUrl ? `<img src="${fullDebugUrl}" alt="Debug" style="max-width: 200px; height: auto; border: 1px solid #ddd;">` : ''}
                        <p><strong>Vehicle Data Status:</strong> ${vehicleData ? 'Found' : 'Not found'}</p>
                        <p><strong>Meshy Model ID:</strong> ${vehicleData?.meshyModelId || 'None'}</p>
                        <p><strong>Vehicle Images:</strong> ${vehicleData?.images?.length || 0} images</p>
                    </div>
                </details>
            `;



        } catch (error) {
            console.error('Composite generation error:', error);
            
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#f8d7da';
            statusDiv.style.color = '#721c24';
            statusDiv.innerHTML = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
            
        } finally {
            // Clear request flag and restore button
            generateBtn.dataset.requesting = 'false';
            generateBtn.disabled = false;
            generateBtn.textContent = '🚀 Generate Composite Image';
        }
    }

    createSetVehicleInterface(container: HTMLElement) {
        const galleryImages = this.getGalleryImages();
        const vehicleInfo = this.extractVehicleGalleryInfo();

        container.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: bold; color: #1976d2; margin-bottom: 8px;">🚗 Set as Vehicle Scene</div>
                <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
                    ${vehicleInfo ? vehicleInfo : 'Save this vehicle for compositing'}
                </div>
                
                <div class="vehicle-preview" style="margin-bottom: 12px; text-align: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px;">
                    <img class="preview-image" src="${galleryImages[0]?.fullUrl || ''}" style="max-width: 100%; max-height: 120px; border-radius: 4px;" />
                    ${galleryImages.length > 1 ? `
                        <div style="font-size: 11px; color: #666; margin-top: 4px;">
                            Main image • ${galleryImages.length} total images will be saved
                        </div>
                    ` : ''}
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="set-vehicle-button" style="
                        background: #2196f3;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: bold;
                        flex: 1;
                    ">Set Vehicle</button>
                    <button class="view-3d-button" style="
                        background: #9c27b0;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: bold;
                        flex: 1;
                    ">Create 3D Model</button>
                    ${galleryImages.length > 1 ? `
                        <span style="font-size: 11px; color: #666;">${galleryImages.length} images</span>
                    ` : ''}
                </div>
            </div>
            <div class="set-vehicle-result" style="display: none; color: #2e7d32; font-weight: bold; font-size: 12px;"></div>
        `;

        // Add event handlers
        const setButton = container.querySelector('.set-vehicle-button') as HTMLButtonElement;
        const resultDiv = container.querySelector('.set-vehicle-result') as HTMLDivElement;

        // Handle Set Vehicle button click
        setButton.addEventListener('click', async () => {
            try {
                setButton.disabled = true;
                setButton.textContent = 'Setting...';

                // Set the main image as the selected one (first image or current image as fallback)
                const selectedImageUrl = galleryImages[0]?.fullUrl || await this.getCurrentVehicleImageUrl();
                await this.setVehicleForCompositing(galleryImages, vehicleInfo, selectedImageUrl);

                resultDiv.style.display = 'block';
                resultDiv.textContent = `✅ Vehicle set with ${galleryImages.length} image${galleryImages.length > 1 ? 's' : ''}!`;
                setButton.textContent = '✓ Vehicle Set';
                setButton.style.background = '#4caf50';

                setTimeout(() => {
                    resultDiv.style.display = 'none';
                }, 3000);

            } catch (error) {
                console.error('Error setting vehicle:', error);
                resultDiv.style.display = 'block';
                resultDiv.style.color = '#d32f2f';
                resultDiv.textContent = '❌ Failed to set vehicle';
                setButton.textContent = 'Set Vehicle';
                setButton.disabled = false;
            }
        });

        // Handle View in 3D button click
        const view3dBtn = container.querySelector('.view-3d-button') as HTMLButtonElement;
        if (view3dBtn) {
            view3dBtn.addEventListener('click', async () => {
                // Check if we have a meshy model ID
                const { VehicleStorage } = await import('./utils/vehicleStorage');
                const vehicleData = await VehicleStorage.getVehicleData();
                
                if (vehicleData?.meshyModelId) {
                    // If we have a model ID, show the 3D viewer
                    this.view3DModel(vehicleData.meshyModelId);
                } else {
                    // If no model ID, show the creation modal
                    this.show3DModal(galleryImages, vehicleInfo);
                }
            });

            // Update button text based on whether we have a model ID
            this.update3DButtonText(view3dBtn);
        }
    }

    async getCurrentVehicleImageUrl(): Promise<string> {
        try {
            // First try to get from VehicleStorage
            const { VehicleStorage } = await import('./utils/vehicleStorage');
            const vehicleData = await VehicleStorage.getVehicleData();
            
            if (vehicleData && vehicleData.images && vehicleData.images.length > 0) {
                // Return the first (main) image
                return vehicleData.images[0];
            }
        } catch (error) {
            console.error('Error getting vehicle image from storage:', error);
        }

        // Fallback to page detection
        const mainImage = document.querySelector('img[src*="web-compressed"]') as HTMLImageElement;
        if (mainImage) {
            return mainImage.src;
        }

        // Fallback to any large image on the page
        const largeImage = document.querySelector('img[alt*="Toyota"], img[alt*="Ford"], img[alt*="Chevy"], img[alt*="Tacoma"]') as HTMLImageElement;
        if (largeImage) {
            return largeImage.src;
        }

        return '';
    }

    getGalleryImages(): Array<{thumbUrl: string, fullUrl: string, isMain: boolean}> {
        const galleryImages: Array<{thumbUrl: string, fullUrl: string, isMain: boolean}> = [];
        
        try {
            // Get the main image first
            const mainImage = document.querySelector('img[src*="web-compressed"]') as HTMLImageElement;
            if (mainImage) {
                galleryImages.push({
                    thumbUrl: mainImage.src,
                    fullUrl: mainImage.src,
                    isMain: true
                });
            }

            // Find all gallery images (both main and thumbnails)
            const allImages = Array.from(document.querySelectorAll('img'));
            const vehicleImages = allImages.filter(img => {
                return img.src && (
                    img.src.includes('web-compressed') || 
                    img.src.includes('thumb')
                ) && (
                    img.src.includes('2019-tacoma') ||
                    img.src.includes(window.location.pathname.split('/')[2]) // Gallery ID
                );
            });

            // Extract gallery ID pattern from current page URL
            const urlMatch = window.location.pathname.match(/\/wheel-offset-gallery\/(\d+)\//);
            const galleryId = urlMatch ? urlMatch[1] : null;

            if (galleryId) {
                vehicleImages.forEach(img => {
                    if (img.src.includes(galleryId)) {
                        // Convert thumbnail URL to full-size URL
                        const fullUrl = img.src.includes('/thumb/') 
                            ? img.src.replace('/thumb/', '/web-compressed/')
                            : img.src;
                        
                        const thumbUrl = img.src;
                        const isMain = img.src.includes('web-compressed') && img.src.includes(`${galleryId}-1-`);
                        
                        // Check if we already have this image (avoid duplicates)
                        const exists = galleryImages.some(existing => existing.fullUrl === fullUrl);
                        if (!exists) {
                            galleryImages.push({
                                thumbUrl,
                                fullUrl,
                                isMain
                            });
                        }
                    }
                });
            }

            // Sort images: main image first, then by filename
            galleryImages.sort((a, b) => {
                if (a.isMain && !b.isMain) return -1;
                if (!a.isMain && b.isMain) return 1;
                return a.fullUrl.localeCompare(b.fullUrl);
            });

            console.log('Found gallery images:', galleryImages);
            
        } catch (error) {
            console.error('Error getting gallery images:', error);
        }

        // If no gallery images found, fallback to current image
        if (galleryImages.length === 0) {
            // Note: This is a synchronous method, so we can't use the async version here
            // Fallback to page detection instead
            const mainImage = document.querySelector('img[src*="web-compressed"]') as HTMLImageElement;
            if (mainImage) {
                galleryImages.push({
                    thumbUrl: mainImage.src,
                    fullUrl: mainImage.src,
                    isMain: true
                });
            }
        }

        return galleryImages;
    }

    extractVehicleGalleryInfo(): string {
        // Try to extract vehicle info from the page title or heading
        const heading = document.querySelector('h1') as HTMLElement;
        if (heading) {
            return heading.textContent?.trim() || '';
        }

        // Fallback to page title
        return document.title.split('|')[0]?.trim() || '';
    }

    show3DModal(galleryImages: Array<{thumbUrl: string, fullUrl: string, isMain: boolean}>, vehicleInfo: string) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'meshy-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'meshy-modal-content';
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        `;

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 12px;
            right: 16px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        `;
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Create modal header
        const header = document.createElement('div');
        header.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #333;">Generate 3D Model</h3>
            <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
                Select images to use for 3D model generation. All images are selected by default.
            </p>
        `;

        // Create image selection grid
        const imageGrid = document.createElement('div');
        imageGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        `;

        // Add image selection checkboxes
        galleryImages.forEach((image, index) => {
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
                text-align: center;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                padding: 8px;
                background: white;
            `;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true; // Default to selected
            checkbox.style.cssText = `
                margin-bottom: 8px;
                transform: scale(1.2);
            `;

            const img = document.createElement('img');
            img.src = image.fullUrl;
            img.alt = `Image ${index + 1}`;
            img.style.cssText = `
                width: 100%;
                height: 80px;
                object-fit: cover;
                border-radius: 4px;
                margin-bottom: 4px;
            `;

            const label = document.createElement('div');
            label.textContent = `Image ${index + 1}`;
            label.style.cssText = `
                font-size: 11px;
                color: #666;
                margin-top: 4px;
            `;

            imageContainer.appendChild(checkbox);
            imageContainer.appendChild(img);
            imageContainer.appendChild(label);
            imageGrid.appendChild(imageContainer);
        });

        // Create generate button
        const generateBtn = document.createElement('button');
        generateBtn.textContent = '🚀 Generate 3D Model';
        generateBtn.style.cssText = `
            background: #9c27b0;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            width: 100%;
        `;

        // Add loading state
        let isGenerating = false;
        generateBtn.addEventListener('click', async () => {
            if (isGenerating) return;
            
            isGenerating = true;
            generateBtn.textContent = '⏳ Generating...';
            generateBtn.disabled = true;
            generateBtn.style.background = '#666';

            try {
                // Get selected image URLs
                const selectedImages = Array.from(imageGrid.querySelectorAll('input[type="checkbox"]:checked'))
                    .map((checkbox, index) => galleryImages[index].fullUrl);

                if (selectedImages.length === 0) {
                    throw new Error('Please select at least one image');
                }

                // Generate texture prompt from vehicle info
                const texturePrompt = this.generateTexturePrompt(vehicleInfo);

                // Call Meshy API
                const { MeshyService } = await import('./services/meshyService');
                const response = await MeshyService.generate3DModel({
                    imageUrls: selectedImages,
                    texturePrompt
                });

                // Store the model ID
                const { VehicleStorage } = await import('./utils/vehicleStorage');
                await VehicleStorage.updateMeshyModelId(response.id);

                // Show success
                generateBtn.textContent = '✅ 3D Model Generated!';
                generateBtn.style.background = '#4caf50';
                
                // Update the button text on the main interface
                const mainButton = document.querySelector('.view-3d-button') as HTMLButtonElement;
                if (mainButton) {
                    this.update3DButtonText(mainButton);
                }
                
                // Close modal after delay
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 2000);

            } catch (error) {
                console.error('3D model generation error:', error);
                generateBtn.textContent = '❌ Error - Try Again';
                generateBtn.style.background = '#f44336';
                
                // Reset button after delay
                setTimeout(() => {
                    isGenerating = false;
                    generateBtn.textContent = '🚀 Generate 3D Model';
                    generateBtn.disabled = false;
                    generateBtn.style.background = '#9c27b0';
                }, 3000);
            }
        });

        // Assemble modal
        modalContent.appendChild(closeBtn);
        modalContent.appendChild(header);
        modalContent.appendChild(imageGrid);
        modalContent.appendChild(generateBtn);
        modal.appendChild(modalContent);

        // Add to page
        document.body.appendChild(modal);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    generateTexturePrompt(vehicleInfo: string): string {
        // Extract key details for texture prompt
        const prompt = vehicleInfo || 'vehicle';
        
        // Add common texture details
        return `A detailed 3D model of a ${prompt} with realistic textures, proper lighting, and high-quality materials. The model should capture the vehicle's appearance, including any custom modifications, wheels, and paint finish.`;
    }

    async update3DButtonText(button: HTMLButtonElement): Promise<void> {
        try {
            const { VehicleStorage } = await import('./utils/vehicleStorage');
            const vehicleData = await VehicleStorage.getVehicleData();
            
            if (vehicleData?.meshyModelId) {
                button.textContent = '👁️ View in 3D';
                button.style.background = '#4caf50';
            } else {
                button.textContent = '🚀 Create 3D Model';
                button.style.background = '#9c27b0';
            }
        } catch (error) {
            console.error('Error updating 3D button text:', error);
            button.textContent = '🚀 Create 3D Model';
            button.style.background = '#9c27b0';
        }
    }

    async handleUpdate3DModel(button: HTMLButtonElement, imageUrl: string, meshyModelId: string): Promise<void> {
        try {
            // Disable button and show processing state
            button.style.pointerEvents = 'none';
            button.style.opacity = '0.6';
            button.textContent = '⏳ Processing...';
            button.style.background = '#ff9800';

            // Convert image to base64
            const base64Data = await this.convertImageToBase64(imageUrl);
            
            // Call the retexture API
            const { MeshyService } = await import('./services/meshyService');
            await MeshyService.retextureModel(meshyModelId, base64Data);

            // Show success message
            button.textContent = '✅ 3D Model Updated!';
            button.style.background = '#4caf50';
            button.style.color = 'white';
            
            // Show additional info about retexturing time
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = `
                margin-top: 8px;
                padding: 8px;
                background: #d4edda;
                border: 1px solid #c3e6cb;
                border-radius: 4px;
                color: #155724;
                font-size: 11px;
                text-align: center;
            `;
            infoDiv.innerHTML = '🎨 3D model retexturing has started. This will take a while to process.';
            
            // Insert after the button
            button.parentNode?.insertBefore(infoDiv, button.nextSibling);

            // Re-enable button after delay
            setTimeout(() => {
                button.style.pointerEvents = 'auto';
                button.style.opacity = '1';
                button.textContent = '🎨 Update 3D Model';
                button.style.background = '#9c27b0';
                button.style.color = 'white';
                
                // Remove info message
                if (infoDiv.parentNode) {
                    infoDiv.parentNode.removeChild(infoDiv);
                }
            }, 5000);

        } catch (error) {
            console.error('Error updating 3D model:', error);
            
            // Show error and re-enable button
            button.style.pointerEvents = 'auto';
            button.style.opacity = '1';
            button.textContent = '❌ Update Failed';
            button.style.background = '#f44336';
            button.style.color = 'white';
            
            // Show error message
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                margin-top: 8px;
                padding: 8px;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                color: #721c24;
                font-size: 11px;
                text-align: center;
            `;
            errorDiv.innerHTML = `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
            
            // Insert after the button
            button.parentNode?.insertBefore(errorDiv, button.nextSibling);
            
            // Re-enable button after delay
            setTimeout(() => {
                button.textContent = '🎨 Update 3D Model';
                button.style.background = '#9c27b0';
                button.style.color = 'white';
                
                // Remove error message
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    }

    async convertImageToBase64(imageUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert to base64 with JPEG format and 0.8 quality
                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(base64);
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image for base64 conversion'));
            };
            
            img.src = imageUrl;
        });
    }

    async getUpdate3DModelButton(imageUrl: string): Promise<string> {
        try {
            // Check if we have a meshy model ID to show the Update 3D Model button
            const { VehicleStorage } = await import('./utils/vehicleStorage');
            const vehicleData = await VehicleStorage.getVehicleData();
            const hasMeshyModel = vehicleData?.meshyModelId;
            
            // Debug logging
            console.log('Vehicle data for Update 3D Model button:', vehicleData);
            console.log('Has meshy model ID:', hasMeshyModel);
            console.log('Meshy model ID value:', vehicleData?.meshyModelId);
            
            if (hasMeshyModel) {
                return `
                    <button class="update-3d-model-btn" 
                           style="background: #9c27b0; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        🎨 Update 3D Model
                    </button>
                `;
            } else {
                return `
                    <button class="update-3d-model-btn-disabled" 
                           style="background: #ccc; color: #666; border: none; padding: 8px 16px; border-radius: 4px; font-size: 14px; cursor: not-allowed;" disabled>
                        🎨 Update 3D Model (No 3D Model)
                    </button>
                `;
            }
        } catch (error) {
            console.error('Error getting Update 3D Model button:', error);
            
            // Check if it's an extension context error
            if (error instanceof Error && error.message.includes('Extension context invalidated')) {
                return `
                    <button class="update-3d-model-btn-error" 
                           style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 14px; cursor: not-allowed;" disabled>
                        ⚠️ Extension Error - Please Reload Page
                    </button>
                `;
            }
            
            return '';
        }
    }



    async view3DModel(taskId: string) {
        try {
            // Create modal for 3D viewer
            const modal = document.createElement('div');
            modal.className = 'meshy-3d-viewer-modal-overlay';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10001;
            `;

            // Create modal content
            const modalContent = document.createElement('div');
            modalContent.className = 'meshy-3d-viewer-modal-content';
            modalContent.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 24px;
                max-width: 90vw;
                max-height: 90vh;
                position: relative;
            `;

            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 12px;
                right: 16px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                z-index: 10;
            `;
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            // Create header
            const header = document.createElement('div');
            header.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: #333;">3D Model Viewer</h3>
            `;

            // Create viewer container
            const viewerContainer = document.createElement('div');
            viewerContainer.style.cssText = `
                width: 800px;
                height: 600px;
                position: relative;
            `;

            // Assemble modal
            modalContent.appendChild(closeBtn);
            modalContent.appendChild(header);
            modalContent.appendChild(viewerContainer);
            modal.appendChild(modalContent);

            // Add to page
            document.body.appendChild(modal);

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });

            // Create 3D viewer
            const { MeshyViewerService } = await import('./services/meshyViewerService');
            const { Meshy3DViewer } = await import('./components/meshy3DViewer');
            
            const modelUrl = await MeshyViewerService.getGlbDownloadUrl(taskId);
            const viewer = new Meshy3DViewer(viewerContainer, modelUrl);
            await viewer.createViewer();

        } catch (error) {
            console.error('Error viewing 3D model:', error);
        }
    }

    async setVehicleForCompositing(galleryImages: Array<{thumbUrl: string, fullUrl: string, isMain: boolean}>, vehicleInfo: string, selectedImageUrl?: string) {
        try {
            // Clear any existing meshyModelId since we're setting a new vehicle
            const { VehicleStorage } = await import('./utils/vehicleStorage');
            
            // Store ALL gallery images for this vehicle using VehicleStorage
            const vehicleData = {
                images: galleryImages.map(img => img.fullUrl),
                info: {
                    title: vehicleInfo,
                    url: window.location.href,
                    yearMakeModel: vehicleInfo,
                    wheels: {},
                    tires: {},
                    suspension: {}
                },
                extractedAt: Date.now()
            };

            // Clear any existing meshyModelId by not including it in the new data
            await VehicleStorage.setVehicleData(vehicleData.images, vehicleData.info);
            
            console.log('Stored new vehicle data (cleared meshyModelId):', vehicleData);
            
            // Also clear the legacy currentVehicle storage
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.remove('currentVehicle');
            } else {
                localStorage.removeItem('currentVehicle');
            }
            
        } catch (error) {
            console.error('Error setting vehicle for compositing:', error);
        }
    }

    updateImagePreviews(container: HTMLElement) {
        const vehicleSelect = container.querySelector('.vehicle-image-select') as HTMLSelectElement;
        const productSelect = container.querySelector('.product-image-select') as HTMLSelectElement;
        
        if (!vehicleSelect || !productSelect) return;
        
        const vehicleUrl = vehicleSelect.value;
        const productUrl = productSelect.value;
        
        // Update full-width vehicle preview
        const vehiclePreviewContainer = container.querySelector('.vehicle-image-preview') as HTMLElement;
        const vehiclePreviewImg = container.querySelector('.vehicle-preview-img') as HTMLImageElement;
        const vehiclePreviewUrl = container.querySelector('.vehicle-preview-url') as HTMLElement;
        
        if (vehiclePreviewContainer && vehiclePreviewImg && vehiclePreviewUrl) {
            if (vehicleUrl) {
                vehiclePreviewContainer.style.display = 'block';
                vehiclePreviewImg.src = vehicleUrl;
                vehiclePreviewUrl.textContent = vehicleUrl.split('/').pop() || '';
            } else {
                vehiclePreviewContainer.style.display = 'none';
            }
        }
        
        // Update debug product preview
        const debugProductPreview = container.querySelector('.debug-product-preview') as HTMLElement;
        const productPreviewImg = container.querySelector('.product-preview-img') as HTMLImageElement;
        const productPreviewUrl = container.querySelector('.product-preview-url') as HTMLElement;
        
        if (debugProductPreview && productPreviewImg && productPreviewUrl) {
            if (productUrl) {
                debugProductPreview.style.display = 'block';
                productPreviewImg.src = productUrl;
                productPreviewUrl.textContent = productUrl.split('/').pop() || '';
            } else {
                debugProductPreview.style.display = 'none';
            }
        }
    }

    toggleAdvancedPanel(container: HTMLElement) {
        const advancedPanel = container.querySelector('.advanced-panel') as HTMLDivElement;
        const toggleBtn = container.querySelector('.advanced-toggle-btn') as HTMLButtonElement;
        
        if (advancedPanel.style.display === 'none') {
            advancedPanel.style.display = 'block';
            toggleBtn.textContent = '⚙️ Hide Advanced';
            toggleBtn.style.background = '#6c757d';
        } else {
            advancedPanel.style.display = 'none';
            toggleBtn.textContent = '⚙️ Advanced';
            toggleBtn.style.background = '#17a2b8';
        }
    }

    toggleDebugPanel(container: HTMLElement) {
        const debugPanel = container.querySelector('.debug-panel') as HTMLDivElement;
        const toggleBtn = container.querySelector('.debug-toggle-btn') as HTMLButtonElement;
        
        if (debugPanel.style.display === 'none') {
            debugPanel.style.display = 'block';
            toggleBtn.textContent = '🐛 Hide Debug';
            toggleBtn.style.background = '#e0a800';
            toggleBtn.style.color = '#ffffff';
        } else {
            debugPanel.style.display = 'none';
            toggleBtn.textContent = '🐛 Debug';
            toggleBtn.style.background = '#ffc107';
            toggleBtn.style.color = '#212529';
        }
    }

    setupVehicleImagePositioning(container: HTMLElement) {
        const vehicleSelect = container.querySelector('.vehicle-image-select') as HTMLSelectElement;
        const vehiclePreviewImg = container.querySelector('.vehicle-preview-img') as HTMLImageElement;
        const vehicleCanvas = container.querySelector('.vehicle-positioning-canvas') as HTMLCanvasElement;
        const vehicleContainer = container.querySelector('.vehicle-image-container') as HTMLDivElement;

        const vehicleImageUrl = vehicleSelect.value;

        if (!vehicleImageUrl || !vehiclePreviewImg || !vehicleCanvas) {
            return;
        }

        // Wait for the vehicle image to load
        vehiclePreviewImg.onload = () => {
            // Set canvas to exactly match the displayed image
            const imgRect = vehiclePreviewImg.getBoundingClientRect();
            const containerRect = vehicleContainer.getBoundingClientRect();
            
            vehicleCanvas.width = vehiclePreviewImg.offsetWidth;
            vehicleCanvas.height = vehiclePreviewImg.offsetHeight;
            vehicleCanvas.style.width = `${vehiclePreviewImg.offsetWidth}px`;
            vehicleCanvas.style.height = `${vehiclePreviewImg.offsetHeight}px`;
            
            // Position canvas exactly over the image
            vehicleCanvas.style.position = 'absolute';
            vehicleCanvas.style.top = '0';
            vehicleCanvas.style.left = '0';
            vehicleCanvas.style.zIndex = '10';
            vehicleCanvas.style.display = 'block';

            // Store image dimensions for coordinate calculation
            vehicleCanvas.dataset.imageWidth = vehiclePreviewImg.naturalWidth.toString();
            vehicleCanvas.dataset.imageHeight = vehiclePreviewImg.naturalHeight.toString();

            // Initialize points if not already set
            if (!vehicleCanvas.dataset.points) {
                vehicleCanvas.dataset.points = JSON.stringify([]);
            }

            // Add click handler
            this.setupVehicleCanvasClickHandler(container, vehicleCanvas);
            
            // Update display to show any existing points
            this.updateVehiclePositionDisplay(container, vehicleCanvas);
        };

        // Trigger load if image is already cached
        if (vehiclePreviewImg.complete) {
            vehiclePreviewImg.onload(null as any);
        }
    }

    setupVehicleCanvasClickHandler(container: HTMLElement, canvas: HTMLCanvasElement) {
        // Remove existing event listeners by cloning
        const newCanvas = canvas.cloneNode(true) as HTMLCanvasElement;
        canvas.parentNode?.replaceChild(newCanvas, canvas);
        
        // Initialize position data
        if (!newCanvas.dataset.points) {
            newCanvas.dataset.points = JSON.stringify([]);
        }

        // Copy over dataset properties
        newCanvas.dataset.imageWidth = canvas.dataset.imageWidth;
        newCanvas.dataset.imageHeight = canvas.dataset.imageHeight;
        newCanvas.dataset.points = canvas.dataset.points;

        newCanvas.addEventListener('click', (event) => {
            this.handleVehicleCanvasClick(container, newCanvas, event);
        });
    }

    handleVehicleCanvasClick(container: HTMLElement, canvas: HTMLCanvasElement, event: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Get current points
        const points = JSON.parse(canvas.dataset.points || '[]');
        const mode = (container.querySelector('.position-mode-radio:checked') as HTMLInputElement)?.value || 'point';

        if (mode === 'point') {
            // Point mode: add point (support up to 2 points)
            if (points.length >= 2) {
                // Replace the last point
                points[points.length - 1] = { x, y };
            } else {
                // Add new point
                points.push({ x, y });
            }
            canvas.dataset.points = JSON.stringify(points);
        } else {
            // Polygon mode: add point or close polygon
            if (points.length > 2) {
                // Check if clicking near first point to close polygon
                const firstPoint = points[0];
                const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
                if (distance < 10) {
                    // Close polygon - don't add the same point again
                    this.updateVehiclePositionDisplay(container, canvas);
                    return;
                }
            }
            
            // Add new point
            points.push({ x, y });
            canvas.dataset.points = JSON.stringify(points);
        }

        this.updateVehiclePositionDisplay(container, canvas);
    }

    updateVehiclePositionDisplay(container: HTMLElement, canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const points = JSON.parse(canvas.dataset.points || '[]');
        const mode = (container.querySelector('.position-mode-radio:checked') as HTMLInputElement)?.value || 'point';
        const coordinates = container.querySelector('.position-coordinates') as HTMLDivElement;
        const controls = container.querySelector('.position-controls') as HTMLDivElement;
        const polygonInstructions = container.querySelector('.polygon-instructions') as HTMLElement;

        // Clear canvas and draw points/lines only (no background image needed since it's overlaid)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw completed polygons first (in blue)
        const completedPolygons = JSON.parse(canvas.dataset.completedPolygons || '[]');
        if (completedPolygons.length > 0) {
            ctx.strokeStyle = '#0066cc';
            ctx.fillStyle = '#0066cc';
            ctx.lineWidth = 2;
            
            completedPolygons.forEach((polygon: any[]) => {
                if (polygon.length >= 3) {
                    // Draw polygon lines
                    ctx.beginPath();
                    ctx.moveTo(polygon[0].x, polygon[0].y);
                    for (let i = 1; i < polygon.length; i++) {
                        ctx.lineTo(polygon[i].x, polygon[i].y);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    
                    // Draw polygon points
                    polygon.forEach((point: any) => {
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    });
                }
            });
        }

        // Draw current points and lines
        if (points.length > 0) {
            ctx.strokeStyle = '#ff0000';
            ctx.fillStyle = '#ff0000';
            ctx.lineWidth = 3;

            points.forEach((point: any, index: number) => {
                // Draw point with white outline for better visibility
                ctx.beginPath();
                ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = '#ff0000';
                ctx.fill();

                // Draw lines for polygon mode
                if (mode === 'polygon' && index > 0) {
                    ctx.beginPath();
                    ctx.moveTo(points[index - 1].x, points[index - 1].y);
                    ctx.lineTo(point.x, point.y);
                    ctx.stroke();
                }
                

            });

            // Draw closing line for completed polygon
            if (mode === 'polygon' && points.length > 2) {
                ctx.beginPath();
                ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
                ctx.lineTo(points[0].x, points[0].y);
                ctx.stroke();
            }
        }

        // Update coordinate display
        if (points.length > 0) {
            const percentagePoints = points.map((point: any) => ({
                xPercent: Math.round((point.x / canvas.width) * 100),
                yPercent: Math.round((point.y / canvas.height) * 100)
            }));

            if (mode === 'point') {
                if (points.length === 1) {
                    coordinates.textContent = `Point 1: ${percentagePoints[0].xPercent}%, ${percentagePoints[0].yPercent}%`;
                } else {
                    coordinates.textContent = `Point 1: ${percentagePoints[0].xPercent}%, ${percentagePoints[0].yPercent}% • Point 2: ${percentagePoints[1].xPercent}%, ${percentagePoints[1].yPercent}%`;
                }
            } else {
                coordinates.textContent = `Polygon: ${points.length} points`;
            }
            
            controls.style.display = 'block';
            
            // Show/hide Next Polygon button for polygon mode
            const nextPolygonBtn = container.querySelector('.next-polygon-btn') as HTMLButtonElement;
            if (nextPolygonBtn) {
                if (mode === 'polygon' && points.length >= 3) {
                    nextPolygonBtn.style.display = 'inline-block';
                } else {
                    nextPolygonBtn.style.display = 'none';
                }
            }
            
            if (mode === 'polygon' && points.length >= 2 && points.length < 10) {
                polygonInstructions.style.display = 'inline';
            } else {
                polygonInstructions.style.display = 'none';
            }
        } else {
            coordinates.textContent = '';
            controls.style.display = 'none';
            
            // Hide Next Polygon button when no points
            const nextPolygonBtn = container.querySelector('.next-polygon-btn') as HTMLButtonElement;
            if (nextPolygonBtn) {
                nextPolygonBtn.style.display = 'none';
            }
        }
    }

    updatePositionMode(container: HTMLElement) {
        const canvas = container.querySelector('.vehicle-positioning-canvas') as HTMLCanvasElement;
        if (canvas) {
            this.clearPositionPoints(container);
            this.updatePositionDebugInfo(container);
        }
    }


}

new Main();