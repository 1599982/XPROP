// Utilidades para extracción de características de manos y procesamiento de datos

/**
 * Extrae características mejoradas de los landmarks de la mano
 * @param {Array} landmarks - Array de landmarks de MediaPipe
 * @returns {Array|null} - Array de características o null si hay error
 */
export function extractHandFeatures(landmarks) {
    if (!landmarks || landmarks.length === 0) return null;

    const features = [];

    try {
        // 1. Coordenadas normalizadas respecto a la muñeca
        const wrist = landmarks[0];

        for (let i = 0; i < landmarks.length; i++) {
            features.push(landmarks[i].x - wrist.x);
            features.push(landmarks[i].y - wrist.y);
            features.push(landmarks[i].z - wrist.z);
        }

        // 2. Distancias entre puntas de dedos
        const fingerTips = [4, 8, 12, 16, 20]; // Pulgar, Índice, Medio, Anular, Meñique

        for (let i = 0; i < fingerTips.length; i++) {
            for (let j = i + 1; j < fingerTips.length; j++) {
                const p1 = landmarks[fingerTips[i]];
                const p2 = landmarks[fingerTips[j]];
                const distance = euclideanDistance(p1, p2);
                features.push(distance);
            }
        }

        // 3. Ángulos entre dedos y la muñeca
        const fingerBases = [2, 5, 9, 13, 17];

        for (let i = 0; i < fingerTips.length; i++) {
            const tip = landmarks[fingerTips[i]];
            const base = landmarks[fingerBases[i]];
            const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
            features.push(angle);
        }

        // 4. Distancias de puntas de dedos a la muñeca
        for (let i = 0; i < fingerTips.length; i++) {
            const tip = landmarks[fingerTips[i]];
            const distance = euclideanDistance(tip, wrist);
            features.push(distance);
        }

        // 5. Nuevas características: curvatura de dedos
        const fingerJoints = [
            [2, 3, 4],   // Pulgar
            [5, 6, 7, 8], // Índice
            [9, 10, 11, 12], // Medio
            [13, 14, 15, 16], // Anular
            [17, 18, 19, 20]  // Meñique
        ];

        for (const joints of fingerJoints) {
            const curvature = calculateFingerCurvature(landmarks, joints);
            features.push(curvature);
        }

        // 6. Área aproximada de la mano
        const handArea = calculateHandArea(landmarks);
        features.push(handArea);

        // 7. Orientación general de la mano
        const handOrientation = calculateHandOrientation(landmarks);
        features.push(handOrientation);

        // 8. Relaciones proporcionales
        const palmWidth = euclideanDistance(landmarks[5], landmarks[17]);
        const palmHeight = euclideanDistance(landmarks[0], landmarks[12]);
        const aspectRatio = palmWidth / (palmHeight || 0.001);
        features.push(aspectRatio);

        // 9. Características de extensión de dedos
        for (let i = 0; i < fingerTips.length; i++) {
            const extension = calculateFingerExtension(landmarks, fingerTips[i], fingerBases[i]);
            features.push(extension);
        }

        // 10. Distancias cruzadas (diagonal)
        features.push(euclideanDistance(landmarks[4], landmarks[20])); // Pulgar a meñique
        features.push(euclideanDistance(landmarks[8], landmarks[16])); // Índice a anular

        return features;

    } catch (error) {
        console.error('Error extrayendo características:', error);
        return null;
    }
}

/**
 * Calcula la distancia euclidiana entre dos puntos 3D
 */
function euclideanDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calcula la curvatura de un dedo basada en sus articulaciones
 */
function calculateFingerCurvature(landmarks, joints) {
    if (joints.length < 3) return 0;

    let totalCurvature = 0;
    
    for (let i = 0; i < joints.length - 2; i++) {
        const p1 = landmarks[joints[i]];
        const p2 = landmarks[joints[i + 1]];
        const p3 = landmarks[joints[i + 2]];

        // Calcular ángulo entre vectores
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        const angle = Math.acos(
            (v1.x * v2.x + v1.y * v2.y) / 
            (Math.sqrt(v1.x * v1.x + v1.y * v1.y) * Math.sqrt(v2.x * v2.x + v2.y * v2.y) + 0.001)
        );

        totalCurvature += angle;
    }

    return totalCurvature / (joints.length - 2);
}

