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
  // Ship colors map - använder de nya CSS-variablerna
  const SHIP_COLORS: Record<string, string> = {
    A: 'var(--ship-carrier)',
    B: 'var(--ship-battleship)',
    C: 'var(--ship-cruiser)',
    S: 'var(--ship-submarine)',
    D: 'var(--ship-destroyer)',
  };

  // Get color based on ship type
  const getShipColor = (code: string) => SHIP_COLORS[code] || '#BDBDBD';

  // Function to generate ship squares with appropriate letter
  const renderShipSquares = (ship: Ship, letterCode: string) => {
    const squares: JSX.Element[] = [];
    for (let i = 0; i < ship.size; i++) {
      squares.push(
        <div 
          key={i} 
          className={`ship-square ${ship.sunk ? 'opacity-70' : ''}`}
          style={{ backgroundColor: getShipColor(letterCode) }}
        >
          {ship.sunk ? '✕' : letterCode}
        </div>
      );
    }
    return squares;
  };

  // Ship data mapping
  const shipData = [
    { key: 'carrier', name: 'Carrier', letter: 'A' },
    { key: 'battleship', name: 'Battleship', letter: 'B' },
    { key: 'cruiser', name: 'Cruiser', letter: 'C' },
    { key: 'submarine', name: 'Submarine', letter: 'S' },
    { key: 'destroyer', name: 'Destroyer', letter: 'D' }
  ];

  return (
    <div className="ship-display p-2 bg-white rounded shadow-sm">
      {shipData.map(shipInfo => (
        <div key={shipInfo.key} className="ship-col mb-2">
          <div className="ship-name text-left w-full mb-1">
            {ships[shipInfo.key as keyof typeof ships].name || shipInfo.name}
            {ships[shipInfo.key as keyof typeof ships].sunk && 
              <span className="ml-2 text-xs text-red-500">Sunk</span>
            }
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