import { AuthForm } from '@/components/auth-form'

type Props = { searchParams: Promise<{ error?: string; success?: string; next?: string }> }

export default async function SignUpPage({ searchParams }: Props) {
  const params = await searchParams
  return <AuthForm mode="signup" error={params.error} success={params.success} nextPath={params.next ?? '/'} />
}
