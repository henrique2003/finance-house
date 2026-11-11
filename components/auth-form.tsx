import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signInAction, signUpAction } from '@/app/actions/auth'

type AuthFormProps = {
  mode: 'login' | 'signup'
  error?: string
  success?: string
  nextPath?: string
}

const messages: Record<string, string> = {
  credentials: 'E-mail ou senha inválidos. Confira os dados e tente novamente.',
  signup: 'Não foi possível concluir o cadastro. Confira os dados e tente novamente.',
  invalid: 'Informe um e-mail válido e uma senha com pelo menos 8 caracteres.',
  'invalid-email': 'Confira o formato do e-mail informado.',
  'weak-password': 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
  'rate-limit': 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
  unconfirmed: 'Confirme seu e-mail pelo link enviado antes de entrar.',
  unexpected: 'O acesso não pôde ser concluído. Tente novamente em instantes.',
}

export function AuthForm({ mode, error, success, nextPath = '/' }: AuthFormProps) {
  const isSignup = mode === 'signup'
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f3ef] px-5 py-12 text-[#17221f]">
      <section className="w-full max-w-md rounded-[28px] border border-[#dfe3dc] bg-[#fbfaf7] p-7 shadow-[0_28px_80px_rgba(23,34,31,0.08)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-[#18352d] text-sm font-semibold text-[#f6e8d3]">C</span>
          <span className="text-xl font-semibold tracking-[-0.04em]">Casa Clara</span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718079]">Finanças da casa</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{isSignup ? 'Crie seu acesso' : 'Bom ter você de volta'}</h1>
        <p className="mt-2 text-sm leading-6 text-[#758179]">{isSignup ? 'Comece um espaço financeiro compartilhado e convide quem mora com você.' : 'Entre para acompanhar o orçamento e os pagamentos da sua casa.'}</p>

        {error && <p role="alert" className="mt-5 rounded-xl border border-[#ead5ce] bg-[#fbefeb] px-4 py-3 text-sm text-[#8b5548]">{messages[error] ?? 'Não foi possível concluir. Tente novamente.'}</p>}
        {success === 'confirm' && <p role="status" className="mt-5 rounded-xl border border-[#d5e2d3] bg-[#edf4eb] px-4 py-3 text-sm text-[#315b43]">Cadastro iniciado. Confirme seu e-mail pelo link enviado para entrar.</p>}

        <form action={isSignup ? signUpAction : signInAction} className="mt-7 flex flex-col gap-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="flex flex-col gap-2 text-xs font-medium text-[#56635c]">E-mail
            <input required type="email" name="email" autoComplete="email" className="rounded-xl border border-[#dfe3dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#698872] focus:ring-2 focus:ring-[#698872]/15" placeholder="voce@email.com" />
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-[#56635c]">Senha
            <input required type="password" name="password" minLength={isSignup ? 8 : 1} autoComplete={isSignup ? 'new-password' : 'current-password'} className="rounded-xl border border-[#dfe3dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#698872] focus:ring-2 focus:ring-[#698872]/15" placeholder={isSignup ? 'Pelo menos 8 caracteres' : 'Sua senha'} />
          </label>
          <Button type="submit" size="lg" className="mt-2 h-auto w-full rounded-xl px-4 py-3.5">{isSignup ? 'Criar conta' : 'Entrar'}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-[#758179]">
          {isSignup ? 'Já tem acesso?' : 'Ainda não tem acesso?'}{' '}
          <Link href={isSignup ? `/auth/login?next=${encodeURIComponent(nextPath)}` : `/auth/sign-up?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#315b43] underline-offset-4 hover:underline">
            {isSignup ? 'Entrar' : 'Criar conta'}
          </Link>
        </p>
        <p className="mt-5 text-center text-xs leading-5 text-[#8a958e]">Sua sessão usa cookies seguros e expira após 7 dias.</p>
      </section>
    </main>
  )
}
