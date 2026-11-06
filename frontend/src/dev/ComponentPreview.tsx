import type { ReactNode } from 'react'
import { Button, EmptyState, ErrorState, LoadingState, Notice, OfflineState, TextField } from '../components'

// Development only (component-preview.html): every shared piece next to the Figma frame it comes from,
// for checking by eye. Add ?lang=en to the address to see English.

function Example({ figma, children }: { figma: string; children: ReactNode }) {
  return (
    <figure style={{ margin: 0, width: 464 }}>
      <figcaption style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>{figma}</figcaption>
      {children}
    </figure>
  )
}

export function ComponentPreview() {
  return (
    <main style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: 32 }}>
      <Example figma="Buttons · A-15 100:1205, N-11 4039:3871, A-08 107:1814">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Button>Desactivar cuenta</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="link">¿Olvidaste tu contraseña?</Button>
          <Button disabled style={{ width: 160 }}>
            Guardar
          </Button>
          <Button size="large" fullWidth>
            Iniciar sesión
          </Button>
        </div>
      </Example>

      <Example figma="Fields · N-11 4039:3871 and A-08 107:1814">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextField label="Correo electrónico" type="email" defaultValue="mariel.velez@uprm.example.edu" />
          <TextField
            label="Motivo obligatorio"
            defaultValue="Error"
            error="Escribe un motivo de al menos 10 caracteres. Este motivo tiene 5."
          />
        </div>
      </Example>

      <Example figma="Notice · N-11 4039:3871">
        <Notice title="No pudimos iniciar sesión">Verifica tu correo y contraseña e intenta de nuevo.</Notice>
      </Example>

      <Example figma="Cargando · A-08 107:1884">
        <LoadingState detail="Buscando cuentas…" />
      </Example>

      <Example figma="Sin resultados · A-08 107:1898">
        <EmptyState
          lead="No encontramos cuentas para “Lidia Solís”."
          detail="Revisa el nombre o busca por correo electrónico."
        />
      </Example>

      <Example figma="Error al cargar · A-08 132:3759">
        <ErrorState onRetry={() => {}} />
      </Example>

      <Example figma="Sin conexión · A-08 132:3777">
        <OfflineState detail="Última actualización a las 10:42." />
      </Example>
    </main>
  )
}