/**
 * Calcula el área aproximada de la mano usando los puntos extremos
 */
function calculateHandArea(landmarks) {
    // Usar puntos extremos para calcular área aproximada
    const extremePoints = [
        landmarks[4],  // Pulgar
        landmarks[8],  // Índice
        landmarks[12], // Medio
        landmarks[16], // Anular
        landmarks[20], // Meñique
        landmarks[0]   // Muñeca
    ];

    // Algoritmo simple de área usando el método de Shoelace
    let area = 0;
    const n = extremePoints.length;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += extremePoints[i].x * extremePoints[j].y;
        area -= extremePoints[j].x * extremePoints[i].y;
    }

    return Math.abs(area) / 2;
}

/**
 * Calcula la orientación general de la mano
 */
function calculateHandOrientation(landmarks) {
    const wrist = landmarks[0];
    const middleFinger = landmarks[12];

    return Math.atan2(middleFinger.y - wrist.y, middleFinger.x - wrist.x);
}

/**
 * Calcula qué tan extendido está un dedo
 */
function calculateFingerExtension(landmarks, tipIndex, baseIndex) {
    const tip = landmarks[tipIndex];
    const base = landmarks[baseIndex];
    const wrist = landmarks[0];

    const tipToWrist = euclideanDistance(tip, wrist);
    const baseToWrist = euclideanDistance(base, wrist);

    return tipToWrist / (baseToWrist || 0.001);
}

/**
 * Normaliza un array de características para mejorar el entrenamiento
 */
export function normalizeFeatures(features) {
    if (!features || features.length === 0) return features;

    const mean = features.reduce((sum, val) => sum + val, 0) / features.length;
    const variance = features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / features.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return features;

    return features.map(val => (val - mean) / stdDev);
}

/**
 * Valida si los landmarks son válidos para el procesamiento
 */
export function validateLandmarks(landmarks) {
    if (!landmarks || !Array.isArray(landmarks)) return false;
    if (landmarks.length !== 21) return false;

    return landmarks.every(point => 
        point && 
        typeof point.x === 'number' && 
        typeof point.y === 'number' && 
        typeof point.z === 'number' &&
        !isNaN(point.x) && !isNaN(point.y) && !isNaN(point.z)
    );
}

/**
 * Calcula la confianza de detección basada en la estabilidad de los landmarks
 */
export function calculateDetectionConfidence(currentLandmarks, previousLandmarks) {
    if (!currentLandmarks || !previousLandmarks) return 0.5;

    let totalMovement = 0;
    const keyPoints = [0, 4, 8, 12, 16, 20]; // Muñeca y puntas de dedos

    for (const pointIndex of keyPoints) {
        const current = currentLandmarks[pointIndex];
        const previous = previousLandmarks[pointIndex];
        
        const movement = euclideanDistance(current, previous);
        totalMovement += movement;
    }

    const avgMovement = totalMovement / keyPoints.length;
    
    // Convertir movimiento a confianza (menos movimiento = más confianza)
    const confidence = Math.max(0, 1 - (avgMovement * 10));
    return Math.min(1, confidence);
}

/**
 * Crea un resumen estadístico de un conjunto de características
 */
export function createFeatureSummary(featuresArray) {
    if (!featuresArray || featuresArray.length === 0) return null;

    const numFeatures = featuresArray[0].length;
    const summary = {
        count: featuresArray.length,
        features: []
    };

    for (let i = 0; i < numFeatures; i++) {
        const values = featuresArray.map(features => features[i]);
        const sortedValues = values.sort((a, b) => a - b);
        
        summary.features.push({
            min: sortedValues[0],
            max: sortedValues[sortedValues.length - 1],
            mean: values.reduce((sum, val) => sum + val, 0) / values.length,
            median: sortedValues[Math.floor(sortedValues.length / 2)],
            std: Math.sqrt(values.reduce((sum, val) => {
                const mean = values.reduce((s, v) => s + v, 0) / values.length;
                return sum + Math.pow(val - mean, 2);
            }, 0) / values.length)
        });
    }

    return summary;
}

