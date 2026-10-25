const MAX_BYTES = 200 * 1024

const loadImage = (file: File) => new Promise<{ image: HTMLImageElement; release: () => void }>((resolve, reject) => {
  const image = new Image()
  const source = URL.createObjectURL(file)
  image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(source) })
  image.onerror = () => { URL.revokeObjectURL(source); reject(new Error(`${file.name} could not be read as an image.`)) }
  image.src = source
})

const toBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) =>
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not compress this image.')), 'image/webp', quality))

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not encode the compressed image.'))
  reader.onerror = () => reject(new Error('Could not read the compressed image.'))
  reader.readAsDataURL(blob)
})

/** Resizes to at most 1600px and converts to WebP, lowering quality until the file is under 200 KB. */
export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
  const { image, release } = await loadImage(file)
  try {
    let scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Image compression is unavailable in this browser.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.68, 0.52]) {
        const blob = await toBlob(canvas, quality)
        if (blob.size <= MAX_BYTES) return await toDataUrl(blob)
      }
      scale *= 0.8
    }
    throw new Error(`${file.name} is still larger than 200 KB after compression. Choose a smaller image.`)
  } finally { release() }
}

export async function uploadPhoto(kind: 'model' | 'unit', entityId: string, dataUrl: string, altText: string) {
  const response = await fetch('/api/admin/photos', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, entityId, dataUrl, altText }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? 'Photo upload failed.')
}
