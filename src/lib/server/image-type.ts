/** Type d'une image d'après ses premiers octets (jamais d'après le nom ni le type annoncé par le client). */
export function imageType(bytes: Uint8Array): { type: string; ext: string } | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return { type: 'image/jpeg', ext: 'jpg' };
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: 'image/png', ext: 'png' };
	if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57) {
		return { type: 'image/webp', ext: 'webp' };
	}
	return null;
}
