/**
 * Main Vehicle Gallery component with product positioning
 * Integrates drag & drop functionality from Home Canvas sample
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Product, ProductPosition, VehicleData } from './types';
import ProductCard from './ProductCard';
import TouchGhost from './TouchGhost';

interface VehicleGalleryProps {
  vehicleData: VehicleData | null;
  newProductUrl?: string;
  onSavePosition: (position: ProductPosition) => Promise<boolean>;
  onRemovePosition: (positionId: string) => Promise<boolean>;
}

const VehicleGallery: React.FC<VehicleGalleryProps> = ({
  vehicleData,
  newProductUrl,
  onSavePosition,
  onRemovePosition
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Touch drag state for mobile support
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchGhostPosition, setTouchGhostPosition] = useState<{ x: number; y: number } | null>(null);

  // Initialize product from URL parameter
  useEffect(() => {
    if (newProductUrl && !selectedProduct) {
      const product: Product = {
        id: Date.now().toString(),
        name: 'New Product',
        imageUrl: newProductUrl
      };
      setSelectedProduct(product);
    }
  }, [newProductUrl, selectedProduct]);

  // Handle mouse drag events
  const handleDragStart = useCallback((e: React.DragEvent) => {
    setIsDragging(true);
    // Hide the default drag ghost image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return; // Ignore final drag event
    setDragPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragPosition(null);
  }, []);

  // Handle drop on vehicle image
  const handleImageDrop = useCallback(async (
    e: React.DragEvent,
    vehicleImageUrl: string,
    imageElement: HTMLImageElement
  ) => {
    e.preventDefault();
    setIsDragging(false);
    setDragPosition(null);

    if (!selectedProduct) return;

    // Calculate relative position within the image
    const rect = imageElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // Percentage
    const y = ((e.clientY - rect.top) / rect.height) * 100; // Percentage

    const position: ProductPosition = {
      id: `${selectedProduct.id}-${vehicleImageUrl}-${Date.now()}`,
      productUrl: selectedProduct.imageUrl,
      vehicleImageUrl,
      position: { x, y },
      timestamp: Date.now(),
      name: selectedProduct.name
    };

    setIsLoading(true);
    setError(null);

    try {
      const success = await onSavePosition(position);
      if (!success) {
        throw new Error('Failed to save position');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save position');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, onSavePosition]);

  // Touch event handlers for mobile support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsTouchDragging(true);
    const touch = e.touches[0];
    setTouchGhostPosition({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTouchDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    setTouchGhostPosition({ x: touch.clientX, y: touch.clientY });
  }, [isTouchDragging]);

  const handleTouchEnd = useCallback(async (e: React.TouchEvent) => {
    if (!isTouchDragging || !selectedProduct) {
      setIsTouchDragging(false);
      setTouchGhostPosition(null);
      return;
    }

    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const vehicleImage = elementBelow?.closest('[data-vehicle-image]') as HTMLImageElement;

    if (vehicleImage) {
      const vehicleImageUrl = vehicleImage.getAttribute('data-vehicle-image');
      if (vehicleImageUrl) {
        // Simulate drop event
        const fakeDropEvent = {
          preventDefault: () => {},
          clientX: touch.clientX,
          clientY: touch.clientY
        } as React.DragEvent;
        await handleImageDrop(fakeDropEvent, vehicleImageUrl, vehicleImage);
      }
    }

    setIsTouchDragging(false);
    setTouchGhostPosition(null);
  }, [isTouchDragging, selectedProduct, handleImageDrop]);

  // Handle position removal
  const handleRemovePosition = useCallback(async (positionId: string) => {
    setIsLoading(true);
    try {
      await onRemovePosition(positionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove position');
    } finally {
      setIsLoading(false);
    }
  }, [onRemovePosition]);

  // Get positions for a specific vehicle image
  const getPositionsForImage = useCallback((vehicleImageUrl: string): ProductPosition[] => {
    return vehicleData?.products?.filter(p => p.vehicleImageUrl === vehicleImageUrl) || [];
  }, [vehicleData]);

  if (!vehicleData) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666666' }}>
        <h2>No Vehicle Data</h2>
        <p>Please set a vehicle first by visiting a gallery page on customwheeloffset.com</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '2rem', 
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#ff6600', marginBottom: '1rem', fontSize: '1.8rem' }}>
          {vehicleData.info.title}
        </h2>
        {vehicleData.info.yearMakeModel && (
          <p style={{ color: '#666666', marginBottom: '0.5rem' }}>
            <strong>Vehicle:</strong> {vehicleData.info.yearMakeModel}
          </p>
        )}
        {vehicleData.info.owner && (
          <p style={{ color: '#666666', marginBottom: '0.5rem' }}>
            <strong>Owner:</strong> {vehicleData.info.owner}
          </p>
        )}
      </div>

      {/* Product Selection */}
      {selectedProduct && (
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '2rem', 
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#333333', marginBottom: '1rem' }}>Selected Product</h3>
          <p style={{ color: '#666666', marginBottom: '1rem' }}>
            Drag the product below onto any vehicle image to position it.
          </p>
          <div style={{ width: '200px' }}>
            <ProductCard
              product={selectedProduct}
              isSelected={true}
              onDragStart={handleDragStart}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#ffe6e6',
          border: '1px solid #ff6666',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem',
          color: '#cc0000'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{
          background: '#fff3e0',
          border: '1px solid #ff6600',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem',
          color: '#ff6600',
          textAlign: 'center'
        }}>
          Saving position...
        </div>
      )}

      {/* Vehicle Images Gallery */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ 
          color: '#333333', 
          marginBottom: '1.5rem', 
          borderBottom: '2px solid #ff6600',
          paddingBottom: '0.5rem',
          display: 'inline-block',
          textTransform: 'uppercase',
          fontWeight: 700,
          letterSpacing: '0.5px'
        }}>
          Vehicle Images ({vehicleData.images.length})
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem'
        }}>
          {vehicleData.images.map((imageUrl, index) => {
            const positions = getPositionsForImage(imageUrl);
            
            return (
              <div key={index} style={{
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                position: 'relative'
              }}>
                <div 
                  style={{ position: 'relative', aspectRatio: '4/3' }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const img = e.currentTarget.querySelector('img') as HTMLImageElement;
                    if (img) handleImageDrop(e, imageUrl, img);
                  }}
                >
                  <img
                    src={imageUrl}
                    alt={`Vehicle ${index + 1}`}
                    data-vehicle-image={imageUrl}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      cursor: selectedProduct ? 'crosshair' : 'default'
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                  
                  {/* Positioned Products */}
                  {positions.map((position) => (
                    <div
                      key={position.id}
                      style={{
                        position: 'absolute',
                        left: `${position.position.x}%`,
                        top: `${position.position.y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '60px',
                        height: '60px',
                        background: 'rgba(255, 102, 0, 0.9)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: '3px solid white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 10
                      }}
                      onClick={() => handleRemovePosition(position.id)}
                      title={`${position.name} - Click to remove`}
                    >
                      <img
                        src={position.productUrl}
                        alt="Positioned product"
                        style={{
                          width: '80%',
                          height: '80%',
                          objectFit: 'contain',
                          borderRadius: '50%'
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Image Info */}
                <div style={{ padding: '1rem' }}>
                  <p style={{ fontSize: '14px', color: '#666666', margin: 0 }}>
                    Image {index + 1}
                    {positions.length > 0 && (
                      <span style={{ color: '#ff6600', fontWeight: 600, marginLeft: '0.5rem' }}>
                        • {positions.length} product{positions.length !== 1 ? 's' : ''} positioned
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag & Drop Instructions */}
      {selectedProduct && !isLoading && (
        <div style={{
          background: '#f0f8ff',
          border: '1px solid #0066cc',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center',
          color: '#0066cc'
        }}>
          💡 <strong>Tip:</strong> Drag the product onto any vehicle image to position it. 
          Click positioned products to remove them.
        </div>
      )}

      {/* Touch Ghost for mobile */}
      {isTouchDragging && (
        <TouchGhost
          imageUrl={selectedProduct?.imageUrl || null}
          position={touchGhostPosition}
        />
      )}

      {/* Drag Ghost for desktop */}
      {isDragging && dragPosition && (
        <TouchGhost
          imageUrl={selectedProduct?.imageUrl || null}
          position={dragPosition}
        />
      )}
    </div>
  );
};

export default VehicleGallery;
