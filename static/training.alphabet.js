import { currentHandLandmarks, isHandDetected } from "./camera.js";
import * as Utils from "./utils.js";

const letter_grid = document.getElementById("alphabet-grid");
const letter_template = document.getElementById("letter-content");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

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

// Variables globales
let selectedLetter = null;
let trainingData = [];
let trainingLabels = [];
let model = null;
let isCapturing = false;
let countdownActive = false;

// Hacer variables globales para que camera.js pueda accederlas
window.isCapturing = false;
window.countdownActive = false;

// Crear grilla del alfabeto
ALPHABET.forEach(letter => {
	const clone = letter_template.content.cloneNode(true);

	clone.querySelector("div").dataset.letter = letter;
	clone.querySelector("img").src = clone.querySelector("img").src + letter + ".png";
	clone.querySelector("img").alt = letter;
	clone.querySelector("span").textContent = letter;
	clone.querySelector("div").addEventListener("click", actionLetter);

	letter_grid.appendChild(clone);
});

// Clase Random Forest simplificada
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
			predictions.push(prediction);
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

// Función principal al hacer click en una letra
function actionLetter() {
	if (isCapturing || countdownActive) {
		console.log('Ya hay una captura en progreso');
		return;
	}

	// Verificar que hay una mano detectada antes de iniciar
	if (!currentHandLandmarks || !isHandDetected) {
		console.log('⚠️ No hay mano detectada. No se puede iniciar el entrenamiento para la letra:', selectedLetter);
		return;
	}

	console.log(`✅ Mano detectada. Iniciando cronómetro para la letra: ${selectedLetter}`);

	const previousSelected = document.querySelector('.letter-item.selected');
	if (previousSelected) {
		previousSelected.classList.remove('selected');
	}

	this.classList.add('selected');
	selectedLetter = this.dataset.letter;

	console.log(`Iniciando entrenamiento para la letra: ${selectedLetter}`);
	startCountdown();
}

// Cronómetro de 3 segundos superpuesto en el canvas
function startCountdown() {
	countdownActive = true;
	window.countdownActive = true;
	let countdown = 3;

	console.log('Iniciando cronómetro con DIV overlay');
	// Mostrar overlay y dibujar el primer número inmediatamente
	showCountdownOverlay(countdown);

	const countdownInterval = setInterval(() => {
		// Verificar si todavía hay mano detectada durante el cronómetro
		if (!currentHandLandmarks || !isHandDetected) {
			console.log('❌ Mano perdida durante cronómetro en:', countdown, 'segundos. Cancelando captura.');
			clearInterval(countdownInterval);
			countdownActive = false;
			window.countdownActive = false;
			hideCountdownOverlay();
			resetToInitialState();
			return;
		}

		countdown--;

		if (countdown < 0) {
			clearInterval(countdownInterval);
			countdownActive = false;
			window.countdownActive = false;
			// Ocultar overlay e iniciar captura
			hideCountdownOverlay();
			startDataCapture();
		} else {
			// Actualizar número en overlay
			showCountdownOverlay(countdown);
		}
	}, 1000);
}

// Mostrar cronómetro usando DIV overlay
function showCountdownOverlay(number) {
	const overlay = document.getElementById('countdown-overlay');
	const numberElement = document.getElementById('countdown-number');

	if (overlay && numberElement) {
		console.log(`Mostrando cronómetro: ${number}`);
		numberElement.textContent = number.toString();
		overlay.style.display = 'flex';
	} else {
		console.error('Elementos de cronómetro no encontrados');
	}
}

// Ocultar cronómetro overlay
function hideCountdownOverlay() {
	const overlay = document.getElementById('countdown-overlay');

	if (overlay) {
		console.log('Ocultando cronómetro overlay');
		overlay.style.display = 'none';
	} else {
		console.error('Overlay de cronómetro no encontrado para ocultar');
	}
}

