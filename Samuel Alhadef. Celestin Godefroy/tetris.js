class Tetris {
  constructor() {
      // Configuration du jeu
      this.gameBoard = document.getElementById('game-board');
      this.gridWidth = 10;
      this.gridHeight = 20;
      this.cellSize = 30;
      this.lastFrameTime = 0;
      this.dropInterval = 1000;
      this.dropCounter = 0;
      this.score = 0;
      this.level = 1;
      this.gameOver = false;
      this.currentPiece = null;

      // Initialisation de la grille
      this.grid = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(0));

      // Définition des couleurs
      this.colors = [
          'transparent',
          'var(--soviet-red)',
          'var(--soviet-yellow)',
          'var(--soviet-red-dark)',
          '#B22222',
          '#CD5C5C',
          '#DC143C',
          '#FF4500'
      ];

      // Définition des pièces
      this.pieces = [
          [[1, 1, 1, 1]],                    // I
          [[1, 1], [1, 1]],                  // O
          [[1, 1, 1], [0, 1, 0]],           // T
          [[1, 1, 1], [1, 0, 0]],           // L
          [[1, 1, 1], [0, 0, 1]],           // J
          [[1, 1, 0], [0, 1, 1]],           // S
          [[0, 1, 1], [1, 1, 0]]            // Z
      ];

      // Initialisation des contrôles et WebSocket
      this.initializeControls();
      this.initializeWebSocket();
      this.currentPiece = this.newPiece();
      this.nextPiece = this.newPiece();
      this.gameLoop();
  }

  initializeWebSocket() {
    this.ws = new WebSocket('ws://' + window.location.hostname + ':81/');
    
    this.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            switch(data.command) {
                case 'start':
                    if (this.gameOver) {
                        this.restart();
                    } else if (!window.tetris) {
                        startGame();
                    }
                    break;
                case 'left':
                    this.movePiece(-1, 0);
                    break;
                case 'right':
                    this.movePiece(1, 0);
                    break;
                case 'down':
                    this.movePiece(0, 1);
                    break;
                case 'rotate':
                    this.rotatePiece();
                    break;
                case 'drop':
                    this.hardDrop();
                    break;
            }
        } catch (e) {
            console.error('Erreur WebSocket:', e);
        }
    };

    this.ws.onclose = () => {
        console.log('WebSocket déconnecté, tentative de reconnexion...');
        setTimeout(() => this.initializeWebSocket(), 1000);
    };

    this.ws.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
    };
}
  initializeControls() {
      document.addEventListener('keydown', (e) => {
          if (this.gameOver) return;

          switch (e.code) {
              case 'ArrowLeft':
                  this.movePiece(-1, 0);
                  break;
              case 'ArrowRight':
                  this.movePiece(1, 0);
                  break;
              case 'ArrowDown':
                  this.movePiece(0, 1);
                  break;
              case 'ArrowUp':
                  this.rotatePiece();
                  break;
              case 'Space':
                  e.preventDefault();
                  this.hardDrop();
                  break;
          }
      });

      // Contrôles tactiles pour mobile
      let touchStartX = null;
      let touchStartY = null;

      document.addEventListener('touchstart', (e) => {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
      });

      document.addEventListener('touchmove', (e) => {
          if (!touchStartX || !touchStartY) return;

          const touchEndX = e.touches[0].clientX;
          const touchEndY = e.touches[0].clientY;
          const deltaX = touchEndX - touchStartX;
          const deltaY = touchEndY - touchStartY;

          if (Math.abs(deltaX) > Math.abs(deltaY)) {
              if (deltaX > 30) this.movePiece(1, 0);
              else if (deltaX < -30) this.movePiece(-1, 0);
          } else {
              if (deltaY > 30) this.movePiece(0, 1);
              else if (deltaY < -30) this.rotatePiece();
          }

          touchStartX = touchEndX;
          touchStartY = touchEndY;
      });

      document.addEventListener('touchend', () => {
          touchStartX = null;
          touchStartY = null;
      });
  }

  newPiece() {
      const pieceType = Math.floor(Math.random() * this.pieces.length);
      const piece = {
          shape: this.pieces[pieceType],
          color: this.colors[pieceType + 1],
          x: Math.floor(this.gridWidth / 2) - Math.floor(this.pieces[pieceType][0].length / 2),
          y: 0
      };

      if (this.checkCollision(piece)) {
          this.gameOver = true;
          return null;
      }

      return piece;
  }

  checkCollision(piece, offsetX = 0, offsetY = 0) {
      return piece.shape.some((row, y) => {
          return row.some((cell, x) => {
              if (cell === 0) return false;
              const newX = piece.x + x + offsetX;
              const newY = piece.y + y + offsetY;
              return (
                  newX < 0 ||
                  newX >= this.gridWidth ||
                  newY >= this.gridHeight ||
                  (newY >= 0 && this.grid[newY][newX])
              );
          });
      });
  }

  movePiece(dx, dy) {
      if (!this.currentPiece) return;

      if (!this.checkCollision(this.currentPiece, dx, dy)) {
          this.currentPiece.x += dx;
          this.currentPiece.y += dy;
          return true;
      }

      if (dy > 0) {
          this.lockPiece();
          this.clearLines();
          this.currentPiece = this.nextPiece;
          this.nextPiece = this.newPiece();
      }
      return false;
  }

  rotatePiece() {
      if (!this.currentPiece) return;

      const newShape = this.currentPiece.shape[0].map((_, i) =>
          this.currentPiece.shape.map(row => row[i]).reverse()
      );

      const oldShape = this.currentPiece.shape;
      this.currentPiece.shape = newShape;

      // Wall kick
      let offset = 1;
      while (this.checkCollision(this.currentPiece)) {
          this.currentPiece.x += offset;
          offset = -(offset + (offset > 0 ? 1 : -1));
          if (Math.abs(offset) > this.currentPiece.shape[0].length) {
              this.currentPiece.shape = oldShape;
              this.currentPiece.x = this.currentPiece.x;
              return;
          }
      }
  }

  hardDrop() {
      while (this.movePiece(0, 1)) {
          continue;
      }
  }

  lockPiece() {
      this.currentPiece.shape.forEach((row, y) => {
          row.forEach((cell, x) => {
              if (cell) {
                  const gridY = this.currentPiece.y + y;
                  const gridX = this.currentPiece.x + x;
                  if (gridY >= 0) {
                      this.grid[gridY][gridX] = this.colors.indexOf(this.currentPiece.color);
                  }
              }
          });
      });
  }

  clearLines() {
      let linesCleared = 0;

      for (let y = this.gridHeight - 1; y >= 0; y--) {
          if (this.grid[y].every(cell => cell !== 0)) {
              this.grid.splice(y, 1);
              this.grid.unshift(Array(this.gridWidth).fill(0));
              linesCleared++;
              y++;
          }
      }

      if (linesCleared > 0) {
          this.updateScore(linesCleared);
      }
  }

  updateScore(linesCleared) {
      const points = [0, 100, 300, 500, 800];
      this.score += points[linesCleared] * this.level;
      this.level = Math.floor(this.score / 1000) + 1;
      
      document.getElementById('score').textContent = this.score;
      document.getElementById('level').textContent = this.level;
      
      this.dropInterval = Math.max(1000 - (this.level - 1) * 100, 100);
  }

  draw() {
      this.gameBoard.innerHTML = '';

      // Dessin de la grille
      this.grid.forEach((row, y) => {
          row.forEach((cell, x) => {
              if (cell) {
                  this.drawCell(x, y, this.colors[cell]);
              }
          });
      });

      // Dessin de la pièce courante
      if (this.currentPiece) {
          this.currentPiece.shape.forEach((row, y) => {
              row.forEach((cell, x) => {
                  if (cell) {
                      this.drawCell(
                          this.currentPiece.x + x,
                          this.currentPiece.y + y,
                          this.currentPiece.color
                      );
                  }
              });
          });
      }

      // Affichage du game over
      if (this.gameOver) {
          document.getElementById('game-over').style.display = 'block';
          document.getElementById('final-score').textContent = this.score;
      }
  }

  drawCell(x, y, color) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.backgroundColor = color;
      cell.style.left = `${x * this.cellSize}px`;
      cell.style.top = `${y * this.cellSize}px`;
      cell.style.width = `${this.cellSize}px`;
      cell.style.height = `${this.cellSize}px`;
      cell.style.boxShadow = 'inset 2px 2px 2px rgba(255,255,255,0.2), inset -2px -2px 2px rgba(0,0,0,0.2)';
      this.gameBoard.appendChild(cell);
  }

  restart() {
      this.grid = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(0));
      this.score = 0;
      this.level = 1;
      this.gameOver = false;
      this.dropCounter = 0;
      this.lastFrameTime = 0;
      this.dropInterval = 1000;
      this.currentPiece = this.newPiece();
      this.nextPiece = this.newPiece();
      
      document.getElementById('score').textContent = '0';
      document.getElementById('level').textContent = '1';
      document.getElementById('game-over').style.display = 'none';
      
      if (!this.gameLoop.isRunning) {
          this.gameLoop();
      }
  }

  gameLoop(currentTime = 0) {
      if (this.gameOver) {
          this.gameLoop.isRunning = false;
          return;
      }

      this.gameLoop.isRunning = true;

      const deltaTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      this.dropCounter += deltaTime;
      if (this.dropCounter > this.dropInterval) {
          this.movePiece(0, 1);
          this.dropCounter = 0;
      }

      this.draw();
      requestAnimationFrame(time => this.gameLoop(time));
  }
}

function startGame() {
  document.getElementById('main-menu').style.display = 'none';
  document.querySelector('.game-container').style.display = 'block';
  if (!window.tetris) {
      window.tetris = new Tetris();
  }
}

window.startGame = startGame;