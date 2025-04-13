'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { Cell, Ship } from '../../utils/types';
import ShipStatus from './ShipStatus';

// Define BOARD_SIZE and convertToGrid locally for ShipPlacement
const BOARD_SIZE = 10;
const convertToGrid = (board: Cell[]): Cell[][] => {
  const grid: Cell[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  board.forEach(cell => {
    // Basic check to prevent accessing undefined indices if board size is wrong
    if (cell && typeof cell.y === 'number' && typeof cell.x === 'number' && cell.y >= 0 && cell.y < BOARD_SIZE && cell.x >= 0 && cell.x < BOARD_SIZE) {
      grid[cell.y][cell.x] = cell;
    } else {
      console.error('Invalid cell data encountered during grid conversion:', cell);
    }
  });
  return grid;
};

interface ShipPlacementProps {
  gameId: string;
  playerId: string;
  board: Cell[][]; // Initial board state (might be empty)
  onFinishPlacement: (finalBoard: Cell[][]) => void; // Updated prop signature
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

  // Add new state for tracking selected ship from board
  const [selectedShipFromBoard, setSelectedShipFromBoard] = useState<Ship | null>(null);

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
  const cleanupShipType = async (shipType: string | undefined) => {
    if (!shipType) return flatBoard;
    
    const newBoard = flatBoard.map(cell => 
      cell.shipType === shipType ? { ...cell, hasShip: false, shipId: null, shipType: null } : cell
    );
    setFlatBoard(newBoard);
    
    // Skip Firestore update for single player mode (AI games)
    if (!gameId.startsWith('ai_')) {
      try {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
          [`players.${playerId}.board`]: newBoard
        });
      } catch (error) {
        console.error('Error cleaning up ship type:', error);
      }
    }
    
    return newBoard;
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
    
    // Update the board in Firestore (or just return for single player)
    await updateBoard();
    
    // Check if all ships are placed
    if (newShips.every(ship => ship.placed)) {
      setPlayerReady();
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

  // Helper function to get ship information based on type
  const getShipInfo = (type: string) => {
    switch (type) {
      case 'carrier':
        return { letter: 'A', color: 'bg-[#4a7c59]', name: 'Carrier (5)' };
      case 'battleship':
        return { letter: 'B', color: 'bg-[#375e97]', name: 'Battleship (4)' };
      case 'cruiser':
        return { letter: 'C', color: 'bg-[#fb6542]', name: 'Cruiser (3)' };
      case 'submarine':
        return { letter: 'S', color: 'bg-[#ffbb00]', name: 'Submarine (3)' };
      case 'destroyer':
        return { letter: 'D', color: 'bg-[#3f681c]', name: 'Destroyer (2)' };
      default:
        return { letter: '?', color: 'bg-gray-400', name: 'Unknown' };
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

  // Modify handleSelectShip to handle both button and board selection
  const handleSelectShip = (ship: Ship) => {
    setSelectedShip(ship);
    setSelectedShipFromBoard(null);
    
    // If ship is already placed, detect its orientation
    if (ship.placed) {
      const shipCells = flatBoard.filter(cell => cell.shipId === ship.id.toString());
      console.log(`Selected ship ${ship.id} (${ship.type}), found ${shipCells.length} cells`);
      setOrientation(detectShipOrientation(ship.id));
    }
  };

  // Add new function to handle board cell click for ship selection
  const handleBoardCellClick = (cell: Cell) => {
    if (cell.hasShip && cell.shipId) {
      const shipId = parseInt(cell.shipId);
      const ship = ships.find(s => s.id === shipId);
      if (ship) {
        setSelectedShip(ship);
        setSelectedShipFromBoard(ship);
        setOrientation(detectShipOrientation(ship.id));
      }
    } else if (selectedShip) {
      placeShip();
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

  // Update the board in Firestore when a ship is placed
  const updateBoard = async () => {
    try {
      // Skip Firestore update for single player mode (AI games)
      if (gameId.startsWith('ai_')) {
        console.log('Single player mode - skipping Firestore update');
        return flatBoard;
      }

      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.board`]: flatBoard
      });
      console.log('Board updated in Firestore');
      return flatBoard;
    } catch (error) {
      console.error('Error updating board:', error);
      return flatBoard;
    }
  };

  // Mark the player as ready
  const setPlayerReady = async () => {
    // Ensure all ships are placed before finishing
    if (ships.some(ship => !ship.placed)) {
      console.warn('Attempted to finish placement before all ships were placed.');
      return; // Or show an error message to the user
    }

    // Convert the final flat board back to a grid
    const finalBoardGrid = convertToGrid(flatBoard);
    console.log('[ShipPlacement] Finishing placement. Final board:', finalBoardGrid);

    // Skip Firestore update for single player mode (AI games)
    if (gameId.startsWith('ai_')) {
      console.log('Single player mode - skipping player ready update, calling onFinishPlacement');
      onFinishPlacement(finalBoardGrid); // Pass the final board state
      return;
    }

    // Multiplayer logic
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.ready`]: true,
        [`players.${playerId}.board`]: flatBoard // Firestore uses the flat board
      });
      // Pass the GRID, not the flat array, to the callback
      onFinishPlacement(finalBoardGrid); 
    } catch (error) {
      console.error('Error marking player as ready:', error);
    }
  };

  const handleRandomPlacement = async () => {
    // Reset all ships to unplaced state
    let randomizedShips = ships.map(ship => ({ ...ship, placed: false }));
    setShips(randomizedShips);
    
    // Clear the board
    let randomBoard = flatBoard.map(cell => ({ 
      ...cell, 
      hasShip: false, 
      shipId: null, 
      shipType: null 
    }));
    setFlatBoard(randomBoard);
    
    // Randomly place each ship
    for (const ship of randomizedShips) {
      let placed = false;
      let maxAttempts = 100;
      let attempts = 0;
      
      while (!placed && attempts < maxAttempts) {
        attempts++;
        
        // Randomly select orientation
        const randomOrientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
        
        // Randomly select a valid starting position
        let randomX = 0;
        let randomY = 0;
        
        if (randomOrientation === 'horizontal') {
          randomX = Math.floor(Math.random() * (10 - ship.size + 1));
          randomY = Math.floor(Math.random() * 10);
        } else {
          randomX = Math.floor(Math.random() * 10);
          randomY = Math.floor(Math.random() * (10 - ship.size + 1));
        }
        
        // Check if this is a valid placement
        let valid = true;
        
        if (randomOrientation === 'horizontal') {
          for (let i = 0; i < ship.size; i++) {
            const cellExists = randomBoard.some(
              cell => cell.x === randomX + i && cell.y === randomY && cell.hasShip
            );
            if (cellExists) {
              valid = false;
              break;
            }
          }
          
          if (valid) {
            // Place the ship
            for (let i = 0; i < ship.size; i++) {
              const index = randomBoard.findIndex(
                cell => cell.x === randomX + i && cell.y === randomY
              );
              if (index !== -1) {
                randomBoard[index] = { 
                  ...randomBoard[index], 
                  hasShip: true,
                  shipId: ship.id.toString(),
                  shipType: ship.type
                };
              }
            }
            placed = true;
          }
        } else {
          for (let i = 0; i < ship.size; i++) {
            const cellExists = randomBoard.some(
              cell => cell.x === randomX && cell.y === randomY + i && cell.hasShip
            );
            if (cellExists) {
              valid = false;
              break;
            }
          }
          
          if (valid) {
            // Place the ship
            for (let i = 0; i < ship.size; i++) {
              const index = randomBoard.findIndex(
                cell => cell.x === randomX && cell.y === randomY + i
              );
              if (index !== -1) {
                randomBoard[index] = { 
                  ...randomBoard[index], 
                  hasShip: true,
                  shipId: ship.id.toString(),
                  shipType: ship.type
                };
              }
            }
            placed = true;
          }
        }
      }
      
      if (!placed) {
        console.error(`Could not place ship ${ship.id} after ${maxAttempts} attempts`);
      }
    }
    
    // Mark all ships as placed
    randomizedShips = randomizedShips.map(ship => ({ ...ship, placed: true }));
    setShips(randomizedShips);
    
    // Update the board
    setFlatBoard(randomBoard);
    
    // Update Firestore
    await updateBoard();
    
    // Mark the player as ready
    setPlayerReady();
  };

  const allShipsPlaced = ships.every(ship => ship.placed);

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white">
      <h2 className="text-xl font-bold mb-4">Placera dina skepp</h2>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-wrap gap-2">
            {ships.map(ship => (
              <button
                key={ship.id}
                onClick={() => handleSelectShip(ship)}
                className={`p-2 border ${
                  selectedShip?.id === ship.id || selectedShipFromBoard?.id === ship.id
                    ? 'border-[#8bb8a8] bg-[#e9f5f1] ring-2 ring-[#8bb8a8]'
                    : 'border-gray-300 bg-white'
                } ${ship.placed ? 'text-gray-500' : 'text-black'}`}
                disabled={!ship.placed && allShipsPlaced}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-${Math.min(ship.size * 2, 10)} h-3 ${ship.type}-color`}
                    style={{ width: `${Math.min(ship.size * 10, 50)}px` }}
                  ></div>
                  <span>{getShipInfo(ship.type || '').name}</span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
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
        </div>
        
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="p-4 bg-white border border-gray-200">
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
                      cellClass += ' ring-4 ring-[#8bb8a8] ring-inset';
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
                      onClick={() => handleBoardCellClick({ x: colIndex, y: rowIndex, isHit: false, hasShip: hasShip || false, shipId: shipId || null, shipType: shipType || null })}
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
        </div>
      </div>
      
      <div className="flex justify-between mt-6">
        <button
          onClick={handleRandomPlacement}
          className="bg-[#8bb8a8] text-white px-4 py-2 rounded"
        >
          Placera slumpmässigt
        </button>
        
        {allShipsPlaced && (
          <button
            onClick={() => setPlayerReady()}
            className="bg-[#8bb8a8] text-white px-4 py-2 rounded"
          >
            Jag är klar
          </button>
        )}
      </div>
    </div>
  );
};

export default ShipPlacement; 