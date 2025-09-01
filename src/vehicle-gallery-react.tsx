/**
 * React entry point for Vehicle Gallery with product positioning
 * Replaces the vanilla JS vehicle-gallery.ts
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import VehicleGallery from './components/VehicleGallery';
import { VehicleStorage, ProductPosition, VehicleData } from './utils/vehicleStorage';

const App: React.FC = () => {
  const [vehicleData, setVehicleData] = React.useState<VehicleData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [newProductUrl, setNewProductUrl] = React.useState<string | null>(null);

  // Load vehicle data and check for new product URL parameter
  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const productUrl = urlParams.get('newImage');
        setNewProductUrl(productUrl);

        // Load vehicle data
        const data = await VehicleStorage.getVehicleData();
        setVehicleData(data);
      } catch (error) {
        console.error('Error loading vehicle data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle saving product position
  const handleSavePosition = async (position: ProductPosition): Promise<boolean> => {
    try {
      const success = await VehicleStorage.saveProductPosition(position);
      if (success) {
        // Reload vehicle data to show the new position
        const updatedData = await VehicleStorage.getVehicleData();
        setVehicleData(updatedData);
      }
      return success;
    } catch (error) {
      console.error('Error saving position:', error);
      return false;
    }
  };

  // Handle removing product position
  const handleRemovePosition = async (positionId: string): Promise<boolean> => {
    try {
      const success = await VehicleStorage.removeProductPosition(positionId);
      if (success) {
        // Reload vehicle data to hide the removed position
        const updatedData = await VehicleStorage.getVehicleData();
        setVehicleData(updatedData);
      }
      return success;
    } catch (error) {
      console.error('Error removing position:', error);
      return false;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#666666'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #ff6600',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p>Loading vehicle gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <VehicleGallery
      vehicleData={vehicleData}
      newProductUrl={newProductUrl || undefined}
      onSavePosition={handleSavePosition}
      onRemovePosition={handleRemovePosition}
    />
  );
};

// Initialize React app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('vehicle-gallery-root');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  } else {
    console.error('Could not find vehicle-gallery-root element');
  }
});

// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
