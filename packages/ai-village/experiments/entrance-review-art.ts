// Only the local authenticated review harness aliases this module. Not a release entry.
import { entranceManifest } from '../src/entrance-manifest.ts'
import { validateEntranceTheme } from '../src/client/entrance-theme.ts'
export const entranceArt = validateEntranceTheme(entranceManifest)
export const entranceArtStatus = 'ART_REVIEW'
