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

  // Get color based on ship type
  const getShipColor = (code: string) => {
    switch(code) {
      case 'A': return 'var(--ship-blue)'; // Carrier
      case 'B': return 'var(--ship-orange)'; // Battleship
      case 'C': return 'var(--ship-pink)'; // Cruiser
      case 'S': return 'var(--ship-yellow)'; // Submarine
      case 'D': return 'var(--ship-green)'; // Destroyer
      default: return '#ccc';
    }
  };

  return (
    <div className="ship-display">
      {/* Carrier */}
      <div className="ship-col">
        <div className="ship-name text-left w-full mb-1">Air craft carrier</div>
        <div className="flex">
          {renderShipSquares(ships.carrier, 'A')}
        </div>
      </div>

      {/* Submarine */}
      <div className="ship-col">
        <div className="ship-name text-left w-full mb-1">Submarine</div>
        <div className="flex">
          {renderShipSquares(ships.submarine, 'S')}
        </div>
      </div>

      {/* Battleship */}
      <div className="ship-col">
        <div className="ship-name text-left w-full mb-1">Battleship</div>
        <div className="flex">
          {renderShipSquares(ships.battleship, 'B')}
        </div>
      </div>

      {/* Cruiser */}
      <div className="ship-col">
        <div className="ship-name text-left w-full mb-1">Cruiser</div>
        <div className="flex">
          {renderShipSquares(ships.cruiser, 'C')}
        </div>
      </div>

      {/* Destroyer */}
      <div className="ship-col">
        <div className="ship-name text-left w-full mb-1">Destroyer</div>
        <div className="flex">
          {renderShipSquares(ships.destroyer, 'D')}
        </div>
      </div>
    </div>
  );
};

export default ShipStatus; 