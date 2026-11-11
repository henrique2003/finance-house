import { AuthForm } from '@/components/auth-form'

type Props = { searchParams: Promise<{ error?: string; next?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  return <AuthForm mode="login" error={params.error} nextPath={params.next ?? '/'} />
}
