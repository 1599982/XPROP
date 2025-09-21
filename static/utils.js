export function extractHandFeatures(landmarks) {
	if (!landmarks || landmarks.length === 0) return null;

	const features = [];

	// Coordenadas normalizadas respecto a la muñeca
	const wrist = landmarks[0];

	for (let i = 0; i < landmarks.length; i++) {
		features.push(landmarks[i].x - wrist.x);
		features.push(landmarks[i].y - wrist.y);
		features.push(landmarks[i].z - wrist.z);
	}

	// Distancias entre puntos clave (puntas de dedos)
	const fingerTips = [4, 8, 12, 16, 20];

	for (let i = 0; i < fingerTips.length; i++) {
		for (let j = i + 1; j < fingerTips.length; j++) {
			const p1 = landmarks[fingerTips[i]];
			const p2 = landmarks[fingerTips[j]];
			const dx = p1.x - p2.x;
			const dy = p1.y - p2.y;
			const dz = p1.z - p2.z;
			const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
			features.push(distance);
		}
	}

	// Ángulos entre dedos
	const fingerBases = [2, 5, 9, 13, 17];

	for (let i = 0; i < fingerTips.length; i++) {
		const tip = landmarks[fingerTips[i]];
		const base = landmarks[fingerBases[i]];
		const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
		features.push(angle);
	}

	// Distancias de dedos a la muñeca
	for (let i = 0; i < fingerTips.length; i++) {
		const tip = landmarks[fingerTips[i]];
		const dx = tip.x - wrist.x;
		const dy = tip.y - wrist.y;
		const dz = tip.z - wrist.z;
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
		features.push(distance);
	}

	return features;
}
