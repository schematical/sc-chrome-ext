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
}

new Main();