export type MediaKind = 'audio' | 'video'

export interface MediaAsset {
  id: string
  kind: MediaKind
  name: string
  mimeType: string
  dataUrl: string
  remoteUrl?: string
  createdAt: string
}

export interface MediaBinding {
  wordAudioAssetId?: string
  sentenceAudioAssetId?: string
}

export interface MediaLibrary {
  assets: MediaAsset[]
  itemBindings: Record<string, MediaBinding>
}
