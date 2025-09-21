import * as Utils from "./utils.js";

// Variables globales para cámara y detección
let video, canvas, context;
let hands, camera;
let leftHandLandmarks = null;
let rightHandLandmarks = null;
let isLeftHandDetected = false;
let isRightHandDetected = false;
let model = null;

// Template elements
let letterGrid;
let letterTemplate;

// Variables para detección - mano izquierda (letras)
let leftHandLetterConfidence = 0;
let lastDetectedLetterLeft = null;
let leftHandLetterHistory = [];
let leftHandConfidenceHistory = [];

// Variables para detección - mano derecha (control)
let rightHandStateConfidence = 0;
let isRightHandClosed = false;
let rightHandStateHistory = [];

// Variables generales
let detectionInterval = null;
let detectedText = "";
let lastWrittenLetter = null;
let lastWriteTime = 0;

// Elementos DOM
let detectedLetterLeftElement;
let letterProgressLeftElement;
let handStateRightElement;
let handProgressRightElement;
let detectedTextElement;
let clearTextButton;
let writeStatusElement;

// Configuración
const DETECTION_INTERVAL = 200; // ms entre detecciones
const CONFIDENCE_THRESHOLD = 80; // Umbral para escribir letra
const HISTORY_SIZE = 5; // Tamaño del historial para suavizado
const HAND_CLOSE_THRESHOLD = 0.3; // Umbral para detectar mano cerrada
const MIN_WRITE_INTERVAL = 800; // ms mínimo entre escrituras de la misma letra

const ALPHABET = [
	"A", "B", "C",
	"D", "E", "F",
	"G", "H", "I",
	"J", "K", "L",
	"M", "N", "O",
	"P", "Q", "R",
	"S", "T", "U",
	"V", "W", "X",
	"Y", "Z"
];

// Clase Random Forest simplificada (copia de main.js)
class SimpleRandomForest {
    constructor(numTrees = 10) {
        this.numTrees = numTrees;
        this.trees = [];
        this.classes = [];
    }

    fit(X, y) {
        this.classes = [...new Set(y)];
        this.trees = [];

        for (let i = 0; i < this.numTrees; i++) {
            const tree = new DecisionTree();
            const sampleSize = Math.floor(X.length * 0.8);
            const indices = [];
            for (let j = 0; j < sampleSize; j++) {
                indices.push(Math.floor(Math.random() * X.length));
            }

            const sampleX = indices.map(idx => X[idx]);
            const sampleY = indices.map(idx => y[idx]);

            tree.fit(sampleX, sampleY);
            this.trees.push(tree);
        }
    }

    predict(X) {
        if (!Array.isArray(X[0])) X = [X];

        const predictions = [];
        for (const sample of X) {
            const votes = {};
            this.classes.forEach(cls => votes[cls] = 0);

            this.trees.forEach(tree => {
                const pred = tree.predict([sample])[0];
                if (pred in votes) votes[pred]++;
            });

            const maxVotes = Math.max(...Object.values(votes));
            const prediction = Object.keys(votes).find(key => votes[key] === maxVotes);
            const confidence = maxVotes / this.trees.length;

            predictions.push({ prediction, confidence });
        }

        return predictions;
    }
}

class DecisionTree {
    constructor(maxDepth = 10, minSamplesSplit = 2) {
        this.maxDepth = maxDepth;
        this.minSamplesSplit = minSamplesSplit;
        this.root = null;
    }

    fit(X, y) {
        this.root = this.buildTree(X, y, 0);
    }

    predict(X) {
        return X.map(sample => this.predictSample(sample, this.root));
    }

    buildTree(X, y, depth) {
        const uniqueClasses = [...new Set(y)];

        if (uniqueClasses.length === 1 || X.length < this.minSamplesSplit || depth >= this.maxDepth) {
            return this.createLeaf(y);
        }

        const bestSplit = this.findBestSplit(X, y);
        if (!bestSplit) return this.createLeaf(y);

        const [leftX, leftY, rightX, rightY] = this.split(X, y, bestSplit);

        const leftChild = this.buildTree(leftX, leftY, depth + 1);
        const rightChild = this.buildTree(rightX, rightY, depth + 1);

        return {
            featureIndex: bestSplit.featureIndex,
            threshold: bestSplit.threshold,
            left: leftChild,
            right: rightChild
        };
    }

