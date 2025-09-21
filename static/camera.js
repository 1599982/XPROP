const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

export let currentHandLandmarks = null;
export let isHandDetected = false;

// Configuración mejorada de MediaPipe Hands
const hands = new Hands({
	locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
	maxNumHands: 1,
	modelComplexity: 1,
	minDetectionConfidence: 0.7,
	minTrackingConfidence: 0.5
});

// Mejorar el callback de resultados con mejor manejo
hands.onResults((results) => {
	// Actualizar landmarks siempre para que la captura funcione
	if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
		currentHandLandmarks = results.multiHandLandmarks[0];
		isHandDetected = true;
	} else {
		currentHandLandmarks = null;
		isHandDetected = false;
	}
	
	// No dibujar si hay overlays activos
	if (window.countdownActive || window.isCapturing) {
		return;
	}
	
	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);
	
	// Dibujar imagen de video
	context.drawImage(results.image, 0, 0, canvas.width, canvas.height);

	// Procesar detección de manos para visualización
	if (isHandDetected) {
		// Dibujar conexiones de la mano
		drawConnectors(context, currentHandLandmarks, HAND_CONNECTIONS, {
			color: "#00ff00",
			lineWidth: 3
		});
		
		// Dibujar puntos de referencia
		drawLandmarks(context, currentHandLandmarks, {
			color: "#ff0000",
			lineWidth: 2,
			radius: 4
		});
	} else {
		// Mostrar advertencia cuando no hay mano detectada
		drawNoHandWarning();
	}

	context.restore();
});

// Mostrar advertencia cuando no se detecta mano
function drawNoHandWarning() {
	context.save();
	
	// Fondo transparente
	context.fillStyle = 'rgba(0, 0, 0, 0.6)';
	context.fillRect(0, 0, canvas.width, canvas.height);
	
	// Texto de advertencia centrado
	context.fillStyle = '#ffffff';
	context.font = 'bold 24px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	
	const centerX = canvas.width / 2;
	const centerY = canvas.height / 2;
	
	// Texto principal
	context.fillText('⚠️ Coloca tu mano frente a la cámara', centerX, centerY - 20);
	
	// Texto secundario
	context.font = 'bold 16px Arial';
	context.fillText('Asegúrate de que esté bien iluminada', centerX, centerY + 20);
	
	context.restore();
}

// Configuración de la cámara con mejor manejo de errores
const camera = new Camera(video, {
	onFrame: async () => {
		try {
			// Siempre procesar frames para mantener detección de manos
			await hands.send({image: video});
		} catch (error) {
			console.error('Error procesando frame:', error);
		}
	},
	width: canvas.width,
	height: canvas.height
});

// Función para inicializar la cámara
async function initCamera() {
	try {
		console.log('Inicializando cámara...');
		await camera.start();
		console.log('Cámara iniciada correctamente');
		
		// Mostrar mensaje de estado
		showCameraStatus('Cámara conectada', 'success');
		
	} catch (error) {
		console.error('Error al inicializar la cámara:', error);
		showCameraStatus('Error: No se pudo acceder a la cámara', 'error');
	}
}

// Mostrar estado de la cámara
function showCameraStatus(message, type) {
	context.save();
	
	// Limpiar canvas
	context.fillStyle = '#000000';
	context.fillRect(0, 0, canvas.width, canvas.height);
	
	// Configurar texto
	context.fillStyle = type === 'error' ? '#ff0000' : '#00ff00';
	context.font = 'bold 20px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	
	// Mostrar mensaje
	context.fillText(message, canvas.width / 2, canvas.height / 2);
	
	context.restore();
	
	// Auto-ocultar mensaje de éxito después de 2 segundos
	if (type === 'success') {
		setTimeout(() => {
			context.clearRect(0, 0, canvas.width, canvas.height);
		}, 2000);
	}
}

// Función para verificar compatibilidad del navegador
function checkBrowserCompatibility() {
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		console.error('getUserMedia no está soportado en este navegador');
		showCameraStatus('Navegador no compatible', 'error');
		return false;
	}
	return true;
}

// Función para manejar errores de permisos
function handlePermissionError(error) {
	console.error('Error de permisos de cámara:', error);
	
	if (error.name === 'NotAllowedError') {
		showCameraStatus('Permiso de cámara denegado', 'error');
	} else if (error.name === 'NotFoundError') {
		showCameraStatus('No se encontró cámara', 'error');
	} else if (error.name === 'NotReadableError') {
		showCameraStatus('Cámara en uso por otra aplicación', 'error');
	} else {
		showCameraStatus('Error desconocido de cámara', 'error');
	}
}

// Función para reiniciar la cámara
export function restartCamera() {
	console.log('Reiniciando cámara...');
	initCamera();
}

// Función para obtener estadísticas de rendimiento
export function getCameraStats() {
	return {
		isHandDetected: isHandDetected,
		hasLandmarks: currentHandLandmarks !== null,
		landmarkCount: currentHandLandmarks ? currentHandLandmarks.length : 0,
		canvasSize: {
			width: canvas.width,
			height: canvas.height
		}
	};
}

// Función para calibrar la detección
export function calibrateDetection(sensitivity = 'medium') {
	const configs = {
		low: {
			minDetectionConfidence: 0.5,
			minTrackingConfidence: 0.3
		},
		medium: {
			minDetectionConfidence: 0.7,
			minTrackingConfidence: 0.5
		},
		high: {
			minDetectionConfidence: 0.9,
			minTrackingConfidence: 0.7
		}
	};
	
	const config = configs[sensitivity] || configs.medium;
	hands.setOptions(config);
	console.log(`Sensibilidad de detección ajustada a: ${sensitivity}`);
}

// Inicialización mejorada
document.addEventListener("DOMContentLoaded", async () => {
	console.log('Iniciando sistema de cámara...');
	
	// Verificar compatibilidad
	if (!checkBrowserCompatibility()) {
		return;
	}
	
	// Mostrar mensaje de carga
	showCameraStatus('Cargando cámara...', 'info');
	
	// Inicializar cámara con manejo de errores
	try {
		await initCamera();
	} catch (error) {
		handlePermissionError(error);
	}
});

// Manejo de errores globales para MediaPipe
window.addEventListener('unhandledrejection', (event) => {
	if (event.reason && event.reason.message && event.reason.message.includes('mediapipe')) {
		console.error('Error de MediaPipe:', event.reason);
		showCameraStatus('Error en el procesamiento de video', 'error');
		event.preventDefault();
	}
});

// Exportar funciones para debugging
window.debugCamera = {
	restart: restartCamera,
	stats: getCameraStats,
	calibrate: calibrateDetection,
	currentLandmarks: () => currentHandLandmarks,
	isDetected: () => isHandDetected
};