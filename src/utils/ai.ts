import { Cell, Ship } from './types';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Ship types and their sizes for easier reference
export const SHIP_SIZES = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2
};

interface AIConfig {
  difficulty: Difficulty;
  boardSize: number;
}

export class BattleshipAI {
  private config: AIConfig;
  private lastHit: { x: number; y: number } | null = null;
  private hitDirection: 'horizontal' | 'vertical' | null = null;
  private potentialTargets: { x: number; y: number }[] = [];
  private board: Cell[][] = [];
  private hitChain: { x: number; y: number }[] = []; // Track consecutive hits
  private sunkShips: Set<string> = new Set(); // Track which ship types have been sunk

  constructor(config: AIConfig) {
    this.config = config;
    this.initializeBoard();
  }

  private initializeBoard() {
    this.board = Array(this.config.boardSize).fill(null).map(() => 
      Array(this.config.boardSize).fill(null).map((_, x) => ({
        x,
        y: 0,
        isHit: false,
        hasShip: false
      }))
    );
  }

  public placeShips(): Cell[][] {
    const ships: Omit<Ship, 'id' | 'placed'>[] = [
      { type: 'carrier', size: 5 },
      { type: 'battleship', size: 4 },
      { type: 'cruiser', size: 3 },
      { type: 'submarine', size: 3 },
      { type: 'destroyer', size: 2 }
    ];

    try {
      // För hard difficulty, använd smart placering
      if (this.config.difficulty === 'hard') {
        return this.placeShipsStrategically(ships);
      }
  
      // För andra svårighetsgrader, använd slumpmässig placering
      const board = this.createEmptyBoard();
      
      // Med de nya reglerna behöver vi fler försök per skepp
      const maxAttemptsPerShip = 500;
      
      for (const ship of ships) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < maxAttemptsPerShip) {
          attempts++;
          
          const isHorizontal = Math.random() > 0.5;
          const x = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? ship.size : 0)));
          const y = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? 0 : ship.size)));
  
          if (this.canPlaceShip(board, x, y, ship.size, isHorizontal)) {
            this.placeShip(board, x, y, ship.size, isHorizontal, ship.type);
            placed = true;
          }
        }
        
        // Om vi inte kunde placera skeppet, försök med enklare regler
        if (!placed) {
          console.warn(`Could not place ship ${ship.type} after ${maxAttemptsPerShip} attempts, trying with simplified rules`);
          attempts = 0;
          
          // Använd enklare regler (tillåt placering intill, men inte överlappande)
          while (!placed && attempts < maxAttemptsPerShip) {
            attempts++;
            
            const isHorizontal = Math.random() > 0.5;
            const x = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? ship.size : 0)));
            const y = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? 0 : ship.size)));
            
            // Enklare placeringscheck - bara kollar överlappning, inte intilliggande skepp
            if (this.canPlaceShipSimple(board, x, y, ship.size, isHorizontal)) {
              this.placeShip(board, x, y, ship.size, isHorizontal, ship.type);
              placed = true;
            }
          }
          
          if (!placed) {
            console.error(`Failed to place ship ${ship.type} even with simplified rules`);
            // Fortsätt ändå - nästa skepp kanske kan placeras
          }
        }
      }
  
      return board;
    } catch (error) {
      console.error('Error in placeShips:', error);
      // Om något går fel, returnera en tom spelplan istället för att krascha
      return this.createEmptyBoard();
    }
  }
  
  // En förenklad version av canPlaceShip som bara kontrollerar överlappning, inte intilliggande skepp
  private canPlaceShipSimple(board: Cell[][], x: number, y: number, size: number, isHorizontal: boolean): boolean {
    for (let i = 0; i < size; i++) {
      const checkX = isHorizontal ? x + i : x;
      const checkY = isHorizontal ? y : y + i;
      
      if (checkX >= this.config.boardSize || checkY >= this.config.boardSize) return false;
      if (board[checkY][checkX].hasShip) return false;
    }
    return true;
  }

  // Strategic ship placement for hard difficulty
  private placeShipsStrategically(ships: Omit<Ship, 'id' | 'placed'>[]): Cell[][] {
    const board = this.createEmptyBoard();
    
    // Start with placing larger ships near edges but not exactly at edges
    const largeShips = [...ships].sort((a, b) => b.size - a.size);
    
    // Öka antal försök för att hantera mer begränsande regler
    const maxAttemptsPerShip = 500; 
    
    for (const ship of largeShips) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < maxAttemptsPerShip) {
        attempts++;
        
        // Bias toward edges but not corners
        let isHorizontal = Math.random() > 0.5;
        let x, y;
        
        if (Math.random() > 0.7) {
          // Place near edges
          if (isHorizontal) {
            // Avoid placing horizontally at the very edge
            x = 1 + Math.floor(Math.random() * (this.config.boardSize - ship.size - 2));
            // But bias toward top or bottom
            y = Math.random() > 0.5 ? 1 : this.config.boardSize - 2;
          } else {
            // Vertical placement near left or right edge
            x = Math.random() > 0.5 ? 1 : this.config.boardSize - 2;
            y = 1 + Math.floor(Math.random() * (this.config.boardSize - ship.size - 2));
          }
        } else {
          // Otherwise place somewhat randomly but avoid corners
          x = 1 + Math.floor(Math.random() * (this.config.boardSize - ship.size - 2));
          y = 1 + Math.floor(Math.random() * (this.config.boardSize - ship.size - 2));
          
          // Try to avoid placing ships parallel to each other
          const existingShipDirection = this.detectExistingShipDirection(board);
          if (existingShipDirection === 'horizontal') {
            isHorizontal = Math.random() > 0.7; // Bias toward vertical
          } else if (existingShipDirection === 'vertical') {
            isHorizontal = Math.random() < 0.7; // Bias toward horizontal
          }
        }
        
        if (this.canPlaceShip(board, x, y, ship.size, isHorizontal)) {
          this.placeShip(board, x, y, ship.size, isHorizontal, ship.type);
          placed = true;
        }
      }
      
      // Om vi inte kunde placera skeppet strategiskt, försök med enklare regler
      if (!placed) {
        console.warn(`Could not place ship ${ship.type} strategically, trying with simplified rules`);
        attempts = 0;
        
        // Försök med enklare placeringsregler (tillåt intill-placering)
        while (!placed && attempts < maxAttemptsPerShip) {
          attempts++;
          
          const isHorizontal = Math.random() > 0.5;
          const x = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? ship.size : 0)));
          const y = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? 0 : ship.size)));
          
          if (this.canPlaceShipSimple(board, x, y, ship.size, isHorizontal)) {
            this.placeShip(board, x, y, ship.size, isHorizontal, ship.type);
            placed = true;
          }
        }
        
        if (!placed) {
          console.error(`Failed to place ship ${ship.type} even with simplified rules`);
          // Fortsätt ändå - nästa skepp kanske kan placeras
        }
      }
    }
    
    return board;
  }

  // Detect if existing ships have a dominant orientation
  private detectExistingShipDirection(board: Cell[][]): 'horizontal' | 'vertical' | 'none' {
    let horizontalCount = 0;
    let verticalCount = 0;
    
    // Count horizontal and vertical ships
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (board[y][x].hasShip) {
          // Check horizontal ship
          if (x < this.config.boardSize - 1 && board[y][x + 1].hasShip) {
            horizontalCount++;
          }
          // Check vertical ship
          if (y < this.config.boardSize - 1 && board[y + 1][x].hasShip) {
            verticalCount++;
          }
        }
      }
    }
    
    if (horizontalCount > verticalCount * 1.5) {
      return 'horizontal';
    } else if (verticalCount > horizontalCount * 1.5) {
      return 'vertical';
    } else {
      return 'none';
    }
  }

  private createEmptyBoard(): Cell[][] {
    return Array(this.config.boardSize).fill(null).map((_, y) => 
      Array(this.config.boardSize).fill(null).map((_, x) => ({
        x,
        y,
        isHit: false,
        hasShip: false
      }))
    );
  }

  private canPlaceShip(board: Cell[][], x: number, y: number, size: number, isHorizontal: boolean): boolean {
    for (let i = 0; i < size; i++) {
      const checkX = isHorizontal ? x + i : x;
      const checkY = isHorizontal ? y : y + i;
      
      if (checkX >= this.config.boardSize || checkY >= this.config.boardSize) return false;
      if (board[checkY][checkX].hasShip) return false;
      
      // Check surrounding cells - Expanded to verify no ships are adjacent (including diagonally)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = checkX + dx;
          const ny = checkY + dy;
          
          // Skip checking the cell itself (dx=0, dy=0)
          if (dx === 0 && dy === 0) continue;
          
          if (nx >= 0 && nx < this.config.boardSize && ny >= 0 && ny < this.config.boardSize) {
            if (board[ny][nx].hasShip) return false;
          }
        }
      }
    }
    return true;
  }

  private placeShip(board: Cell[][], x: number, y: number, size: number, isHorizontal: boolean, shipType: Ship['type']) {
    for (let i = 0; i < size; i++) {
      const placeX = isHorizontal ? x + i : x;
      const placeY = isHorizontal ? y : y + i;
      board[placeY][placeX] = {
        ...board[placeY][placeX],
        hasShip: true,
        shipType,
        shipId: `${shipType}-${x}-${y}`
      };
    }
  }

  public makeMove(opponentBoard: Cell[][]): { x: number; y: number } {
    // For hard mode's first few moves, bias slightly toward center
    if (this.config.difficulty === 'hard' && 
        this.countHits(opponentBoard) < 5 && 
        Math.random() < 0.35) {
      // Get a move biased toward the center portion of the board
      return this.makeCenterBiasedMove(opponentBoard);
    }
    
    switch (this.config.difficulty) {
      case 'easy':
        return this.makeRandomMove(opponentBoard);
      case 'medium':
        return this.makeSmartMove(opponentBoard);
      case 'hard':
        return this.makeAdvancedMove(opponentBoard);
      default:
        return this.makeRandomMove(opponentBoard);
    }
  }

  private makeRandomMove(opponentBoard: Cell[][]): { x: number; y: number } {
    const availableMoves: { x: number; y: number }[] = [];
    
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit) {
          // For hard difficulty, skip cells adjacent to sunk ships
          if (this.config.difficulty === 'hard' && this.isAdjacentToSunkShip(opponentBoard, x, y)) {
            continue;
          }
          availableMoves.push({ x, y });
        }
      }
    }
    
    // If no valid moves available (shouldn't happen in normal gameplay), return a fallback move
    if (availableMoves.length === 0) {
      for (let y = 0; y < this.config.boardSize; y++) {
        for (let x = 0; x < this.config.boardSize; x++) {
          if (!opponentBoard[y][x].isHit) {
            availableMoves.push({ x, y });
          }
        }
      }
    }
    
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }

  private makeSmartMove(opponentBoard: Cell[][]): { x: number; y: number } {
    // If we have 2+ hits in our chain, use that to determine direction and next move
    if (this.hitChain.length >= 2) {
      // Determine direction from the first two hits
      const first = this.hitChain[0];
      const second = this.hitChain[1];
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      
      if (dx !== 0) {
        this.hitDirection = 'horizontal';
      } else if (dy !== 0) {
        this.hitDirection = 'vertical';
      }
      
      // Try continuing in the same direction from the last hit
      const lastInChain = this.hitChain[this.hitChain.length - 1];
      const nextForward = {
        x: lastInChain.x + (this.hitDirection === 'horizontal' ? Math.sign(dx) : 0),
        y: lastInChain.y + (this.hitDirection === 'vertical' ? Math.sign(dy) : 0)
      };
      
      // Check if next position is valid, not already hit, and not adjacent to a sunk ship
      if (this.isValidPosition(nextForward.x, nextForward.y) && 
          !opponentBoard[nextForward.y][nextForward.x].isHit &&
          (this.config.difficulty !== 'hard' || !this.isAdjacentToSunkShip(opponentBoard, nextForward.x, nextForward.y))) {
        return nextForward;
      }
      
      // If forward direction is blocked, try the opposite direction from the first hit
      const nextBackward = {
        x: first.x - (this.hitDirection === 'horizontal' ? Math.sign(dx) : 0),
        y: first.y - (this.hitDirection === 'vertical' ? Math.sign(dy) : 0)
      };
      
      if (this.isValidPosition(nextBackward.x, nextBackward.y) && 
          !opponentBoard[nextBackward.y][nextBackward.x].isHit &&
          (this.config.difficulty !== 'hard' || !this.isAdjacentToSunkShip(opponentBoard, nextBackward.x, nextBackward.y))) {
        return nextBackward;
      }
      
      // If both ends are blocked, the ship might be fully hit but not registered as sunk yet
      // (This situation should be rare in actual gameplay)
    }
    
    // If we have a single hit but no direction, try adjacent cells
    if (this.hitChain.length === 1) {
      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ];
      
      // Shuffle directions for more varied gameplay
      for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
      }
      
      for (const dir of directions) {
        const x = this.hitChain[0].x + dir.x;
        const y = this.hitChain[0].y + dir.y;
        
        if (this.isValidPosition(x, y) && !opponentBoard[y][x].isHit &&
            (this.config.difficulty !== 'hard' || !this.isAdjacentToSunkShip(opponentBoard, x, y))) {
          return { x, y };
        }
      }
    }
    
    // If no hit chain or all targeted positions are invalid, make a random move
    if (this.config.difficulty === 'hard') {
      // For hard difficulty, use the probabilistic approach to pick a random move
      const availableMoves: { x: number; y: number }[] = [];
      
      for (let y = 0; y < this.config.boardSize; y++) {
        for (let x = 0; x < this.config.boardSize; x++) {
          if (!opponentBoard[y][x].isHit && !this.isAdjacentToSunkShip(opponentBoard, x, y)) {
            availableMoves.push({ x, y });
          }
        }
      }
      
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    } else {
      // For medium difficulty, just make a random move
      return this.makeRandomMove(opponentBoard);
    }
  }

  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.config.boardSize && y >= 0 && y < this.config.boardSize;
  }

  private makeAdvancedMove(opponentBoard: Cell[][]): { x: number; y: number } {
    // First, check if we have a hit chain to follow (prioritize ongoing ship targeting)
    if (this.hitChain.length >= 1) {
      // Use the same smart logic as medium difficulty, but with better heuristics
      const smartMove = this.makeSmartMove(opponentBoard);
      
      // If the smart move is valid, 80% chance to use it
      // This adds some unpredictability for hard mode
      if (Math.random() < 0.8) {
        return smartMove;
      }
    }
    
    // If we have potential targets from previous logic, try them first
    if (this.potentialTargets.length > 0) {
      // Sort potential targets by probability
      this.potentialTargets.sort((a, b) => {
        const aVal = this.calculatePositionValue(a.x, a.y, opponentBoard);
        const bVal = this.calculatePositionValue(b.x, b.y, opponentBoard);
        return bVal - aVal; // Higher value first
      });
      
      // Filter out isolated single cells that can't fit any remaining ship
      const filteredTargets = this.potentialTargets.filter(target => 
        !this.isIsolatedCell(target.x, target.y, opponentBoard)
      );
      
      // If we have filtered targets, use them; otherwise fall back to the original list
      const targets = filteredTargets.length > 0 ? filteredTargets : this.potentialTargets;
      
      // Use weighted random selection for top targets
      if (targets.length > 3) {
        // Take top 3 candidates
        const topCandidates = targets.slice(0, 3);
        const weights = [0.6, 0.3, 0.1]; // 60% chance for best, 30% for second, 10% for third
        
        const randomValue = Math.random();
        if (randomValue < weights[0]) {
          return topCandidates[0];
        } else if (randomValue < weights[0] + weights[1]) {
          return topCandidates[1];
        } else {
          return topCandidates[2];
        }
      }
      
      return targets.shift()!;
    }
    
    // Use enhanced probability density to find likely ship locations
    const probabilityMap = this.createProbabilityMap(opponentBoard);
    
    // Filter out isolated cells
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit && this.isIsolatedCell(x, y, opponentBoard)) {
          probabilityMap[y][x] = 0; // Zero out isolated cells
        }
      }
    }
    
    return this.findHighestProbabilityMove(probabilityMap, opponentBoard);
  }

  // Check if a cell is isolated (surrounded by misses or edges) such that no ship can fit
  private isIsolatedCell(x: number, y: number, opponentBoard: Cell[][]): boolean {
    // If cell is already hit, it's not isolated (not relevant)
    if (opponentBoard[y][x].isHit) return false;
    
    // Get remaining ship sizes
    const remainingShips = this.getRemainingShipSizes();
    if (remainingShips.length === 0) return false; // No ships left, can't be isolated
    
    const smallestShipSize = Math.min(...remainingShips);
    
    // Check horizontal fit
    let maxHorizontalSpace = 1; // Start with this cell
    let leftSpace = 0, rightSpace = 0;
    
    // Check left
    for (let i = 1; i <= smallestShipSize; i++) {
      const nx = x - i;
      if (!this.isValidPosition(nx, y) || 
          (opponentBoard[y][nx].isHit && !opponentBoard[y][nx].hasShip)) {
        break; // Hit edge or miss
      }
      leftSpace++;
    }
    
    // Check right
    for (let i = 1; i <= smallestShipSize; i++) {
      const nx = x + i;
      if (!this.isValidPosition(nx, y) || 
          (opponentBoard[y][nx].isHit && !opponentBoard[y][nx].hasShip)) {
        break; // Hit edge or miss
      }
      rightSpace++;
    }
    
    maxHorizontalSpace += leftSpace + rightSpace;
    
    // Check vertical fit
    let maxVerticalSpace = 1; // Start with this cell
    let topSpace = 0, bottomSpace = 0;
    
    // Check top
    for (let i = 1; i <= smallestShipSize; i++) {
      const ny = y - i;
      if (!this.isValidPosition(x, ny) || 
          (opponentBoard[ny][x].isHit && !opponentBoard[ny][x].hasShip)) {
        break; // Hit edge or miss
      }
      topSpace++;
    }
    
    // Check bottom
    for (let i = 1; i <= smallestShipSize; i++) {
      const ny = y + i;
      if (!this.isValidPosition(x, ny) || 
          (opponentBoard[ny][x].isHit && !opponentBoard[ny][x].hasShip)) {
        break; // Hit edge or miss
      }
      bottomSpace++;
    }
    
    maxVerticalSpace += topSpace + bottomSpace;
    
    // If either direction has enough space for smallest ship, cell is not isolated
    return maxHorizontalSpace < smallestShipSize && maxVerticalSpace < smallestShipSize;
  }

  // Calculate how promising a position is based on surrounding hits
  private calculatePositionValue(x: number, y: number, opponentBoard: Cell[][]): number {
    if (!this.isValidPosition(x, y) || opponentBoard[y][x].isHit) {
      return -1; // Invalid position
    }
    
    let value = 0;
    
    // Small boost for positions near edges (players often place ships along edges)
    if (x === 0 || x === this.config.boardSize - 1) {
      value += 1; // Edge boost
    }
    if (y === 0 || y === this.config.boardSize - 1) {
      value += 1; // Edge boost
    }
    
    // Even higher boost for corners (but not too high to avoid corner obsession)
    if ((x === 0 || x === this.config.boardSize - 1) && 
        (y === 0 || y === this.config.boardSize - 1)) {
      value += 1; // Corner boost
    }
    
    // Check surrounding cells for hits
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];
    
    // Higher value for positions adjacent to hits
    for (const dir of directions) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      
      if (this.isValidPosition(nx, ny)) {
        const cell = opponentBoard[ny][nx];
        if (cell.isHit && cell.hasShip) {
          value += 5; // Adjacent hit is very valuable
        } else if (cell.isHit && !cell.hasShip) {
          value -= 1; // Adjacent miss is less promising
        }
      }
    }
    
    // Even higher value if position forms a line with hits
    for (let i = 0; i < directions.length; i += 2) { // Check pairs (horizontal and vertical)
      const dir1 = directions[i];
      const dir2 = directions[i + 1];
      
      const nx1 = x + dir1.x;
      const ny1 = y + dir1.y;
      const nx2 = x + dir2.x;
      const ny2 = y + dir2.y;
      
      if (this.isValidPosition(nx1, ny1) && this.isValidPosition(nx2, ny2)) {
        const cell1 = opponentBoard[ny1][nx1];
        const cell2 = opponentBoard[ny2][nx2];
        
        if (cell1.isHit && cell1.hasShip && cell2.isHit && cell2.hasShip) {
          value += 10; // Position forms a line with hits on both sides
        }
      }
    }
    
    return value;
  }

  // Get the remaining ship sizes, excluding already sunk ships
  private getRemainingShipSizes(): number[] {
    const allShips = [
      { type: 'carrier', size: 5 },
      { type: 'battleship', size: 4 },
      { type: 'cruiser', size: 3 },
      { type: 'submarine', size: 3 },
      { type: 'destroyer', size: 2 }
    ];
    
    return allShips
      .filter(ship => !this.sunkShips.has(ship.type))
      .map(ship => ship.size);
  }

  // Check cells that should be avoided due to being adjacent to sunk ships
  private isAdjacentToSunkShip(opponentBoard: Cell[][], x: number, y: number): boolean {
    // All 8 directions including diagonals
    const directions = [
      { x: 1, y: 0 },  // right
      { x: -1, y: 0 }, // left
      { x: 0, y: 1 },  // down
      { x: 0, y: -1 }, // up
      { x: 1, y: 1 },  // down-right
      { x: -1, y: 1 }, // down-left
      { x: 1, y: -1 }, // up-right
      { x: -1, y: -1 } // up-left
    ];
    
    // Check if this cell is adjacent to a cell with a sunk ship
    for (const dir of directions) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      
      if (this.isValidPosition(nx, ny)) {
        const cell = opponentBoard[ny][nx];
        if (cell.isHit && cell.hasShip && cell.shipType && this.sunkShips.has(cell.shipType)) {
          return true; // This cell is adjacent to a sunk ship
        }
      }
    }
    
    return false;
  }

  // Check if a ship can fit at the position (simpler than canPlaceShip)
  private canFitShip(opponentBoard: Cell[][], x: number, y: number, size: number, isHorizontal: boolean): boolean {
    for (let i = 0; i < size; i++) {
      const checkX = isHorizontal ? x + i : x;
      const checkY = isHorizontal ? y : y + i;
      
      if (checkX >= this.config.boardSize || checkY >= this.config.boardSize) return false;
      if (opponentBoard[checkY][checkX].isHit && !opponentBoard[checkY][checkX].hasShip) return false;
      
      // Skip positions adjacent to sunk ships (they can't contain ships)
      if (this.isAdjacentToSunkShip(opponentBoard, checkX, checkY)) return false;
    }
    return true;
  }

  private createProbabilityMap(opponentBoard: Cell[][]): number[][] {
    const probabilityMap = Array(this.config.boardSize).fill(0).map(() => 
      Array(this.config.boardSize).fill(0)
    );
    
    // Get the remaining ship sizes (exclude sunk ships)
    const remainingShips = this.getRemainingShipSizes();
    
    // Normal probability calculation
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit) {
          // Skip cells adjacent to sunk ships since they can't contain ships
          if (this.isAdjacentToSunkShip(opponentBoard, x, y)) {
            probabilityMap[y][x] = 0;
            continue;
          }
          
          // Check horizontal possibilities for each remaining ship size
          for (const size of remainingShips) {
            if (this.canFitShip(opponentBoard, x, y, size, true)) {
              for (let i = 0; i < size; i++) {
                if (x + i < this.config.boardSize) {
                  probabilityMap[y][x + i]++;
                }
              }
            }
          }
          
          // Check vertical possibilities for each remaining ship size
          for (const size of remainingShips) {
            if (this.canFitShip(opponentBoard, x, y, size, false)) {
              for (let i = 0; i < size; i++) {
                if (y + i < this.config.boardSize) {
                  probabilityMap[y + i][x]++;
                }
              }
            }
          }
        }
      }
    }
    
    // Enhanced directional boosting for hit chains
    if (this.hitChain.length >= 2 && this.hitDirection) {
      // Apply stronger boost in the known direction
      const mainDirection = this.hitDirection === 'horizontal' 
          ? [{ x: 1, y: 0 }, { x: -1, y: 0 }]
          : [{ x: 0, y: 1 }, { x: 0, y: -1 }];
          
      // Cross direction (perpendicular to main direction)
      const crossDirection = this.hitDirection === 'horizontal'
          ? [{ x: 0, y: 1 }, { x: 0, y: -1 }]
          : [{ x: 1, y: 0 }, { x: -1, y: 0 }];
      
      for (const hit of this.hitChain) {
        // Strong boost along the chain's direction (15)
        for (const dir of mainDirection) {
          const nx = hit.x + dir.x;
          const ny = hit.y + dir.y;
          
          if (this.isValidPosition(nx, ny) && !opponentBoard[ny][nx].isHit) {
            // Skip if adjacent to a sunk ship
            if (!this.isAdjacentToSunkShip(opponentBoard, nx, ny)) {
              probabilityMap[ny][nx] += 15; // Very high boost in main direction
            }
          }
          
          // Extended boost (2 cells away, only in main direction)
          const nx2 = hit.x + 2 * dir.x;
          const ny2 = hit.y + 2 * dir.y;
          
          if (this.isValidPosition(nx2, ny2) && !opponentBoard[ny2][nx2].isHit) {
            // Skip if adjacent to a sunk ship
            if (!this.isAdjacentToSunkShip(opponentBoard, nx2, ny2)) {
              // Higher boost if there's a line of hits
              if (opponentBoard[ny][nx].isHit && opponentBoard[ny][nx].hasShip) {
                probabilityMap[ny2][nx2] += 20; // Very high boost for continuation
              } else {
                probabilityMap[ny2][nx2] += 5; // Moderate boost otherwise
              }
            }
          }
        }
        
        // Minimal boost perpendicular to chain (only if no other hits)
        if (this.hitChain.length <= 2) { // Only for early in the chain
          for (const dir of crossDirection) {
            const nx = hit.x + dir.x;
            const ny = hit.y + dir.y;
            
            if (this.isValidPosition(nx, ny) && !opponentBoard[ny][nx].isHit) {
              // Skip if adjacent to a sunk ship
              if (!this.isAdjacentToSunkShip(opponentBoard, nx, ny)) {
                probabilityMap[ny][nx] += 2; // Small boost in cross direction
              }
            }
          }
        }
      }
    } else {
      // Without a known direction, use standard boost around hits
      for (const hit of this.hitChain) {
        const directions = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 }
        ];
        
        for (const dir of directions) {
          const nx = hit.x + dir.x;
          const ny = hit.y + dir.y;
          
          if (this.isValidPosition(nx, ny) && !opponentBoard[ny][nx].isHit) {
            // Skip if adjacent to a sunk ship
            if (!this.isAdjacentToSunkShip(opponentBoard, nx, ny)) {
              probabilityMap[ny][nx] += 5; // Standard boost for adjacent cells
            }
          }
        }
      }
    }
    
    // Small boost for cells near edges
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit) {
          // Skip if adjacent to a sunk ship
          if (!this.isAdjacentToSunkShip(opponentBoard, x, y)) {
            // Boost edge cells
            if (x === 0 || x === this.config.boardSize - 1 || 
                y === 0 || y === this.config.boardSize - 1) {
              probabilityMap[y][x] += 1;
            }
          }
        }
      }
    }
    
    return probabilityMap;
  }

  private findHighestProbabilityMove(probabilityMap: number[][], opponentBoard: Cell[][]): { x: number; y: number } {
    let maxProb = -1;
    let bestMoves: { x: number; y: number }[] = [];
    
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit) {
          // Skip positions adjacent to sunk ships
          if (this.isAdjacentToSunkShip(opponentBoard, x, y)) {
            continue;
          }
          
          if (probabilityMap[y][x] > maxProb) {
            maxProb = probabilityMap[y][x];
            bestMoves = [{ x, y }];
          } else if (probabilityMap[y][x] === maxProb) {
            bestMoves.push({ x, y });
          }
        }
      }
    }
    
    // Use weighted random selection instead of pure random
    if (bestMoves.length > 1) {
      // Sort by additional criteria for tiebreaking
      bestMoves.sort((a, b) => {
        const aValue = this.calculatePositionValue(a.x, a.y, opponentBoard);
        const bValue = this.calculatePositionValue(b.x, b.y, opponentBoard);
        return bValue - aValue;
      });
      
      // 60% chance to pick the best one, 40% to pick others
      if (Math.random() < 0.6) {
        return bestMoves[0];
      } else {
        // Pick from the rest with equal probability
        const rest = bestMoves.slice(1);
        return rest[Math.floor(Math.random() * rest.length)];
      }
    }
    
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  public updateLastMove(x: number, y: number, wasHit: boolean) {
    // Add to internal tracking board
    if (this.isValidPosition(x, y) && this.board[y]) {
      this.board[y][x] = {
        ...this.board[y][x],
        isHit: true,
        hasShip: wasHit
      };
    }
    
    if (wasHit) {
      // Add to hit chain
      this.hitChain.push({ x, y });
      this.lastHit = { x, y };
      
      // If we have multiple hits, sort the hit chain to maintain logical order
      if (this.hitChain.length >= 2 && this.hitDirection) {
        this.sortHitChain();
      }
      
      if (!this.hitDirection && this.hitChain.length >= 2) {
        // Determine direction based on hits
        const first = this.hitChain[0];
        const second = this.hitChain[1];
        
        if (first.x !== second.x) {
          this.hitDirection = 'horizontal';
        } else if (first.y !== second.y) {
          this.hitDirection = 'vertical';
        }
        
        // Once direction is known, clear potential targets
        // (we'll focus on the known direction rather than exploring others)
        this.potentialTargets = [];
      }
    } else {
      // Reset direction if needed, but keep the hit chain
      // This allows AI to try other directions around the hit chain
      if (this.hitDirection && this.hitChain.length > 0) {
        const lastHit = this.hitChain[this.hitChain.length - 1];
        
        // If we missed when trying to extend a chain, try the other direction
        if (this.hitDirection === 'horizontal') {
          const oppositeDirs = [
            { x: -1, y: 0 },
            { x: 1, y: 0 }
          ];
          
          // Clear existing potential targets when changing strategies
          this.potentialTargets = [];
          
          for (const dir of oppositeDirs) {
            const nx = lastHit.x + dir.x;
            const ny = lastHit.y + dir.y;
            
            if (this.isValidPosition(nx, ny) && !this.board[ny][nx].isHit) {
              this.addPotentialTarget(nx, ny);
            }
          }
        } else if (this.hitDirection === 'vertical') {
          const oppositeDirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 }
          ];
          
          // Clear existing potential targets when changing strategies
          this.potentialTargets = [];
          
          for (const dir of oppositeDirs) {
            const nx = lastHit.x + dir.x;
            const ny = lastHit.y + dir.y;
            
            if (this.isValidPosition(nx, ny) && !this.board[ny][nx].isHit) {
              this.addPotentialTarget(nx, ny);
            }
          }
        }
      }
    }
  }
  
  // Call this method when a ship is sunk to reset targeting
  public resetTargeting() {
    this.hitChain = [];
    this.hitDirection = null;
    this.lastHit = null;
    this.potentialTargets = [];
  }
  
  // Mark a ship as sunk
  public markShipAsSunk(shipType: string) {
    if (shipType) {
      this.sunkShips.add(shipType);
      console.log(`[AI] Marked ship ${shipType} as sunk. Sunk ships: ${Array.from(this.sunkShips).join(', ')}`);
    }
    // Always reset targeting when a ship is sunk
    this.resetTargeting();
  }
  
  // Add a position to potential targets, avoiding duplicates
  private addPotentialTarget(x: number, y: number): void {
    // Check if this position already exists in potential targets
    const exists = this.potentialTargets.some(target => 
      target.x === x && target.y === y
    );
    
    if (!exists) {
      this.potentialTargets.push({ x, y });
    }
  }
  
  private sortHitChain() {
    if (this.hitDirection === 'horizontal') {
      this.hitChain.sort((a, b) => a.x - b.x);
    } else if (this.hitDirection === 'vertical') {
      this.hitChain.sort((a, b) => a.y - b.y);
    }
  }

  // Count total hits on the board
  private countHits(opponentBoard: Cell[][]): number {
    let hitCount = 0;
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (opponentBoard[y][x].isHit) {
          hitCount++;
        }
      }
    }
    return hitCount;
  }

  // Make a move biased toward the center portion of the board
  private makeCenterBiasedMove(opponentBoard: Cell[][]): { x: number; y: number } {
    const centerRegion = {
      minX: Math.floor(this.config.boardSize * 0.3),
      maxX: Math.floor(this.config.boardSize * 0.7),
      minY: Math.floor(this.config.boardSize * 0.3),
      maxY: Math.floor(this.config.boardSize * 0.7)
    };
    
    // Collect unhit cells in center region
    const centerCells: { x: number; y: number }[] = [];
    for (let y = centerRegion.minY; y <= centerRegion.maxY; y++) {
      for (let x = centerRegion.minX; x <= centerRegion.maxX; x++) {
        if (!opponentBoard[y][x].isHit && !this.isAdjacentToSunkShip(opponentBoard, x, y)) {
          centerCells.push({ x, y });
        }
      }
    }
    
    // If there are available center cells, pick one randomly
    if (centerCells.length > 0) {
      return centerCells[Math.floor(Math.random() * centerCells.length)];
    }
    
    // Fall back to random move if no center cells available
    return this.makeRandomMove(opponentBoard);
  }

  // Expose AI internal state for debugging
  public getDebugState() {
    return {
      difficulty: this.config.difficulty,
      hitChain: [...this.hitChain],
      direction: this.hitDirection,
      sunkShips: Array.from(this.sunkShips),
      potentialTargets: [...this.potentialTargets],
      lastHit: this.lastHit
    };
  }
} 