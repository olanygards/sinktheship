'use client';

import React, { useState } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

interface Cell {
  x: number;
  y: number;
  isHit: boolean;
  hasShip: boolean;
}

interface ShipPlacementProps {
  gameId: string;
  playerId: string;
  board: Cell[][];
  onFinishPlacement: () => void;
}

interface Ship {
  id: string;
  size: number;
  placed: boolean;
}

const ShipPlacement: React.FC<ShipPlacementProps> = ({
  gameId,
  playerId,
  board,
  onFinishPlacement
}) => {
  const [ships, setShips] = useState<Ship[]>([
    { id: 'carrier', size: 5, placed: false },
    { id: 'battleship', size: 4, placed: false },
    { id: 'cruiser', size: 3, placed: false },
    { id: 'submarine', size: 3, placed: false },
    { id: 'destroyer', size: 2, placed: false }
  ]);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [flatBoard, setFlatBoard] = useState<Cell[]>(board.flat().filter(Boolean));

  const toggleOrientation = () => {
    setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal');
  };

  const isValidPlacement = (shipSize: number, x: number, y: number): boolean => {
    if (orientation === 'horizontal') {
      if (x + shipSize > 10) return false;
      
      for (let i = 0; i < shipSize; i++) {
        const cell = board[y]?.[x + i];
        if (!cell || cell.hasShip) return false;
      }
    } else {
      if (y + shipSize > 10) return false;
      
      for (let i = 0; i < shipSize; i++) {
        const cell = board[y + i]?.[x];
        if (!cell || cell.hasShip) return false;
      }
    }
    
    return true;
  };

  const getHoveredCells = (): { x: number; y: number }[] => {
    if (!selectedShip || !hoveredCell) return [];
    
    const cells = [];
    
    if (orientation === 'horizontal') {
      for (let i = 0; i < selectedShip.size; i++) {
        if (hoveredCell.x + i < 10) {
          cells.push({ x: hoveredCell.x + i, y: hoveredCell.y });
        }
      }
    } else {
      for (let i = 0; i < selectedShip.size; i++) {
        if (hoveredCell.y + i < 10) {
          cells.push({ x: hoveredCell.x, y: hoveredCell.y + i });
        }
      }
    }
    
    return cells;
  };

  const placeShip = async () => {
    if (!selectedShip || !hoveredCell) return;
    
    if (!isValidPlacement(selectedShip.size, hoveredCell.x, hoveredCell.y)) return;
    
    const newBoard = [...flatBoard];
    
    if (orientation === 'horizontal') {
      for (let i = 0; i < selectedShip.size; i++) {
        const index = newBoard.findIndex(
          cell => cell.x === hoveredCell.x + i && cell.y === hoveredCell.y
        );
        if (index !== -1) {
          newBoard[index] = { ...newBoard[index], hasShip: true };
        }
      }
    } else {
      for (let i = 0; i < selectedShip.size; i++) {
        const index = newBoard.findIndex(
          cell => cell.x === hoveredCell.x && cell.y === hoveredCell.y + i
        );
        if (index !== -1) {
          newBoard[index] = { ...newBoard[index], hasShip: true };
        }
      }
    }
    
    setFlatBoard(newBoard);
    
    const newShips = ships.map(ship => 
      ship.id === selectedShip.id ? { ...ship, placed: true } : ship
    );
    
    setShips(newShips);
    setSelectedShip(null);
    
    // Update Firestore
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.board`]: newBoard
      });
    } catch (error) {
      console.error('Error updating board:', error);
    }
  };

  const finishPlacement = async () => {
    if (ships.some(ship => !ship.placed)) return;
    
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.ready`]: true
      });
      onFinishPlacement();
    } catch (error) {
      console.error('Error finalizing placement:', error);
    }
  };

  const hoveredCells = getHoveredCells();
  const isValidHover = selectedShip && hoveredCell && 
    isValidPlacement(selectedShip.size, hoveredCell.x, hoveredCell.y);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <div>
        <div className="inline-block bg-white p-4 rounded-lg shadow-lg">
          <div className="grid grid-cols-10 gap-0">
            {board.map((row, y) =>
              row.map((cell, x) => {
                const isHovered = hoveredCells.some(c => c.x === x && c.y === y);
                let cellClass = 'w-8 h-8 border border-gray-400 transition-colors';
                
                if (cell.hasShip) {
                  cellClass += ' bg-gray-500';
                } else if (isHovered) {
                  cellClass += isValidHover ? ' bg-green-200' : ' bg-red-200';
                }
                
                return (
                  <div
                    key={`${x}-${y}`}
                    className={cellClass}
                    onMouseEnter={() => setHoveredCell({ x, y })}
                    onClick={() => placeShip()}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <h3 className="text-lg font-bold mb-4">Placera dina skepp</h3>
        
        <div className="mb-4">
          <button
            onClick={toggleOrientation}
            className="px-4 py-2 bg-blue-500 text-white rounded mb-4"
          >
            Riktning: {orientation === 'horizontal' ? 'Horisontell' : 'Vertikal'}
          </button>
        </div>
        
        <div className="space-y-2">
          {ships.map(ship => (
            <div
              key={ship.id}
              className={`p-2 rounded cursor-pointer flex justify-between items-center ${
                ship.placed
                  ? 'bg-gray-300'
                  : selectedShip?.id === ship.id
                  ? 'bg-blue-100 border-2 border-blue-500'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => !ship.placed && setSelectedShip(ship)}
            >
              <div className="flex items-center">
                <div className="flex">
                  {Array.from({ length: ship.size }).map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 bg-gray-500 border border-gray-600"
                    />
                  ))}
                </div>
                <span className="ml-2">
                  {ship.id.charAt(0).toUpperCase() + ship.id.slice(1)}
                </span>
              </div>
              {ship.placed && <span className="text-green-500">✓</span>}
            </div>
          ))}
        </div>
        
        <button
          onClick={finishPlacement}
          disabled={ships.some(ship => !ship.placed)}
          className={`mt-6 px-4 py-2 w-full rounded ${
            ships.some(ship => !ship.placed)
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          Klar med placering
        </button>
      </div>
    </div>
  );
};

export default ShipPlacement; 