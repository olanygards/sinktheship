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
  analysisRadius?: number;
  probabilityCacheSize?: number;
  availableSpaceCacheSize?: number;
  placementPatterns?: {
    edge: number;
    center: number;
    cluster: number;
  };
  probabilityBoosts?: {
    hitChain: number;
    availableSpace: number;
    edge: number;
    corner: number;
    lineFormation: number;
  };
}

export class BattleshipAI {
  private config: AIConfig;
  private lastHit: { x: number; y: number } | null = null;
  private hitDirection: 'horizontal' | 'vertical' | null = null;
  private potentialTargets: { x: number; y: number }[] = [];
  private board: Cell[][] = [];
  private hitChain: { x: number; y: number }[] = []; // Track consecutive hits
  private sunkShips: Set<string> = new Set(); // Track which ship types have been sunk
  private parityHunting: boolean = true; // Track if we're in parity hunting phase
  private parity: number = 0; // 0 or 1, representing the parity we're hunting on
  private probabilityCache: Map<string, number[][]> = new Map();
  private lastProbabilityMap: number[][] | null = null;
  private lastBoardState: string | null = null;
  private cachedAvailableSpaces: Map<string, number> = new Map();
  private analysisRadius: number;
  private placementPatterns: { type: string; weight: number }[];
  private probabilityBoosts: {
    hitChain: number;
    availableSpace: number;
    edge: number;
    corner: number;
    lineFormation: number;
  };