    findBestSplit(X, y) {
        let bestGini = Infinity;
        let bestSplit = null;

        const numFeatures = X[0].length;
        const featuresToTry = Math.max(1, Math.floor(Math.sqrt(numFeatures)));

        const featureIndices = [];
        while (featureIndices.length < featuresToTry) {
            const idx = Math.floor(Math.random() * numFeatures);
            if (!featureIndices.includes(idx)) {
                featureIndices.push(idx);
            }
        }

        for (const featureIndex of featureIndices) {
            const values = X.map(sample => sample[featureIndex]);
            const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

            for (let i = 0; i < uniqueValues.length - 1; i++) {
                const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
                const gini = this.calculateGini(X, y, featureIndex, threshold);

                if (gini < bestGini) {
                    bestGini = gini;
                    bestSplit = { featureIndex, threshold };
                }
            }
        }

        return bestSplit;
    }

    calculateGini(X, y, featureIndex, threshold) {
        const [leftY, rightY] = this.splitLabels(X, y, featureIndex, threshold);
        const totalSamples = y.length;

        const leftWeight = leftY.length / totalSamples;
        const rightWeight = rightY.length / totalSamples;

        const leftGini = this.giniImpurity(leftY);
        const rightGini = this.giniImpurity(rightY);

        return leftWeight * leftGini + rightWeight * rightGini;
    }

    splitLabels(X, y, featureIndex, threshold) {
        const leftY = [];
        const rightY = [];

        for (let i = 0; i < X.length; i++) {
            if (X[i][featureIndex] <= threshold) {
                leftY.push(y[i]);
            } else {
                rightY.push(y[i]);
            }
        }

        return [leftY, rightY];
    }

    split(X, y, splitInfo) {
        const leftX = [], leftY = [], rightX = [], rightY = [];

        for (let i = 0; i < X.length; i++) {
            if (X[i][splitInfo.featureIndex] <= splitInfo.threshold) {
                leftX.push(X[i]);
                leftY.push(y[i]);
            } else {
                rightX.push(X[i]);
                rightY.push(y[i]);
            }
        }

        return [leftX, leftY, rightX, rightY];
    }

    giniImpurity(labels) {
        if (labels.length === 0) return 0;

        const counts = {};
        labels.forEach(label => counts[label] = (counts[label] || 0) + 1);

        let impurity = 1;
        for (const count of Object.values(counts)) {
            const probability = count / labels.length;
            impurity -= probability ** 2;
        }

        return impurity;
    }

    createLeaf(y) {
        const counts = {};
        y.forEach(label => counts[label] = (counts[label] || 0) + 1);
        const prediction = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        return { prediction };
    }

    predictSample(sample, node) {
        if (node.prediction !== undefined) {
            return node.prediction;
        }

        if (sample[node.featureIndex] <= node.threshold) {
            return this.predictSample(sample, node.left);
        } else {
            return this.predictSample(sample, node.right);
        }
    }
}

// Inicialización cuando se carga el DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando sistema de predicción...');

    // Obtener elementos DOM
    initDOMElements();

    // Cargar modelo entrenado
    loadTrainedModel();

    // Inicializar cámara
    await initCamera();

    // Iniciar detección
    startDetection();

    console.log('Sistema de predicción iniciado');
});

// Obtener elementos DOM
function initDOMElements() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');
    
    detectedLetterLeftElement = document.getElementById('detected-letter-left');
    letterProgressLeftElement = document.getElementById('letter-progress-left');
    handStateRightElement = document.getElementById('hand-state-right');
    handProgressRightElement = document.getElementById('hand-progress-right');
    detectedTextElement = document.getElementById('detected-text');
    clearTextButton = document.getElementById('clear-text');
    writeStatusElement = document.getElementById('write-status');
    
    letterGrid = document.getElementById("alphabet-grid");
    letterTemplate = document.getElementById("letter-content");
    
    // Event listener para limpiar texto
    clearTextButton.addEventListener('click', clearDetectedText);
    
    // Generar alfabeto automáticamente
    generateAlphabet();
}

