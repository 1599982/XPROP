import { currentHandLandmarks } from "./camera.js";
import * as Utils from "./utils.js";

const letter_grid = document.getElementById("alphabet-grid");
const letter_template = document.getElementById("letter-content");

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
]

ALPHABET.forEach(letter => {
	const clone = letter_template.content.cloneNode(true);

	clone.querySelector("div").dataset.letter = letter;
	clone.querySelector("img").src = clone.querySelector("img").src + letter + ".png";
	clone.querySelector("img").alt = letter;
	clone.querySelector("span").textContent = letter;
	clone.querySelector("div").addEventListener("click", actionLetter);

	letter_grid.appendChild(clone);
})

// ########################################## //
let selectedLetter = null;
let trainingData = [];
let trainingLabels = [];

function actionLetter() {
	const previousSelected = document.querySelector('.letter-item.selected');

	if (previousSelected) {
		previousSelected.classList.remove('selected');
	}

	this.classList.add('selected');
	selectedLetter = this.dataset.letter;
	setTimeout(captureSample, 500);
}

function saveTrainingData() {
	const data = {
		features: trainingData,
		labels: trainingLabels,
		timestamp: Date.now()
	};

	localStorage.setItem('signLanguageTrainingData', JSON.stringify(data));
}

function loadStats() {
	// Contar muestras por letra
	const letterCounts = {};
	ALPHABET.forEach(letter => letterCounts[letter] = 0);
	trainingLabels.forEach(label => {
		if (label in letterCounts) letterCounts[label]++;
	});

	// Actualizar botones con indicador visual
	document.querySelectorAll('.letter-btn').forEach(btn => {
		const letter = btn.dataset.letter;
		const count = letterCounts[letter];

		btn.classList.remove('has-data');
		if (count > 0) {
			btn.classList.add('has-data');
		}
	});

	// Actualizar estadísticas
	const lettersWithData = Object.values(letterCounts).filter(count => count > 0).length;
}

async function captureSample() {
	if (!currentHandLandmarks || !selectedLetter) {
		console.log('Selecciona una letra y asegúrate de que tu mano sea visible', 'error');
		return;
	}

	// Extraer características
	const features = Utils.extractHandFeatures(currentHandLandmarks);

	if (!features) {
		console.log('No se pudieron extraer características de la mano', 'error');
		return;
	}

	// Añadir a datos de entrenamiento
	trainingData.push(features);
	trainingLabels.push(selectedLetter);

	// Guardar datos
	saveTrainingData();

	const sampleCount = trainingLabels.filter(label => label === selectedLetter).length;
	console.log(`✅ Muestra capturada para ${selectedLetter}. Total: ${sampleCount}`, 'success');

	loadStats();
}
