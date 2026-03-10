export async function getAssetPath(relativePath: string): Promise<string> {
  try {
    if (typeof window !== 'undefined') {
      // If running in a dev server (http/https), prefer the web-served path
      if (window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
        return `/${relativePath.replace(/^\//, '')}`
      }

      if ((window as any).electronAPI && typeof (window as any).electronAPI.getAssetBasePath === 'function') {
        const base = await (window as any).electronAPI.getAssetBasePath()
        if (base) {
          const normalized = base.replace(/\\/g, '/')
          return `file://${normalized}/${relativePath}`
        }
      }
    }
  } catch (err) {
    // ignore and use fallback
  }

  // Fallback for web/dev server: public/wallpapers are served at '/wallpapers/...'
  return `/${relativePath.replace(/^\//, '')}`
}

const BASE64_CHUNK_SIZE = 0x8000
const localFileDataUrlCache = new Map<string, string>()

function toLocalFilePath(resourceUrl: string) {
  if (!resourceUrl.startsWith('file://')) {
    return null
  }

  const decodedPath = decodeURIComponent(resourceUrl.replace(/^file:\/\//, ''))
  if (/^\/[A-Za-z]:/.test(decodedPath)) {
    return decodedPath.slice(1)
  }

  return decodedPath
}

function getMimeTypeForAsset(resourceUrl: string) {
  const normalized = resourceUrl.split('?')[0].toLowerCase()

  if (normalized.endsWith('.png')) return 'image/png'
  if (normalized.endsWith('.webp')) return 'image/webp'
  if (normalized.endsWith('.gif')) return 'image/gif'
  if (normalized.endsWith('.svg')) return 'image/svg+xml'
  if (normalized.endsWith('.avif')) return 'image/avif'
  return 'image/jpeg'
}

function toBase64(bytes: Uint8Array) {
  let binary = ''

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(index, index + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export async function getRenderableAssetUrl(asset: string): Promise<string> {
  if (!asset || asset.startsWith('data:') || asset.startsWith('http') || asset.startsWith('#') || asset.startsWith('linear-gradient') || asset.startsWith('radial-gradient')) {
    return asset
  }

  const resolvedAsset = asset.startsWith('/') && !asset.startsWith('//')
    ? await getAssetPath(asset.replace(/^\//, ''))
    : asset

  const localFilePath = toLocalFilePath(resolvedAsset)
  if (!localFilePath || typeof window === 'undefined' || !window.electronAPI?.readLocalFile) {
    return resolvedAsset
  }

  const cached = localFileDataUrlCache.get(resolvedAsset)
  if (cached) {
    return cached
  }

  try {
    const result = await window.electronAPI.readLocalFile(localFilePath)
    if (!result.success || !result.data) {
      return resolvedAsset
    }

    const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data)
    const dataUrl = `data:${getMimeTypeForAsset(localFilePath)};base64,${toBase64(bytes)}`
    localFileDataUrlCache.set(resolvedAsset, dataUrl)
    return dataUrl
  } catch {
    return resolvedAsset
  }
}

export default getAssetPath;
