import { VehicleStorage } from './utils/vehicleStorage';

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "setVehicle",
    title: "Set Vehicle",
    contexts: ["page", "image"],
    documentUrlPatterns: ["https://www.customwheeloffset.com/wheel-offset-gallery/*"]
  });
  
  chrome.contextMenus.create({
    id: "addToVehicle",
    title: "Add to vehicle",
    contexts: ["image"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "setVehicle" && tab?.id) {
    // Send message to content script to extract vehicle images
    try {
      chrome.tabs.sendMessage(tab.id, {
        type: "EXTRACT_VEHICLE_IMAGES"
      });
    } catch (error) {
      console.error("Error sending message to content script:", error);
    }
  } else if (info.menuItemId === "addToVehicle" && info.srcUrl) {
    // Add image directly to vehicle data
    try {
      const success = await VehicleStorage.addImageToVehicle(info.srcUrl);
      
      if (success) {
        console.log("Image added to vehicle successfully:", info.srcUrl);
        
        // Open vehicle gallery in new tab with the newly added image highlighted
        const galleryUrl = chrome.runtime.getURL('vehicle-gallery.html') + `?newImage=${encodeURIComponent(info.srcUrl)}`;
        chrome.tabs.create({ url: galleryUrl });
        
        // Show success notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon.png',
          title: 'Image Added to Vehicle',
          message: `Added image to vehicle successfully. Gallery opened in new tab.`
        });
      } else {
        // Show error notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon.png',
          title: 'Error Adding Image',
          message: `No vehicle data exists. Please set a vehicle first.`
        });
      }
    } catch (error) {
      console.error("Error adding image to vehicle:", error);
      
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon.png',
        title: 'Error Adding Image',
        message: `Failed to add image to vehicle`
      });
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  switch (request.type) {
    case "VEHICLE_IMAGES_EXTRACTED":
      try {
        // Store vehicle data using the VehicleStorage utility
        const success = await VehicleStorage.setVehicleData(request.data, request.vehicleInfo);
        
        if (success) {
          console.log("Vehicle images stored successfully:", request.data);
          
          // Show success notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon.png',
            title: 'Vehicle Set Successfully',
            message: `Extracted ${request.data.length} images from ${request.vehicleInfo.title || 'vehicle'}`
          });
          
          sendResponse({ success: true });
        } else {
          throw new Error("Failed to store vehicle data");
        }
      } catch (error) {
        console.error("Error storing vehicle images:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        sendResponse({ success: false, error: errorMessage });
      }
      return true; // Keep message channel open for async response
      
    case "GET_VEHICLE_DATA":
      try {
        const vehicleData = await VehicleStorage.getVehicleData();
        sendResponse({ success: true, data: vehicleData });
      } catch (error) {
        console.error("Error retrieving vehicle data:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        sendResponse({ success: false, error: errorMessage });
      }
      return true;
      
    default:
      break;
  }
});