/**
 * Detecta outliers en un conjunto de características
 */
export function detectOutliers(features, threshold = 2) {
    const summary = createFeatureSummary([features]);
    if (!summary) return false;

    for (let i = 0; i < features.length; i++) {
        const featureStats = summary.features[i];
        const zScore = Math.abs((features[i] - featureStats.mean) / (featureStats.std || 1));
        
        if (zScore > threshold) {
            return true; // Es un outlier
        }
    }

    return false;
}

/**
 * Suaviza una serie temporal de características usando media móvil
 */
export function smoothFeatures(featuresHistory, windowSize = 5) {
    if (!featuresHistory || featuresHistory.length < windowSize) {
        return featuresHistory[featuresHistory.length - 1] || null;
    }

    const recentFeatures = featuresHistory.slice(-windowSize);
    const numFeatures = recentFeatures[0].length;
    const smoothed = new Array(numFeatures).fill(0);

    for (let i = 0; i < numFeatures; i++) {
        for (const features of recentFeatures) {
            smoothed[i] += features[i];
        }
        smoothed[i] /= windowSize;
    }

    return smoothed;
}

/**
 * Divide los datos de entrenamiento en chunks más pequeños
 * @param {Array} features - Array de características
 * @param {Array} labels - Array de etiquetas
 * @param {number} chunkSize - Tamaño de cada chunk (por defecto 100)
 * @returns {Array} - Array de chunks con {features, labels, chunkIndex, totalChunks}
 */
export function createDataChunks(features, labels, chunkSize = 100) {
    if (!features || !labels || features.length !== labels.length) {
        throw new Error('Features y labels deben tener la misma longitud');
    }

    const chunks = [];
    const totalItems = features.length;
    const totalChunks = Math.ceil(totalItems / chunkSize);

    for (let i = 0; i < totalItems; i += chunkSize) {
        const chunkFeatures = features.slice(i, i + chunkSize);
        const chunkLabels = labels.slice(i, i + chunkSize);
        
        chunks.push({
            features: chunkFeatures,
            labels: chunkLabels,
            chunkIndex: Math.floor(i / chunkSize),
            totalChunks: totalChunks,
            startIndex: i,
            endIndex: Math.min(i + chunkSize - 1, totalItems - 1)
        });
    }

    return chunks;
}

/**
 * Envía datos de entrenamiento por chunks con seguimiento de progreso
 * @param {string} type - Tipo de entrenamiento ('alphabet' o 'numbers')
 * @param {Array} features - Array de características
 * @param {Array} labels - Array de etiquetas
 * @param {number} chunkSize - Tamaño de cada chunk
 * @param {Function} progressCallback - Función de callback para el progreso
 * @returns {Promise<boolean>} - True si todos los chunks se enviaron correctamente
 */
