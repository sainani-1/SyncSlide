export function getFileExtension(name: string) {
  const match = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(name)
  return match?.[1]?.toLowerCase() || ''
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

export function isPdfFile(file: File) {
  return file.type === 'application/pdf' || getFileExtension(file.name) === 'pdf'
}

export function isPowerPointFile(file: File) {
  const ext = getFileExtension(file.name)
  return ext === 'pptx'
}

export function isLegacyPowerPointFile(file: File) {
  return getFileExtension(file.name) === 'ppt'
}

export function isPdfSlide(url: string, name: string) {
  return getFileExtension(url) === 'pdf' || getFileExtension(name) === 'pdf'
}
