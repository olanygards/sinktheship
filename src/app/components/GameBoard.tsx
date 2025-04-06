'use client';

import React from 'react';

interface Cell {
  x: number;
  y: number;
  isHit: boolean;
  hasShip: boolean;
}

interface GameBoardProps {
  isPlayerBoard: boolean;
  onCellClick: (x: number, y: number) => void;
  board: Cell[][];
}

const GameBoard: React.FC<GameBoardProps> = ({ isPlayerBoard, onCellClick, board }) => {
  const renderCell = (cell: Cell) => {
    let cellClass = 'w-8 h-8 border border-gray-400 cursor-pointer transition-colors';
    
    if (cell.isHit) {
      cellClass += cell.hasShip ? ' bg-red-500' : ' bg-blue-200';
    } else if (isPlayerBoard && cell.hasShip) {
      cellClass += ' bg-gray-500';
    }

    return (
      <div
        key={`${cell.x}-${cell.y}`}
        className={cellClass}
        onClick={() => !isPlayerBoard && !cell.isHit && onCellClick(cell.x, cell.y)}
      />
    );
  };

  return (
    <div className="inline-block bg-white p-4 rounded-lg shadow-lg">
      <div className="grid grid-cols-10 gap-0">
        {board.map((row, y) =>
          row.map((cell, x) => renderCell(cell || { x, y, isHit: false, hasShip: false }))
        )}
      </div>
    </div>
  );
};

export default GameBoard; 