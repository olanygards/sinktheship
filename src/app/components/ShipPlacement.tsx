'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { Cell, Ship as ShipType } from '../../utils/types';
import ShipStatus from './ShipStatus';
import GameBoard from './GameBoard';

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

interface Position {
  x: number;
  y: number;
}

type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

interface ShipInfo {
  size: number;
  name: string;
  type: ShipKind;
}

// Update Cell type to include shipType as a nullable field
interface ExtendedCell extends Omit<Cell, 'shipType'> {
  shipType: ShipKind | undefined;
}

interface Ship {
  type: ShipKind;
  size: number;
  placed: boolean;
  name: string;
}

const SHIP_TYPES: Record<ShipKind, Ship> = {
  carrier: { type: 'carrier', size: 5, placed: false, name: 'Carrier' },
  battleship: { type: 'battleship', size: 4, placed: false, name: 'Battleship' },
  cruiser: { type: 'cruiser', size: 3, placed: false, name: 'Cruiser' },
  submarine: { type: 'submarine', size: 3, placed: false, name: 'Submarine' },
  destroyer: { type: 'destroyer', size: 2, placed: false, name: 'Destroyer' }
};

const ShipPlacement: React.FC<ShipPlacementProps> = ({
  gameId, 
  playerId, 
  board: initialBoard, 
  onFinishPlacement
}) => {
  const [board, setBoard] = useState<ExtendedCell[][]>(initialBoard.map(row => 
    row.map(cell => ({ ...cell, shipType: undefined }))
  ));
  const [selectedShip, setSelectedShip] = useState<ShipInfo | null>(null);
  const [placedShips, setPlacedShips] = useState<Set<ShipKind>>(new Set());
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);
  const [error, setError] = useState<string>('');

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

  // Automatically select the first unplaced ship when component loads
  useEffect(() => {
    const firstUnplacedShip = Object.values(SHIP_TYPES).find(ship => !placedShips.has(ship.type));
    if (firstUnplacedShip && !selectedShip) {
      setSelectedShip(firstUnplacedShip);
    }
  }, [placedShips, selectedShip]);

  const rotateShip = () => {
    if (selectedShip) {
      setIsHorizontal(!isHorizontal);
    }
  };

  const handleCellHover = (x: number, y: number) => {
    setHoveredCell({ x, y });
  };

  const isValidPlacement = (x: number, y: number, ship: ShipInfo, horizontal: boolean): boolean => {
    if (horizontal) {
      if (x + ship.size > 10) return false;
      for (let i = 0; i < ship.size; i++) {
        if (board[y][x + i].hasShip) return false;
        // Check adjacent cells
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const newY = y + dy;
            const newX = x + i + dx;
            if (
              newY >= 0 && newY < 10 &&
              newX >= 0 && newX < 10 &&
              board[newY][newX].hasShip
            ) {
              return false;
            }
          }
        }
      }
    } else {
      if (y + ship.size > 10) return false;
      for (let i = 0; i < ship.size; i++) {
        if (board[y + i][x].hasShip) return false;
        // Check adjacent cells
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const newY = y + i + dy;
            const newX = x + dx;
            if (
              newY >= 0 && newY < 10 &&
              newX >= 0 && newX < 10 &&
              board[newY][newX].hasShip
            ) {
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  const placeShip = async (x: number, y: number) => {
    if (!selectedShip) return;
    
    if (!isValidPlacement(x, y, selectedShip, isHorizontal)) {
      setError('Ogiltig placering. Försök igen.');
      return;
    }

    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    
    if (isHorizontal) {
      for (let i = 0; i < selectedShip.size; i++) {
        newBoard[y][x + i] = {
          ...newBoard[y][x + i],
          hasShip: true,
          shipType: selectedShip.type
        };
      }
    } else {
      for (let i = 0; i < selectedShip.size; i++) {
        newBoard[y + i][x] = {
          ...newBoard[y + i][x],
          hasShip: true,
          shipType: selectedShip.type
        };
      }
    }

    setBoard(newBoard);
    setPlacedShips(new Set([...placedShips, selectedShip.type]));
    setSelectedShip(null);
    setError('');

    // If all ships are placed, update the game state
    if (placedShips.size === 4) { // After placing the last ship
      try {
        if (gameId !== 'ai_game') {
          const gameRef = doc(db, 'games', gameId);
          await updateDoc(gameRef, {
            [`players.${playerId}.board`]: newBoard.flat(),
            [`players.${playerId}.ready`]: true
          });
        }
        // Convert the board to match the expected Cell type
        const finalBoard = newBoard.map(row => 
          row.map(cell => ({
            ...cell,
            shipType: cell.shipType || undefined
          }))
        );
        onFinishPlacement(finalBoard);
      } catch (error) {
        console.error('Error updating game state:', error);
        setError('Ett fel uppstod. Försök igen.');
      }
    }
  };

  const getPreviewCells = (): Position[] => {
    if (!selectedShip || !hoveredCell) return [];
    
    const cells: Position[] = [];
    
    if (isHorizontal) {
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

  const previewCells = hoveredCell ? getPreviewCells() : [];
  const isValidPreview = hoveredCell && selectedShip ? 
    isValidPlacement(hoveredCell.x, hoveredCell.y, selectedShip, isHorizontal) : 
    false;

  // Update the availableShips state when a ship is placed
  useEffect(() => {
    const updatedShips = { ...availableShips };
    Object.values(SHIP_TYPES).forEach(ship => {
      if (placedShips.has(ship.type)) {
        if (ship.size === 5) updatedShips.carrier.sunk = true;
        else if (ship.size === 4) updatedShips.battleship.sunk = true;
        else if (ship.size === 3 && !updatedShips.cruiser.sunk) updatedShips.cruiser.sunk = true;
        else if (ship.size === 3) updatedShips.submarine.sunk = true;
        else if (ship.size === 2) updatedShips.destroyer.sunk = true;
      }
    });
    setAvailableShips(updatedShips);
  }, [placedShips]);

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
        return { letter: 'A', color: 'carrier-color', name: 'Carrier (5)' };
      case 'battleship':
        return { letter: 'B', color: 'battleship-color', name: 'Battleship (4)' };
      case 'cruiser':
        return { letter: 'C', color: 'cruiser-color', name: 'Cruiser (3)' };
      case 'submarine':
        return { letter: 'S', color: 'submarine-color', name: 'Submarine (3)' };
      case 'destroyer':
        return { letter: 'D', color: 'destroyer-color', name: 'Destroyer (2)' };
      default:
        return { letter: '?', color: 'unknown-color', name: 'Unknown' };
    }
  };

  // Render ship visualization
  const renderShipIcons = (ship: ShipInfo) => {
    const { letter, color } = getShipInfo(ship.type);
    const icons: JSX.Element[] = [];
    
    for (let i = 0; i < ship.size; i++) {
      icons.push(
        <div 
          key={i} 
          className={`ship-square ${color}`}
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
  const detectShipOrientation = (shipId: string) => {
    const shipCells = board.flat().filter(cell => cell.shipType === shipId);
    console.log(`Found ${shipCells.length} cells for ship ${shipId} when detecting orientation`);
    if (shipCells.length < 2) return 'horizontal'; // Default
    
    // Check if all cells have same y (horizontal) or x (vertical)
    const sameY = shipCells.every(cell => cell.y === shipCells[0].y);
    return sameY ? 'horizontal' : 'vertical';
  };

  // Modify handleSelectShip to handle both button and board selection
  const handleSelectShip = (ship: ShipInfo) => {
    setSelectedShip(ship);
    setSelectedShipFromBoard(null);
    
    // If ship is already placed, detect its orientation
    if (placedShips.has(ship.type)) {
      const shipCells = board.flat().filter(cell => cell.shipType === ship.type);
      console.log(`Selected ship ${ship.type}, found ${shipCells.length} cells`);
      setIsHorizontal(detectShipOrientation(ship.type) === 'horizontal');
    }
  };

  // Add new function to handle board cell click for ship selection
  const handleBoardCellClick = (cell: ExtendedCell) => {
    if (cell.hasShip && cell.shipType) {
      const ship = SHIP_TYPES[cell.shipType];
      if (ship) {
        setSelectedShip(ship);
        setSelectedShipFromBoard(null);
        setIsHorizontal(detectShipOrientation(cell.shipType) === 'horizontal');
      }
    } else if (selectedShip) {
      placeShip(cell.x, cell.y);
    }
  };

  // Reset function to clear duplicate ships
  const resetShips = async () => {
    // First identify all ships that have cells on the board
    const shipIdsOnBoard = new Set<ShipKind>();
    board.flat().forEach(cell => {
      if (cell.hasShip && cell.shipType) {
        shipIdsOnBoard.add(cell.shipType);
      }
    });
    
    console.log('Ship IDs on board:', Array.from(shipIdsOnBoard));
    console.log('Ships in state:', Object.values(SHIP_TYPES).map(s => `${s.type}:${placedShips.has(s.type)}`).join(', '));
    
    // Create a new board with all ships removed
    const clearedBoard = board.map(row => row.map(cell => ({
      ...cell,
      hasShip: false,
      shipType: undefined
    })));
    
    // Reset all ships to unplaced
    const resetShipsArray = Object.values(SHIP_TYPES).map(ship => ({
      ...ship,
      placed: false
    }));
    
    setBoard(clearedBoard);
    setPlacedShips(new Set());
    
    // Update Firestore
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.board`]: clearedBoard.flat()
      });
    } catch (error) {
      console.error('Error resetting board:', error);
      setError('Ett fel uppstod när brädet skulle återställas.');
    }
  };

  // Update the board in Firestore when a ship is placed
  const updateBoard = async () => {
    try {
      // Skip Firestore update for single player mode (AI games)
      if (gameId.startsWith('ai_')) {
        console.log('Single player mode - skipping Firestore update');
        return board.flat();
      }

      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${playerId}.board`]: board.flat()
      });
      console.log('Board updated in Firestore');
      return board.flat();
    } catch (error) {
      console.error('Error updating board:', error);
      return board.flat();
    }
  };

  // Mark the player as ready
  const setPlayerReady = async () => {
    // Ensure all ships are placed before finishing
    if (Object.values(SHIP_TYPES).some(ship => !placedShips.has(ship.type))) {
      console.warn('Attempted to finish placement before all ships were placed.');
      return; // Or show an error message to the user
    }

    // Convert the final flat board back to a grid
    const finalBoardGrid = convertToGrid(board.flat());
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
        [`players.${playerId}.board`]: board.flat() // Firestore uses the flat board
      });
      // Pass the GRID, not the flat array, to the callback
      onFinishPlacement(finalBoardGrid); 
    } catch (error) {
      console.error('Error marking player as ready:', error);
    }
  };

  const handleRandomPlacement = async () => {
    try {
      // Reset board and ships
      const newBoard = Array(BOARD_SIZE).fill(null).map((_, y) =>
        Array(BOARD_SIZE).fill(null).map((_, x) => ({
          x,
          y,
          isHit: false,
          hasShip: false,
          shipType: undefined as ShipKind | undefined
        }))
      );
      
      const newShips = { ...SHIP_TYPES };
      const newPlacedShips = new Set<ShipKind>();
      
      // Try to place each ship
      for (const ship of Object.values(newShips)) {
        let placed = false;
        let attempts = 0;
        const maxAttempts = 500;
        
        while (!placed && attempts < maxAttempts) {
          const x = Math.floor(Math.random() * BOARD_SIZE);
          const y = Math.floor(Math.random() * BOARD_SIZE);
          const isHorizontal = Math.random() > 0.5;
          
          if (isValidRandomPlacement(newBoard, x, y, ship, isHorizontal)) {
            // Place the ship
            for (let i = 0; i < ship.size; i++) {
              const cellX = isHorizontal ? x + i : x;
              const cellY = isHorizontal ? y : y + i;
              if (cellX < BOARD_SIZE && cellY < BOARD_SIZE) {
                newBoard[cellY][cellX] = {
                  ...newBoard[cellY][cellX],
                  hasShip: true,
                  shipType: ship.type as ShipKind
                };
              }
            }
            placed = true;
            newPlacedShips.add(ship.type);
          }
          attempts++;
        }
        
        // If we couldn't place the ship with standard rules, try with simpler rules
        if (!placed) {
          console.warn(`Could not place ${ship.type} with standard rules, trying simpler rules`);
          attempts = 0;
          
          while (!placed && attempts < maxAttempts) {
            const x = Math.floor(Math.random() * BOARD_SIZE);
            const y = Math.floor(Math.random() * BOARD_SIZE);
            const isHorizontal = Math.random() > 0.5;
            
            if (isValidRandomPlacementSimple(newBoard, x, y, ship, isHorizontal)) {
              // Place the ship
              for (let i = 0; i < ship.size; i++) {
                const cellX = isHorizontal ? x + i : x;
                const cellY = isHorizontal ? y : y + i;
                if (cellX < BOARD_SIZE && cellY < BOARD_SIZE) {
                  newBoard[cellY][cellX] = {
                    ...newBoard[cellY][cellX],
                    hasShip: true,
                    shipType: ship.type as ShipKind
                  };
                }
              }
              placed = true;
              newPlacedShips.add(ship.type);
            }
            attempts++;
          }
        }
      }
      
      // Update the board state
      setBoard(newBoard);
      setPlacedShips(newPlacedShips);
      
      // Update Firestore
      if (!isSinglePlayer) {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
          [`boards.${playerId}`]: newBoard.map(row => 
            row.map(cell => ({
              x: cell.x,
              y: cell.y,
              isHit: cell.isHit,
              hasShip: cell.hasShip,
              shipType: cell.shipType || undefined
            }))
          )
        });
      }
      
      // Mark player as ready
      setPlayerReady();
      
    } catch (error) {
      console.error('Error during random placement:', error);
      setError('Ett fel uppstod vid slumpmässig placering av skepp');
    }
  };

  const allShipsPlaced = Object.values(SHIP_TYPES).every(ship => placedShips.has(ship.type));

  const [isSinglePlayer, setIsSinglePlayer] = useState(false);
  const [ships, setShips] = useState<Record<ShipKind, Ship>>(SHIP_TYPES);

  const isValidRandomPlacement = (board: Cell[][], x: number, y: number, ship: Ship, isHorizontal: boolean): boolean => {
    // Check if ship extends beyond the board
    if (isHorizontal && x + ship.size > BOARD_SIZE) return false;
    if (!isHorizontal && y + ship.size > BOARD_SIZE) return false;
    
    for (let i = 0; i < ship.size; i++) {
      const checkX = isHorizontal ? x + i : x;
      const checkY = isHorizontal ? y : y + i;
      
      // Check if the cell itself has a ship
      if (board[checkY][checkX].hasShip) return false;
      
      // Check for adjacent ships (horizontal, vertical, and diagonal)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          // Skip the cell itself (dx=0, dy=0)
          if (dx === 0 && dy === 0) continue;
          
          const adjacentX = checkX + dx;
          const adjacentY = checkY + dy;
          
          // Check if position is valid on the board
          if (adjacentX >= 0 && adjacentX < BOARD_SIZE && adjacentY >= 0 && adjacentY < BOARD_SIZE) {
            // Check if there's a ship at this position
            if (board[adjacentY][adjacentX].hasShip) return false;
          }
        }
      }
    }
    
    return true;
  };

  const isValidRandomPlacementSimple = (board: Cell[][], x: number, y: number, ship: Ship, isHorizontal: boolean): boolean => {
    if (isHorizontal && x + ship.size > BOARD_SIZE) return false;
    if (!isHorizontal && y + ship.size > BOARD_SIZE) return false;
    
    for (let i = 0; i < ship.size; i++) {
      const checkX = isHorizontal ? x + i : x;
      const checkY = isHorizontal ? y : y + i;
      
      // Check if the cell itself has a ship
      if (board[checkY][checkX].hasShip) return false;
    }
    
    return true;
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Placera dina skepp</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}
      
      <div className="mb-6">
        <div className="flex flex-wrap gap-3 mb-4 justify-start">
          {Object.values(SHIP_TYPES).map((ship) => (
            <button
              key={ship.type}
              onClick={() => handleSelectShip(ship)}
              className={`p-1 ${
                placedShips.has(ship.type)
                  ? 'bg-gray-300 cursor-not-allowed'
                  : selectedShip?.type === ship.type
                  ? 'bg-[#8bb8a8] text-white'
                  : 'bg-white border border-[#8bb8a8] text-[#8bb8a8] hover:bg-[#8bb8a8] hover:text-white'
              }`}
              disabled={placedShips.has(ship.type) || allShipsPlaced}
            >
              <div className="flex gap-[4px] bg-black p-1 rounded-md">
                {renderShipIcons(ship)}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-[var(--primary)]">Rotera skepp</span>
            <button 
              className="p-2 bg-[var(--board-background)] flex items-center justify-center transition-all rounded-[5px]"
              onClick={rotateShip}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--primary)] flex items-center justify-center">
                  {isHorizontal ? (
                    <div className="w-6 h-2 bg-white"></div>
                  ) : (
                    <div className="w-2 h-6 bg-white"></div>
                  )}
                </div>
                <div className="flex flex-col">
                  <img 
                    src="/images/rotate-icon.svg" 
                    alt="Rotate Ship" 
                    className="h-6 w-6 text-[var(--primary)]"
                  />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between mt-6">
        <button
          onClick={handleRandomPlacement}
          className="btn-primary rounded-[5px]"
        >
          Placera slumpmässigt
        </button>
        
        {allShipsPlaced && (
          <button
            onClick={() => setPlayerReady()}
            className="btn-primary rounded-[5px]"
          >
            Jag är klar
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-4 justify-center">
        <div className="p-4 bg-white rounded-[5px]">
          <div className="grid grid-cols-10 gap-0 border border-[var(--grid-line)] overflow-hidden rounded-[5px]">
            {board.map((row, rowIndex) => 
              row.map((cell, colIndex) => {
                const isHovered = previewCells.some(c => c.x === colIndex && c.y === rowIndex);
                const hasShip = board.flat().find(c => c.x === colIndex && c.y === rowIndex)?.hasShip;
                const shipType = board.flat().find(c => c.x === colIndex && c.y === rowIndex)?.shipType;
                const isSelectedShipCell = selectedShip && shipType === selectedShip.type;
                
                let cellClass = 'board-cell';
                if (hasShip && shipType) {
                  cellClass += ` ${shipType}-color`;
                  if (isSelectedShipCell) {
                    cellClass += ' ring-2 ring-[var(--primary)] ring-inset';
                  }
                } else if (isHovered) {
                  cellClass += isValidPreview ? ' bg-green-100' : ' bg-red-100';
                } else {
                  cellClass += ' board-cell-water';
                }
                
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={cellClass}
                    onMouseEnter={() => handleCellHover(colIndex, rowIndex)}
                    onClick={() => handleBoardCellClick({ x: colIndex, y: rowIndex, isHit: false, hasShip: hasShip || false, shipType: shipType || undefined })}
                  >
                    {hasShip && shipType && (
                      <div 
                        className="w-full h-full flex items-center justify-center text-white font-bold"
                      >
                        {renderShipIcons(SHIP_TYPES[shipType])}
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
  );
};

export default ShipPlacement; 