// Capturar datos durante 5 segundos
function startDataCapture() {
	isCapturing = true;
	window.isCapturing = true;
	let captureTime = 5000; // 5 segundos
	let captureInterval = 100; // Capturar cada 100ms
	let samplesCollected = 0;
	let maxSamples = captureTime / captureInterval;

	console.log(`Iniciando captura de datos para ${selectedLetter}... (${maxSamples} muestras máximo, ${captureTime}ms)`);

	const captureIntervalId = setInterval(() => {
		// Verificar si hay mano durante la captura
		if (!currentHandLandmarks || !isHandDetected) {
			console.log('❌ Mano perdida durante captura. Deteniendo captura después de', samplesCollected, 'muestras.');
			clearInterval(captureIntervalId);
			isCapturing = false;
			window.isCapturing = false;
			resetToInitialState();
			return;
		}

		if (currentHandLandmarks && selectedLetter) {
			const features = Utils.extractHandFeatures(currentHandLandmarks);

			if (features) {
				trainingData.push(features);
				trainingLabels.push(selectedLetter);
				samplesCollected++;
				if (samplesCollected % 5 === 0) {
					console.log(`Capturado ${samplesCollected}/${maxSamples} muestras`);
				}
			}
		}

		// Actualizar progreso en el header
		updateProgressBar(samplesCollected, maxSamples);

	}, captureInterval);

	// Finalizar captura después de 5 segundos
	setTimeout(() => {
		clearInterval(captureIntervalId);
		isCapturing = false;
		window.isCapturing = false;
		finishCapture(samplesCollected);
	}, captureTime);
}

// Actualizar la barra de progreso en el header
function updateProgressBar(current, total) {
	const progressFill = document.getElementById('progress-fill');
	const progressText = document.getElementById('progress-text');

	if (progressFill && progressText) {
		const percentage = Math.round((current / total) * 100);
		progressFill.style.width = `${percentage}%`;
		progressText.textContent = `${percentage}%`;
	}
}

// Finalizar captura y entrenar modelo
function finishCapture(samplesCollected) {
	console.log(`Captura finalizada. ${samplesCollected} muestras recolectadas para ${selectedLetter}`);

	// El canvas se limpiará automáticamente con el siguiente frame del video

	// Actualizar contador de muestras
	updateSampleCount();

	// Entrenar modelo si hay suficientes datos
	if (trainingData.length >= 50) {
		trainModel();
	}

	// Guardar datos
	saveTrainingData();

	// Resetear estado inicial
	resetToInitialState();

	console.log(`Total de muestras en el dataset: ${trainingData.length}`);
}

// Resetear estado inicial
function resetToInitialState() {
	console.log('🔄 Reseteando estado inicial');
	
	// Resetear barra de progreso
	const progressFill = document.getElementById('progress-fill');
	const progressText = document.getElementById('progress-text');

	if (progressFill && progressText) {
		progressFill.style.width = '0%';
		progressText.textContent = '0%';
	}

	// Limpiar selección
	const selectedElement = document.querySelector('.letter-item.selected');
	if (selectedElement) {
		selectedElement.classList.remove('selected');
	}
	selectedLetter = null;
}

// Entrenar modelo
async function trainModel() {
	console.log('Entrenando modelo...');

	try {
		model = new SimpleRandomForest(30);
		model.fit(trainingData, trainingLabels);

		// Calcular precisión simple
		const accuracy = calculateAccuracy();
		console.log(`Modelo entrenado con precisión: ${(accuracy * 100).toFixed(1)}%`);

		// Guardar modelo
		saveModel();

	} catch (error) {
		console.error('Error al entrenar el modelo:', error);
	}
}

// Calcular precisión del modelo
function calculateAccuracy() {
	if (!model || trainingData.length < 10) return 0;

	let correct = 0;
	const testSize = Math.min(100, Math.floor(trainingData.length * 0.2));

	for (let i = 0; i < testSize; i++) {
		const randomIndex = Math.floor(Math.random() * trainingData.length);
		const features = trainingData[randomIndex];
		const actualLabel = trainingLabels[randomIndex];
		const prediction = model.predict([features])[0];

		if (prediction === actualLabel) {
			correct++;
		}
	}

	return correct / testSize;
}

// Actualizar contador de muestras
function updateSampleCount() {
	const totalSamples = trainingData.length;

	// Actualizar indicadores visuales en las letras
	const letterCounts = {};
	ALPHABET.forEach(letter => letterCounts[letter] = 0);
	trainingLabels.forEach(label => {
		if (label in letterCounts) letterCounts[label]++;
	});

	document.querySelectorAll('.letter-item').forEach(item => {
		const letter = item.dataset.letter;
		const count = letterCounts[letter];

		item.classList.remove('has-data');
		if (count > 0) {
			item.classList.add('has-data');
		}
	});
}

