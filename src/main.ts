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

        // Setup compositing UI in specific location
        this.injectCompositingUI();
        
        // Re-inject UI when page content changes (for dynamic loading)
        const observer = new MutationObserver(() => {
            this.injectCompositingUI();
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

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                        Vehicle Image:
                    </label>
                    <select class="vehicle-image-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="">Choose vehicle image...</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                        Product Image:
                    </label>
                    <select class="product-image-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="">Choose product image...</option>
                    </select>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                        Product Position:
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
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #555;">
                        Actions:
                    </label>
                    <div style="display: flex; gap: 8px; align-items: end; height: 100%;">
                        <button class="generate-composite-btn" 
                                style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            🚀 Generate Composite
                        </button>
                        <button class="auto-fill-btn" 
                                style="background: #6c757d; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            📝 Auto-fill
                        </button>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
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

            <!-- Debug Image Previews -->
            <div class="image-previews" style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; display: none;">
                <h5 style="margin: 0 0 12px 0; color: #333; font-size: 14px;">🔍 Image Preview (Debug)</h5>
                <div style="display: flex; gap: 16px; align-items: flex-start;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-weight: bold; margin-bottom: 8px; color: #007bff; font-size: 12px;">Vehicle Scene</div>
                        <img class="vehicle-preview" style="max-width: 200px; max-height: 150px; width: auto; height: auto; border: 2px solid #007bff; border-radius: 4px; object-fit: contain;" />
                        <div class="vehicle-url" style="font-size: 10px; color: #666; margin-top: 4px; word-break: break-all;"></div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-weight: bold; margin-bottom: 8px; color: #28a745; font-size: 12px;">Product</div>
                        <img class="product-preview" style="max-width: 200px; max-height: 150px; width: auto; height: auto; border: 2px solid #28a745; border-radius: 4px; object-fit: contain;" />
                        <div class="product-url" style="font-size: 10px; color: #666; margin-top: 4px; word-break: break-all;"></div>
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

        // Find product images (wheels-compressed)
        let productImages = document.querySelectorAll('img[src*="wheels-compressed"]');
        
        // If no wheels-compressed images found, try alternatives
        if (productImages.length === 0) {
            productImages = document.querySelectorAll('img[src*="wheel"], img[src*="rim"]');
        }

        console.log(`Found ${productImages.length} product images:`, Array.from(productImages).map((img: any) => img.src));

        productImages.forEach((img: any) => {
            if (img.src && img.src.length > 0) {
                const option = document.createElement('option');
                option.value = img.src;
                option.textContent = img.src.split('/').pop() || img.src;
                productSelect.appendChild(option);
            }
        });

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
        if (vehicleImages.length === 0 && productImages.length === 0) {
            const debugInfo = document.createElement('div');
            debugInfo.style.cssText = 'background: #fff3cd; border: 1px solid #ffeaa7; padding: 8px; border-radius: 4px; margin-top: 8px; font-size: 12px;';
            debugInfo.innerHTML = '⚠️ No images detected on this page. This feature works best on Custom Wheel Offset product gallery pages.';
            container.appendChild(debugInfo);
        }
    }

    async addStoredVehicleToSelect(vehicleSelect: HTMLSelectElement) {
        try {
            let storedVehicle = null;
            
            // Try to get from chrome storage first
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get('currentVehicle');
                storedVehicle = result.currentVehicle;
            } else {
                // Fallback to localStorage
                const stored = localStorage.getItem('currentVehicle');
                if (stored) {
                    storedVehicle = JSON.parse(stored);
                }
            }

            if (storedVehicle && storedVehicle.imageUrl) {
                // Check if vehicle was set recently (within 24 hours)
                const hoursSinceSet = (Date.now() - storedVehicle.setAt) / (1000 * 60 * 60);
                if (hoursSinceSet < 24) {
                    const option = document.createElement('option');
                    option.value = storedVehicle.imageUrl;
                    option.textContent = `📋 Stored: ${storedVehicle.info || 'Vehicle from Gallery'}`;
                    option.style.backgroundColor = '#e3f2fd';
                    option.style.fontWeight = 'bold';
                    
                    // Insert as second option (after "Select Vehicle Image")
                    if (vehicleSelect.options.length > 0) {
                        vehicleSelect.insertBefore(option, vehicleSelect.options[1]);
                    } else {
                        vehicleSelect.appendChild(option);
                    }
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

    setupInterfaceEventHandlers(container: HTMLElement) {
        const generateBtn = container.querySelector('.generate-composite-btn') as HTMLButtonElement;
        const autoFillBtn = container.querySelector('.auto-fill-btn') as HTMLButtonElement;
        const vehicleSelect = container.querySelector('.vehicle-image-select') as HTMLSelectElement;
        const productSelect = container.querySelector('.product-image-select') as HTMLSelectElement;

        // Generate composite handler
        generateBtn.addEventListener('click', () => {
            this.handleInterfaceCompositeGeneration(container);
        });

        // Auto-fill handler
        autoFillBtn.addEventListener('click', () => {
            this.generateDescriptionsForInterface(container);
        });

        // Image preview handlers
        vehicleSelect.addEventListener('change', () => {
            this.updateImagePreviews(container);
        });

        productSelect.addEventListener('change', () => {
            this.updateImagePreviews(container);
        });

        // Update previews after initial population
        setTimeout(() => {
            this.updateImagePreviews(container);
        }, 500);
    }

    async handleInterfaceCompositeGeneration(container: HTMLElement) {
        const generateBtn = container.querySelector('.generate-composite-btn') as HTMLButtonElement;
        const statusDiv = container.querySelector('.composite-status') as HTMLElement;
        const resultDiv = container.querySelector('.composite-result') as HTMLElement;
        
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
            const xInput = container.querySelector('.x-position') as HTMLInputElement;
            const yInput = container.querySelector('.y-position') as HTMLInputElement;
            const vehicleTextarea = container.querySelector('.vehicle-description') as HTMLTextAreaElement;
            const productTextarea = container.querySelector('.product-description') as HTMLTextAreaElement;

            const vehicleImageUrl = vehicleSelect.value;
            const productImageUrl = productSelect.value;
            
            if (!vehicleImageUrl || !productImageUrl) {
                throw new Error('Please select both vehicle and product images');
            }

            const xPercent = parseFloat(xInput.value);
            const yPercent = parseFloat(yInput.value);
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
            
            const request = {
                sceneUrl: vehicleImageUrl,
                productUrl: productImageUrl,
                dropPosition: {
                    xPercent,
                    yPercent
                },
                sceneDescription: vehicleDescription,
                productDescription: productDescription
            };

            console.log('Sending composite request from interface:', request);
            const response = await CompositingService.generateComposite(request);

            // Show success
            statusDiv.style.background = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.innerHTML = '✅ Composite generated successfully!';

            // Show result
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: white;">
                    <h5 style="margin: 0 0 12px 0; color: #333;">🎨 Generated Composite Image:</h5>
                    <div style="text-align: center; margin-bottom: 12px;">
                        <img src="${response.finalImageUrl}" alt="Generated Composite" 
                             style="max-width: 100%; max-height: 400px; height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 12px;">
                        <a href="${response.finalImageUrl}" download="composite-image.jpg" 
                           style="display: inline-block; background: #007bff; color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; font-size: 14px;">
                            💾 Download Image
                        </a>
                        <button onclick="navigator.share({files: [new File([await fetch('${response.finalImageUrl}').then(r => r.blob())], 'composite.jpg')]})" 
                                style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            📤 Share
                        </button>
                    </div>
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; font-size: 12px; color: #666; margin-bottom: 8px;">🔧 Debug Information</summary>
                        <div style="font-size: 11px; color: #666; background: #f8f9fa; padding: 8px; border-radius: 4px;">
                            <p style="margin: 0 0 8px 0;"><strong>AI Prompt:</strong> ${response.finalPrompt}</p>
                            ${response.debugImageUrl ? `
                                <p style="margin: 0 0 4px 0;"><strong>Debug Image:</strong></p>
                                <img src="${response.debugImageUrl}" alt="Debug" style="max-width: 200px; height: auto; border: 1px solid #ddd; border-radius: 4px;">
                            ` : ''}
                        </div>
                    </details>
                </div>
            `;

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
                dropPosition: {
                    xPercent,
                    yPercent
                },
                sceneDescription,
                productDescription
            };

            console.log('Sending composite request:', request);
            const response = await CompositingService.generateComposite(request);

            // Show success
            statusDiv.style.background = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.innerHTML = '✅ Composite generated successfully!';

            // Show result
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <h5 style="margin: 0 0 8px 0; color: #333;">Generated Composite:</h5>
                <img src="${response.finalImageUrl}" alt="Generated Composite" 
                     style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;">
                <div style="margin-bottom: 8px;">
                    <a href="${response.finalImageUrl}" download="composite-image.jpg" 
                       style="display: inline-block; background: #007bff; color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 12px;">
                        💾 Download Image
                    </a>
                </div>
                <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; font-size: 12px; color: #666;">Debug Info</summary>
                    <div style="margin-top: 4px; font-size: 11px; color: #999;">
                        <p><strong>Final Prompt:</strong> ${response.finalPrompt}</p>
                        ${response.debugImageUrl ? `<img src="${response.debugImageUrl}" alt="Debug" style="max-width: 200px; height: auto; border: 1px solid #ddd;">` : ''}
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
        const vehicleImageUrl = this.getCurrentVehicleImageUrl();
        const vehicleInfo = this.extractVehicleGalleryInfo();

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <div style="font-weight: bold; color: #1976d2;">🚗 Set as Vehicle Scene</div>
                <div style="font-size: 12px; color: #666;">
                    ${vehicleInfo ? vehicleInfo : 'Use this vehicle for compositing'}
                </div>
                <button class="set-vehicle-button" style="
                    background: #2196f3;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: bold;
                ">Set Vehicle</button>
            </div>
            <div class="set-vehicle-result" style="display: none; color: #2e7d32; font-weight: bold; font-size: 12px;"></div>
        `;

        // Add event handler for the Set Vehicle button
        const setButton = container.querySelector('.set-vehicle-button') as HTMLButtonElement;
        const resultDiv = container.querySelector('.set-vehicle-result') as HTMLDivElement;

        setButton.addEventListener('click', async () => {
            try {
                setButton.disabled = true;
                setButton.textContent = 'Setting...';

                await this.setVehicleForCompositing(vehicleImageUrl, vehicleInfo);

                resultDiv.style.display = 'block';
                resultDiv.textContent = '✅ Vehicle set successfully!';
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
    }

    getCurrentVehicleImageUrl(): string {
        // Try to find the main vehicle image
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

    extractVehicleGalleryInfo(): string {
        // Try to extract vehicle info from the page title or heading
        const heading = document.querySelector('h1') as HTMLElement;
        if (heading) {
            return heading.textContent?.trim() || '';
        }

        // Fallback to page title
        return document.title.split('|')[0]?.trim() || '';
    }

    async setVehicleForCompositing(imageUrl: string, vehicleInfo: string) {
        // Store the vehicle info in chrome.storage.local for use in compositing
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({
                currentVehicle: {
                    imageUrl: imageUrl,
                    info: vehicleInfo,
                    setAt: Date.now(),
                    source: 'gallery'
                }
            });
        } else {
            // Fallback to localStorage for testing
            localStorage.setItem('currentVehicle', JSON.stringify({
                imageUrl: imageUrl,
                info: vehicleInfo,
                setAt: Date.now(),
                source: 'gallery'
            }));
        }
    }

    updateImagePreviews(container: HTMLElement) {
        const vehicleSelect = container.querySelector('.vehicle-image-select') as HTMLSelectElement;
        const productSelect = container.querySelector('.product-image-select') as HTMLSelectElement;
        const previewsDiv = container.querySelector('.image-previews') as HTMLDivElement;
        const vehiclePreview = container.querySelector('.vehicle-preview') as HTMLImageElement;
        const productPreview = container.querySelector('.product-preview') as HTMLImageElement;
        const vehicleUrl = container.querySelector('.vehicle-url') as HTMLDivElement;
        const productUrl = container.querySelector('.product-url') as HTMLDivElement;

        const vehicleImageUrl = vehicleSelect.value;
        const productImageUrl = productSelect.value;

        // Show/hide preview section
        if (vehicleImageUrl || productImageUrl) {
            previewsDiv.style.display = 'block';
        } else {
            previewsDiv.style.display = 'none';
            return;
        }

        // Update vehicle preview
        if (vehicleImageUrl) {
            vehiclePreview.src = vehicleImageUrl;
            vehiclePreview.style.display = 'block';
            vehicleUrl.textContent = vehicleImageUrl;
        } else {
            vehiclePreview.style.display = 'none';
            vehicleUrl.textContent = 'No vehicle selected';
        }

        // Update product preview
        if (productImageUrl) {
            productPreview.src = productImageUrl;
            productPreview.style.display = 'block';
            productUrl.textContent = productImageUrl;
        } else {
            productPreview.style.display = 'none';
            productUrl.textContent = 'No product selected';
        }

        // Add error handling for broken images
        vehiclePreview.onerror = () => {
            vehiclePreview.style.display = 'none';
            vehicleUrl.textContent = `❌ Failed to load: ${vehicleImageUrl}`;
        };

        productPreview.onerror = () => {
            productPreview.style.display = 'none';
            productUrl.textContent = `❌ Failed to load: ${productImageUrl}`;
        };
    }
}

new Main();