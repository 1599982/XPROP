import { currentHandLandmarks } from "./camera.js";
import * as Utils from "./utils.js";

const letter_grid = document.getElementById("alphabet-grid");
const letter_template = document.getElementById("letter-content");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const sampleCountElement = document.getElementById("sample-count");

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

	// Dibujar el primer número inmediatamente
	drawCountdown(countdown);

	const countdownInterval = setInterval(() => {
		countdown--;

		if (countdown < 0) {
			clearInterval(countdownInterval);
			countdownActive = false;
			window.countdownActive = false;
			// Iniciar captura de datos por 5 segundos
			startDataCapture();
		} else {
			// Limpiar canvas y redibujar
			drawCountdown(countdown);
		}
	}, 1000);
}

// Dibujar cronómetro superpuesto en el canvas
function drawCountdown(number) {
	// Limpiar completamente el canvas primero
	context.clearRect(0, 0, canvas.width, canvas.height);

	// Guardar el estado del canvas
	context.save();

	// Fondo semi-transparente
	context.fillStyle = 'rgba(0, 0, 0, 0.5)';
	context.fillRect(0, 0, canvas.width, canvas.height);

	const centerX = canvas.width / 2;
	const centerY = canvas.height / 2;

	// Configurar estilo del número
	context.fillStyle = '#FFD700';
	context.strokeStyle = '#FF4500';
	context.lineWidth = 4;
	context.font = 'bold 120px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';

	// Dibujar número con sombra
	context.shadowColor = '#000000';
	context.shadowBlur = 10;
	context.shadowOffsetX = 2;
	context.shadowOffsetY = 2;

	context.fillText(number.toString(), centerX, centerY);
	context.strokeText(number.toString(), centerX, centerY);

	// Resetear sombra para el texto adicional
	context.shadowColor = 'transparent';
	context.shadowBlur = 0;
	context.shadowOffsetX = 0;
	context.shadowOffsetY = 0;

	context.restore();
}

// Capturar datos durante 5 segundos
function startDataCapture() {
	isCapturing = true;
	window.isCapturing = true;
	let captureTime = 5000; // 5 segundos
	let captureInterval = 100; // Capturar cada 100ms
	let samplesCollected = 0;
	let maxSamples = captureTime / captureInterval;

	console.log(`Iniciando captura de datos para ${selectedLetter}...`);

	const captureIntervalId = setInterval(() => {
		if (currentHandLandmarks && selectedLetter) {
			const features = Utils.extractHandFeatures(currentHandLandmarks);

			if (features) {
				trainingData.push(features);
				trainingLabels.push(selectedLetter);
				samplesCollected++;
			}
		}

		// Mostrar progreso en el canvas
		drawCaptureProgress(samplesCollected, maxSamples);

	}, captureInterval);

	// Finalizar captura después de 5 segundos
	setTimeout(() => {
		clearInterval(captureIntervalId);
		isCapturing = false;
		window.isCapturing = false;
		finishCapture(samplesCollected);
	}, captureTime);
}

// Dibujar progreso de captura
function drawCaptureProgress(current, total) {
	// Limpiar completamente el canvas primero
	context.clearRect(0, 0, canvas.width, canvas.height);

	context.save();

	// Fondo semi-transparente
	context.fillStyle = 'rgba(0, 0, 0, 0.7)';
	context.fillRect(0, 0, canvas.width, canvas.height);

	// Barra de progreso
	const barWidth = 300;
	const barHeight = 20;
	const barX = (canvas.width - barWidth) / 2;
	const barY = canvas.height / 2;

	// Fondo de la barra
	context.fillStyle = '#333333';
	context.fillRect(barX, barY, barWidth, barHeight);

	// Progreso
	const progress = current / total;
	context.fillStyle = '#00FF00';
	context.fillRect(barX, barY, barWidth * progress, barHeight);

	// Texto
	context.fillStyle = '#FFFFFF';
	context.font = 'bold 24px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(`Capturando datos para ${selectedLetter}...`, canvas.width / 2, barY - 40);
	context.fillText(`${current}/${total} muestras`, canvas.width / 2, barY + barHeight + 30);

	context.restore();
}

// Finalizar captura y entrenar modelo
function finishCapture(samplesCollected) {
	console.log(`Captura finalizada. ${samplesCollected} muestras recolectadas para ${selectedLetter}`);

	// Mostrar mensaje de finalización antes de limpiar
	showCompletionMessage(samplesCollected);

	// Limpiar canvas después de un breve delay para que la cámara pueda continuar normalmente
	setTimeout(() => {
		context.clearRect(0, 0, canvas.width, canvas.height);
	}, 1500);

	// Actualizar contador de muestras
	updateSampleCount();

	// Entrenar modelo si hay suficientes datos
	if (trainingData.length >= 50) {
		trainModel();
	}

	// Guardar datos
	saveTrainingData();

	// Limpiar selección
	const selectedElement = document.querySelector('.letter-item.selected');
	if (selectedElement) {
		selectedElement.classList.remove('selected');
	}
	selectedLetter = null;

	console.log(`Total de muestras en el dataset: ${trainingData.length}`);
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
	sampleCountElement.textContent = totalSamples;

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

// Guardar datos de entrenamiento
function saveTrainingData() {
	const data = {
		features: trainingData,
		labels: trainingLabels,
		timestamp: Date.now()
	};
	localStorage.setItem('signLanguageTrainingData', JSON.stringify(data));
}

// Cargar datos de entrenamiento
function loadTrainingData() {
	const saved = localStorage.getItem('signLanguageTrainingData');
	if (saved) {
		const data = JSON.parse(saved);
		trainingData = data.features || [];
		trainingLabels = data.labels || [];
		updateSampleCount();
	}
}

// Guardar modelo
function saveModel() {
	if (model) {
		const modelData = {
			model: model,
			timestamp: Date.now()
		};
		localStorage.setItem('signLanguageModel', JSON.stringify(modelData));
	}
}

// Cargar modelo
function loadModel() {
	const saved = localStorage.getItem('signLanguageModel');
	if (saved) {
		const data = JSON.parse(saved);
		// Nota: La deserialización del modelo requeriría más trabajo
		// Por ahora solo guardamos la referencia
		console.log('Modelo guardado encontrado');
	}
}

// Mostrar mensaje de completación
function showCompletionMessage(samplesCollected) {
	context.save();

	// Fondo semi-transparente
	context.fillStyle = 'rgba(0, 100, 0, 0.8)';
	context.fillRect(0, 0, canvas.width, canvas.height);

	const centerX = canvas.width / 2;
	const centerY = canvas.height / 2;

	// Mensaje principal
	context.fillStyle = '#FFFFFF';
	context.font = 'bold 28px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText('✅ ¡Completado!', centerX, centerY - 30);

	// Detalles
	context.font = 'bold 18px Arial';
	context.fillText(`${samplesCollected} muestras recolectadas para ${selectedLetter}`, centerX, centerY + 10);
	context.fillText(`Total en dataset: ${trainingData.length}`, centerX, centerY + 40);

	context.restore();
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
	resetData: () => {
		trainingData = [];
		trainingLabels = [];
		localStorage.removeItem('signLanguageTrainingData');
		updateSampleCount();
	}
};
