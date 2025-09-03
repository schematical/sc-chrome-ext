# Image Compositing API Integration - Scope Document

## 🎯 Project Overview
Integrate AI-powered image compositing functionality by sending positioned vehicle and product images to a local API service that generates realistic composite images using AI.

## 📋 Current State Analysis
- ✅ Vehicle image extraction from Custom Wheel Offset pages
- ✅ Product positioning with drag-and-drop interface  
- ✅ VehicleStorage system with ProductPosition data
- ✅ React gallery with visual position indicators
- 🆕 **NEW**: API integration for AI composite image generation

## 🔌 API Integration Specification

### Endpoint Details
- **URL**: `http://localhost:3000/api/scene`
- **Method**: POST
- **Content-Type**: application/json

### Request Payload Structure
```typescript
interface CompositeImageRequest {
  sceneUrl: string;          // Vehicle image URL
  productUrl: string;        // Product image URL  
  dropPosition: Array<{
    xPercent: number;        // X position as percentage (0-100)
    yPercent: number;        // Y position as percentage (0-100)
  }>;                        // Array of points (single point or polygon)
  sceneDescription: string;  // AI context for vehicle image
  productDescription: string; // AI context for product image
}
```

### Response Structure
```typescript
interface CompositeImageResponse {
  finalImageUrl: string;     // Generated composite image URL
  debugImageUrl: string;     // Debug image (base64 data URI)
  finalPrompt: string;       // AI prompt used for generation
}
```

## 🏗️ Implementation Requirements

### 1. New Service Creation
```typescript
// src/services/compositingService.ts
class CompositingService {
  static async generateComposite(request: CompositeImageRequest): Promise<CompositeImageResponse>
  static async isServiceAvailable(): Promise<boolean>
  static validateRequest(request: CompositeImageRequest): boolean
}
```

### 2. UI/UX Integration Points

#### A. Vehicle Gallery Enhancement
- **New Button**: "Generate Composite" for positioned products
- **Loading States**: Progress indicators during API calls
- **Result Display**: Show generated composite alongside original
- **Error Handling**: User-friendly error messages

#### B. Product Position Enhancement
```typescript
interface ProductPosition {
  // Existing fields...
  id: string;
  productUrl: string;
  vehicleImageUrl: string;
  position: { x: number; y: number };
  timestamp: number;
  name?: string;
  
  // NEW fields for compositing
  composite?: {
    requestId: string;
    finalImageUrl?: string;
    debugImageUrl?: string;
    generatedAt: number;
    status: 'pending' | 'completed' | 'failed';
  };
}
```

### 3. Data Flow Architecture
```
1. User positions product on vehicle image
2. User clicks "Generate Composite" 
3. Convert position coordinates to percentages
4. Add scene/product descriptions (user input or AI-generated)
5. Send API request to localhost:3000/api/scene
6. Show loading state in gallery
7. Receive composite image response
8. Update ProductPosition with composite data
9. Display result in gallery interface
```

## 🔧 Technical Implementation Tasks

### Phase 1: Core API Integration
1. **Service Layer**
   - Create `CompositingService` class
   - Implement API request/response handling
   - Add request validation and error handling
   - Add service availability checking

2. **Storage Enhancement**
   - Extend `ProductPosition` interface for composite data
   - Update `VehicleStorage` methods to handle composite metadata
   - Add composite image caching/cleanup logic

3. **Gallery UI Updates**
   - Add "Generate Composite" button to positioned products
   - Implement loading states and progress indicators
   - Create composite image display component
   - Add error handling and retry mechanisms

### Phase 2: UX Enhancements  
1. **Scene/Product Descriptions**
   - Auto-generate descriptions from vehicle/product metadata
   - Allow user editing of descriptions for better AI context
   - Save preferred descriptions for reuse

2. **Batch Processing**
   - Generate composites for multiple products at once
   - Queue management for multiple requests
   - Bulk operations UI

3. **Image Management**
   - Download/save composite images locally
   - Share composite images functionality
   - Image comparison tools (before/after)

## 🎨 User Experience Flow

### Happy Path
1. User has positioned product(s) on vehicle image(s)
2. User sees "Generate Composite" button on positioned products
3. User clicks button → Loading spinner appears
4. API generates composite → Success notification
5. Composite image displays alongside original
6. User can save, share, or regenerate

### Error Scenarios
- **Service Unavailable**: Clear message, option to retry
- **API Errors**: Specific error messages, troubleshooting tips  
- **Network Issues**: Retry logic, offline indication
- **Invalid Positions**: Guide user to reposition product

## 📊 Data Requirements