  constructor(config: AIConfig) {
    this.config = {
      ...config,
      analysisRadius: config.analysisRadius ?? 3,
      probabilityCacheSize: config.probabilityCacheSize ?? 100,
      availableSpaceCacheSize: config.availableSpaceCacheSize ?? 1000,
      placementPatterns: config.placementPatterns ?? {
        edge: 0.4,
        center: 0.3,
        cluster: 0.3
      },
      probabilityBoosts: config.probabilityBoosts ?? {
        hitChain: 15,
        availableSpace: 5,
        edge: 1,
        corner: 1,
        lineFormation: 10
      }
    };
    
    this.analysisRadius = this.config.analysisRadius!;
    this.placementPatterns = Object.entries(this.config.placementPatterns!).map(([type, weight]) => ({ type, weight }));
    this.probabilityBoosts = this.config.probabilityBoosts!;
    
    this.initializeBoard();
    this.parity = Math.random() < 0.5 ? 0 : 1;
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
    
    // Sort ships by size (largest first)
    const sortedShips = [...ships].sort((a, b) => b.size - a.size);
    
    // Define placement patterns
    const patterns = [
      { type: 'edge', weight: 0.4 },
      { type: 'center', weight: 0.3 },
      { type: 'cluster', weight: 0.3 }
    ];
    
    // Track placed ships for clustering
    const placedShips: { x: number; y: number; size: number; isHorizontal: boolean }[] = [];
    
    for (const ship of sortedShips) {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 500;
      
      while (!placed && attempts < maxAttempts) {
        attempts++;
        
        // Choose placement pattern based on weights
        const pattern = this.choosePattern(patterns);
        
        let x, y, isHorizontal;
        
        switch (pattern) {
          case 'edge':
            // Place near edges but not exactly at edges
            isHorizontal = Math.random() > 0.5;
            if (isHorizontal) {
              x = 1 + Math.floor(Math.random() * (this.config.boardSize - ship.size - 2));
              y = Math.random() > 0.5 ? 1 : this.config.boardSize - 2;
            } else {
              x = Math.random() > 0.5 ? 1 : this.config.boardSize - 2;
              y = 1 + Math.floor(Math.random() * (this.config.boardSize - ship.size - 2));
            }
            break;
            
          case 'center':
            // Place in center region
            isHorizontal = Math.random() > 0.5;
            const centerRegion = {
              minX: Math.floor(this.config.boardSize * 0.3),
              maxX: Math.floor(this.config.boardSize * 0.7),
              minY: Math.floor(this.config.boardSize * 0.3),
              maxY: Math.floor(this.config.boardSize * 0.7)
            };
            x = centerRegion.minX + Math.floor(Math.random() * (centerRegion.maxX - centerRegion.minX - ship.size + 1));
            y = centerRegion.minY + Math.floor(Math.random() * (centerRegion.maxY - centerRegion.minY - ship.size + 1));
            break;
            
          case 'cluster':
            // Try to place near existing ships
            if (placedShips.length > 0) {
              const referenceShip = placedShips[Math.floor(Math.random() * placedShips.length)];
              isHorizontal = Math.random() > 0.5;
              
              // Place within 2 cells of reference ship
              const offset = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
              if (isHorizontal) {
                x = referenceShip.x + offset;
                y = referenceShip.y + (Math.random() > 0.5 ? 1 : -1);
              } else {
                x = referenceShip.x + (Math.random() > 0.5 ? 1 : -1);
                y = referenceShip.y + offset;
              }
            } else {
              // If no ships placed yet, fall back to edge placement
              isHorizontal = Math.random() > 0.5;
              x = 1 + Math.floor(Math.random() * (this.config.boardSize - ship.size - 2));
              y = Math.random() > 0.5 ? 1 : this.config.boardSize - 2;
            }
            break;
        }
        
        if (this.canPlaceShip(board, x, y, ship.size, isHorizontal)) {
          this.placeShip(board, x, y, ship.size, isHorizontal, ship.type);
          placedShips.push({ x, y, size: ship.size, isHorizontal });
          placed = true;
        }
      }
      
      if (!placed) {
        console.warn(`Could not place ship ${ship.type} strategically, trying with simplified rules`);
        // Fall back to simplified placement
        attempts = 0;
        while (!placed && attempts < maxAttempts) {
          attempts++;
          const isHorizontal = Math.random() > 0.5;
          const x = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? ship.size : 0)));
          const y = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? 0 : ship.size)));
          
          if (this.canPlaceShipSimple(board, x, y, ship.size, isHorizontal)) {
            this.placeShip(board, x, y, ship.size, isHorizontal, ship.type);
            placed = true;
          }
        }
      }
    }
    
    return board;
  }

  private choosePattern(patterns: { type: string; weight: number }[]): string {
    const totalWeight = patterns.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const pattern of patterns) {
      if (random < pattern.weight) {
        return pattern.type;
      }
      random -= pattern.weight;
    }
    
    return patterns[0].type; // Fallback
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
    // For hard difficulty, use the optimized strategy
    if (this.config.difficulty === 'hard') {
      return this.makeAdvancedMove(opponentBoard);
    }
    
    switch (this.config.difficulty) {
      case 'easy':
        return this.makeRandomMove(opponentBoard);
      case 'medium':
        return this.makeSmartMove(opponentBoard);
      default:
        return this.makeRandomMove(opponentBoard);
    }
  }

  private makeRandomMove(opponentBoard: Cell[][]): { x: number; y: number } {
    const availableMoves: { x: number; y: number }[] = [];
    
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit) {
          // Skip cells adjacent to sunk ships and isolated cells
          if (this.isAdjacentToSunkShip(opponentBoard, x, y) || 
              this.isIsolatedCell(x, y, opponentBoard)) {
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
            // Even in fallback, skip isolated cells
            if (!this.isIsolatedCell(x, y, opponentBoard)) {
              availableMoves.push({ x, y });
            }
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
      
      // Check if next position is valid, not already hit, not adjacent to sunk ships, and not isolated
      if (this.isValidPosition(nextForward.x, nextForward.y) && 
          !opponentBoard[nextForward.y][nextForward.x].isHit &&
          !this.isAdjacentToSunkShip(opponentBoard, nextForward.x, nextForward.y) &&
          !this.isIsolatedCell(nextForward.x, nextForward.y, opponentBoard)) {
        return nextForward;
      }
      
      // If forward direction is blocked, try the opposite direction from the first hit
      const nextBackward = {
        x: first.x - (this.hitDirection === 'horizontal' ? Math.sign(dx) : 0),
        y: first.y - (this.hitDirection === 'vertical' ? Math.sign(dy) : 0)
      };
      
      if (this.isValidPosition(nextBackward.x, nextBackward.y) && 
          !opponentBoard[nextBackward.y][nextBackward.x].isHit &&
          !this.isAdjacentToSunkShip(opponentBoard, nextBackward.x, nextBackward.y) &&
          !this.isIsolatedCell(nextBackward.x, nextBackward.y, opponentBoard)) {
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
            !this.isAdjacentToSunkShip(opponentBoard, x, y) &&
            !this.isIsolatedCell(x, y, opponentBoard)) {
          return { x, y };
        }
      }
    }
    
    // If no hit chain or all targeted positions are invalid, make a random move
    return this.makeRandomMove(opponentBoard);
  }

  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.config.boardSize && y >= 0 && y < this.config.boardSize;
  }

  private makeAdvancedMove(opponentBoard: Cell[][]): { x: number; y: number } {
    // If we have a hit chain, prioritize targeting
    if (this.hitChain.length >= 1) {
      // Use deterministic targeting logic
      const targetingMove = this.makeDeterministicTargetingMove(opponentBoard);
      if (targetingMove) {
        return targetingMove;
      }
    }

    // If no targeting move available, use probability map with parity hunting
    const probabilityMap = this.createProbabilityMap(opponentBoard);
    
    // During parity hunting phase, only consider cells of the chosen parity
    if (this.parityHunting) {
      for (let y = 0; y < this.config.boardSize; y++) {
        for (let x = 0; x < this.config.boardSize; x++) {
          if ((x + y) % 2 !== this.parity) {
            probabilityMap[y][x] = 0;
          }
        }
      }
    }
    
    return this.findHighestProbabilityMove(probabilityMap, opponentBoard);
  }

  private makeDeterministicTargetingMove(opponentBoard: Cell[][]): { x: number; y: number } | null {
    // If we have multiple hits, follow the direction
    if (this.hitChain.length >= 2 && this.hitDirection) {
      const first = this.hitChain[0];
      const last = this.hitChain[this.hitChain.length - 1];
      
      // Try continuing in the same direction from the last hit
      const nextForward = {
        x: last.x + (this.hitDirection === 'horizontal' ? Math.sign(last.x - first.x) : 0),
        y: last.y + (this.hitDirection === 'vertical' ? Math.sign(last.y - first.y) : 0)
      };
      
      if (this.isValidPosition(nextForward.x, nextForward.y) && 
          !opponentBoard[nextForward.y][nextForward.x].isHit &&
          !this.isAdjacentToSunkShip(opponentBoard, nextForward.x, nextForward.y) &&
          !this.isIsolatedCell(nextForward.x, nextForward.y, opponentBoard)) {
        return nextForward;
      }
      
      // If forward direction is blocked, try the opposite direction from the first hit
      const nextBackward = {
        x: first.x - (this.hitDirection === 'horizontal' ? Math.sign(last.x - first.x) : 0),
        y: first.y - (this.hitDirection === 'vertical' ? Math.sign(last.y - first.y) : 0)
      };
      
      if (this.isValidPosition(nextBackward.x, nextBackward.y) && 
          !opponentBoard[nextBackward.y][nextBackward.x].isHit &&
          !this.isAdjacentToSunkShip(opponentBoard, nextBackward.x, nextBackward.y) &&
          !this.isIsolatedCell(nextBackward.x, nextBackward.y, opponentBoard)) {
        return nextBackward;
      }
      
      // If both ends are blocked, check perpendicular cells
      const perpendicularMoves = this.getPerpendicularMoves(opponentBoard);
      if (perpendicularMoves.length > 0) {
        // Sort by probability value and return the best one
        perpendicularMoves.sort((a, b) => {
          const aVal = this.calculatePositionValue(a.x, a.y, opponentBoard);
          const bVal = this.calculatePositionValue(b.x, b.y, opponentBoard);
          return bVal - aVal;
        });
        return perpendicularMoves[0];
      }
    }
    
    // If we have a single hit, try adjacent cells in a deterministic order
    if (this.hitChain.length === 1) {
      const directions = [
        { x: 1, y: 0 },  // Right
        { x: -1, y: 0 }, // Left
        { x: 0, y: 1 },  // Down
        { x: 0, y: -1 }  // Up
      ];
      
      // Sort directions by available space
      const sortedDirections = directions.map(dir => ({
        dir,
        space: this.calculateAvailableSpace(opponentBoard, this.hitChain[0].x, this.hitChain[0].y, dir)
      })).sort((a, b) => b.space - a.space);
      
      for (const { dir } of sortedDirections) {
        const x = this.hitChain[0].x + dir.x;
        const y = this.hitChain[0].y + dir.y;
        
        if (this.isValidPosition(x, y) && !opponentBoard[y][x].isHit &&
            !this.isAdjacentToSunkShip(opponentBoard, x, y) &&
            !this.isIsolatedCell(x, y, opponentBoard)) {
          return { x, y };
        }
      }
    }
    
    return null; // No targeting move available
  }

  private getPerpendicularMoves(opponentBoard: Cell[][]): { x: number; y: number }[] {
    const moves: { x: number; y: number }[] = [];
    
    if (this.hitDirection === 'horizontal') {
      // Check cells above and below each hit
      for (const hit of this.hitChain) {
        const up = { x: hit.x, y: hit.y - 1 };
        const down = { x: hit.x, y: hit.y + 1 };
        
        if (this.isValidPosition(up.x, up.y) && !opponentBoard[up.y][up.x].isHit &&
            !this.isAdjacentToSunkShip(opponentBoard, up.x, up.y) &&
            !this.isIsolatedCell(up.x, up.y, opponentBoard)) {
          moves.push(up);
        }
        
        if (this.isValidPosition(down.x, down.y) && !opponentBoard[down.y][down.x].isHit &&
            !this.isAdjacentToSunkShip(opponentBoard, down.x, down.y) &&
            !this.isIsolatedCell(down.x, down.y, opponentBoard)) {
          moves.push(down);
        }
      }
    } else if (this.hitDirection === 'vertical') {
      // Check cells left and right of each hit
      for (const hit of this.hitChain) {
        const left = { x: hit.x - 1, y: hit.y };
        const right = { x: hit.x + 1, y: hit.y };
        
        if (this.isValidPosition(left.x, left.y) && !opponentBoard[left.y][left.x].isHit &&
            !this.isAdjacentToSunkShip(opponentBoard, left.x, left.y) &&
            !this.isIsolatedCell(left.x, left.y, opponentBoard)) {
          moves.push(left);
        }
        
        if (this.isValidPosition(right.x, right.y) && !opponentBoard[right.y][right.x].isHit &&
            !this.isAdjacentToSunkShip(opponentBoard, right.x, right.y) &&
            !this.isIsolatedCell(right.x, right.y, opponentBoard)) {
          moves.push(right);
        }
      }
    }
    
    return moves;
  }

  private findHighestProbabilityMove(probabilityMap: number[][], opponentBoard: Cell[][]): { x: number; y: number } {
    let maxProb = -1;
    let bestMoves: { x: number; y: number }[] = [];
    
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit) {
          // Skip positions adjacent to sunk ships and isolated cells
          if (this.isAdjacentToSunkShip(opponentBoard, x, y) || 
              this.isIsolatedCell(x, y, opponentBoard)) {
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
    
    // If we have multiple best moves, use deterministic tie-breaking
    if (bestMoves.length > 1) {
      // First tie-breaker: position value
      bestMoves.sort((a, b) => {
        const aValue = this.calculatePositionValue(a.x, a.y, opponentBoard);
        const bValue = this.calculatePositionValue(b.x, b.y, opponentBoard);
        if (aValue !== bValue) {
          return bValue - aValue;
        }
        // Second tie-breaker: row then column (consistent ordering)
        return (a.y === b.y) ? a.x - b.x : a.y - b.y;
      });
    }
    
    return bestMoves[0];
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
      
      // If this is the first hit, disable parity hunting
      if (this.hitChain.length === 1) {
        this.parityHunting = false;
      }
      
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
      }
    }
  }
  
  // Call this method when a ship is sunk to reset targeting
  public resetTargeting() {
    this.hitChain = [];
    this.hitDirection = null;
    this.lastHit = null;
    this.potentialTargets = [];
    this.probabilityCache.clear();
    this.cachedAvailableSpaces.clear();
    this.lastProbabilityMap = null;
    this.lastBoardState = null;
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

  private getBoardStateKey(opponentBoard: Cell[][]): string {
    // Enhanced board state key that includes more relevant information
    let key = '';
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        const cell = opponentBoard[y][x];
        key += cell.isHit ? (cell.hasShip ? 'H' : 'M') : 'U';
      }
    }
    
    // Include hit chain with direction information
    key += `|${this.hitChain.map(h => `${h.x},${h.y}`).join(';')}`;
    key += `|${this.hitDirection || 'N'}`;
    
    // Include sunk ships and remaining ship sizes
    key += `|${Array.from(this.sunkShips).join(',')}`;
    key += `|${this.getRemainingShipSizes().join(',')}`;
    
    // Include parity information
    key += `|${this.parityHunting ? 'P' : 'N'}`;
    key += `|${this.parity}`;
    
    return key;
  }

  private createProbabilityMap(opponentBoard: Cell[][]): number[][] {
    const boardStateKey = this.getBoardStateKey(opponentBoard);
    
    // Check cache first
    if (this.probabilityCache.has(boardStateKey)) {
      return this.probabilityCache.get(boardStateKey)!;
    }
    
    // If board state hasn't changed much, reuse last probability map
    if (this.lastBoardState && 
        this.lastProbabilityMap && 
        this.boardsAreSimilar(this.lastBoardState, boardStateKey)) {
      return this.lastProbabilityMap;
    }
    
    const probabilityMap = Array(this.config.boardSize).fill(0).map(() => 
      Array(this.config.boardSize).fill(0)
    );
    
    // Get the remaining ship sizes
    const remainingShips = this.getRemainingShipSizes();
    
    // Determine analysis area
    const analysisArea = this.getAnalysisArea(opponentBoard);
    
    // Enhanced probability calculation using all possible placements
    for (const shipSize of remainingShips) {
      // Horizontal placements
      for (let y = analysisArea.minY; y <= analysisArea.maxY; y++) {
        for (let x = analysisArea.minX; x <= analysisArea.maxX - shipSize; x++) {
          if (this.canFitShip(opponentBoard, x, y, shipSize, true)) {
            const weight = shipSize * 2;
            for (let i = 0; i < shipSize; i++) {
              probabilityMap[y][x + i] += weight;
            }
          }
        }
      }
      
      // Vertical placements
      for (let x = analysisArea.minX; x <= analysisArea.maxX; x++) {
        for (let y = analysisArea.minY; y <= analysisArea.maxY - shipSize; y++) {
          if (this.canFitShip(opponentBoard, x, y, shipSize, false)) {
            const weight = shipSize * 2;
            for (let i = 0; i < shipSize; i++) {
              probabilityMap[y + i][x] += weight;
            }
          }
        }
      }
    }
    
    // Enhanced directional boosting for hit chains
    if (this.hitChain.length >= 2 && this.hitDirection) {
      const mainDirection = this.hitDirection === 'horizontal' 
          ? [{ x: 1, y: 0 }, { x: -1, y: 0 }]
          : [{ x: 0, y: 1 }, { x: 0, y: -1 }];
          
      const crossDirection = this.hitDirection === 'horizontal'
          ? [{ x: 0, y: 1 }, { x: 0, y: -1 }]
          : [{ x: 1, y: 0 }, { x: -1, y: 0 }];
      
      for (const hit of this.hitChain) {
        for (const dir of mainDirection) {
          const nx = hit.x + dir.x;
          const ny = hit.y + dir.y;
          
          if (this.isValidPosition(nx, ny) && !opponentBoard[ny][nx].isHit) {
            if (!this.isAdjacentToSunkShip(opponentBoard, nx, ny)) {
              const availableSpace = this.getCachedAvailableSpace(opponentBoard, nx, ny, dir);
              probabilityMap[ny][nx] += this.probabilityBoosts.hitChain + 
                                      (availableSpace * this.probabilityBoosts.availableSpace);
            }
          }
          
          const nx2 = hit.x + 2 * dir.x;
          const ny2 = hit.y + 2 * dir.y;
          
          if (this.isValidPosition(nx2, ny2) && !opponentBoard[ny2][nx2].isHit) {
            if (!this.isAdjacentToSunkShip(opponentBoard, nx2, ny2)) {
              if (opponentBoard[ny][nx].isHit && opponentBoard[ny][nx].hasShip) {
                probabilityMap[ny2][nx2] += this.probabilityBoosts.lineFormation;
              } else {
                probabilityMap[ny2][nx2] += this.probabilityBoosts.hitChain / 3;
              }
            }
          }
        }
        
        if (this.hitChain.length <= 2) {
          for (const dir of crossDirection) {
            const nx = hit.x + dir.x;
            const ny = hit.y + dir.y;
            
            if (this.isValidPosition(nx, ny) && !opponentBoard[ny][nx].isHit) {
              if (!this.isAdjacentToSunkShip(opponentBoard, nx, ny)) {
                probabilityMap[ny][nx] += this.probabilityBoosts.hitChain / 5;
              }
            }
          }
        }
      }
    }
    
    // Adaptive parity based on remaining ships
    if (this.parityHunting) {
      const remainingShips = this.getRemainingShipSizes();
      const allOddSized = remainingShips.every(size => size % 2 === 1);
      const allEvenSized = remainingShips.every(size => size % 2 === 0);
      
      if (allOddSized) {
        this.parity = 1;
      } else if (allEvenSized) {
        this.parity = 0;
      }
      
      for (let y = analysisArea.minY; y <= analysisArea.maxY; y++) {
        for (let x = analysisArea.minX; x <= analysisArea.maxX; x++) {
          if ((x + y) % 2 !== this.parity) {
            probabilityMap[y][x] = 0;
          }
        }
      }
    }
    
    // Cache the result
    this.probabilityCache.set(boardStateKey, probabilityMap);
    this.lastProbabilityMap = probabilityMap;
    this.lastBoardState = boardStateKey;
    
    // Clean up old cache entries if needed
    if (this.probabilityCache.size > this.config.probabilityCacheSize!) {
      this.probabilityCache.clear();
    }
    
    return probabilityMap;
  }

  private getAnalysisArea(opponentBoard: Cell[][]): { minX: number; maxX: number; minY: number; maxY: number } {
    // If no hits, analyze the whole board
    if (this.hitChain.length === 0) {
      return {
        minX: 0,
        maxX: this.config.boardSize - 1,
        minY: 0,
        maxY: this.config.boardSize - 1
      };
    }
    
    // Calculate initial area around hits
    let minX = this.config.boardSize;
    let maxX = -1;
    let minY = this.config.boardSize;
    let maxY = -1;
    
    // Consider all hits in the chain
    for (const hit of this.hitChain) {
      minX = Math.min(minX, hit.x - this.analysisRadius);
      maxX = Math.max(maxX, hit.x + this.analysisRadius);
      minY = Math.min(minY, hit.y - this.analysisRadius);
      maxY = Math.max(maxY, hit.y + this.analysisRadius);
    }
    
    // Expand area based on largest remaining ship
    const largestShip = Math.max(...this.getRemainingShipSizes());
    minX = Math.max(0, minX - largestShip);
    maxX = Math.min(this.config.boardSize - 1, maxX + largestShip);
    minY = Math.max(0, minY - largestShip);
    maxY = Math.min(this.config.boardSize - 1, maxY + largestShip);
    
    // Ensure the area is at least large enough for the largest ship
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if (width < largestShip || height < largestShip) {
      // Expand the area to ensure it can fit the largest ship
      const centerX = Math.floor((minX + maxX) / 2);
      const centerY = Math.floor((minY + maxY) / 2);
      const expansion = Math.max(largestShip - width, largestShip - height);
      
      minX = Math.max(0, centerX - Math.floor(expansion / 2));
      maxX = Math.min(this.config.boardSize - 1, centerX + Math.ceil(expansion / 2));
      minY = Math.max(0, centerY - Math.floor(expansion / 2));
      maxY = Math.min(this.config.boardSize - 1, centerY + Math.ceil(expansion / 2));
    }
    
    return { minX, maxX, minY, maxY };
  }

  private boardsAreSimilar(oldKey: string, newKey: string): boolean {
    // Split keys into components
    const [oldPattern, oldHits, oldDirection, oldSunk, oldSizes, oldParityHunt, oldParity] = oldKey.split('|');
    const [newPattern, newHits, newDirection, newSunk, newSizes, newParityHunt, newParity] = newKey.split('|');
    
    // Check if critical components have changed
    if (oldDirection !== newDirection || 
        oldParityHunt !== newParityHunt || 
        oldParity !== newParity) {
      return false;
    }
    
    // Check if sunk ships have changed
    if (oldSunk !== newSunk) {
      return false;
    }
    
    // Check if remaining ship sizes have changed
    if (oldSizes !== newSizes) {
      return false;
    }
    
    // Allow for up to 3 cell differences in the pattern
    let differences = 0;
    for (let i = 0; i < oldPattern.length; i++) {
      if (oldPattern[i] !== newPattern[i]) {
        differences++;
        if (differences > 3) {
          return false;
        }
      }
    }
    
    return true;
  }

  private getCachedAvailableSpace(opponentBoard: Cell[][], x: number, y: number, dir: { x: number; y: number }): number {
    const cacheKey = `${x},${y},${dir.x},${dir.y}`;
    
    if (this.cachedAvailableSpaces.has(cacheKey)) {
      return this.cachedAvailableSpaces.get(cacheKey)!;
    }
    
    const space = this.calculateAvailableSpace(opponentBoard, x, y, dir);
    this.cachedAvailableSpaces.set(cacheKey, space);
    
    // Clean up old cache entries if needed
    if (this.cachedAvailableSpaces.size > this.config.availableSpaceCacheSize!) {
      this.cachedAvailableSpaces.clear();
    }
    
    return space;
  }

  private calculateAvailableSpace(opponentBoard: Cell[][], x: number, y: number, dir: { x: number; y: number }): number {
    let space = 0;
    let nx = x;
    let ny = y;
    
    while (this.isValidPosition(nx, ny) && 
           !opponentBoard[ny][nx].isHit && 
           !this.isAdjacentToSunkShip(opponentBoard, nx, ny)) {
      space++;
      nx += dir.x;
      ny += dir.y;
    }
    
    return space;
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