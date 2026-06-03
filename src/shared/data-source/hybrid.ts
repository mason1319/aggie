import { localContentSource } from './local'
import { remoteContentSource } from './remote'
import type { AppContentBundle, AppDataSource } from './types'

async function tryRemote(): Promise<AppContentBundle> {
  return await remoteContentSource.getContentBundle()
}

export const hybridContentSource: AppDataSource = {
  async getContentBundle() {
    try {
      return await tryRemote()
    } catch {
      return await localContentSource.getContentBundle()
    }
  },

  async saveContentBundle(bundle) {
    try {
      await remoteContentSource.saveContentBundle(bundle)
      return
    } catch {
      // 远端不可用时保证本地可用，保证演示与内容闭环
      await localContentSource.saveContentBundle(bundle)
    }
  },
}