### Position Coordinate Conversion
```typescript
// Convert array of pixel coordinates to percentages
function convertPointsToPercentages(
  points: Array<{x: number, y: number}>,
  canvasWidth: number, 
  canvasHeight: number
): Array<{xPercent: number; yPercent: number}> {
  return points.map(point => ({
    xPercent: Math.round((point.x / canvasWidth) * 100),
    yPercent: Math.round((point.y / canvasHeight) * 100)
  }));
}
```

### Description Generation
```typescript
// Auto-generate scene descriptions from vehicle data
function generateSceneDescription(vehicleInfo: VehicleData['info']): string {
  return `This is a ${vehicleInfo.yearMakeModel} vehicle. ${vehicleInfo.wheels.brand ? `It has ${vehicleInfo.wheels.brand} wheels.` : ''}`;
}

function generateProductDescription(productUrl: string): string {
  // Extract product type from URL patterns or metadata
  if (productUrl.includes('wheels')) return "This is a wheel/rim";
  if (productUrl.includes('tires')) return "This is a tire";
  return "This is an automotive product";
}
```

## 🚀 Success Criteria

### Functional Requirements
- [ ] Successfully send positioned products to compositing API
- [ ] Display generated composite images in gallery
- [ ] Store composite metadata with product positions
- [ ] Handle errors gracefully with user feedback
- [ ] Maintain performance with reasonable response times

### Technical Requirements  
- [ ] Clean service architecture for API integration
- [ ] Proper error handling and retry logic
- [ ] Efficient image loading and caching
- [ ] Responsive UI during async operations
- [ ] Data persistence for composite images

### User Experience Requirements
- [ ] Intuitive "Generate Composite" workflow
- [ ] Clear loading states and progress feedback
- [ ] Easy comparison between original and composite
- [ ] Simple regeneration if unsatisfied with result

## 🔍 Open Questions & Clarifications Needed

### API Service Details
1. **Authentication**: Does the localhost API require any authentication headers?
2. **Rate Limiting**: Are there any rate limits or concurrent request restrictions?
3. **Image Size Limits**: What are the maximum image dimensions/file sizes supported?
4. **Response Time**: What's the typical response time for composite generation?

### Description Requirements
5. **Description Source**: Should descriptions be auto-generated, user-input, or both?
6. **Description Templates**: Are there preferred description formats for better AI results?
7. **Scene Context**: How detailed should scene descriptions be for optimal results?

### Composite Image Management
8. **Image Storage**: Should composite images be stored locally, cached temporarily, or downloaded?
9. **Image Quality**: Are there different quality/resolution options for composites?
10. **Regeneration**: Should users be able to regenerate with different descriptions/positions?

### Integration Scope
11. **Batch Operations**: Should multiple products be composited simultaneously or individually?
12. **Position Validation**: Are there position constraints (e.g., products must be on certain areas)?
13. **Fallback Behavior**: What happens if the API service is unavailable?

### Performance Considerations  
14. **Image Optimization**: Should images be resized/optimized before sending to API?
15. **Caching Strategy**: How should we cache responses to avoid duplicate API calls?
16. **Progress Tracking**: Do we need detailed progress for long-running operations?

---

## ✅ IMPLEMENTATION COMPLETED

### 🚀 What's Been Built

**Core API Integration ✅**
- `CompositingService` class with full API integration to `localhost:3000/api/scene`
- Request validation and error handling
- Coordinate conversion from pixels to xPercent/yPercent
- Service availability checking

**Page Integration ✅**
- Automatic button injection under both vehicle and product images
- Expandable inline controls with Custom Wheel Offset styling
- Target image selection dropdowns
- Position controls (X/Y percentage inputs)
- Description text areas with auto-generation
- **NEW: Vehicle gallery page integration with "Set Vehicle" functionality**

**Enhanced Metadata Extraction ✅**
- `MetadataExtractor` service for detailed page analysis
- Vehicle metadata extraction (year, make, model, wheels, suspension)
- Product metadata extraction (brand, model, finish, type)
- URL pattern recognition for brands and models
- Detailed AI descriptions generation

**Complete User Experience ✅**
- 🎨 "Generate Composite" buttons appear under all images
- Click to expand inline controls panel
- Auto-populated descriptions and image selectors
- Loading states with progress indicators
- Success/error feedback with detailed messages
- Composite image display with download links
- Debug information panel
- **NEW: "Set Vehicle" workflow from gallery pages to product pages**
- **NEW: Advanced visual positioning system with point/polygon modes**

### 🛠️ How It Works

**On Product Pages:**
1. **User sees images** on Custom Wheel Offset product pages
2. **🎨 "Generate Composite" buttons** appear under each image automatically
3. **Click button** → Controls panel expands inline
4. **Select target image** from dropdown (includes stored vehicles from gallery)
5. **Adjust position** using X/Y percentage inputs (defaults: 50%, 75%)
6. **Review descriptions** (auto-generated from page metadata)
7. **Click "🚀 Generate Composite Image"**
8. **Loading state** shows progress
9. **Result displays** with download option and debug info

