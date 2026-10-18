/** Maior lado, em pixels, de uma foto depois de reduzida para envio. */
const MAX_SIDE = 2048;
/** Fotos ate esse tamanho e dentro de MAX_SIDE vao como estao. */
const MAX_BYTES_AS_IS = 1.5 * 1024 * 1024;

const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Reduz fotos grandes antes do envio (os arquivos ficam no banco, e fotos de celular passam fácil de 5 MB).
 * Vira JPEG com o maior lado em 2048 px. Documentos, imagens pequenas e qualquer falha seguem o arquivo
 * original.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!RESIZABLE.has(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const largest = Math.max(bitmap.width, bitmap.height);
    if (largest <= MAX_SIDE && file.size <= MAX_BYTES_AS_IS) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(1, MAX_SIDE / largest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    // PNG com transparencia vira JPEG: fundo branco no lugar do transparente.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
