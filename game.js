// ИГРА-ПЛАТФОРМЕР - ИСПРАВЛЕННАЯ ВЕРСИЯ
// Использованы нейросети: DeepSeek, ChatGPT
// Время выполнения: ~6 часов (полная переработка физики и коллизий)
// С помощью нейросетей создано: вся логика коллизий, физика, генерация уровней

(function(){
    // --- НАСТРОЙКИ CANVAS ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // --- ЭЛЕМЕНТЫ UI ---
    const scoreSpan = document.getElementById('scoreValue');
    const livesSpan = document.getElementById('livesValue');
    const coinsSpan = document.getElementById('coinsValue');
    const totalCoinsSpan = document.getElementById('totalCoinsValue');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const restartBtn = document.getElementById('restartBtn');
    const messageOverlay = document.getElementById('messageOverlay');
    const messageTitle = document.getElementById('messageTitle');
    const messageText = document.getElementById('messageText');
    const messageBtn = document.getElementById('messageBtn');

    // --- ПАРАМЕТРЫ ИГРЫ ---
    let gameRunning = false;
    let paused = false;
    let animationId = null;
    let score = 0;
    let lives = 3;
    let collectedCoins = 0;
    let totalCoins = 0;

    // --- ОБЪЕКТЫ МИРА ---
    let platforms = [];
    let coins = [];
    let enemies = [];
    let player = null;
    
    // Камера
    let cameraX = 0;
    const WORLD_WIDTH = 2800;
    
    // Флаги для управления
    const keys = {
        left: false,
        right: false,
        jump: false,
        canJump: true
    };
    
    let jumpPressed = false;
    
    // --- КЛАСС ИГРОКА (с улучшенной физикой) ---
    class Player {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = 28;
            this.height = 28;
            this.vx = 0;
            this.vy = 0;
            this.speed = 3;
            this.jumpPower = -10.5;
            this.gravity = 0.4;
            this.onGround = false;
            this.facingRight = true;
            this.isDead = false;
        }
        
        update(platformsList) {
            if (this.isDead) return false;
            
            // Применяем гравитацию
            this.vy += this.gravity;
            
            // Горизонтальное движение
            this.x += this.vx;
            
            // Коллизии по горизонтали
            for (let platform of platformsList) {
                if (this.checkCollision(platform)) {
                    if (this.vx > 0) {
                        this.x = platform.x - this.width;
                    } else if (this.vx < 0) {
                        this.x = platform.x + platform.w;
                    }
                }
            }
            
            // Вертикальное движение
            this.y += this.vy;
            this.onGround = false;
            
            // Коллизии по вертикали
            for (let platform of platformsList) {
                if (this.checkCollision(platform)) {
                    if (this.vy >= 0) {
                        // Падаем на платформу
                        this.y = platform.y - this.height;
                        this.vy = 0;
                        this.onGround = true;
                    } else if (this.vy < 0) {
                        // Ударяемся головой
                        this.y = platform.y + platform.h;
                        this.vy = 0;
                    }
                }
            }
            
            // Прыжок
            if (keys.jump && this.onGround && !jumpPressed) {
                this.vy = this.jumpPower;
                this.onGround = false;
                jumpPressed = true;
            }
            
            if (!keys.jump) {
                jumpPressed = false;
            }
            
            // Границы мира
            if (this.x < 50) this.x = 50;
            if (this.x + this.width > WORLD_WIDTH - 50) {
                this.x = WORLD_WIDTH - this.width - 50;
            }
            
            // Проверка падения в бездну
            if (this.y > canvas.height + 100) {
                return false; // смерть
            }
            
            if (this.y < 0) {
                this.y = 0;
                if (this.vy < 0) this.vy = 0;
            }
            
            return true;
        }
        
        checkCollision(platform) {
            return this.x < platform.x + platform.w &&
                   this.x + this.width > platform.x &&
                   this.y < platform.y + platform.h &&
                   this.y + this.height > platform.y;
        }
        
        draw(ctx, camX) {
            let drawX = this.x - camX;
            ctx.save();
            ctx.shadowBlur = 5;
            ctx.shadowColor = "black";
            
            // Тело
            let grad = ctx.createLinearGradient(drawX, this.y, drawX + this.width, this.y + this.height);
            grad.addColorStop(0, '#4CAF50');
            grad.addColorStop(1, '#2E7D32');
            ctx.fillStyle = grad;
            ctx.fillRect(drawX, this.y, this.width, this.height);
            
            // Глаза
            ctx.fillStyle = "white";
            ctx.beginPath();
            let eyeX = this.facingRight ? drawX + this.width - 8 : drawX + 6;
            ctx.arc(eyeX, this.y + 9, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#1a1a2e";
            ctx.beginPath();
            ctx.arc(eyeX, this.y + 8, 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Кепка
            ctx.fillStyle = "#FF5722";
            ctx.fillRect(drawX + 2, this.y - 6, this.width - 4, 8);
            ctx.fillStyle = "#E64A19";
            ctx.fillRect(drawX, this.y - 2, this.width, 4);
            
            ctx.restore();
        }
        
        moveLeft() {
            this.vx = -this.speed;
            this.facingRight = false;
        }
        
        moveRight() {
            this.vx = this.speed;
            this.facingRight = true;
        }
        
        stopMove() {
            this.vx = 0;
        }
        
        respawn(x, y) {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.isDead = false;
            this.onGround = false;
        }
    }
    
    // --- МОНЕТА ---
    class Coin {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.w = 12;
            this.h = 12;
            this.collected = false;
            this.animationOffset = Math.random() * Math.PI * 2;
        }
        
        draw(ctx, camX, time) {
            if (this.collected) return;
            let drawX = this.x - camX;
            let bob = Math.sin(time * 0.005 + this.animationOffset) * 3;
            
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = "gold";
            ctx.fillStyle = "#FFD700";
            ctx.beginPath();
            ctx.ellipse(drawX + this.w/2, this.y + this.h/2 + bob, this.w/2, this.h/2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFA500";
            ctx.beginPath();
            ctx.ellipse(drawX + this.w/2, this.y + this.h/2 + bob, this.w/3, this.h/3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFF176";
            ctx.font = "bold 9px monospace";
            ctx.fillText("★", drawX + 3, this.y + 9 + bob);
            ctx.restore();
        }
    }
    
    // --- ВРАГ ---
    class Enemy {
        constructor(x, y, moveRange = 100, speed = 1.2) {
            this.x = x;
            this.y = y;
            this.w = 26;
            this.h = 26;
            this.startX = x;
            this.range = moveRange;
            this.speed = speed;
            this.dir = 1;
        }
        
        update() {
            this.x += this.speed * this.dir;
            if (this.x >= this.startX + this.range) {
                this.x = this.startX + this.range;
                this.dir = -1;
            }
            if (this.x <= this.startX - this.range) {
                this.x = this.startX - this.range;
                this.dir = 1;
            }
        }
        
        draw(ctx, camX) {
            let drawX = this.x - camX;
            ctx.fillStyle = "#D32F2F";
            ctx.fillRect(drawX, this.y, this.w, this.h);
            ctx.fillStyle = "#B71C1C";
            ctx.fillRect(drawX + 4, this.y - 5, this.w - 8, 7);
            ctx.fillStyle = "white";
            ctx.fillRect(drawX + 5, this.y + 6, 5, 5);
            ctx.fillRect(drawX + 16, this.y + 6, 5, 5);
            ctx.fillStyle = "black";
            ctx.fillRect(drawX + 6, this.y + 7, 3, 3);
            ctx.fillRect(drawX + 17, this.y + 7, 3, 3);
            // брови
            ctx.fillStyle = "#4A0000";
            ctx.fillRect(drawX + 4, this.y + 3, 7, 2);
            ctx.fillRect(drawX + 15, this.y + 3, 7, 2);
        }
        
        checkCollision(player) {
            return player.x < this.x + this.w &&
                   player.x + player.width > this.x &&
                   player.y < this.y + this.h &&
                   player.y + player.height > this.y;
        }
    }
    
    // --- ПЛАТФОРМА ---
    class Platform {
        constructor(x, y, w, h, type = 'normal') {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.type = type;
        }
        
        draw(ctx, camX) {
            let drawX = this.x - camX;
            // Основная платформа
            ctx.fillStyle = "#8B5A2B";
            ctx.fillRect(drawX, this.y, this.w, this.h);
            // Верхняя часть
            ctx.fillStyle = "#A0522D";
            ctx.fillRect(drawX, this.y - 4, this.w, 6);
            // Детали
            ctx.fillStyle = "#6B3E1B";
            for (let i = 0; i < this.w; i += 25) {
                ctx.fillRect(drawX + i + 5, this.y - 2, 15, 3);
            }
            // Текстура дерева
            ctx.fillStyle = "#5D3A1A";
            for (let i = 0; i < this.w; i += 20) {
                ctx.fillRect(drawX + i + 3, this.y + 5, 3, this.h - 10);
            }
        }
    }
    
    // --- ГЕНЕРАЦИЯ УРОВНЯ ---
    function buildLevel() {
        platforms = [];
        coins = [];
        enemies = [];
        
        // Земля (основная платформа)
        platforms.push(new Platform(0, canvas.height - 40, WORLD_WIDTH, 40));
        
        // Платформы для прыжков
        const platformData = [
            { x: 150, y: 430, w: 100, h: 20 },
            { x: 350, y: 390, w: 90, h: 20 },
            { x: 550, y: 350, w: 100, h: 20 },
            { x: 750, y: 400, w: 80, h: 20 },
            { x: 950, y: 340, w: 100, h: 20 },
            { x: 1150, y: 380, w: 90, h: 20 },
            { x: 1350, y: 310, w: 110, h: 20 },
            { x: 1550, y: 360, w: 90, h: 20 },
            { x: 1750, y: 290, w: 100, h: 20 },
            { x: 1950, y: 340, w: 100, h: 20 },
            { x: 2150, y: 280, w: 110, h: 20 },
            { x: 2350, y: 330, w: 90, h: 20 },
            { x: 2550, y: 300, w: 100, h: 20 },
            { x: 2700, y: 350, w: 80, h: 20 }
        ];
        
        // Воздушные платформы
        const airPlatforms = [
            { x: 450, y: 280, w: 70, h: 15 },
            { x: 680, y: 240, w: 70, h: 15 },
            { x: 850, y: 270, w: 80, h: 15 },
            { x: 1050, y: 220, w: 80, h: 15 },
            { x: 1250, y: 250, w: 70, h: 15 },
            { x: 1450, y: 200, w: 80, h: 15 },
            { x: 1650, y: 230, w: 70, h: 15 },
            { x: 1850, y: 180, w: 80, h: 15 },
            { x: 2050, y: 220, w: 80, h: 15 },
            { x: 2250, y: 170, w: 90, h: 15 },
            { x: 2450, y: 210, w: 80, h: 15 },
            { x: 2620, y: 190, w: 70, h: 15 }
        ];
        
        platformData.forEach(p => platforms.push(new Platform(p.x, p.y, p.w, p.h)));
        airPlatforms.forEach(p => platforms.push(new Platform(p.x, p.y, p.w, p.h)));
        
        // Монеты
        const coinPositions = [
            [180, 395], [400, 355], [580, 315], [780, 365], [980, 305],
            [1180, 345], [1380, 275], [1580, 325], [1780, 255], [1980, 305],
            [2180, 245], [2380, 295], [2580, 265], [2720, 315],
            [480, 245], [710, 205], [890, 235], [1090, 185], [1290, 215],
            [1490, 165], [1690, 195], [1890, 145], [2090, 185], [2290, 135],
            [2490, 175], [2650, 155]
        ];
        
        coinPositions.forEach(pos => {
            coins.push(new Coin(pos[0], pos[1]));
        });
        
        totalCoins = coins.length;
        totalCoinsSpan.innerText = totalCoins;
        
        // Враги
        enemies.push(new Enemy(450, 360, 120, 1.1));
        enemies.push(new Enemy(850, 380, 100, 1.2));
        enemies.push(new Enemy(1250, 340, 110, 1.3));
        enemies.push(new Enemy(1650, 350, 130, 1.2));
        enemies.push(new Enemy(2050, 320, 120, 1.4));
        enemies.push(new Enemy(2450, 310, 140, 1.3));
        enemies.push(new Enemy(2650, 330, 100, 1.5));
    }
    
    // --- СБРОС ИГРЫ ---
    function resetGame() {
        score = 0;
        lives = 3;
        collectedCoins = 0;
        updateUI();
        buildLevel();
        player = new Player(100, canvas.height - 80);
        cameraX = 0;
        keys.left = false;
        keys.right = false;
        keys.jump = false;
        jumpPressed = false;
        if (gameRunning) {
            gameRunning = true;
        }
        paused = false;
        hideMessage();
    }
    
    // --- ОБНОВЛЕНИЕ UI ---
    function updateUI() {
        scoreSpan.innerText = score;
        livesSpan.innerText = lives;
        coinsSpan.innerText = collectedCoins;
    }
    
    // --- СБОР МОНЕТ ---
    function handleCollectibles() {
        for (let coin of coins) {
            if (!coin.collected && 
                player.x < coin.x + coin.w && 
                player.x + player.width > coin.x &&
                player.y < coin.y + coin.h && 
                player.y + player.height > coin.y) {
                coin.collected = true;
                collectedCoins++;
                score += 10;
                updateUI();
            }
        }
    }
    
    // --- СТОЛКНОВЕНИЯ С ВРАГАМИ ---
    function handleEnemiesCollision() {
        for (let enemy of enemies) {
            if (enemy.checkCollision(player)) {
                lives--;
                updateUI();
                
                if (lives <= 0) {
                    gameOver(false);
                    return false;
                }
                
                // Возрождение с отбрасыванием
                player.respawn(100, canvas.height - 80);
                cameraX = 0;
                
                // Небольшая задержка после смерти
                return false;
            }
        }
        return true;
    }
    
    // --- ПРОВЕРКА ПОБЕДЫ ---
    function checkWin() {
        if (collectedCoins >= totalCoins && totalCoins > 0) {
            gameOver(true);
            return true;
        }
        return false;
    }
    
    // --- КОНЕЦ ИГРЫ ---
    function gameOver(isWin) {
        gameRunning = false;
        if (animationId) cancelAnimationFrame(animationId);
        
        if (isWin) {
            messageTitle.innerText = "🎉 ПОБЕДА! 🎉";
            messageText.innerText = `Вы набрали ${score} очков и собрали все монеты! Нажмите "Старт" для новой игры.`;
        } else {
            messageTitle.innerText = "💀 ИГРА ОКОНЧЕНА 💀";
            messageText.innerText = "Вы проиграли. Нажмите 'Рестарт' для новой попытки.";
        }
        showMessage();
    }
    
    function showMessage() { 
        messageOverlay.classList.remove('hidden'); 
    }
    
    function hideMessage() { 
        messageOverlay.classList.add('hidden'); 
    }
    
    // --- ОБНОВЛЕНИЕ ИГРЫ ---
    let lastTimestamp = 0;
    
    function updateGame() {
        if (!gameRunning || paused) return;
        
        // Обновление игрока
        const alive = player.update(platforms);
        if (!alive) {
            lives--;
            updateUI();
            if (lives <= 0) {
                gameOver(false);
                return;
            } else {
                player.respawn(100, canvas.height - 80);
                cameraX = 0;
            }
        }
        
        // Обновление врагов
        for (let enemy of enemies) {
            enemy.update();
        }
        
        // Сбор монет
        handleCollectibles();
        
        // Столкновения с врагами
        const enemyCollision = handleEnemiesCollision();
        if (!enemyCollision) return;
        
        // Проверка победы
        if (checkWin()) return;
        
        // Обновление камеры
        let targetCam = player.x + player.width / 2 - canvas.width / 2;
        targetCam = Math.max(0, Math.min(targetCam, WORLD_WIDTH - canvas.width));
        cameraX = cameraX * 0.92 + targetCam * 0.08;
    }
    
    // --- ОТРИСОВКА ---
    let animationTime = 0;
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Небо
        let gradSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradSky.addColorStop(0, "#64B5F6");
        gradSky.addColorStop(1, "#B3E5FC");
        ctx.fillStyle = gradSky;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Облака
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        for (let i = 0; i < 5; i++) {
            let cloudX = (cameraX * 0.3 + i * 300) % (WORLD_WIDTH + 400) - 200;
            ctx.beginPath();
            ctx.ellipse(cloudX, 60, 45, 35, 0, 0, Math.PI * 2);
            ctx.ellipse(cloudX + 40, 50, 50, 40, 0, 0, Math.PI * 2);
            ctx.ellipse(cloudX + 80, 60, 45, 35, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Платформы
        for (let platform of platforms) {
            platform.draw(ctx, cameraX);
        }
        
        // Монеты
        animationTime++;
        for (let coin of coins) {
            coin.draw(ctx, cameraX, animationTime);
        }
        
        // Враги
        for (let enemy of enemies) {
            enemy.draw(ctx, cameraX);
        }
        
        // Игрок
        if (player) {
            player.draw(ctx, cameraX);
        }
        
        // Финальная граница
        ctx.fillStyle = "#5D3A1A";
        ctx.fillRect(WORLD_WIDTH - cameraX - 20, 0, 20, canvas.height);
        ctx.fillStyle = "#8B5A2B";
        ctx.fillRect(WORLD_WIDTH - cameraX - 25, 0, 5, canvas.height);
        
        // Пауза
        if (paused && gameRunning) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 30px monospace";
            ctx.textAlign = "center";
            ctx.fillText("ПАУЗА", canvas.width / 2, canvas.height / 2);
            ctx.font = "16px monospace";
            ctx.fillText("Нажмите 'Пауза' снова", canvas.width / 2, canvas.height / 2 + 40);
        }
    }
    
    // --- ИГРОВОЙ ЦИКЛ ---
    function gameLoop() {
        updateGame();
        draw();
        animationId = requestAnimationFrame(gameLoop);
    }
    
    // --- ОБРАБОТКА ВВОДА ---
    function updateMovement() {
        if (!gameRunning || paused || !player) return;
        
        if (keys.left && !keys.right) {
            player.moveLeft();
        } else if (keys.right && !keys.left) {
            player.moveRight();
        } else {
            player.stopMove();
        }
    }
    
    // --- СОБЫТИЯ КЛАВИАТУРЫ ---
    function handleKeyDown(e) {
        const code = e.code;
        
        switch (code) {
            case 'ArrowLeft':
            case 'KeyA':
                keys.left = true;
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'KeyD':
                keys.right = true;
                e.preventDefault();
                break;
            case 'ArrowUp':
            case 'Space':
            case 'KeyW':
                keys.jump = true;
                e.preventDefault();
                break;
            case 'KeyR':
                resetGame();
                if (!gameRunning) gameRunning = true;
                paused = false;
                hideMessage();
                e.preventDefault();
                break;
        }
    }
    
    function handleKeyUp(e) {
        const code = e.code;
        
        switch (code) {
            case 'ArrowLeft':
            case 'KeyA':
                keys.left = false;
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'KeyD':
                keys.right = false;
                e.preventDefault();
                break;
            case 'ArrowUp':
            case 'Space':
            case 'KeyW':
                keys.jump = false;
                e.preventDefault();
                break;
        }
    }
    
    // --- КНОПКИ УПРАВЛЕНИЯ ---
    startBtn.onclick = () => {
        if (!gameRunning) {
            resetGame();
            gameRunning = true;
            paused = false;
            hideMessage();
        } else if (paused) {
            paused = false;
            hideMessage();
        }
    };
    
    pauseBtn.onclick = () => {
        if (gameRunning) {
            paused = !paused;
        }
    };
    
    restartBtn.onclick = () => {
        resetGame();
        gameRunning = true;
        paused = false;
        hideMessage();
    };
    
    messageBtn.onclick = () => {
        hideMessage();
        if (!gameRunning) {
            gameRunning = false;
        }
    };
    
    // --- ЗАПУСК ---
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Цикл обновления движения
    setInterval(updateMovement, 16);
    
    // Инициализация
    buildLevel();
    player = new Player(100, canvas.height - 80);
    updateUI();
    gameRunning = false;
    gameLoop();
})();