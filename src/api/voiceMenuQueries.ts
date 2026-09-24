import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as voiceMenuApi from './voiceMenu'

/** React Query hooks for ./voiceMenu.ts - kept out of the shared queries.ts so this
 * feature stays in files of its own; the API module stays mockable in tests. */

export function useVoiceMenu() {
  return useQuery({ queryKey: ['voiceMenu'], queryFn: voiceMenuApi.getVoiceMenu })
}

export function useUpdateVoiceMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: voiceMenuApi.VoiceMenuInput) => voiceMenuApi.updateVoiceMenu(data),
    onSuccess: (data) => qc.setQueryData(['voiceMenu'], data),
  })
}
