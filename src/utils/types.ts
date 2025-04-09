// Game related types
export interface Cell {
  x: number;
  y: number;
  isHit: boolean;
  hasShip: boolean;
  shipId?: string;
  shipType?: 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
  isSunkShip?: boolean;
}

export interface Ship {
  id: number;
  size: number;
  placed: boolean;
  type?: 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
}

export interface GameState {
  players: {
    [key: string]: {
      board: Cell[];
      ready: boolean;
      userId?: string;
    };
  };
  currentTurn: string;
  status: 'waiting' | 'placing' | 'playing' | 'finished';
  winner?: string;
  completedAt?: string;
}

// User related types
export interface UserProfile {
  username: string;
  friends: string[];
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winRate: number;
  };
}

export interface FriendStats {
  id: string;
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
} 