export async function sendTrainingDataInChunks(type, features, labels, chunkSize = 100, progressCallback = null) {
    try {
        // Primero limpiar datos existentes
        const clearResponse = await fetch(`/api/training/clear/${type}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!clearResponse.ok) {
            throw new Error('Error al limpiar datos existentes');
        }

        const chunks = createDataChunks(features, labels, chunkSize);
        let successfulChunks = 0;

        for (const chunk of chunks) {
            const data = {
                type: type,
                features: chunk.features,
                labels: chunk.labels,
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunk.totalChunks,
                isFirstChunk: chunk.chunkIndex === 0,
                isLastChunk: chunk.chunkIndex === chunk.totalChunks - 1,
                timestamp: Date.now()
            };

            const response = await fetch('/api/training/save-chunk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!result.success) {
                console.error(`Error en chunk ${chunk.chunkIndex}:`, result.error);
                throw new Error(`Error en chunk ${chunk.chunkIndex}: ${result.error}`);
            }

            successfulChunks++;

            // Callback de progreso
            if (progressCallback) {
                progressCallback({
                    chunkIndex: chunk.chunkIndex,
                    totalChunks: chunk.totalChunks,
                    percentage: Math.round((successfulChunks / chunk.totalChunks) * 100),
                    completed: successfulChunks,
                    total: chunk.totalChunks
                });
            }

            // Pequeña pausa entre chunks para no sobrecargar el servidor
            await sleep(50);
        }

        console.log(`✓ Todos los ${chunks.length} chunks enviados correctamente`);
        return true;

    } catch (error) {
        console.error('Error enviando datos por chunks:', error);
        throw error;
    }
}

/**
 * Función auxiliar para pausar la ejecución
 * @param {number} ms - Milisegundos a pausar
 * @returns {Promise}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calcula el tamaño óptimo de chunk basado en el tamaño de los datos
 * @param {Array} features - Array de características
 * @param {number} maxSizeKB - Tamaño máximo por chunk en KB (por defecto 500KB)
 * @returns {number} - Tamaño óptimo de chunk
 */
export function calculateOptimalChunkSize(features, maxSizeKB = 500) {
    if (!features || features.length === 0) return 100;

    // Estimar el tamaño de una muestra en bytes
    const sampleSize = JSON.stringify({
        features: features[0] || [],
        label: 'A'
    }).length;

    // Calcular cuántas muestras caben en el límite de tamaño
    const maxSizeBytes = maxSizeKB * 1024;
    const optimalSize = Math.floor(maxSizeBytes / sampleSize);

    // Asegurar que esté dentro de rangos razonables
    return Math.max(10, Math.min(500, optimalSize));
}

/**
 * Monitorea el progreso de envío de chunks y muestra información en consola
 * @param {Object} progress - Objeto con información del progreso
 */
export function defaultProgressCallback(progress) {
    const { chunkIndex, totalChunks, percentage, completed, total } = progress;
    
    console.log(`📦 Chunk ${chunkIndex + 1}/${totalChunks} enviado (${percentage}% completado)`);
    
    if (completed === total) {
        console.log('🎉 ¡Todos los chunks enviados correctamente!');
    }
}

/**
 * Valida que los chunks se puedan crear correctamente
 * @param {Array} features - Array de características
 * @param {Array} labels - Array de etiquetas
 * @param {number} chunkSize - Tamaño de chunk propuesto
 * @returns {Object} - Información de validación
 */
export function validateChunkingData(features, labels, chunkSize) {
    const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        info: {}
    };

    // Validaciones básicas
    if (!features || !Array.isArray(features)) {
        validation.isValid = false;
        validation.errors.push('Features debe ser un array válido');
    }

    if (!labels || !Array.isArray(labels)) {
        validation.isValid = false;
        validation.errors.push('Labels debe ser un array válido');
    }

    if (features.length !== labels.length) {
        validation.isValid = false;
        validation.errors.push('Features y labels deben tener la misma longitud');
    }

    if (chunkSize <= 0) {
        validation.isValid = false;
        validation.errors.push('El tamaño de chunk debe ser mayor a 0');
    }

    // Información adicional
    if (validation.isValid) {
        const totalChunks = Math.ceil(features.length / chunkSize);
        const estimatedTime = totalChunks * 0.1; // ~100ms por chunk

        validation.info = {
            totalSamples: features.length,
            chunkSize: chunkSize,
            totalChunks: totalChunks,
            estimatedTimeSeconds: estimatedTime
        };

        // Advertencias
        if (totalChunks > 50) {
            validation.warnings.push(`Se crearán ${totalChunks} chunks, esto puede tomar un tiempo considerable`);
        }

        if (chunkSize > 1000) {
            validation.warnings.push('Chunk size muy grande, podría causar timeouts en el servidor');
        }
    }

    return validation;
}