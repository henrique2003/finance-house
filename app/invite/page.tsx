import { redirect } from 'next/navigation'
import { acceptHouseholdInviteAction } from '@/app/actions/finance'
import { createClient } from '@/lib/supabase/server'

type Props = { searchParams: Promise<{ code?: string; error?: string }> }

export default async function InvitePage({ searchParams }: Props) {
  const params = await searchParams
  const code = params.code ?? ''
  if (!code || code.length > 80) redirect('/auth/login')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/invite?code=${code}`)}`)

  return <main className="flex min-h-screen items-center justify-center bg-[#f5f3ef] px-5 py-12 text-[#17221f]"><section className="w-full max-w-md rounded-[28px] border border-[#dfe3dc] bg-[#fbfaf7] p-8 shadow-[0_28px_80px_rgba(23,34,31,0.08)]"><div className="flex size-10 items-center justify-center rounded-2xl bg-[#18352d] font-semibold text-[#f6e8d3]">C</div><p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-[#718079]">Casa Clara</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Convite para compartilhar uma casa</h1><p className="mt-3 text-sm leading-6 text-[#758179]">Este link dá acesso aos dados financeiros da residência. Só aceite se reconhecer quem enviou o convite.</p>{params.error && <p role="alert" className="mt-4 rounded-xl bg-[#fbefeb] p-3 text-sm text-[#8b5548]">O convite expirou, já foi usado ou é inválido.</p>}<form action={acceptHouseholdInviteAction} className="mt-6"><input type="hidden" name="code" value={code} /><button className="w-full rounded-xl bg-[#18352d] px-4 py-3.5 text-sm font-semibold text-white">Aceitar convite</button></form></section></main>
}
