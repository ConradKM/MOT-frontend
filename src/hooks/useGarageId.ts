import { useParams } from 'react-router-dom'

/** Reads the :garageId path param. Only valid inside routes nested under Layout,
 * where it's guaranteed present (Layout redirects if it doesn't match the signed-in
 * employee's own garage). */
export function useGarageId(): string {
  const { garageId } = useParams<{ garageId: string }>()
  return garageId as string
}
