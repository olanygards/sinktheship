'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { Cell, Ship } from '../../utils/types';
import ShipStatus from './ShipStatus';

interface ShipPlacementProps {
  gameId: string;
  playerId: string;
  board: Cell[][];
  onFinishPlacement: () => void;
}

const ShipPlacement: React.FC<ShipPlacementProps> = ({
  gameId, 
  playerId, 
  board, 
  onFinishPlacement
}) => {
  const [ships, setShips] = useState<Ship[]>([
    { id: 1, size: 5, placed: false, type: 'carrier' },
    { id: 2, size: 4, placed: false, type: 'battleship' },
    { id: 3, size: 3, placed: false, type: 'cruiser' },
    { id: 4, size: 3, placed: false, type: 'submarine' },
    { id: 5, size: 2, placed: false, type: 'destroyer' },
  ]);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [hoveredCell, setHoveredCell] = useState<Cell | null>(null);
  const [flatBoard, setFlatBoard] = useState<Cell[]>(board.flat());

  // For displaying ship visualization
  const [availableShips, setAvailableShips] = useState({
    carrier: { size: 5, name: 'Air craft carrier', sunk: false },
    battleship: { size: 4, name: 'Battleship', sunk: false },
    cruiser: { size: 3, name: 'Cruiser', sunk: false },
    submarine: { size: 3, name: 'Submarine', sunk: false },
    destroyer: { size: 2, name: 'Destroyer', sunk: false }
  });

  // Function to check if a ship placement is valid
  const isValidPlacement = (shipSize: number, x: number, y: number): boolean => {
    if (orientation === 'horizontal') {
      // Check if ship extends beyond the board
      if (x + shipSize > 10) return false;
      
      // Check if any of the cells already have a ship
      for (let i = 0; i < shipSize; i++) {
        const cellExists = flatBoard.some(
          cell => cell.x === x + i && cell.y === y && cell.hasShip
        );
        if (cellExists) return false;
      }
    } else {
      // Check if ship extends beyond the board
      if (y + shipSize > 10) return false;
      
      // Check if any of the cells already have a ship
      for (let i = 0; i < shipSize; i++) {
        const cellExists = flatBoard.some(
          cell => cell.x === x && cell.y === y + i && cell.hasShip
        );
        if (cellExists) return false;
      }
    }
    
    return true;
  };

  // Get cells that would be affected by placing a ship at the hovered position
  const getHoveredCells = () => {
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

  // Helper function to remove ALL instances of a ship type from the board
  const cleanupShipType = async (shipType: string) => {
    console.log(`Cleaning up all ships of type: ${shipType}`);
    
    // Wait a moment to ensure any pending state updates are processed
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a completely new board without any ships of this type
    const newBoard = [...flatBoard].map(cell => {
      if (cell.shipType === shipType) {
        return { 
          ...cell, 
          hasShip: false, 
          shipId: null, 
          shipType: null 
        };
      }
      return cell;
    });
    
    // First update the board state
    setFlatBoard(newBoard);
    
    // Then mark all ships of this type as not placed
    const updatedShips = ships.map(ship => 
      ship.type === shipType ? { ...ship, placed: false } : ship
    );
    setShips(updatedShips);
    
    // Update Firestore with the cleaned board
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.board`]: newBoard
      });
      
      console.log(`Successfully cleaned all ${shipType} ships from the board`);
      
      // Return the new board for immediate use
      return newBoard;
    } catch (error) {
      console.error('Error updating board after cleanup:', error);
      return newBoard;
    }
  };

  const placeShip = async () => {
    if (!selectedShip || !hoveredCell) return;
    
    if (!isValidPlacement(selectedShip.size, hoveredCell.x, hoveredCell.y)) return;

    // Disable interaction while processing
    const shipTypeToPlace = selectedShip.type;
    setSelectedShip(null); // Immediately remove selection to prevent multiple clicks
    
    // IMPORTANT: Clean up ALL ships of this type from the board before placing
    // and wait for the cleaned board to be returned
    const cleanedBoard = await cleanupShipType(shipTypeToPlace);
    
    // Use the cleaned board to ensure we have the latest state
    const newBoard = [...cleanedBoard];
    
    if (orientation === 'horizontal') {
      for (let i = 0; i < selectedShip.size; i++) {
        const index = newBoard.findIndex(
          cell => cell.x === hoveredCell.x + i && cell.y === hoveredCell.y
        );
        if (index !== -1) {
          newBoard[index] = { 
            ...newBoard[index], 
            hasShip: true,
            shipId: selectedShip.id.toString(),
            shipType: shipTypeToPlace
          };
        }
      }
    } else {
      for (let i = 0; i < selectedShip.size; i++) {
        const index = newBoard.findIndex(
          cell => cell.x === hoveredCell.x && cell.y === hoveredCell.y + i
        );
        if (index !== -1) {
          newBoard[index] = { 
            ...newBoard[index], 
            hasShip: true,
            shipId: selectedShip.id.toString(),
            shipType: shipTypeToPlace
          };
        }
      }
    }
    
    // Update the board state with new ship
    setFlatBoard(newBoard);
    
    // Mark this ship as placed
    const newShips = ships.map(ship => 
      ship.id === selectedShip.id ? { ...ship, placed: true } : ship
    );
    setShips(newShips);
    
    // Update Firestore
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.board`]: newBoard
      });
      console.log(`Successfully placed ${shipTypeToPlace} on the board`);
    } catch (error) {
      console.error('Error updating board:', error);
    }
  };

  // Remove a ship from the board to allow repositioning
  const removeShip = async (shipId: number) => {
    const shipToRemove = ships.find(s => s.id === shipId);
    if (!shipToRemove) {
      console.error(`Ship with ID ${shipId} not found`);
      return;
    }
    
    console.log(`Removing ship with ID: ${shipId}, type: ${shipToRemove.type}`);
    
    // Remove by ship type to ensure all instances are removed
    await cleanupShipType(shipToRemove.type);
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

  // Update the availableShips state when a ship is placed
  useEffect(() => {
    const updatedShips = { ...availableShips };
    ships.forEach(ship => {
      if (ship.placed) {
        if (ship.size === 5) updatedShips.carrier.sunk = true;
        else if (ship.size === 4) updatedShips.battleship.sunk = true;
        else if (ship.size === 3 && !updatedShips.cruiser.sunk) updatedShips.cruiser.sunk = true;
        else if (ship.size === 3) updatedShips.submarine.sunk = true;
        else if (ship.size === 2) updatedShips.destroyer.sunk = true;
      }
    });
    setAvailableShips(updatedShips);
  }, [ships]);

  // Get ship name based on size
  const getShipName = (size: number): string => {
    switch(size) {
      case 5: return 'Hangarfartyg';
      case 4: return 'Slagskepp';
      case 3: return 'Kryssare';
      case 2: return 'Jagare';
      default: return 'Skepp';
    }
  };

  // Get ship code and color based on type
  const getShipInfo = (type: string) => {
    switch(type) {
      case 'carrier': return { letter: 'A', color: 'var(--ship-blue)' };
      case 'battleship': return { letter: 'B', color: 'var(--ship-orange)' };
      case 'cruiser': return { letter: 'C', color: 'var(--ship-pink)' };
      case 'submarine': return { letter: 'S', color: 'var(--ship-yellow)' };
      case 'destroyer': return { letter: 'D', color: 'var(--ship-green)' };
      default: return { letter: 'X', color: '#ccc' };
    }
  };

  // Render ship visualization
  const renderShipIcons = (ship: Ship) => {
    const { letter, color } = getShipInfo(ship.type || '');
    const icons = [];
    
    for (let i = 0; i < ship.size; i++) {
      icons.push(
        <div 
          key={i} 
          className="ship-square flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: color }}
        >
          {letter}
        </div>
      );
    }
    
    return (
      <div className="flex">
        {icons}
      </div>
    );
  };

  // Function to detect the orientation of a placed ship
  const detectShipOrientation = (shipId: number) => {
    const shipCells = flatBoard.filter(cell => cell.shipId === shipId.toString());
    console.log(`Found ${shipCells.length} cells for ship ${shipId} when detecting orientation`);
    if (shipCells.length < 2) return 'horizontal'; // Default
    
    // Check if all cells have same y (horizontal) or x (vertical)
    const sameY = shipCells.every(cell => cell.y === shipCells[0].y);
    return sameY ? 'horizontal' : 'vertical';
  };

  // Update to handle selecting a ship
  const handleSelectShip = (ship: Ship) => {
    setSelectedShip(ship);
    
    // If ship is already placed, detect its orientation
    if (ship.placed) {
      const shipCells = flatBoard.filter(cell => cell.shipId === ship.id.toString());
      console.log(`Selected ship ${ship.id} (${ship.type}), found ${shipCells.length} cells`);
      setOrientation(detectShipOrientation(ship.id));
    }
  };

  // Reset function to clear duplicate ships
  const resetShips = async () => {
    // First identify all ships that have cells on the board
    const shipIdsOnBoard = new Set();
    flatBoard.forEach(cell => {
      if (cell.hasShip && cell.shipId) {
        shipIdsOnBoard.add(cell.shipId);
      }
    });
    
    console.log('Ship IDs on board:', Array.from(shipIdsOnBoard));
    console.log('Ships in state:', ships.map(s => `${s.id}:${s.placed}`).join(', '));
    
    // Create a new board with all ships removed
    const clearedBoard = flatBoard.map(cell => ({
      ...cell,
      hasShip: false,
      shipId: null,
      shipType: null
    }));
    
    // Reset all ships to unplaced
    const resetShipsArray = ships.map(ship => ({
      ...ship,
      placed: false
    }));
    
    setFlatBoard(clearedBoard);
    setShips(resetShipsArray);
    
    // Update Firestore
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.board`]: clearedBoard
      });
    } catch (error) {
      console.error('Error resetting board:', error);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white border border-gray-200">
      <h2 className="text-2xl font-bold mb-4">
        Placera dina skepp
      </h2>
      
      <div className="flex flex-wrap justify-center gap-8 w-full">
        <div className="flex flex-col">
          <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-2">
            {ships.map(ship => (
              <button
                key={ship.id}
                className={`p-2 rounded border ${
                  ship.placed 
                    ? selectedShip?.id === ship.id
                      ? 'bg-white text-black border-[#8bb8a8] border-2'
                      : 'bg-white text-black border-gray-300 hover:border-blue-400'
                    : selectedShip?.id === ship.id
                      ? 'bg-white text-black border-[#8bb8a8] border-2'
                      : 'bg-white text-black border-gray-300 hover:border-[#8bb8a8]'
                }`}
                onClick={() => handleSelectShip(ship)}
              >
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <span className="font-medium">{getShipName(ship.size)}</span>
                  {renderShipIcons(ship)}
                  {ship.placed && <span className="text-xs text-blue-500 mt-1">(Kan flyttas)</span>}
                </div>
              </button>
            ))}
            
            {/* Orientation button as part of the grid */}
            <button 
              className="p-2 rounded border bg-white border-gray-300 hover:border-[#8bb8a8] flex items-center justify-center"
              onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}
            >
              <div className="flex items-center gap-3">
                {/* Black square with orientation indicator */}
                <div className="w-12 h-12 bg-black flex items-center justify-center">
                  {orientation === 'horizontal' ? (
                    <div className="w-8 h-2 bg-white"></div>
                  ) : (
                    <div className="w-2 h-8 bg-white"></div>
                  )}
                </div>
                {/* Rotation arrows */}
                <div className="flex flex-col">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 -mb-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </button>
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="p-4 bg-white border border-gray-200 mb-6">
              <div className="grid grid-cols-10 gap-0 border border-gray-300">
                {board.map((row, rowIndex) => 
                  row.map((cell, colIndex) => {
                    const isHovered = hoveredCells.some(c => c.x === colIndex && c.y === rowIndex);
                    const hasShip = flatBoard.find(c => c.x === colIndex && c.y === rowIndex)?.hasShip;
                    const shipType = flatBoard.find(c => c.x === colIndex && c.y === rowIndex)?.shipType;
                    const shipId = flatBoard.find(c => c.x === colIndex && c.y === rowIndex)?.shipId;
                    const isSelectedShipCell = selectedShip && shipId === selectedShip.id.toString();
                    
                    let cellClass = 'board-cell';
                    if (hasShip && shipType) {
                      cellClass += ` ${shipType}-color`;
                      if (isSelectedShipCell) {
                        cellClass += ' ring-2 ring-[#8bb8a8] ring-inset';
                      }
                    } else if (isHovered) {
                      cellClass += isValidHover ? ' bg-green-200' : ' bg-red-200';
                    } else {
                      cellClass += ' board-cell-water';
                    }
                    
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={cellClass}
                        onMouseEnter={() => setHoveredCell({ x: colIndex, y: rowIndex, isHit: false, hasShip: false })}
                        onClick={() => selectedShip && placeShip()}
                      >
                        {hasShip && shipType && (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {getShipInfo(shipType).letter}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          
            <div className="p-4 bg-white border border-gray-200">
              <h2 className="text-xl font-bold mb-2">DINA SKEPP</h2>
              <ShipStatus ships={availableShips} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-center mt-4">
        {selectedShip ? (
          <p className="mb-4 text-center">
            <span className="font-bold">{getShipName(selectedShip.size)}</span> valt.
            {selectedShip.placed ? ' Välj en ny position för att flytta skeppet.' : isValidHover && hoveredCell ? ' Klicka för att placera.' : ' Välj en giltig position.'}
          </p>
        ) : ships.some(ship => !ship.placed) ? (
          <p className="mb-4 text-center">Välj ett skepp att placera.</p>
        ) : (
          <p className="mb-4 text-center text-green-600 font-bold">Alla skepp placerade!</p>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={finishPlacement}
            disabled={ships.some(ship => !ship.placed)}
            className={`px-6 py-3 ${ships.some(ship => !ship.placed) ? 'bg-gray-300 text-gray-500 opacity-50' : 'bg-[#8bb8a8] text-white'}`}
          >
            Färdig med placering
          </button>
          
          <button
            onClick={resetShips}
            className="px-6 py-3 bg-red-500 text-white"
          >
            Återställ placering
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipPlacement; 