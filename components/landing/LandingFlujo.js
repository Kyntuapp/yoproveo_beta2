const STEPS = [
  {
    label: 'Publica tu necesidad',
    hint: 'Indica qué necesitas comprar en una solicitud clara.',
    core: false,
  },
  {
    label: 'Los proveedores presentan ofertas',
    hint: 'Recibes propuestas con precio, despacho y condiciones.',
    core: false,
  },
  {
    label: 'Kyntü organiza y destaca las mejores alternativas',
    hint: 'Las ofertas se ordenan para que compares con facilidad.',
    core: true,
  },
  {
    label: 'Compara y elige',
    hint: 'Decides considerando precio, despacho y condiciones.',
    core: false,
  },
];

export default function LandingFlujo() {
  return (
    <section className="landing-section" id="como-funciona">
      <div className="landing__inner landing__inner--narrow">
        <p className="landing-section__eyebrow">Proceso</p>
        <h2 className="landing-section__title">Cómo funciona Kyntü</h2>
        <div className="landing-flujo">
          {STEPS.map((step, index) => (
            <div
              key={step.label}
              className={
                step.core
                  ? 'landing-flujo__step landing-flujo__step--core'
                  : 'landing-flujo__step'
              }
            >
              <span className="landing-flujo__num">{index + 1}</span>
              <div className="landing-flujo__body">
                <p className="landing-flujo__label">{step.label}</p>
                {step.hint ? (
                  <p className="landing-flujo__hint">{step.hint}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
