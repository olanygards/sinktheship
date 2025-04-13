'use client';

import React from 'react';

interface Ship {
  size: number;
  name: string;
  sunk: boolean;
}

interface ShipStatusProps {
  ships: {
    carrier: Ship;
    battleship: Ship;
    cruiser: Ship;
    submarine: Ship;
    destroyer: Ship;
  };
}

const ShipStatus: React.FC<ShipStatusProps> = ({ ships }) => {
  // Ship colors map
  const SHIP_COLORS: Record<string, string> = {
    A: 'var(--ship-blue)',
    B: 'var(--ship-orange)',
    C: 'var(--ship-pink)',
    S: 'var(--ship-yellow)',
    D: 'var(--ship-green)',
  };

  // Get color based on ship type
  const getShipColor = (code: string) => SHIP_COLORS[code] || '#ccc';

  // Function to generate ship squares with appropriate letter
  const renderShipSquares = (ship: Ship, letterCode: string) => {
    const squares = [];
    for (let i = 0; i < ship.size; i++) {
      squares.push(
        <div 
          key={i} 
          className={`ship-square ${ship.sunk ? 'opacity-50' : ''}`}
          style={{ backgroundColor: getShipColor(letterCode) }}
        >
          {letterCode}
        </div>
      );
    }
    return squares;
  };

  // Ship data mapping
  const shipData = [
    { key: 'carrier', name: 'Air craft carrier', letter: 'A' },
    { key: 'submarine', name: 'Submarine', letter: 'S' },
    { key: 'battleship', name: 'Battleship', letter: 'B' },
    { key: 'cruiser', name: 'Cruiser', letter: 'C' },
    { key: 'destroyer', name: 'Destroyer', letter: 'D' }
  ];

  return (
    <div className="ship-display">
      {shipData.map(shipInfo => (
        <div key={shipInfo.key} className="ship-col">
          <div className="ship-name text-left w-full mb-1">
            {ships[shipInfo.key as keyof typeof ships].name || shipInfo.name}
          </div>
          <div className="flex">
            {renderShipSquares(ships[shipInfo.key as keyof typeof ships], shipInfo.letter)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ShipStatus; 