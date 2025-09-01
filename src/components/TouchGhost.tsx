/**
 * TouchGhost component for showing drag preview
 * Adapted from Home Canvas sample
 */

import React from 'react';

interface TouchGhostProps {
  imageUrl: string | null;
  position: { x: number; y: number } | null;
}

const TouchGhost: React.FC<TouchGhostProps> = ({ imageUrl, position }) => {
  if (!imageUrl || !position) {
    return null;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, -50%)',
    width: '120px',
    height: '120px',
    pointerEvents: 'none',
    zIndex: 9999,
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    padding: '8px',
    border: '2px solid #ff6600',
  };

  return (
    <div style={style}>
      <img
        src={imageUrl}
        alt="Dragging product"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: '8px',
        }}
      />
    </div>
  );
};

export default TouchGhost;
