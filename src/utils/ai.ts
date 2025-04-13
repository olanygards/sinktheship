import { Cell, Ship } from './types';

export type Difficulty = 'easy' | 'medium' | 'hard';

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

    const board = this.createEmptyBoard();
    
    ships.forEach(ship => {
      let placed = false;
      while (!placed) {
        const isHorizontal = Math.random() > 0.5;
        const x = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? ship.size : 0)));
        const y = Math.floor(Math.random() * (this.config.boardSize - (isHorizontal ? 0 : ship.size)));

        if (this.canPlaceShip(board, x, y, ship.size, isHorizontal)) {
          this.placeShip(board, x, y, ship.size, isHorizontal, ship.type);
          placed = true;
        }
      }
    });

    return board;
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
      
      // Check surrounding cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = checkX + dx;
          const ny = checkY + dy;
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
          availableMoves.push({ x, y });
        }
      }
    }
    
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }

  private makeSmartMove(opponentBoard: Cell[][]): { x: number; y: number } {
    // If we have a hit but no direction, try adjacent cells
    if (this.lastHit && !this.hitDirection) {
      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ];
      
      for (const dir of directions) {
        const x = this.lastHit.x + dir.x;
        const y = this.lastHit.y + dir.y;
        
        if (x >= 0 && x < this.config.boardSize && y >= 0 && y < this.config.boardSize) {
          if (!opponentBoard[y][x].isHit) {
            return { x, y };
          }
        }
      }
    }
    
    // If we have a direction, continue in that direction
    if (this.lastHit && this.hitDirection) {
      const dir = this.hitDirection === 'horizontal' ? { x: 1, y: 0 } : { x: 0, y: 1 };
      let x = this.lastHit.x + dir.x;
      let y = this.lastHit.y + dir.y;
      
      while (x >= 0 && x < this.config.boardSize && y >= 0 && y < this.config.boardSize) {
        if (!opponentBoard[y][x].isHit) {
          return { x, y };
        }
        x += dir.x;
        y += dir.y;
      }
    }
    
    // If no strategy works, make a random move
    return this.makeRandomMove(opponentBoard);
  }

  private makeAdvancedMove(opponentBoard: Cell[][]): { x: number; y: number } {
    // First, check if we have any potential targets from previous moves
    if (this.potentialTargets.length > 0) {
      return this.potentialTargets.shift()!;
    }
    
    // If we have a hit, use pattern recognition
    if (this.lastHit) {
      // Add surrounding cells to potential targets
      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ];
      
      for (const dir of directions) {
        const x = this.lastHit.x + dir.x;
        const y = this.lastHit.y + dir.y;
        
        if (x >= 0 && x < this.config.boardSize && y >= 0 && y < this.config.boardSize) {
          if (!opponentBoard[y][x].isHit) {
            this.potentialTargets.push({ x, y });
          }
        }
      }
      
      if (this.potentialTargets.length > 0) {
        return this.potentialTargets.shift()!;
      }
    }
    
    // Use probability density to find likely ship locations
    const probabilityMap = this.createProbabilityMap(opponentBoard);
    return this.findHighestProbabilityMove(probabilityMap, opponentBoard);
  }

  private createProbabilityMap(opponentBoard: Cell[][]): number[][] {
    const probabilityMap = Array(this.config.boardSize).fill(0).map(() => 
      Array(this.config.boardSize).fill(0)
    );
    
    const ships = [5, 4, 3, 3, 2]; // Remaining ship sizes
    
    for (let y = 0; y < this.config.boardSize; y++) {
      for (let x = 0; x < this.config.boardSize; x++) {
        if (!opponentBoard[y][x].isHit) {
          // Check horizontal possibilities
          for (const size of ships) {
            if (this.canPlaceShip(opponentBoard, x, y, size, true)) {
              for (let i = 0; i < size; i++) {
                probabilityMap[y][x + i]++;
              }
            }
          }
          
          // Check vertical possibilities
          for (const size of ships) {
            if (this.canPlaceShip(opponentBoard, x, y, size, false)) {
              for (let i = 0; i < size; i++) {
                probabilityMap[y + i][x]++;
              }
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
          if (probabilityMap[y][x] > maxProb) {
            maxProb = probabilityMap[y][x];
            bestMoves = [{ x, y }];
          } else if (probabilityMap[y][x] === maxProb) {
            bestMoves.push({ x, y });
          }
        }
      }
    }
    
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  public updateLastMove(x: number, y: number, wasHit: boolean) {
    if (wasHit) {
      this.lastHit = { x, y };
      if (!this.hitDirection) {
        // Try to determine direction based on previous hits
        const directions = [
          { x: 1, y: 0, dir: 'horizontal' as const },
          { x: -1, y: 0, dir: 'horizontal' as const },
          { x: 0, y: 1, dir: 'vertical' as const },
          { x: 0, y: -1, dir: 'vertical' as const }
        ];
        
        for (const dir of directions) {
          const nx = x + dir.x;
          const ny = y + dir.y;
          if (nx >= 0 && nx < this.config.boardSize && ny >= 0 && ny < this.config.boardSize) {
            if (this.board[ny][nx].isHit && this.board[ny][nx].hasShip) {
              this.hitDirection = dir.dir;
              break;
            }
          }
        }
      }
    } else if (this.lastHit && this.hitDirection) {
      // If we missed after having a direction, try the opposite direction
      const dir = this.hitDirection === 'horizontal' ? { x: -1, y: 0 } : { x: 0, y: -1 };
      let x = this.lastHit.x + dir.x;
      let y = this.lastHit.y + dir.y;
      
      if (x >= 0 && x < this.config.boardSize && y >= 0 && y < this.config.boardSize) {
        if (!this.board[y][x].isHit) {
          this.potentialTargets.push({ x, y });
        }
      }
    }
  }
} 