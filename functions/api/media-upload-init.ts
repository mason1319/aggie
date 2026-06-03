import { onRequest as legacyOnRequest } from './media/upload/init'

export const onRequest = async (context: Parameters<typeof legacyOnRequest>[0]) => legacyOnRequest(context)
