// Virtual Mouse Overlay - Componente no intrusivo para control gestual
// Se puede integrar en cualquier página sin afectar el diseño existente

class VirtualMouseOverlay {
    constructor(options = {}) {
        // Aplicar configuración automática basada en la página
        const pageConfig = this.getPageConfig();
        
        this.options = {
            enabled: false,
            showCursor: true,
            showCamera: true,
            showControls: true,
            showInstructions: true,
            cursorColor: '#ff4444',
            clickColor: '#44ff44',
            cameraSize: { width: 240, height: 180 },
            clickCooldown: 600,
            minConfidence: 0.7,
            position: 'top-right',
            ...pageConfig,
            ...options
        };

        this.isInitialized = false;
        this.hands = null;
        this.camera = null;
        this.currentHand = null;
        this.isClicking = false;
        this.lastClickTime = 0;
        this.elements = {};

        // Bind methods
        this.processHands = this.processHands.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    // Obtener configuración específica de la página
    getPageConfig() {
        if (typeof window.getVirtualMouseConfig === 'function') {
            return window.getVirtualMouseConfig();
        }
        return {};
    }

    // Inicializar el componente
    async init() {
        if (this.isInitialized) return;

        try {
            await this.loadMediaPipe();
            this.createElements();
            this.setupEventListeners();
            this.applyPageConfiguration();
            this.isInitialized = true;
            console.log('Virtual Mouse Overlay initialized for:', window.location.pathname);
            
            // Auto-activar si está configurado
            if (this.options.enabled) {
                await this.enable();
            }
        } catch (error) {
            console.error('Error initializing Virtual Mouse Overlay:', error);
        }
    }

    // Aplicar configuración específica de la página
    applyPageConfiguration() {
        if (this.elements && typeof window.applyVirtualMousePosition === 'function') {
            window.applyVirtualMousePosition(this.options.position, {
                toggle: this.elements.toggle,
                camera: this.elements.camera,
                controls: this.elements.controls,
                instructions: this.elements.instructions
            });
        }
        
        // Aplicar visibilidad inicial
        if (!this.options.showInstructions && this.elements.instructions) {
            this.elements.instructions.style.display = 'none';
        }

        // Asegurar que el cursor tenga los estilos correctos
        if (this.elements.cursor) {
            this.elements.cursor.style.position = 'fixed';
            this.elements.cursor.style.zIndex = '9999999';
            this.elements.cursor.style.pointerEvents = 'none';
            console.log('Cursor element initialized:', this.elements.cursor);
        }
    }

    // Cargar librerías de MediaPipe si no están disponibles
    async loadMediaPipe() {
        if (typeof Hands === 'undefined') {
            await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
            await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js');
            await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
            await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        }
    }

    // Cargar script dinámicamente
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Crear elementos del overlay
    createElements() {
        // Contenedor principal
        const overlay = document.createElement('div');
        overlay.id = 'virtual-mouse-overlay';
        overlay.innerHTML = `
            <style>
                #virtual-mouse-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999999;
                    font-family: Arial, sans-serif;
                }

                .vm-toggle-btn {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    width: 50px;
                    height: 50px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    pointer-events: auto;
                    z-index: 1000000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    color: white;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    transition: all 0.3s ease;
                }

                .vm-toggle-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
                }

                .vm-toggle-btn.active {
                    background: linear-gradient(135deg, #4caf50, #45a049);
                }

                .vm-camera {
                    position: fixed;
                    top: 70px;
                    right: 10px;
                    width: ${this.options.cameraSize.width}px;
                    height: ${this.options.cameraSize.height}px;
                    border: 2px solid #4caf50;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #000;
                    display: none;
                    pointer-events: none;
                }

                .vm-camera.active {
                    display: block;
                }

                .vm-camera video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transform: scaleX(-1);
                }

                .vm-camera canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

                .vm-cursor {
                    position: fixed !important;
                    width: 20px !important;
                    height: 20px !important;
                    background: radial-gradient(circle, ${this.options.cursorColor}, #aa0000) !important;
                    border: 2px solid white !important;
                    border-radius: 50% !important;
                    pointer-events: none !important;
                    transform: translate(-50%, -50%) !important;
                    box-shadow: 0 0 10px rgba(255, 68, 68, 0.8) !important;
                    display: none !important;
                    transition: all 0.1s ease !important;
                    z-index: 9999999 !important;
                }

                .vm-cursor.clicking {
                    background: radial-gradient(circle, ${this.options.clickColor}, #00aa00) !important;
                    transform: translate(-50%, -50%) scale(1.5) !important;
                    box-shadow: 0 0 15px rgba(68, 255, 68, 1) !important;
                }

                .vm-controls {
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 12px;
                    display: none;
                    pointer-events: none;
                    min-width: 200px;
                }

                .vm-controls.active {
                    display: block;
                }

                .vm-status {
                    display: flex;
                    align-items: center;
                    margin: 4px 0;
                }

                .vm-status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 8px;
                }

                .vm-status-dot.green { background: #4caf50; }
                .vm-status-dot.red { background: #f44336; }

                .vm-click-effect {
                    position: fixed;
                    width: 0;
                    height: 0;
                    border: 2px solid ${this.options.clickColor};
                    border-radius: 50%;
                    pointer-events: none;
                    animation: vm-ripple 0.6s ease-out forwards;
                }

                @keyframes vm-ripple {
                    0% { width: 0; height: 0; opacity: 1; }
                    100% { width: 60px; height: 60px; margin: -30px 0 0 -30px; opacity: 0; }
                }

                .vm-instructions {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 11px;
                    display: none;
                    pointer-events: none;
                    max-width: 180px;
                }

                .vm-instructions.active {
                    display: block;
                }
            </style>

            <!-- Botón de activación/desactivación -->
            <button class="vm-toggle-btn" id="vm-toggle">🖱️</button>

            <!-- Cámara -->
            <div class="vm-camera" id="vm-camera">
                <video id="vm-video" autoplay muted playsinline></video>
                <canvas id="vm-canvas" width="${this.options.cameraSize.width}" height="${this.options.cameraSize.height}"></canvas>
            </div>

            <!-- Cursor virtual -->
            <div id="vm-cursor"></div>

            <!-- Controles de estado -->
            <div class="vm-controls" id="vm-controls">
                <div class="vm-status">
                    <div class="vm-status-dot red" id="vm-camera-dot"></div>
                    <span id="vm-camera-status">Cámara: OFF</span>
                </div>
                <div class="vm-status">
                    <div class="vm-status-dot red" id="vm-hand-dot"></div>
                    <span id="vm-hand-status">Mano: NO</span>
                </div>
                <div class="vm-status">
                    <div class="vm-status-dot red" id="vm-click-dot"></div>
                    <span id="vm-click-status">Click: OFF</span>
                </div>
            </div>

            <!-- Instrucciones -->
            <div class="vm-instructions" id="vm-instructions">
                <strong>Control Gestual:</strong><br>
                • Extiende tu mano<br>
                • Apunta con el índice<br>
                • Cierra el puño = click<br>
                • Ctrl+M = toggle
            </div>
        `;

        document.body.appendChild(overlay);

        // Guardar referencias
        this.elements = {
            overlay,
            toggle: document.getElementById('vm-toggle'),
            camera: document.getElementById('vm-camera'),
            video: document.getElementById('vm-video'),
            canvas: document.getElementById('vm-canvas'),
            cursor: document.getElementById('vm-cursor'),
            controls: document.getElementById('vm-controls'),
            instructions: document.getElementById('vm-instructions'),
            cameraDot: document.getElementById('vm-camera-dot'),
            handDot: document.getElementById('vm-hand-dot'),
            clickDot: document.getElementById('vm-click-dot'),
            cameraStatus: document.getElementById('vm-camera-status'),
            handStatus: document.getElementById('vm-hand-status'),
            clickStatus: document.getElementById('vm-click-status')
        };

        this.ctx = this.elements.canvas.getContext('2d');
        
        // Configurar cursor inmediatamente
        this.initializeCursor();
    }

    // Configurar event listeners
    setupEventListeners() {
        // Botón toggle
        this.elements.toggle.addEventListener('click', () => this.toggle());

        // Atajo de teclado Ctrl+M
        document.addEventListener('keydown', this.handleKeyPress);

        // Prevenir que el overlay interfiera con clicks normales
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay) {
                e.stopPropagation();
            }
        });
    }

    // Manejar atajos de teclado
    handleKeyPress(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            this.toggle();
        }
    }

    // Activar/desactivar el sistema
    async toggle() {
        if (this.options.enabled) {
            this.disable();
        } else {
            await this.enable();
        }
    }

    // Activar el sistema
    async enable() {
        try {
            this.options.enabled = true;
            this.elements.toggle.classList.add('active');
            this.elements.toggle.textContent = '🎯';
            
            if (this.options.showCamera) {
                this.elements.camera.classList.add('active');
            }
            
            if (this.options.showControls) {
                this.elements.controls.classList.add('active');
            }
            
            if (this.options.showInstructions) {
                this.elements.instructions.classList.add('active');
                
                // Auto-ocultar instrucciones después de un tiempo si está configurado
                if (this.options.autoHideDelay) {
                    setTimeout(() => {
                        if (this.elements.instructions) {
                            this.elements.instructions.classList.remove('active');
                        }
                    }, this.options.autoHideDelay);
                }
            }

            await this.setupCamera();
            this.setupHandTracking();
            this.verifyCursor(); // Verificar que el cursor funcione
            
        } catch (error) {
            console.error('Error enabling virtual mouse:', error);
            this.disable();
        }
    }

    // Desactivar el sistema
    disable() {
        this.options.enabled = false;
        this.elements.toggle.classList.remove('active');
        this.elements.toggle.textContent = '🖱️';
        this.elements.camera.classList.remove('active');
        this.elements.controls.classList.remove('active');
        if (this.elements.instructions) {
            this.elements.instructions.classList.remove('active');
        }
        this.elements.cursor.style.display = 'none';

        // Detener cámara
        if (this.elements.video.srcObject) {
            this.elements.video.srcObject.getTracks().forEach(track => track.stop());
            this.elements.video.srcObject = null;
        }

        // Detener tracking
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }

        this.updateStatus('camera', false);
        this.updateStatus('hand', false);
        this.updateStatus('click', false);
    }

    // Configurar cámara
    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: 'user' }
            });

            this.elements.video.srcObject = stream;
            this.updateStatus('camera', true);

        } catch (error) {
            console.error('Error accessing camera:', error);
            this.updateStatus('camera', false);
        }
    }

    // Configurar hand tracking
    // Configurar detección de manos
    setupHandTracking() {
        if (!window.Hands) {
            console.error('MediaPipe Hands not available');
            return;
        }

        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: this.options.minConfidence,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults(this.processHands);

        this.camera = new Camera(this.elements.video, {
            onFrame: async () => {
                if (this.options.enabled) {
                    await this.hands.send({ image: this.elements.video });
                }
            },
            width: 1280,
            height: 720
        });

        this.camera.start();
        console.log('Hand tracking initialized');
    }

    // Inicializar cursor con estilos básicos
    initializeCursor() {
        if (this.elements.cursor) {
            this.elements.cursor.style.cssText = `
                position: fixed;
                width: 24px;
                height: 24px;
                background: radial-gradient(circle, ${this.options.cursorColor}, #cc0000);
                border: 3px solid white;
                border-radius: 50%;
                z-index: 9999999;
                pointer-events: none;
                display: none;
                transform: translate(-50%, -50%);
                box-shadow: 0 0 15px rgba(255, 68, 68, 0.8);
                transition: all 0.15s ease;
            `;
            console.log('Cursor initialized');
        }
    }

    // Verificar cursor después de inicializar
    verifyCursor() {
        setTimeout(() => {
            if (this.elements.cursor) {
                console.log('Testing cursor visibility...');
                this.elements.cursor.style.display = 'block';
                this.elements.cursor.style.left = '100px';
                this.elements.cursor.style.top = '100px';
                console.log('Test cursor should be visible at 100,100');
            }
        }, 2000);
    }

    // Procesar resultados de hand tracking
    processHands(results) {
        if (!this.options.enabled) return;

        this.ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.currentHand = results.multiHandLandmarks[0];
            this.updateStatus('hand', true);
            this.handleHandGestures();
            this.drawHand();
        } else {
            this.currentHand = null;
            this.updateStatus('hand', false);
            if (this.elements.cursor) {
                this.elements.cursor.style.display = 'none';
            }
        }
    }

    // Manejar gestos de la mano
    handleHandGestures() {
        if (!this.currentHand || !this.options.enabled) return;

        // Obtener posición del índice
        const indexTip = this.currentHand[8];
        const x = (1 - indexTip.x) * window.innerWidth;
        const y = indexTip.y * window.innerHeight;

        console.log('Hand detected, moving cursor to:', x, y); // Debug

        // Actualizar cursor
        this.updateCursor(x, y);

        // Detectar click
        const shouldClick = this.detectClickGesture();
        this.handleClick(shouldClick, x, y);
    }

    // Actualizar posición del cursor
    updateCursor(x, y) {
        if (this.options.showCursor && this.elements.cursor) {
            this.elements.cursor.style.display = 'block';
            this.elements.cursor.style.left = x + 'px';
            this.elements.cursor.style.top = y + 'px';
            console.log('Cursor moved to:', x, y);
        }
    }

    // Detectar gesto de click
    detectClickGesture() {
        if (!this.currentHand) return false;

        const tips = [4, 8, 12, 16, 20];
        const knuckles = [3, 6, 10, 14, 18];
        let closedCount = 0;

        for (let i = 0; i < tips.length; i++) {
            const tip = this.currentHand[tips[i]];
            const knuckle = this.currentHand[knuckles[i]];

            if (i === 0) {
                if (Math.abs(tip.x - knuckle.x) < 0.05) closedCount++;
            } else {
                if (tip.y > knuckle.y) closedCount++;
            }
        }

        return closedCount >= 4;
    }

    // Manejar click virtual
    handleClick(shouldClick, x, y) {
        const now = Date.now();

        if (shouldClick && !this.isClicking && (now - this.lastClickTime) > this.options.clickCooldown) {
            this.isClicking = true;
            this.lastClickTime = now;

            // Aplicar efecto de clicking
            if (this.elements.cursor) {
                this.elements.cursor.style.background = `radial-gradient(circle, ${this.options.clickColor}, #00cc00)`;
                this.elements.cursor.style.transform = 'translate(-50%, -50%) scale(1.4)';
                this.elements.cursor.style.boxShadow = '0 0 20px rgba(68, 255, 68, 1)';
            }
            
            this.updateStatus('click', true);
            this.createClickEffect(x, y);
            this.performClick(x, y);

            setTimeout(() => {
                this.isClicking = false;
                if (this.elements.cursor) {
                    this.elements.cursor.style.background = `radial-gradient(circle, ${this.options.cursorColor}, #cc0000)`;
                    this.elements.cursor.style.transform = 'translate(-50%, -50%) scale(1)';
                    this.elements.cursor.style.boxShadow = '0 0 15px rgba(255, 68, 68, 0.8)';
                }
                this.updateStatus('click', false);
            }, 200);
        }
    }

    // Crear efecto visual de click
    createClickEffect(x, y) {
        const effect = document.createElement('div');
        effect.className = 'vm-click-effect';
        effect.style.left = x + 'px';
        effect.style.top = y + 'px';
        this.elements.overlay.appendChild(effect);

        setTimeout(() => effect.remove(), 600);
    }

    // Realizar click en elemento
    performClick(x, y) {
        const element = document.elementFromPoint(x, y);
        
        if (element && (element.tagName === 'BUTTON' || element.tagName === 'A' || element.onclick || element.classList.contains('clickable'))) {
            // Crear y disparar evento de click
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            });
            
            element.dispatchEvent(clickEvent);
            
            // Efecto visual si es un botón
            if (element.tagName === 'BUTTON') {
                const originalStyle = element.style.transform;
                element.style.transform = 'scale(0.95)';
                element.style.transition = 'transform 0.1s ease';
                
                setTimeout(() => {
                    element.style.transform = originalStyle;
                }, 150);
            }
        }
    }

    // Dibujar landmarks de la mano
    drawHand() {
        if (!this.currentHand) return;

        this.ctx.strokeStyle = '#4caf50';
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#ff4444';

        // Dibujar puntos principales
        [4, 8, 12, 16, 20].forEach(index => {
            const point = this.currentHand[index];
            const x = point.x * this.elements.canvas.width;
            const y = point.y * this.elements.canvas.height;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }

    // Actualizar estado visual
    updateStatus(type, active) {
        const dots = {
            camera: this.elements.cameraDot,
            hand: this.elements.handDot,
            click: this.elements.clickDot
        };

        const statuses = {
            camera: this.elements.cameraStatus,
            hand: this.elements.handStatus,
            click: this.elements.clickStatus
        };

        const messages = {
            camera: active ? 'Cámara: ON' : 'Cámara: OFF',
            hand: active ? 'Mano: SÍ' : 'Mano: NO',
            click: active ? 'Click: SÍ' : 'Click: OFF'
        };

        if (dots[type]) {
            dots[type].className = `vm-status-dot ${active ? 'green' : 'red'}`;
        }

        if (statuses[type]) {
            statuses[type].textContent = messages[type];
        }
    }

    // Destruir el componente
    destroy() {
        this.disable();
        document.removeEventListener('keydown', this.handleKeyPress);
        
        if (this.elements.overlay) {
            this.elements.overlay.remove();
        }
        
        this.isInitialized = false;
        console.log('Virtual Mouse Overlay destroyed');
    }

    // Función para forzar la visibilidad del cursor
    forceCursorVisible() {
        if (this.elements.cursor) {
            console.log('Forcing cursor to be visible...');
            this.elements.cursor.style.cssText = `
                position: fixed !important;
                left: 150px !important;
                top: 150px !important;
                width: 24px !important;
                height: 24px !important;
                background: radial-gradient(circle, #ff0000, #cc0000) !important;
                border: 3px solid white !important;
                border-radius: 50% !important;
                z-index: 9999999 !important;
                pointer-events: none !important;
                display: block !important;
                transform: translate(-50%, -50%) !important;
                box-shadow: 0 0 15px rgba(255, 0, 0, 0.8) !important;
            `;
            console.log('Cursor forced to position 150,150 with red color');
            return true;
        }
        console.error('Cursor element not found');
        return false;
    }
}

// Función de debug completa para el cursor
window.debugVirtualCursor = function() {
    console.log('=== VIRTUAL CURSOR DEBUG ===');
    
    if (!window.virtualMouse) {
        console.error('Virtual mouse instance not found');
        return;
    }
    
    const vm = window.virtualMouse;
    const cursor = vm.elements.cursor;
    
    console.log('Virtual mouse enabled:', vm.options.enabled);
    console.log('Show cursor option:', vm.options.showCursor);
    console.log('Cursor element:', cursor);
    
    if (cursor) {
        console.log('Current cursor styles:', {
            display: cursor.style.display,
            position: cursor.style.position,
            left: cursor.style.left,
            top: cursor.style.top,
            zIndex: cursor.style.zIndex,
            visibility: cursor.style.visibility
        });
        
        // Forzar cursor visible para test
        cursor.style.cssText = `
            position: fixed !important;
            left: 300px !important;
            top: 300px !important;
            width: 30px !important;
            height: 30px !important;
            background: lime !important;
            border: 3px solid black !important;
            border-radius: 50% !important;
            z-index: 9999999 !important;
            pointer-events: none !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
        `;
        
        console.log('Debug cursor placed at 300,300 (lime green with black border)');
        
        // Remover después de 10 segundos
        setTimeout(() => {
            if (cursor && vm.options.enabled) {
                vm.initializeCursor();
                console.log('Debug cursor restored to normal');
            } else {
                cursor.style.display = 'none';
                console.log('Debug cursor hidden (system disabled)');
            }
        }, 10000);
        
    } else {
        console.error('Cursor element not found in DOM!');
        
        // Crear cursor de emergencia
        const emergencyCursor = document.createElement('div');
        emergencyCursor.id = 'emergency-cursor';
        emergencyCursor.style.cssText = `
            position: fixed !important;
            left: 100px !important;
            top: 100px !important;
            width: 40px !important;
            height: 40px !important;
            background: red !important;
            border: 5px solid white !important;
            border-radius: 50% !important;
            z-index: 9999999 !important;
            pointer-events: none !important;
            display: block !important;
        `;
        document.body.appendChild(emergencyCursor);
        console.log('Emergency cursor created (red at 100,100)');
        
        setTimeout(() => {
            if (emergencyCursor.parentNode) {
                emergencyCursor.remove();
            }
        }, 15000);
    }
    
    console.log('=== DEBUG COMPLETE ===');
};

// Función simplificada para test rápido
window.testVirtualCursor = function() {
    console.log('Quick cursor test...');
    if (window.virtualMouse && window.virtualMouse.elements.cursor) {
        window.virtualMouse.forceCursorVisible();
    } else {
        window.debugVirtualCursor();
    }
};

// Auto-inicialización cuando se carga el script
document.addEventListener('DOMContentLoaded', async () => {
    // Pequeño delay para asegurar que la configuración esté disponible
    setTimeout(async () => {
        // Solo auto-inicializar si no existe ya una instancia
        if (!window.virtualMouse) {
            window.virtualMouse = new VirtualMouseOverlay();
            await window.virtualMouse.init();
            console.log('Virtual Mouse Overlay auto-initialized. Press Ctrl+M or click the button to activate.');
            console.log('DEBUG COMMANDS:');
            console.log('- testVirtualCursor() - Quick cursor test');
            console.log('- debugVirtualCursor() - Full cursor debug');
            console.log('- window.virtualMouse.forceCursorVisible() - Force cursor visible');
        }
    }, 50);
});

// Exportar para uso manual
window.VirtualMouseOverlay = VirtualMouseOverlay;