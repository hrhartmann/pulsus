import { useEffect, type ReactNode } from 'react'
import { Link, Route, Router, Switch, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { requestPersistence } from './db/db'
import { seedIfFirstRun } from './db/seed'
import { loadActive } from './lib/active'
import { ExerciseEditor } from './screens/ExerciseEditor'
import { ExercisesScreen } from './screens/ExercisesScreen'
import { HistoryScreen, SessionDetail } from './screens/HistoryScreen'
import { ImportScreen } from './screens/ImportScreen'
import { PlayerScreen } from './screens/PlayerScreen'
import { RoutineEditor } from './screens/RoutineEditor'
import { RoutinesScreen } from './screens/RoutinesScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export default function App() {
  useEffect(() => {
    void seedIfFirstRun()
    void requestPersistence()
  }, [])

  return (
    <Router hook={useHashLocation}>
      <ResumeActive />
      <Switch>
        <Route path="/play/:id" component={PlayerScreen} />
        <Route path="/rutina/:id" component={RoutineEditor} />
        <Route path="/ejercicio/:id" component={ExerciseEditor} />
        <Route path="/historial/:id" component={SessionDetail} />
        <Route path="/importar/:data" component={ImportScreen} />
        <Route>
          <TabLayout>
            <Switch>
              <Route path="/ejercicios" component={ExercisesScreen} />
              <Route path="/historial" component={HistoryScreen} />
              <Route path="/ajustes" component={SettingsScreen} />
              <Route component={RoutinesScreen} />
            </Switch>
          </TabLayout>
        </Route>
      </Switch>
      <UpdatePrompt />
    </Router>
  )
}

/** Si la app se recargó a mitad de una rutina (iOS a veces lo hace), vuelve al reproductor. */
function ResumeActive() {
  const [location, navigate] = useLocation()
  useEffect(() => {
    const active = loadActive()
    if (active && !active.state.finishedAt && location === '/') navigate(`/play/${active.routine.id}`, { replace: true })
    // solo al abrir la app
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

const TABS = [
  { href: '/', label: 'Rutinas', icon: '⚡' },
  { href: '/ejercicios', label: 'Ejercicios', icon: '💪' },
  { href: '/historial', label: 'Historial', icon: '📈' },
  { href: '/ajustes', label: 'Ajustes', icon: '⚙️' },
]

function TabLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  return (
    <div className="min-h-dvh pb-28">
      {children}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => {
            const active = t.href === '/' ? location === '/' : location.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href} className="press flex flex-1 flex-col items-center gap-0.5 pt-2.5 pb-1">
                <span className={`text-xl transition ${active ? '' : 'opacity-40 grayscale'}`}>{t.icon}</span>
                <span className={`text-[11px] font-semibold ${active ? 'text-ink' : 'text-faint'}`}>{t.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/** Aviso de nueva versión. No recarga sola para no cortar una rutina en curso. */
function UpdatePrompt() {
  const [location] = useLocation()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh || location.startsWith('/play')) return null
  return (
    <div className="animate-pop fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 pl-4 shadow-2xl">
      <div className="flex-1 text-sm">Hay una versión nueva de Pulsus.</div>
      <button type="button" onClick={() => void updateServiceWorker(true)} className="press rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
        Actualizar
      </button>
    </div>
  )
}
