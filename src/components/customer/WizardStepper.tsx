export interface WizardStep {
  id: number
  label: string
}

interface Props {
  steps: WizardStep[]
  currentStep: number
}

export function WizardStepper({ steps, currentStep }: Props) {
  // Index-based rather than comparing ids numerically: the steps a customer
  // sees are built from the business's own configuration, so their ids are
  // not guaranteed to be a contiguous ascending run and `s.id < currentStep`
  // would mark the wrong ones done.
  const currentIndex = steps.findIndex((s) => s.id === currentStep)
  const current = steps[currentIndex]

  return (
    <div>
      <p className="text-sm font-medium text-slate-500">
        Step {currentIndex + 1} of {steps.length}
        {current ? `: ${current.label}` : ''}
      </p>
      <ol className="mt-3 flex items-center">
        {steps.map((s, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming'
          return (
            <li key={s.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    state === 'done'
                      ? 'bg-emerald-600 text-white'
                      : state === 'current'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    state === 'upcoming' ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && <span className="mx-3 h-px flex-1 bg-slate-200" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