// Cargar modelo entrenado desde localStorage
function loadTrainedModel() {
    try {
        const savedData = localStorage.getItem('signLanguageTrainingData');
        if (!savedData) {
            console.warn('No se encontraron datos de entrenamiento');
            showModelStatus('No hay modelo entrenado', 'warning');
            return;
        }

        const data = JSON.parse(savedData);
        if (!data.features || !data.labels || data.features.length === 0) {
            console.warn('Datos de entrenamiento vacíos o inválidos');
            showModelStatus('Modelo inválido', 'error');
            return;
        }

        console.log(`Cargando modelo con ${data.features.length} muestras`);

        // Crear y entrenar modelo
        model = new SimpleRandomForest(30);
        model.fit(data.features, data.labels);

        console.log('Modelo cargado exitosamente');
        showModelStatus('Modelo cargado', 'success');

    } catch (error) {
        console.error('Error cargando modelo:', error);
        showModelStatus('Error cargando modelo', 'error');
    }
}

// Mostrar estado del modelo
function showModelStatus(message, type) {
    // Mostrar en consola y opcionalmente en UI
    console.log(`Estado del modelo: ${message} (${type})`);
}

// Inicializar cámara con MediaPipe
async function initCamera() {
    try {
        console.log('Inicializando cámara...');

        // Configurar MediaPipe Hands
        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        // Configurar callback de resultados
        hands.onResults(onHandsResults);

        // Configurar cámara
        camera = new Camera(video, {
            onFrame: async () => {
                await hands.send({image: video});
            },
            width: canvas.width,
            height: canvas.height
        });

        // Iniciar cámara
        await camera.start();
        console.log('Cámara iniciada correctamente');

    } catch (error) {
        console.error('Error inicializando cámara:', error);
    }
}

// Procesar resultados de MediaPipe
function onHandsResults(results) {
    // Resetear detección
    leftHandLandmarks = null;
    rightHandLandmarks = null;
    isLeftHandDetected = false;
    isRightHandDetected = false;

    // Procesar múltiples manos
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];
            
            // MediaPipe devuelve la perspectiva de la cámara (espejo)
            // Así que "Left" es la mano derecha del usuario y viceversa
            if (handedness.label === 'Right') {
                // Esta es la mano izquierda del usuario (para detectar letras)
                leftHandLandmarks = landmarks;
                isLeftHandDetected = true;
            } else if (handedness.label === 'Left') {
                // Esta es la mano derecha del usuario (para control)
                rightHandLandmarks = landmarks;
                isRightHandDetected = true;
            }
        }
    }

    // Dibujar en canvas
    drawResults(results);
}

// Dibujar resultados en canvas
function drawResults(results) {
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar imagen de video
    context.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Dibujar mano izquierda (verde - letras)
    if (isLeftHandDetected && leftHandLandmarks) {
        drawConnectors(context, leftHandLandmarks, HAND_CONNECTIONS, {
            color: "#00ff00",
            lineWidth: 2
        });
        drawLandmarks(context, leftHandLandmarks, {
            color: "#00aa00",
            lineWidth: 1,
            radius: 3
        });
        
        // Etiqueta para mano izquierda
        drawHandLabel(leftHandLandmarks[0], "IZQUIERDA - LETRAS", "#00ff00");
    }

    // Dibujar mano derecha (azul - control)
    if (isRightHandDetected && rightHandLandmarks) {
        drawConnectors(context, rightHandLandmarks, HAND_CONNECTIONS, {
            color: "#0088ff",
            lineWidth: 2
        });
        drawLandmarks(context, rightHandLandmarks, {
            color: "#0066cc",
            lineWidth: 1,
            radius: 3
        });
        
        // Etiqueta para mano derecha
        drawHandLabel(rightHandLandmarks[0], "DERECHA - CONTROL", "#0088ff");
    }

    // Mostrar instrucciones si no hay manos
    if (!isLeftHandDetected && !isRightHandDetected) {
        drawNoHandMessage();
    }

    context.restore();
}

