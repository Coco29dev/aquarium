/** Réduit une photo (JPEG, côté long ≤ maxSide) avant l'envoi : ~200–400 Ko au lieu de plusieurs Mo. */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
	if (!blob) throw new Error("Impossible de préparer l'image");
	return blob;
}