// Guardar datos de entrenamiento con compresión
async function saveTrainingData() {
	try {
		const data = {
			type: 'alphabet',
			features: trainingData,
			labels: trainingLabels,
			timestamp: Date.now()
		};

		// Check data size
		const dataSize = new Blob([JSON.stringify(data)]).size;
		console.log(`Data size: ${(dataSize / 1024).toFixed(2)}KB`);

		if (dataSize > 900 * 1024) { // 900KB limit
			console.log('Data too large, using compression...');
			
			// Use compression utility if available
			if (window.CompressionUtils) {
				const result = await window.CompressionUtils.smartSendData('/api/training/save', data);
				if (!result.success) {
					console.error('Error guardando datos:', result.error);
					alert('Error al guardar los datos: ' + result.error);
				} else {
					console.log('Datos guardados correctamente con compresión');
				}
				return;
			}

			// Fallback: chunk the data
			const chunkSize = 50;
			const chunks = [];
			for (let i = 0; i < trainingData.length; i += chunkSize) {
				chunks.push({
					type: 'alphabet',
					features: trainingData.slice(i, i + chunkSize),
					labels: trainingLabels.slice(i, i + chunkSize),
					chunk: Math.floor(i / chunkSize),
					totalChunks: Math.ceil(trainingData.length / chunkSize),
					timestamp: Date.now()
				});
			}

			for (let chunk of chunks) {
				const response = await fetch('/api/training/save', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(chunk)
				});

				const result = await response.json();
				if (!result.success) {
					console.error('Error guardando chunk:', result.error);
					alert('Error al guardar los datos: ' + result.error);
					return;
				}
			}
			console.log('Datos guardados correctamente en chunks');
		} else {
			// Normal request
			const response = await fetch('/api/training/save', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data)
			});

			const result = await response.json();
			
			if (!result.success) {
				console.error('Error guardando datos:', result.error);
				alert('Error al guardar los datos: ' + result.error);
			} else {
				console.log('Datos guardados correctamente');
			}
		}
	} catch (error) {
		console.error('Error de conexión:', error);
		alert('Error de conexión al servidor');
	}
}

// Cargar datos de entrenamiento con descompresión
async function loadTrainingData() {
	try {
		const response = await fetch('/api/training/load/alphabet');
		let result = await response.json();

		// Handle compression if utils are available
		if (window.CompressionUtils) {
			result = await window.CompressionUtils.handleResponse({json: () => result});
		}

		if (result.success) {
			// Decompress features if compressed
			if (result.compressed && result.features) {
				if (window.CompressionUtils) {
					trainingData = await window.CompressionUtils.decompressData(result.features);
				} else {
					// Fallback: assume it's base64 encoded JSON
					try {
						const decoded = atob(result.features);
						trainingData = JSON.parse(decoded);
					} catch (e) {
						trainingData = result.features;
					}
				}
			} else {
				trainingData = result.features || [];
			}
			
			trainingLabels = result.labels || [];
			updateSampleCount();
		} else {
			console.warn('No se pudieron cargar los datos:', result.error);
			trainingData = [];
			trainingLabels = [];
			updateSampleCount();
		}
	} catch (error) {
		console.error('Error cargando datos:', error);
		trainingData = [];
		trainingLabels = [];
		updateSampleCount();
	}
}

// Guardar modelo
async function saveModel() {
	if (model) {
		try {
			const modelData = {
				type: 'alphabet',
				model: model,
				timestamp: Date.now()
			};

			const response = await fetch('/api/model/save', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(modelData)
			});

			const result = await response.json();

			if (!result.success) {
				console.error('Error guardando modelo:', result.error);
			} else {
				console.log('Modelo guardado correctamente');
			}
		} catch (error) {
			console.error('Error de conexión al guardar modelo:', error);
		}
	}
}

// Cargar modelo
async function loadModel() {
	try {
		const response = await fetch('/api/model/load/alphabet');
		const result = await response.json();

		if (result.success) {
			// Nota: La deserialización del modelo requeriría más trabajo
			// Por ahora solo guardamos la referencia
			console.log('Modelo cargado desde base de datos');
			return result.model;
		} else {
			console.warn('No se pudo cargar el modelo:', result.error);
			return null;
		}
	} catch (error) {
		console.error('Error cargando modelo:', error);
		return null;
	}
}



// Inicialización
document.addEventListener('DOMContentLoaded', () => {
	loadTrainingData();
	loadModel();
	console.log('Sistema de entrenamiento iniciado');
});

// Exportar funciones principales para debugging
window.debugTraining = {
	trainingData: () => trainingData,
	trainingLabels: () => trainingLabels,
	model: () => model,
	resetData: async () => {
		try {
			const response = await fetch('/api/training/reset/alphabet', {
				method: 'DELETE'
			});

			const result = await response.json();

			if (result.success) {
				trainingData = [];
				trainingLabels = [];
				updateSampleCount();
				console.log('Datos de alfabeto eliminados correctamente');
			} else {
				console.error('Error eliminando datos:', result.error);
				alert('Error al eliminar los datos: ' + result.error);
			}
		} catch (error) {
			console.error('Error de conexión:', error);
			alert('Error de conexión al servidor');
		}
	}
};
