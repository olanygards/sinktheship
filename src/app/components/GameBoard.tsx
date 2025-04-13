'use client';

import React from 'react';
import { Cell } from '../../utils/types'; // Make sure Cell is imported

// REMOVE Inlined Cell type definition - use the imported one
// interface Cell {
//   x: number;
//   y: number;
//   isHit: boolean;
//   hasShip: boolean;
//   shipId?: string; // Added optional shipId
//   shipType?: 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer'; // Added optional shipType
// }

interface GameBoardProps {
  board: Cell[][];
  onCellClick: (x: number, y: number) => void;
  isPlayerBoard: boolean;
  isSmall?: boolean; // Optional prop for smaller boards
}

// Helper function (can be moved to utils) - använda de nya CSS-klasserna
const getShipInfo = (type: string) => {
    switch (type) {
      case 'carrier': return { letter: 'A', color: 'carrier-color' };
      case 'battleship': return { letter: 'B', color: 'battleship-color' };
      case 'cruiser': return { letter: 'C', color: 'cruiser-color' };
      case 'submarine': return { letter: 'S', color: 'submarine-color' };
      case 'destroyer': return { letter: 'D', color: 'destroyer-color' };
      default: return { letter: '?', color: 'unknown-color' };
    }
};

const GameBoard: React.FC<GameBoardProps> = ({ board, onCellClick, isPlayerBoard, isSmall }) => {
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

  // Check if board data is valid before rendering
  if (!board || board.length === 0 || !board[0] || board[0].length === 0) {
    console.error('Invalid board data received in GameBoard:', board);
    // Optionally return a placeholder or loading state
    return <div className="p-4 text-red-500">Error: Invalid board data.</div>;
  }

  // Generate coordinate labels A-J and 1-10
  const columnLabels = Array.from({length: 10}, (_, i) => String.fromCharCode(65 + i));
  const rowLabels = Array.from({length: 10}, (_, i) => i + 1);

  return (
    <div className="board-container">
      <div className={`mb-1 ml-6 flex ${isSmall ? 'small-coord-labels' : ''}`}>
        {columnLabels.map(label => (
          <div key={label} className="coordinate-label">
            {label}
          </div>
        ))}
      </div>
      <div className="flex">
        <div className={`flex flex-col mr-1 ${isSmall ? 'small-coord-labels' : ''}`}>
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
          className={`grid grid-cols-10 gap-0 ${isSmall ? 'small-board' : ''} border border-[var(--grid-line)] rounded overflow-hidden`}
        >
          {board.map((row, y) => {
            // Add safety check for row validity
            if (!Array.isArray(row)) {
                console.error(`Invalid row data at index ${y}:`, row);
                return null; // Skip rendering this row
            }
            return row.map((cell, x) => {
               // Add safety check for cell validity
               if (!cell || typeof cell.x !== 'number' || typeof cell.y !== 'number') {
                 console.error(`Invalid cell data at (${x}, ${y}):`, cell);
                 return <div key={`${x}-${y}`} className="board-cell bg-red-100">!</div>; // Render an error cell
               }

              // Determine cell style based on its state
              let cellClass = 'board-cell';
              let content = null;

              if (cell.isHit) {
                if (cell.hasShip) {
                  // It's a hit on a ship
                  if (cell.isSunkShip) {
                    // Ship is sunk
                    cellClass += ' board-cell-sunk'; // Style for sunk ship part
                    content = <div className="sunk-ship-marker">✕</div>; 
                  } else {
                    // Ship is hit but not sunk
                    cellClass += ' board-cell-hit'; // Style for regular hit
                    content = <div className="hit-marker">✕</div>; 
                  }
                } else {
                  // It's a miss
                  cellClass += ' board-cell-miss'; // Style for miss
                  content = <div className="miss-marker">•</div>; 
                }
              } else if (isPlayerBoard && cell.hasShip) {
                 // Show player's own ships if it's their board
                 cellClass += ` ${cell.shipType || 'unknown'}-color`; 
                 content = <div className="ship-marker">{cell.shipType ? getShipInfo(cell.shipType).letter : '?'}</div>;
              }
               else {
                // Default water cell
                cellClass += ' board-cell-water';
              }

              // Add hover effect only if it's the opponent's board and clickable
              if (!isPlayerBoard && !cell.isHit) {
                 cellClass += ' hover:opacity-80 cursor-pointer';
              }

               // Add size class if small board
               if (isSmall) {
                 cellClass += ' small-cell';
               }

              return (
                <div
                  key={`${x}-${y}`}
                  className={cellClass}
                  onClick={() => !isPlayerBoard && !cell.isHit && onCellClick(x, y)} // Click only on opponent board, unhit cells
                  data-is-sunk={cell.isSunkShip || false} // Add data attribute for potential CSS targeting
                >
                  {content} 
                </div>
              );
            })
          })}
        </div>
      </div>
    </div>
  );
};

export default GameBoard; 