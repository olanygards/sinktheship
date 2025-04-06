'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc, onSnapshot, setDoc } from 'firebase/firestore';
import GameBoard from './GameBoard';
import ShipPlacement from './ShipPlacement';

interface GameProps {
  gameId: string;
  playerId: string;
}

interface Cell {
  x: number;
  y: number;
  isHit: boolean;
  hasShip: boolean;
}

interface GameState {
  players: {
    [key: string]: {
      board: Cell[];
      ready: boolean;
    };
  };
  currentTurn: string;
  status: 'waiting' | 'placing' | 'playing' | 'finished';
}

const BOARD_SIZE = 10;

const createEmptyBoard = () => {
  const board: Cell[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      board.push({
        x,
        y,
        isHit: false,
        hasShip: false,
      });
    }
  }
  return board;
};

const convertToGrid = (board: Cell[]): Cell[][] => {
  const grid: Cell[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  board.forEach(cell => {
    grid[cell.y][cell.x] = cell;
  });
  return grid;
};

const Game: React.FC<GameProps> = ({ gameId, playerId }) => {
  const [playerBoard, setPlayerBoard] = useState<Cell[][]>(convertToGrid(createEmptyBoard()));
  const [opponentBoard, setOpponentBoard] = useState<Cell[][]>(convertToGrid(createEmptyBoard()));
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'placing' | 'playing' | 'finished'>('waiting');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [gameMessage, setGameMessage] = useState('Väntar på motståndare...');

  useEffect(() => {
    const initializeGame = async () => {
      const gameRef = doc(db, 'games', gameId);
      
      try {
        await setDoc(gameRef, {
          players: {
            [playerId]: {
              board: createEmptyBoard(),
              ready: false
            }
          },
          status: 'waiting',
          currentTurn: playerId,
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (error) {
        console.error('Error initializing game:', error);
      }
    };

    initializeGame();
  }, [gameId, playerId]);

  useEffect(() => {
    const gameRef = doc(db, 'games', gameId);
    
    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const gameData = doc.data() as GameState;
        setGameState(gameData);
        setIsPlayerTurn(gameData.currentTurn === playerId);
        setGameStatus(gameData.status);
        
        // Convert flat arrays back to grids for display
        if (gameData.players[playerId]?.board) {
          setPlayerBoard(convertToGrid(gameData.players[playerId].board));
        }
        
        const opponent = Object.keys(gameData.players).find(id => id !== playerId);
        if (opponent) {
          setOpponentId(opponent);
          
          if (gameData.players[opponent]?.board) {
            setOpponentBoard(convertToGrid(gameData.players[opponent].board));
          }
        }

        // Update game status message
        updateGameMessage(gameData);
        
        // Check if both players are ready
        const allPlayersReady = Object.values(gameData.players).every(player => player.ready);
        if (allPlayersReady && gameData.status === 'placing' && Object.keys(gameData.players).length === 2) {
          updateGameStatus('playing');
        } else if (gameData.status === 'waiting' && Object.keys(gameData.players).length === 2) {
          updateGameStatus('placing');
        }
      }
    });

    return () => unsubscribe();
  }, [gameId, playerId]);

  const updateGameMessage = (gameData: GameState) => {
    if (gameData.status === 'waiting') {
      setGameMessage('Väntar på motståndare...');
    } else if (gameData.status === 'placing') {
      if (gameData.players[playerId]?.ready) {
        setGameMessage('Väntar på att motståndaren placerar sina skepp...');
      } else {
        setGameMessage('Placera dina skepp');
      }
    } else if (gameData.status === 'playing') {
      if (gameData.currentTurn === playerId) {
        setGameMessage('Din tur! Skjut mot motståndarens spelplan.');
      } else {
        setGameMessage('Motståndarens tur. Vänta...');
      }
    } else if (gameData.status === 'finished') {
      // Här kan vi lägga till logik för att avgöra vinnare
      setGameMessage('Spelet är slut!');
    }
  };

  const updateGameStatus = async (status: 'waiting' | 'placing' | 'playing' | 'finished') => {
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        status: status
      });
    } catch (error) {
      console.error('Error updating game status:', error);
    }
  };

  const handleFinishPlacement = () => {
    console.log('Placement finished');
  };

  const handleCellClick = async (x: number, y: number) => {
    if (!isPlayerTurn || !gameState || !opponentId || gameState.status !== 'playing') return;

    try {
      const gameRef = doc(db, 'games', gameId);
      const opponentBoard = gameState.players[opponentId].board;
      const targetCellIndex = opponentBoard.findIndex(cell => cell.x === x && cell.y === y);
      
      if (targetCellIndex === -1) return;
      
      // Check if cell was already hit
      if (opponentBoard[targetCellIndex].isHit) return;

      const updatedBoard = [...opponentBoard];
      const wasHit = updatedBoard[targetCellIndex].hasShip;
      
      updatedBoard[targetCellIndex] = {
        ...updatedBoard[targetCellIndex],
        isHit: true
      };

      // Check if all ships are sunk
      const allShipsSunk = updatedBoard.filter(cell => cell.hasShip).every(cell => cell.isHit);
      
      if (allShipsSunk) {
        await updateDoc(gameRef, {
          [`players.${opponentId}.board`]: updatedBoard,
          status: 'finished',
          winner: playerId
        });
      } else {
        // If miss, change turn
        if (!wasHit) {
          await updateDoc(gameRef, {
            [`players.${opponentId}.board`]: updatedBoard,
            currentTurn: opponentId
          });
        } else {
          // If hit, keep turn but update board
          await updateDoc(gameRef, {
            [`players.${opponentId}.board`]: updatedBoard
          });
        }
      }
    } catch (error) {
      console.error('Error updating game:', error);
    }
  };

  const renderContent = () => {
    if (gameState?.status === 'waiting') {
      return (
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Väntar på motståndare</h2>
          <p className="mb-4">Delad ditt spel-ID med en vän för att börja spela:</p>
          <div className="bg-gray-100 p-3 rounded text-lg font-mono mb-4">{gameId}</div>
          <button 
            onClick={() => navigator.clipboard.writeText(gameId)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Kopiera ID
          </button>
        </div>
      );
    }

    if (gameState?.status === 'placing' && !gameState.players[playerId]?.ready) {
      return (
        <ShipPlacement 
          gameId={gameId} 
          playerId={playerId} 
          board={playerBoard}
          onFinishPlacement={handleFinishPlacement}
        />
      );
    }

    return (
      <div className="flex flex-col md:flex-row gap-8">
        <div>
          <h2 className="text-xl font-bold mb-2">Din spelplan</h2>
          <GameBoard
            isPlayerBoard={true}
            board={playerBoard}
            onCellClick={() => {}}
          />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Motståndarens spelplan</h2>
          <GameBoard
            isPlayerBoard={false}
            board={opponentBoard}
            onCellClick={handleCellClick}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      {renderContent()}
      <div className="text-center">
        <p className="text-lg">{gameMessage}</p>
      </div>
    </div>
  );
};

export default Game; 