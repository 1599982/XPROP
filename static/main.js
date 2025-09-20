const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

const hands = new Hands({
	locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
})

hands.setOptions({
	maxNumHands: 2,
	modelComplexity: 1,
	minDetectionConfidence: 0.5,
	minTrackingConfidence: 0.5
})

hands.onResults((results) => {
	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.drawImage(results.image, 0, 0, canvas.width, canvas.height);

	if (results.multiHandLandmarks.length === 0) {
		return;
	}

	for (const landmarks of results.multiHandLandmarks) {
		drawConnectors(context, landmarks, HAND_CONNECTIONS, {
			color: "#00ff00",
			lineWidth: 3
		})
		drawLandmarks(context, landmarks, {
			color: "#ff0000",
			lineWidth: 1
		})
	}

	context.restore();
})

const camera = new Camera(video, {
	onFrame: async () => {
		await hands.send({image: video});
	},
	width: 1280,
	height: 720
})

camera.start();