// Dibujar etiqueta de mano
function drawHandLabel(wristLandmark, label, color) {
    context.save();
    
    const x = wristLandmark.x * canvas.width;
    const y = wristLandmark.y * canvas.height - 35;
    
    // Fondo semi-transparente para la etiqueta
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(x - 60, y - 15, 120, 20);
    
    // Texto de la etiqueta
    context.fillStyle = color;
    context.font = 'bold 11px Arial';
    context.textAlign = 'center';
    context.fillText(label, x, y - 2);
    
    context.restore();
}

// Dibujar mensaje cuando no hay mano detectada
function drawNoHandMessage() {
    context.save();
    
    // Fondo semi-transparente
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texto
    context.fillStyle = '#ffffff';
    context.font = 'bold 16px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    context.fillText('Sistema de Detección de Dos Manos', canvas.width / 2, canvas.height / 2 - 50);
    context.font = 'bold 14px Arial';
    context.fillStyle = '#00ff00';
    context.fillText('🟢 MANO IZQUIERDA: Hacer señas del alfabeto', canvas.width / 2, canvas.height / 2 - 25);
    context.fillStyle = '#0088ff';
    context.fillText('🔵 MANO DERECHA: Cerrar puño para escribir', canvas.width / 2, canvas.height / 2 - 5);
    context.fillStyle = '#ffffff';
    context.font = 'bold 12px Arial';
    context.fillText('• Confianza de letra > 80% para escribir', canvas.width / 2, canvas.height / 2 + 20);
    context.fillText('• Asegúrate de buena iluminación', canvas.width / 2, canvas.height / 2 + 35);
    
    context.restore();
}

// Iniciar detección continua
function startDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }

    detectionInterval = setInterval(() => {
        if (model) {
            performDetection();
        } else {
            resetDetection();
        }
    }, DETECTION_INTERVAL);
}

// Realizar detección de letra y estado de mano
function performDetection() {
    try {
        // Procesar mano izquierda (letras)
        if (isLeftHandDetected && leftHandLandmarks) {
            detectLetterFromLeftHand();
        } else {
            resetLeftHandDetection();
        }
        
        // Procesar mano derecha (control)
        if (isRightHandDetected && rightHandLandmarks) {
            detectRightHandState();
        } else {
            resetRightHandDetection();
        }
        
        // Actualizar UI
        updateDetectorUI();
        
        // Escribir letra si se cumplen condiciones
        checkAndWriteLetter();
        
    } catch (error) {
        console.error('Error en detección:', error);
    }
}

// Detectar letra desde la mano izquierda
function detectLetterFromLeftHand() {
    const features = Utils.extractHandFeatures(leftHandLandmarks);
    if (!features) return;

    // Predecir letra
    const predictions = model.predict([features]);
    const letterPrediction = predictions[0];
    
    // Calcular confianza de la letra (0-100)
    leftHandLetterConfidence = Math.round(letterPrediction.confidence * 100);
    lastDetectedLetterLeft = letterPrediction.prediction;
    
    // Actualizar historial para suavizado
    leftHandLetterHistory.push(lastDetectedLetterLeft);
    leftHandConfidenceHistory.push(leftHandLetterConfidence);
    
    // Mantener tamaño máximo del historial
    if (leftHandLetterHistory.length > HISTORY_SIZE) {
        leftHandLetterHistory.shift();
        leftHandConfidenceHistory.shift();
    }
}

// Detectar estado de la mano derecha
function detectRightHandState() {
    const handState = detectHandState(rightHandLandmarks);
    isRightHandClosed = handState.isClosed;
    rightHandStateConfidence = Math.round(handState.confidence * 100);
    
    // Actualizar historial para suavizado
    rightHandStateHistory.push(isRightHandClosed);
    
    // Mantener tamaño máximo del historial
    if (rightHandStateHistory.length > HISTORY_SIZE) {
        rightHandStateHistory.shift();
    }
}

