'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc, onSnapshot, setDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../../firebase/AuthContext';
import { updateGameStats } from '../../firebase/auth';
import GameBoard from './GameBoard';
import ShipPlacement from './ShipPlacement';
import { Cell, GameState, Ship } from '../../utils/types';
import ShipStatus from './ShipStatus';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection } from 'firebase/firestore';

interface GameProps {
  gameId: string;
  playerId: string;
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
  const { currentUser } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'placing' | 'playing' | 'finished'>('waiting');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(false);
  const [showTurnModal, setShowTurnModal] = useState<boolean>(false);
  const [turnMessage, setTurnMessage] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [attemptingReconnect, setAttemptingReconnect] = useState<boolean>(false);
  const [playerBoard, setPlayerBoard] = useState<Cell[][]>(convertToGrid(createEmptyBoard()));
  const [opponentBoard, setOpponentBoard] = useState<Cell[][]>(convertToGrid(createEmptyBoard()));
  const [gameMessage, setGameMessage] = useState<string>('Ansluter till spelet...');
  const router = useRouter();

  // Track remaining ships for both players
  const [playerShips, setPlayerShips] = useState({
    carrier: { size: 5, name: 'Air craft carrier', sunk: false },
    battleship: { size: 4, name: 'Battleship', sunk: false },
    cruiser: { size: 3, name: 'Cruiser', sunk: false },
    submarine: { size: 3, name: 'Submarine', sunk: false },
    destroyer: { size: 2, name: 'Destroyer', sunk: false }
  });
  
  const [opponentShips, setOpponentShips] = useState({
    carrier: { size: 5, name: 'Air craft carrier', sunk: false },
    battleship: { size: 4, name: 'Battleship', sunk: false },
    cruiser: { size: 3, name: 'Cruiser', sunk: false },
    submarine: { size: 3, name: 'Submarine', sunk: false },
    destroyer: { size: 2, name: 'Destroyer', sunk: false }
  });

  useEffect(() => {
    const initializeGame = async () => {
      try {
        const gameRef = doc(db, 'games', gameId);
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
        setConnectionError('Det gick inte att initiera spelet. Försök igen.');
      }
    };

    initializeGame();
  }, [gameId, playerId]);

  useEffect(() => {
    let unsubscribe: () => void;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectToGame = () => {
      try {
        setAttemptingReconnect(true);
        const gameRef = doc(db, 'games', gameId);
        
        unsubscribe = onSnapshot(gameRef, 
          (doc) => {
            setConnectionError(null);
            setAttemptingReconnect(false);
            reconnectAttempts = 0;
            
            if (doc.exists()) {
              const gameData = doc.data() as GameState;
              setGameState(gameData);
              const isYourTurn = gameData.currentTurn === playerId;
              setIsPlayerTurn(isYourTurn);
              setGameStatus(gameData.status);
              
              // Hantera tur-ändringar
              if (gameData.status === 'playing') {
                if (isYourTurn) {
                  setTurnMessage('Din tur att skjuta!');
                  setShowTurnModal(true);
                  
                  // Dölj modalen efter 1 sekund
                  setTimeout(() => {
                    setShowTurnModal(false);
                  }, 1000); // 1 sekund
                } else {
                  setTurnMessage('Motståndarens tur...');
                }
              }
              
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
            } else {
              setConnectionError('Detta spel finns inte längre. Det kan ha tagits bort.');
            }
          },
          (error) => {
            console.error('Error fetching game data:', error);
            setConnectionError(`Det gick inte att ansluta till spelet: ${error.message}`);
            
            // Försök återansluta om vi inte nått max antal försök
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              reconnectTimeout = setTimeout(() => {
                setAttemptingReconnect(true);
                connectToGame();
              }, 3000); // Försök återansluta efter 3 sekunder
            }
          }
        );
      } catch (error) {
        console.error('Error setting up game connection:', error);
        setConnectionError(`Det gick inte att ansluta till spelet.`);
      }
    };

    connectToGame();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [gameId, playerId]);

