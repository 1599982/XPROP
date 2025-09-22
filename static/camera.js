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

	// Siempre dibujar el resultado, similar a predict
	drawResults(results);
});

// Dibujar resultados similar a predict/alphabet.html
function drawResults(results) {
	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);

	// Dibujar imagen de video siempre
	context.drawImage(results.image, 0, 0, canvas.width, canvas.height);

	// Si hay cronómetro activo, no dibujar landmarks
	if (window.countdownActive) {
		context.restore();
		return;
	}

	// Procesar detección de manos para visualización
	if (isHandDetected && currentHandLandmarks) {
		// Dibujar conexiones de la mano en color verde (#4caf50)
		drawConnectors(context, currentHandLandmarks, HAND_CONNECTIONS, {
			color: "#00ff00",
			lineWidth: 2
		});

		// Dibujar puntos de referencia en verde más oscuro
		drawLandmarks(context, currentHandLandmarks, {
			color: "#00aa00",
			lineWidth: 1,
			radius: 3
		});

		// Etiqueta para la mano (diferente si está capturando)
		const label = window.isCapturing ? "CAPTURANDO DATOS..." : "MANO DETECTADA";
		const color = window.isCapturing ? "#ff6b35" : "#00ff00";
		drawHandLabel(currentHandLandmarks[0], label, color);

		// Indicador visual adicional durante captura
		if (window.isCapturing) {
			drawCaptureIndicator();
		}
	} else {
		// Mostrar advertencia cuando no hay mano detectada
		drawNoHandMessage();
	}

	context.restore();
}

// Dibujar etiqueta de mano similar a predict
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

// Mostrar mensaje cuando no hay mano detectada (similar a predict)
function drawNoHandMessage() {
	context.save();

	// Fondo semi-transparente similar a predict
	context.fillStyle = 'rgba(0, 0, 0, 0.3)';
	context.fillRect(0, 0, canvas.width, canvas.height);

	// Texto
	context.fillStyle = '#ffffff';
	context.font = 'bold 16px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';

	const centerX = canvas.width / 2;
	const centerY = canvas.height / 2;

	context.fillText('Sistema de Entrenamiento ABC', centerX, centerY - 50);
	context.font = 'bold 18px Arial';
	context.fillStyle = '#4caf50';
	context.fillText('🟢 Coloca tu mano frente a la cámara', centerX, centerY - 25);
	context.fillStyle = '#ffffff';
	context.font = 'bold 16px Arial';
	context.fillText('• Selecciona una letra para entrenar', centerX, centerY + 10);
	context.fillText('• Asegúrate de buena iluminación', centerX, centerY + 30);

	context.restore();
}

// Dibujar indicador de captura activa
function drawCaptureIndicator() {
	context.save();

	// Círculo pulsante en la esquina superior derecha
	const x = canvas.width - 50;
	const y = 50;
	const radius = 20;

	// Animación pulsante basada en tiempo
	const time = Date.now();
	const pulse = Math.sin(time / 200) * 0.3 + 0.7; // Pulsa entre 0.4 y 1.0

	// Círculo de fondo
	context.fillStyle = `rgba(255, 107, 53, ${pulse})`;
	context.beginPath();
	context.arc(x, y, radius, 0, 2 * Math.PI);
	context.fill();

	// Texto "REC"
	context.fillStyle = '#ffffff';
	context.font = 'bold 12px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText('REC', x, y);

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
