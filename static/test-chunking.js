import * as Utils from "./utils.js";

/**
 * Script de prueba para verificar la funcionalidad de chunking
 */

// Función para crear datos de prueba
function createTestData(numSamples = 500) {
    const features = [];
    const labels = [];
    
    const testLabels = ['A', 'B', 'C', 'D', 'E'];
    
    for (let i = 0; i < numSamples; i++) {
        // Crear características simuladas (array de 100 números)
        const sampleFeatures = [];
        for (let j = 0; j < 100; j++) {
            sampleFeatures.push(Math.random() * 2 - 1); // Valores entre -1 y 1
        }
        
        features.push(sampleFeatures);
        labels.push(testLabels[i % testLabels.length]);
    }
    
    return { features, labels };
}

// Prueba básica de creación de chunks
function testChunkCreation() {
    console.log('🧪 Iniciando prueba de creación de chunks...');
    
    const { features, labels } = createTestData(250);
    const chunkSize = 50;
    
    try {
        const chunks = Utils.createDataChunks(features, labels, chunkSize);
        
        console.log(`✅ Chunks creados: ${chunks.length}`);
        console.log(`📊 Datos originales: ${features.length} muestras`);
        
        // Verificar integridad
        let totalSamples = 0;
        chunks.forEach((chunk, index) => {
            console.log(`📦 Chunk ${index}: ${chunk.features.length} muestras (índices ${chunk.startIndex}-${chunk.endIndex})`);
            totalSamples += chunk.features.length;
        });
        
        if (totalSamples === features.length) {
            console.log('✅ Integridad verificada: todos los datos están presentes');
        } else {
            console.error('❌ Error de integridad: faltan datos');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error en prueba de chunks:', error);
        return false;
    }
}

// Prueba de cálculo de tamaño óptimo
function testOptimalChunkSize() {
    console.log('🧪 Iniciando prueba de tamaño óptimo de chunk...');
    
    const { features } = createTestData(100);
    
    const sizes = [100, 250, 500, 1000]; // KB
    
    sizes.forEach(maxSize => {
        const optimalSize = Utils.calculateOptimalChunkSize(features, maxSize);
        console.log(`📏 Para ${maxSize}KB máximo: ${optimalSize} muestras por chunk`);
    });
    
    return true;
}

// Prueba de validación
function testValidation() {
    console.log('🧪 Iniciando prueba de validación...');
    
    const { features, labels } = createTestData(100);
    
    // Casos válidos
    const validResult = Utils.validateChunkingData(features, labels, 25);
    console.log('✅ Validación con datos válidos:', validResult.isValid ? 'PASS' : 'FAIL');
    
    // Casos inválidos
    const invalidResults = [
        Utils.validateChunkingData([], labels, 25),
        Utils.validateChunkingData(features, [], 25),
        Utils.validateChunkingData(features, labels.slice(0, 50), 25), // Longitudes diferentes
        Utils.validateChunkingData(features, labels, 0), // Chunk size inválido
    ];
    
    invalidResults.forEach((result, index) => {
        console.log(`❌ Caso inválido ${index + 1}:`, result.isValid ? 'FAIL (debería ser inválido)' : 'PASS');
        if (result.errors.length > 0) {
            console.log(`   Errores: ${result.errors.join(', ')}`);
        }
    });
    
    return true;
}

// Prueba de progreso callback
function testProgressCallback() {
    console.log('🧪 Iniciando prueba de callback de progreso...');
    
    return new Promise(resolve => {
        let callbackCount = 0;
        const expectedCalls = 5;
        
        const testCallback = (progress) => {
            callbackCount++;
            console.log(`📈 Progreso: ${progress.percentage}% (${progress.completed}/${progress.total})`);
            
            if (callbackCount === expectedCalls) {
                console.log('✅ Callback de progreso funcionando correctamente');
                resolve(true);
            }
        };
        
        // Simular llamadas de progreso
        for (let i = 1; i <= expectedCalls; i++) {
            setTimeout(() => {
                testCallback({
                    chunkIndex: i - 1,
                    totalChunks: expectedCalls,
                    percentage: Math.round((i / expectedCalls) * 100),
                    completed: i,
                    total: expectedCalls
                });
            }, i * 100);
        }
    });
}

// Prueba simulada de envío (sin backend real)
async function testSimulatedSend() {
    console.log('🧪 Iniciando prueba simulada de envío...');
    
    const { features, labels } = createTestData(150);
    const chunkSize = 30;
    
    // Simular función de envío
    const mockSendFunction = async (type, features, labels, chunkSize, progressCallback) => {
        const chunks = Utils.createDataChunks(features, labels, chunkSize);
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Simular tiempo de envío
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Llamar callback de progreso
            if (progressCallback) {
                progressCallback({
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    percentage: Math.round(((i + 1) / chunks.length) * 100),
                    completed: i + 1,
                    total: chunks.length
                });
            }
            
            console.log(`📤 Chunk simulado ${i + 1}/${chunks.length} enviado`);
        }
        
        return true;
    };
    
    try {
        const success = await mockSendFunction(
            'test',
            features,
            labels,
            chunkSize,
            Utils.defaultProgressCallback
        );
        
        console.log('✅ Envío simulado completado:', success ? 'ÉXITO' : 'FALLO');
        return success;
    } catch (error) {
        console.error('❌ Error en envío simulado:', error);
        return false;
    }
}

// Ejecutar todas las pruebas
export async function runAllTests() {
    console.log('🚀 Iniciando suite completa de pruebas de chunking...\n');
    
    const tests = [
        { name: 'Creación de chunks', fn: testChunkCreation },
        { name: 'Tamaño óptimo', fn: testOptimalChunkSize },
        { name: 'Validación', fn: testValidation },
        { name: 'Callback de progreso', fn: testProgressCallback },
        { name: 'Envío simulado', fn: testSimulatedSend }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            console.log(`\n📋 Ejecutando: ${test.name}`);
            const result = await test.fn();
            
            if (result) {
                console.log(`✅ ${test.name}: PASS`);
                passed++;
            } else {
                console.log(`❌ ${test.name}: FAIL`);
                failed++;
            }
        } catch (error) {
            console.error(`💥 ${test.name}: ERROR - ${error.message}`);
            failed++;
        }
    }
    
    console.log(`\n📊 Resultados finales:`);
    console.log(`✅ Pruebas pasadas: ${passed}`);
    console.log(`❌ Pruebas fallidas: ${failed}`);
    console.log(`📈 Porcentaje de éxito: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    return { passed, failed, total: passed + failed };
}

// Ejecutar pruebas individuales desde consola
window.testChunking = {
    runAllTests,
    testChunkCreation,
    testOptimalChunkSize,
    testValidation,
    testProgressCallback,
    testSimulatedSend,
    createTestData
};

console.log('🔧 Test chunking cargado. Usa testChunking.runAllTests() para ejecutar todas las pruebas.');