**NEW: On Vehicle Gallery Pages:**
1. **User browses vehicle gallery** (`/wheel-offset-gallery/`)
2. **🚗 "Set as Vehicle Scene" button** appears near Save button
3. **Click "Set Vehicle"** → Vehicle stored for compositing
4. **Navigate to product pages** → Stored vehicle appears as priority option
5. **Generate composites** using the stored vehicle as scene

### 🧠 Smart Features Implemented

**Intelligent Description Generation**
- Extracts vehicle year/make/model from page titles and breadcrumbs
- Identifies wheel brands (XD, Fuel, Method, etc.) from URLs and content
- Generates detailed AI prompts like "This is a 2019 Toyota Tacoma equipped with XD Grenade wheels, wheel size: 18x9, tire size: 285/70R17, suspension: ReadyLift Leveling Kit"

**Brand Recognition**
- URL pattern matching for wheel brands
- Brand name formatting (e.g., "lockoffroadwheels" → "Lock Off Road")
- Model name cleaning (e.g., "xd135_grenade_black" → "XD135 Grenade")
- Finish detection from filenames (black, white, machined, chrome, bronze)

**Robust Error Handling**
- Service unavailable detection
- Detailed error messages for debugging
- Request validation before sending
- Graceful fallbacks for missing data

**NEW: Cross-Page Vehicle Storage**
- Chrome storage integration for vehicle persistence
- 24-hour expiration for stored vehicles
- Visual indicators for stored vehicles in dropdowns
- Automatic detection of vehicle gallery vs product pages

**NEW: Advanced Positioning System**
- Visual point/polygon positioning replacing simple X/Y inputs
- Interactive canvas with vehicle image background for precise clicking
- Two modes: Point (single click) and Polygon (multiple points with auto-close)
- Real-time coordinate display and visual feedback
- Advanced panel organization with collapsible interface

### 📁 Files Created/Modified

**New Files:**
- `src/services/compositingService.ts` - API integration service
- `src/services/metadataExtractor.ts` - Enhanced page metadata extraction

**Modified Files:**
- `src/main.ts` - Added compositing button injection and UI controls
- `COMPOSITING_API_SCOPE.md` - Complete scope documentation

### 🎯 Ready for Testing

The implementation is complete and ready for testing! 

**To test:**
1. Load extension on any Custom Wheel Offset gallery page
2. Look for 🎨 "Generate Composite" buttons under images
3. Make sure your localhost:3000 API service is running
4. Click button, fill out the form, and generate composites

**NEW: To test vehicle gallery integration:**
1. Visit a vehicle gallery page (e.g., `/wheel-offset-gallery/1185761/...`)
2. Look for 🚗 "Set as Vehicle Scene" button near the Save button
3. Click "Set Vehicle" to store the vehicle
4. Navigate to a product page
5. Open compositing interface - stored vehicle should appear as "📋 Stored: [Vehicle Info]"

**NEW: To test advanced positioning:**
1. Open compositing interface on any product page
2. Click "⚙️ Advanced" button to expand advanced panel
3. Select vehicle and product images
4. Choose Point or Polygon mode
5. Click on the vehicle image canvas to set positions
6. See real-time coordinate feedback and visual indicators

**Example Request Sent to API:**
```json
{
  "sceneUrl": "https://images.customwheeloffset.com/web-compressed/670291-12-2019-tacoma-toyota-readylift-leveling-kit-body-lift-xd-bully-black.jpg",
  "productUrl": "https://images.customwheeloffset.com/wheels-compressed/xdwheels/xd135/xd135_grenade_black.jpg",
  "dropPosition": [
    {"xPercent": 50, "yPercent": 75}
  ],
  "sceneDescription": "This is a 2019 Toyota Tacoma equipped with XD Grenade wheels, wheel size: 18x9, suspension: ReadyLift Leveling Kit. The image shows the vehicle's wheel and tire setup clearly.",
  "productDescription": "This is a wheel/rim XD Wheels Grenade with black finish"
}
```

**Example Polygon Request:**
```json
{
  "sceneUrl": "https://...",
  "productUrl": "https://...",
  "dropPosition": [
    {"xPercent": 45, "yPercent": 70},
    {"xPercent": 55, "yPercent": 70},
    {"xPercent": 60, "yPercent": 80},
    {"xPercent": 40, "yPercent": 80}
  ],
  "sceneDescription": "Vehicle description...",
  "productDescription": "Product description..."
}
```

### 📋 Next Steps (Phase 2)
- Multiple product selection interface (currently single product)
- User-editable descriptions with templates
- Batch composite generation
- Image caching and management
- Playwright crawling for additional metadata sources

---

**Context Preservation**: This document captures the complete implementation of image compositing API integration for the Chrome extension, including technical details, user flow, and testing instructions.
