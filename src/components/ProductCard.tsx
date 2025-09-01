/**
 * ProductCard component for displaying products
 * Styled with Custom Wheel Offset theme
 */

import React from 'react';
import { Product } from './types';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  isSelected, 
  onClick, 
  onDragStart 
}) => {
  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    cursor: onClick ? 'pointer' : 'grab',
    border: isSelected ? '2px solid #ff6600' : '1px solid #e0e0e0',
    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
  };

  const imageContainerStyle: React.CSSProperties = {
    aspectRatio: '1',
    width: '100%',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  };

  const textStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'center',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  return (
    <div 
      style={cardStyle} 
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        }
      }}
    >
      <div style={imageContainerStyle}>
        <img src={product.imageUrl} alt={product.name} style={imageStyle} />
      </div>
      <div style={textStyle}>
        <h4 style={nameStyle}>{product.name}</h4>
      </div>
    </div>
  );
};

export default ProductCard;