  const updateGameMessage = (gameData: GameState) => {
    if (gameData.status === 'waiting') {
      setGameMessage('Väntar på motståndare...');
    } else if (gameData.status === 'placing') {
      if (gameData.players[playerId]?.ready) {
        setGameMessage('Väntar på att motståndaren placerar sina skepp...');
      } else {
        setGameMessage('Placera dina skepp på spelplanen');
      }
    } else if (gameData.status === 'playing') {
      if (gameData.currentTurn === playerId) {
        setGameMessage('Din tur! Skjut mot motståndarens spelplan.');
      } else {
        setGameMessage('Motståndarens tur. Vänta medan de skjuter...');
      }
    } else if (gameData.status === 'finished') {
      // For finished games, leave message empty since we show result in the main content
      setGameMessage('');
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

  const handlePlayAgain = async () => {
    try {
      // Skapa ett nytt spel
      const newPlayerId = currentUser?.uid || `player_${Date.now()}`;
      const gameRef = await addDoc(collection(db, 'games'), {
        players: {
          [newPlayerId]: {
            ready: false,
            userId: currentUser?.uid || null
          }
        },
        status: 'waiting',
        createdAt: new Date().toISOString()
      });
      
      console.log(`Navigating to new game: /?gameId=${gameRef.id}&playerId=${newPlayerId}`);
      // Navigera till det nya spelet - using window.location for a full page refresh
      window.location.href = `/?gameId=${gameRef.id}&playerId=${newPlayerId}`;
    } catch (error) {
      console.error('Error creating new game:', error);
      setConnectionError('Kunde inte skapa ett nytt spel. Försök igen.');
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

      // Om vi träffade ett skepp, kolla om hela skeppet är sänkt
      if (wasHit && updatedBoard[targetCellIndex].shipId) {
        const shipId = updatedBoard[targetCellIndex].shipId;
        const shipCells = updatedBoard.filter(cell => cell.shipId === shipId);
        
        // Kolla om alla celler för detta skepp är träffade
        const isShipSunk = shipCells.every(cell => cell.isHit);
        
        if (isShipSunk) {
          console.log("Skepp sänkt! ID:", shipId);
          
          // Uppdatera alla celler som tillhör detta skepp för att markera dem som del av ett sänkt skepp
          for (let i = 0; i < updatedBoard.length; i++) {
            if (updatedBoard[i].shipId === shipId) {
              updatedBoard[i] = {
                ...updatedBoard[i],
                isSunkShip: true
              };
            }
          }
          
          // Uppdatera ship status
          if (updatedBoard[targetCellIndex].shipType) {
            const shipType = updatedBoard[targetCellIndex].shipType;
            if (opponentShips[shipType]) {
              const updatedOpponentShips = { ...opponentShips };
              updatedOpponentShips[shipType].sunk = true;
              setOpponentShips(updatedOpponentShips);
            }
          }
          
          // Visa meddelande om sänkt skepp
          const shipType = updatedBoard[targetCellIndex].shipType;
          const shipName = shipType ? opponentShips[shipType]?.name || shipType : "Skepp";
          setGameMessage(`Du sänkte ett ${shipName}!`);
          
          // Sätt en timeout för att återställa meddelandet efter 3 sekunder
          setTimeout(() => {
            if (gameState?.status === 'playing') {
              if (gameState.currentTurn === playerId) {
                setGameMessage('Din tur! Skjut mot motståndarens spelplan.');
              } else {
                setGameMessage('Motståndarens tur. Vänta medan de skjuter...');
              }
            }
          }, 3000);
        }
      }

      // Check if all ships are sunk
      const allShipsSunk = updatedBoard.filter(cell => cell.hasShip).every(cell => cell.isHit);
      
      try {
        if (allShipsSunk) {
          // Game is finished, update game and statistics
          await updateDoc(gameRef, {
            [`players.${opponentId}.board`]: updatedBoard,
            status: 'finished',
            winner: playerId,
            completedAt: new Date().toISOString()
          });
          
          // Update statistics if the user is authenticated
          if (currentUser) {
            // Update winner's stats
            await updateGameStats(currentUser.uid, true);
            
            // Update loser's stats
            const opponentUserId = gameState.players[opponentId]?.userId;
            if (opponentUserId) {
              // Kontrollera att det är ett giltigt användar-ID och inte null
              await updateGameStats(opponentUserId, false);
            }
          }
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
        setConnectionError('Det gick inte att uppdatera spelet. Försök igen.');
        
        // Återställ tillståndet efter en kort fördröjning
        setTimeout(() => {
          setConnectionError(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error updating game:', error);
      setConnectionError('Det gick inte att uppdatera spelet. Försök igen.');
      
      // Återställ tillståndet efter en kort fördröjning
      setTimeout(() => {
        setConnectionError(null);
      }, 3000);
    }
  };

  // Funktion för att uppdatera skeppsstatus baserat på brädet
  useEffect(() => {
    if (!opponentId || !gameState) return;
    
    const opponentBoardFlat = gameState.players[opponentId]?.board || [];
    
    // För varje skeppstyp, kontrollera om alla delar är träffade
    const shipTypes = ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'];
    const updatedOpponentShips = { ...opponentShips };
    
    for (const shipType of shipTypes) {
      const shipCells = opponentBoardFlat.filter(cell => cell.shipType === shipType);
      if (shipCells.length > 0) {
        const isShipSunk = shipCells.every(cell => cell.isHit);
        updatedOpponentShips[shipType].sunk = isShipSunk;
      }
    }
    
    setOpponentShips(updatedOpponentShips);
  }, [opponentBoard, opponentId, gameState]);

  const renderContent = () => {
    if (gameState?.status === 'waiting') {
      return (
        <div className="p-8 text-center bg-white border border-gray-200">
          <h2 className="text-2xl font-bold mb-4">Väntar på motståndare</h2>
          <p className="mb-4">Dela ditt spel-ID med en vän för att börja spela:</p>
          <div className="bg-gray-100 p-3 border border-gray-200 font-mono mb-4">{gameId}</div>
          <button 
            onClick={() => navigator.clipboard.writeText(gameId)}
            className="bg-[#8bb8a8] text-white px-4 py-2"
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

    if (gameState?.status === 'finished') {
      return (
        <div className="p-8 text-center bg-white">
          <h2 className="text-3xl font-bold mb-6">
            {gameState.winner === playerId ? 'Du vann!' : 'Du förlorade!'}
          </h2>
          
          <div className="flex flex-col items-center gap-4 mb-8">
            {/* Player board */}
            <div className="p-1 bg-white">
              <h2 className="text-lg font-bold mb-0 text-left">Din spelplan</h2>
              <div className="small-board">
                <GameBoard
                  isPlayerBoard={true}
                  board={playerBoard}
                  onCellClick={() => {}}
                  isSmall={true}
                />
              </div>
            </div>
            
            {/* Opponent board */}
            <div className="p-1 bg-white">
              <h2 className="text-lg font-bold mb-0 text-left">Motståndarens spelplan</h2>
              <div className="small-board">
                <GameBoard
                  isPlayerBoard={false}
                  board={opponentBoard}
                  onCellClick={() => {}}
                  isSmall={true}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
            <button 
              onClick={handlePlayAgain}
              className="bg-[#8bb8a8] text-white px-6 py-3 rounded text-lg"
            >
              Spela igen
            </button>
            <Link href="/active-games">
              <button className="bg-[#8bb8a8] text-white px-6 py-3 rounded text-lg">
                Tillbaka till mina spel
              </button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 items-center justify-center bg-white">
        {/* Player's board and ships in a vertical layout */}
        <div className="flex flex-col items-center gap-4">
          {/* Player board */}
          <div className="p-1 bg-white">
            <h2 className="text-lg font-bold mb-0 text-left">Din spelplan</h2>
            <div className="small-board">
              <GameBoard
                isPlayerBoard={true}
                board={playerBoard}
                onCellClick={() => {}}
                isSmall={true}
              />
            </div>
          </div>
          
          {/* Your Ships Status */}
          <div className="p-1 bg-white">
            <h2 className="text-lg font-bold mb-0 text-left">DINA SKEPP</h2>
            <ShipStatus ships={playerShips} />
          </div>
        </div>
        
        {/* Opponent's board */}
        <div className="p-1 bg-white relative">
          <h2 className="text-lg font-bold mb-0 text-left">Motståndarens spelplan</h2>
          <div className={!isPlayerTurn ? "opacity-50 pointer-events-none" : ""}>
            <GameBoard
              isPlayerBoard={false}
              board={opponentBoard}
              onCellClick={handleCellClick}
              isSmall={false}
            />
            
            {!isPlayerTurn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black bg-opacity-30 rounded-lg p-3 text-white text-lg font-bold">
                  Väntar på motståndaren...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tur-modal som visas när det blir användarens tur */}
        {showTurnModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-green-600 text-white px-8 py-4 rounded-lg shadow-lg text-xl font-bold animate-bounce">
              Din tur!
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <div className="w-full max-w-4xl flex justify-end">
        <Link
          href="/active-games"
          className="text-gray-600 hover:text-gray-800 text-sm flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Tillbaka till mina spel
        </Link>
      </div>
      
      {connectionError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-xl w-full">
          <span className="block sm:inline">{connectionError}</span>
          {attemptingReconnect && <span className="block mt-1">Försöker återansluta...</span>}
        </div>
      )}
      
      {renderContent()}
      <div className="text-center p-4 bg-white max-w-xl w-full">
        <p className="text-lg font-medium">
          {gameMessage}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Spel-ID: {gameId}
        </p>
      </div>
    </div>
  );
};

export default Game; 