// Detectar si la mano está cerrada o abierta
function detectHandState(landmarks) {
    try {
        // Puntos clave para detección
        const fingerTips = [4, 8, 12, 16, 20]; // Pulgar, Índice, Medio, Anular, Meñique
        const fingerPips = [3, 6, 10, 14, 18]; // Articulaciones medias
        const fingerMcps = [2, 5, 9, 13, 17]; // Nudillos
        const wrist = landmarks[0];

        let closedFingers = 0;
        let fingerStates = [];

        // Verificar dedos índice, medio, anular y meñique
        for (let i = 1; i < fingerTips.length; i++) {
            const tip = landmarks[fingerTips[i]];
            const pip = landmarks[fingerPips[i]];
            const mcp = landmarks[fingerMcps[i]];

            // Múltiples criterios para determinar si está cerrado
            let isClosed = false;

            // Criterio 1: Punta más abajo que nudillo
            if (tip.y > mcp.y + 0.02) {
                isClosed = true;
            }

            // Criterio 2: Punta más cerca de la muñeca que el nudillo
            const tipToWrist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
            const mcpToWrist = Math.sqrt(Math.pow(mcp.x - wrist.x, 2) + Math.pow(mcp.y - wrist.y, 2));

            if (tipToWrist < mcpToWrist * 0.95) {
                isClosed = true;
            }

            // Criterio 3: Ángulo de flexión
            const angle = calculateFingerAngle(mcp, pip, tip);
            if (angle > 2.0) { // Más de ~115 grados indica flexión
                isClosed = true;
            }

            fingerStates.push(isClosed);
            if (isClosed) closedFingers++;
        }

        // Verificar pulgar (lógica especial)
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const thumbMcp = landmarks[2];

        let thumbClosed = false;

        // El pulgar está cerrado si está cerca de la palma
        const thumbToPalm = Math.abs(thumbTip.x - landmarks[9].x); // Distancia al dedo medio
        if (thumbToPalm < 0.08) {
            thumbClosed = true;
        }

        // También verificar si está doblado hacia adentro
        if (thumbTip.x > thumbMcp.x && Math.abs(thumbTip.y - thumbMcp.y) < 0.05) {
            thumbClosed = true;
        }

        fingerStates.unshift(thumbClosed);
        if (thumbClosed) closedFingers++;

        // Calcular confianza basada en consistencia
        const closedRatio = closedFingers / 5;

        // Considerar mano cerrada si al menos 4 de 5 dedos están cerrados
        const isClosed = closedFingers >= 4;

        // Confianza más alta cuando todos los dedos están en el mismo estado
        let confidence;
        if (closedFingers === 0 || closedFingers === 5) {
            confidence = 0.95; // Muy alta confianza
        } else if (closedFingers === 1 || closedFingers === 4) {
            confidence = 0.8; // Alta confianza
        } else {
            confidence = 0.6; // Confianza media
        }

        return { isClosed, confidence };

    } catch (error) {
        console.error('Error detectando estado de mano:', error);
        return { isClosed: false, confidence: 0 };
    }
}

// Calcular ángulo de flexión de un dedo
function calculateFingerAngle(mcp, pip, tip) {
    // Vector desde nudillo a articulación media
    const v1 = { x: pip.x - mcp.x, y: pip.y - mcp.y };

    // Vector desde articulación media a punta
    const v2 = { x: tip.x - pip.x, y: tip.y - pip.y };

    // Calcular ángulo entre vectores
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return angle;
}

