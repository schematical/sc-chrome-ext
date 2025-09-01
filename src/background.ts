import { VehicleStorage } from './utils/vehicleStorage';

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "setVehicle",
    title: "Set Vehicle",
    contexts: ["page", "image"],
    documentUrlPatterns: ["*://*.customwheeloffset.com/*"]
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