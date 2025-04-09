'use client';

import React from 'react';

// Inlinea Cell-typen tillfälligt för att lösa importproblemet
interface Cell {
  x: number;
  y: number;
  isHit: boolean;
  hasShip: boolean;
  isSunkShip?: boolean;
  shipType?: string;
  shipId?: string; // Endast string för att undvika typkompatibilitetsproblem
}

interface GameBoardProps {
  isPlayerBoard: boolean;
  board: Cell[][];
  onCellClick: (x: number, y: number) => void;
  isSmall?: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ isPlayerBoard, onCellClick, board, isSmall = false }) => {
  // Debug-funktion för att kontrollera state
  React.useEffect(() => {
    const sunkShips = board
      .flat()
      .filter(cell => cell?.isSunkShip)
      .map(cell => `${cell.x},${cell.y} (${cell.shipType})`);
    
    if (sunkShips.length > 0) {
      console.log(`${isPlayerBoard ? 'Player' : 'Opponent'} board has sunk ships:`, sunkShips);
    }
  }, [board, isPlayerBoard]);

  const renderCell = (cell: Cell) => {
    let cellClass = 'board-cell';
    
    if (cell.isHit) {
      if (cell.hasShip) {
        if (cell.isSunkShip) {
          // Sänkt skepp - Visa speciell färg baserat på skeppstyp
          cellClass += ' board-cell-hit board-cell-sunk';
          
          if (cell.shipType) {
            cellClass += ` ${cell.shipType}-color`;
          }
        } else {
          // Träffat skepp, men inte sänkt
          cellClass += ' board-cell-hit';
        }
      } else {
        // Missed shot
        cellClass += ' board-cell-miss';
      }
    } else if (isPlayerBoard && cell.hasShip) {
      // Player's ships
      cellClass += ' board-cell-ship';
    } else {
      // Empty water
      cellClass += ' board-cell-water';
    }

    return (
      <div
        key={`${cell.x}-${cell.y}`}
        className={cellClass}
        onClick={() => !isPlayerBoard && !cell.isHit && onCellClick(cell.x, cell.y)}
        data-ship-id={cell.shipId}
        data-is-sunk={cell.isSunkShip ? 'true' : 'false'}
      >
        {cell.isHit && cell.hasShip && cell.isSunkShip && (
          <div className="absolute inset-0 flex items-center justify-center text-white font-bold">
            {cell.shipType?.charAt(0).toUpperCase()}
          </div>
        )}
        {cell.isHit && cell.hasShip && !cell.isSunkShip && (
          <div className="absolute inset-0 flex items-center justify-center text-white">X</div>
        )}
        {cell.isHit && !cell.hasShip && (
          <div className="absolute inset-0 flex items-center justify-center">·</div>
        )}
      </div>
    );
  };

  // Generate coordinate labels A-J and 1-10
  const columnLabels = Array.from({length: 10}, (_, i) => String.fromCharCode(65 + i));
  const rowLabels = Array.from({length: 10}, (_, i) => i + 1);

  return (
    <div className="board-container">
      <div className="mb-1 ml-6 flex">
        {columnLabels.map(label => (
          <div key={label} className="coordinate-label">
            {label}
          </div>
        ))}
      </div>
      <div className="flex">
        <div className="flex flex-col mr-1">
          {rowLabels.map(label => (
            <div 
              key={label} 
              className="coordinate-label"
            >
              {label}
            </div>
          ))}
        </div>
        <div 
          className={`grid grid-cols-10 gap-0 ${isSmall ? 'small-board' : ''}`}
        >
          {board.map((row, y) =>
            row.map((cell, x) => renderCell(cell || { x, y, isHit: false, hasShip: false }))
          )}
        </div>
      </div>
    </div>
  );
};

export default GameBoard; 