// Obtener letra más común del historial de mano izquierda
function getMostCommonLeftLetter() {
    if (leftHandLetterHistory.length === 0) return null;
    
    const counts = {};
    leftHandLetterHistory.forEach(letter => {
        counts[letter] = (counts[letter] || 0) + 1;
    });
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

// Obtener confianza promedio de mano izquierda
function getAverageLeftConfidence() {
    if (leftHandConfidenceHistory.length === 0) return 0;
    return leftHandConfidenceHistory.reduce((sum, conf) => sum + conf, 0) / leftHandConfidenceHistory.length;
}

// Obtener estado más común de mano derecha
function getMostCommonRightHandState() {
    if (rightHandStateHistory.length === 0) return false;
    
    const closedCount = rightHandStateHistory.filter(state => state).length;
    return closedCount > rightHandStateHistory.length / 2;
}

// Actualizar UI de detectores
function updateDetectorUI() {
    // Detector 1: Mano Izquierda (Letras)
    if (isLeftHandDetected) {
        const smoothedLetter = getMostCommonLeftLetter();
        const smoothedConfidence = getAverageLeftConfidence();
        
        if (detectedLetterLeftElement && smoothedLetter) {
            detectedLetterLeftElement.textContent = smoothedLetter;
            detectedLetterLeftElement.classList.toggle('active', smoothedConfidence > 60);
        }
        
        if (letterProgressLeftElement) {
            letterProgressLeftElement.style.width = `${smoothedConfidence}%`;
            letterProgressLeftElement.textContent = `${Math.round(smoothedConfidence)}%`;
        }
    }
    
    // Detector 2: Mano Derecha (Control)
    if (isRightHandDetected) {
        const smoothedRightState = getMostCommonRightHandState();
        
        if (handStateRightElement) {
            const currentState = smoothedRightState ? 'CERRADA' : 'ABIERTA';
            handStateRightElement.textContent = currentState;
            handStateRightElement.classList.remove('open', 'closed');
            handStateRightElement.classList.add(smoothedRightState ? 'closed' : 'open');
        }
        
        if (handProgressRightElement) {
            handProgressRightElement.style.width = `${rightHandStateConfidence}%`;
            handProgressRightElement.textContent = `${rightHandStateConfidence}%`;
        }
    }
}

// Verificar condiciones y escribir letra
function checkAndWriteLetter() {
    // Condiciones: ambas manos detectadas, mano derecha cerrada Y confianza mano izquierda > 80%
    if (isLeftHandDetected && isRightHandDetected) {
        const smoothedLeftConfidence = getAverageLeftConfidence();
        const smoothedLeftLetter = getMostCommonLeftLetter();
        const smoothedRightState = getMostCommonRightHandState();
        
        if (smoothedRightState && smoothedLeftConfidence > CONFIDENCE_THRESHOLD && smoothedLeftLetter) {
            const currentTime = Date.now();
            
            // Permitir escribir si es una letra diferente o ha pasado suficiente tiempo
            if (smoothedLeftLetter !== lastWrittenLetter || 
                (currentTime - lastWriteTime) > MIN_WRITE_INTERVAL) {
                writeDetectedLetter(smoothedLeftLetter);
                lastWrittenLetter = smoothedLeftLetter;
                lastWriteTime = currentTime;
            }
        }
    }
    
    // Actualizar indicador de estado de escritura
    updateWriteStatus();
}

// Escribir letra detectada en el cuadro de texto
function writeDetectedLetter(letter) {
    detectedText += letter;
    if (detectedTextElement) {
        detectedTextElement.textContent = detectedText;
    }
    console.log(`Letra escrita: ${letter} (Texto: ${detectedText})`);
    
    // Efecto visual de escritura exitosa
    if (writeStatusElement) {
        writeStatusElement.textContent = `✅ Escrito: ${letter}`;
        writeStatusElement.classList.remove('ready', 'cooldown');
        writeStatusElement.classList.add('ready');
        
        // Volver al estado normal después de un momento
        setTimeout(() => {
            updateWriteStatus();
        }, 600);
    }
}

// Limpiar texto detectado
function clearDetectedText() {
    detectedText = "";
    lastWrittenLetter = null;
    lastWriteTime = 0;
    if (detectedTextElement) {
        detectedTextElement.textContent = "";
    }
    console.log('Texto limpiado');
    updateWriteStatus();
}

// Resetear detección cuando no hay manos
function resetDetection() {
    resetLeftHandDetection();
    resetRightHandDetection();
}

// Resetear detección de mano izquierda
function resetLeftHandDetection() {
    leftHandLetterConfidence = 0;
    lastDetectedLetterLeft = null;
    leftHandLetterHistory = [];
    leftHandConfidenceHistory = [];
    
    if (detectedLetterLeftElement) {
        detectedLetterLeftElement.textContent = isLeftHandDetected ? '-' : 'SIN MANO';
        detectedLetterLeftElement.classList.remove('active');
    }
    
    if (letterProgressLeftElement) {
        letterProgressLeftElement.style.width = '0%';
        letterProgressLeftElement.textContent = '0%';
    }
}

// Resetear detección de mano derecha
function resetRightHandDetection() {
    rightHandStateConfidence = 0;
    isRightHandClosed = false;
    rightHandStateHistory = [];
    
    if (handStateRightElement) {
        handStateRightElement.textContent = isRightHandDetected ? 'ABIERTA' : 'SIN MANO';
        handStateRightElement.classList.remove('open', 'closed');
        if (isRightHandDetected) {
            handStateRightElement.classList.add('open');
        }
    }
    
    if (handProgressRightElement) {
        handProgressRightElement.style.width = '0%';
        handProgressRightElement.textContent = '0%';
    }
}

// Actualizar indicador de estado de escritura
function updateWriteStatus() {
    if (!writeStatusElement) return;
    
    const currentTime = Date.now();
    const timeSinceLastWrite = currentTime - lastWriteTime;
    
    if (!isLeftHandDetected || !isRightHandDetected) {
        writeStatusElement.textContent = "⚠️ Faltan manos";
        writeStatusElement.classList.remove('ready', 'cooldown');
        return;
    }
    
    const smoothedLeftConfidence = getAverageLeftConfidence();
    const smoothedRightState = getMostCommonRightHandState();
    
    if (smoothedLeftConfidence < CONFIDENCE_THRESHOLD) {
        writeStatusElement.textContent = `📊 Confianza: ${Math.round(smoothedLeftConfidence)}%`;
        writeStatusElement.classList.remove('ready', 'cooldown');
        return;
    }
    
    if (!smoothedRightState) {
        writeStatusElement.textContent = "👋 Cierra mano derecha";
        writeStatusElement.classList.remove('ready', 'cooldown');
        return;
    }
    
    const smoothedLeftLetter = getMostCommonLeftLetter();
    
    // Si es la misma letra y está en período de espera
    if (smoothedLeftLetter === lastWrittenLetter && timeSinceLastWrite < MIN_WRITE_INTERVAL) {
        const remainingTime = Math.ceil((MIN_WRITE_INTERVAL - timeSinceLastWrite) / 100) / 10;
        writeStatusElement.textContent = `⏳ Espera ${remainingTime.toFixed(1)}s`;
        writeStatusElement.classList.remove('ready');
        writeStatusElement.classList.add('cooldown');
        return;
    }
    
    // Todo listo para escribir
    if (smoothedLeftLetter) {
        writeStatusElement.textContent = `✅ Listo: ${smoothedLeftLetter}`;
        writeStatusElement.classList.remove('cooldown');
        writeStatusElement.classList.add('ready');
    } else {
        writeStatusElement.textContent = "✅ Listo";
        writeStatusElement.classList.remove('cooldown');
        writeStatusElement.classList.add('ready');
    }
}

// Generar alfabeto automáticamente usando template
function generateAlphabet() {
    if (!letterGrid || !letterTemplate) {
        console.error('Template elements not found');
        return;
    }
    
    // Limpiar grid existente (excepto el template)
    const existingItems = letterGrid.querySelectorAll('.letter-item');
    existingItems.forEach(item => item.remove());
    
    // Generar cada letra del alfabeto
    ALPHABET.forEach(letter => {
        const clone = letterTemplate.content.cloneNode(true);
        
        clone.querySelector("div").dataset.letter = letter;
        clone.querySelector("img").src = clone.querySelector("img").src + letter + ".png";
        clone.querySelector("img").alt = letter;
        clone.querySelector("span").textContent = letter;
        
        letterGrid.appendChild(clone);
    });
    
    console.log(`Alfabeto generado automáticamente: ${ALPHABET.length} letras`);
    console.log('Letras generadas:', ALPHABET.join(', '));
}

// Funciones de debugging
window.debugPrediction = {
    getLeftHandLandmarks: () => leftHandLandmarks,
    getRightHandLandmarks: () => rightHandLandmarks,
    getModel: () => model,
    getDetectedText: () => detectedText,
    getLeftHandStats: () => ({ 
        letter: lastDetectedLetterLeft, 
        confidence: leftHandLetterConfidence,
        detected: isLeftHandDetected 
    }),
    getRightHandStats: () => ({ 
        closed: isRightHandClosed, 
        confidence: rightHandStateConfidence,
        detected: isRightHandDetected 
    }),
    getAlphabet: () => ALPHABET,
    getGeneratedLetters: () => document.querySelectorAll('.letter-item').length,
    clearText: clearDetectedText,
    resetModel: () => {
        model = null;
        loadTrainedModel();
    },
    regenerateAlphabet: () => {
        generateAlphabet();
    }
};

console.log('Módulo de predicción cargado');
