import { entranceManifest } from '../entrance-manifest.ts'
import { validateEntranceArt } from './entrance-theme.ts'
export const entranceArt = validateEntranceArt(entranceManifest)
export const entranceArtStatus = entranceManifest.status
