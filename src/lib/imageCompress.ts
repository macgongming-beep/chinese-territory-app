// 클라이언트 사이드 이미지 압축 (canvas)
// - 너무 큰 사진(10MB+)을 화질 유지하면서 1-2MB로 축소
// - 의존성 없음, 모던 브라우저 + iOS Safari 16+

export type CompressOptions = {
  maxWidth?: number        // 최대 가로 픽셀 (default 1600)
  maxHeight?: number       // 최대 세로 픽셀 (default 1600)
  quality?: number         // JPEG 품질 0~1 (default 0.85)
  maxSizeMB?: number       // 목표 파일 크기 (이하 도달까지 quality 자동 감소)
  outputType?: 'image/jpeg' | 'image/webp'  // default 'image/jpeg'
}

export type CompressResult = {
  file: File
  width: number
  height: number
  originalSize: number
  finalSize: number
  ratio: number  // 0~1, 작을수록 더 압축됨
}

/**
 * 파일 → 압축된 새 File 반환.
 * 이미지가 아니면 그대로 반환.
 */
export async function compressImage(
  input: File,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.85,
    maxSizeMB = 1.5,
    outputType = 'image/jpeg',
  } = options

  const originalSize = input.size

  // 이미지 아니면 통과
  if (!input.type.startsWith('image/')) {
    return { file: input, width: 0, height: 0, originalSize, finalSize: originalSize, ratio: 1 }
  }

  // 1. File → ImageBitmap (Image 객체보다 빠르고 메모리 효율적)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(input)
  } catch (e) {
    console.warn('[imageCompress] createImageBitmap failed, fallback to Image:', e)
    bitmap = await loadViaImage(input)
  }

  // 2. 리사이즈 비율 계산
  const { width: srcW, height: srcH } = bitmap
  const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH)
  const targetW = Math.round(srcW * scale)
  const targetH = Math.round(srcH * scale)

  // 3. canvas 에 그리고 인코딩
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { file: input, width: srcW, height: srcH, originalSize, finalSize: originalSize, ratio: 1 }
  }
  // 부드러운 다운스케일링
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)

  // 4. quality 조절 루프 — 목표 크기 도달까지
  let q = quality
  let blob: Blob | null = null
  for (let i = 0; i < 5; i += 1) {
    blob = await canvasToBlob(canvas, outputType, q)
    if (!blob) break
    if (blob.size <= maxSizeMB * 1024 * 1024) break
    q = Math.max(0.5, q - 0.1)
  }
  if (!blob) {
    return { file: input, width: srcW, height: srcH, originalSize, finalSize: originalSize, ratio: 1 }
  }

  const ext = outputType === 'image/webp' ? 'webp' : 'jpg'
  const baseName = input.name.replace(/\.[^.]+$/, '')
  const newFile = new File([blob], `${baseName}.${ext}`, {
    type: outputType,
    lastModified: Date.now(),
  })

  return {
    file: newFile,
    width: targetW,
    height: targetH,
    originalSize,
    finalSize: blob.size,
    ratio: blob.size / originalSize,
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality)
  })
}

function loadViaImage(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      URL.revokeObjectURL(url)
      try {
        const bmp = await createImageBitmap(img)
        resolve(bmp)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽지 못했습니다.'))
    }
    img.src = url
  })
}
