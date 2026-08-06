export default function KyntuStatusPage({
  title,
  message,
  eyebrow = 'Kyntü',
  loading = true,
  action,
  actionText,
}) {
  return (
    <main className="kyntu-status-page">
      <div className="kyntu-status-glow" />
      <section className="kyntu-status-card" aria-live="polite">
        <img src="/icono_1.png" alt="Kyntü" className="kyntu-status-logo" />
        <span className="kyntu-status-eyebrow">{eyebrow}</span>
        {loading && <span className="kyntu-status-spinner" aria-hidden="true" />}
        <h1>{title}</h1>
        {message && <p>{message}</p>}
        {action && actionText && (
          <button type="button" onClick={action}>{actionText}</button>
        )}
      </section>

      <style jsx>{`
        .kyntu-status-page { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; position: relative; overflow: hidden; box-sizing: border-box; padding: 24px; font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif; background: linear-gradient(145deg, #f8fbff, #eef5ff 52%, #f7fcfb); }
        .kyntu-status-glow { position: absolute; inset: 0; background: radial-gradient(circle at 15% 20%, rgba(23,107,255,.14), transparent 32%), radial-gradient(circle at 85% 80%, rgba(0,194,168,.12), transparent 30%); }
        .kyntu-status-card { position: relative; width: min(430px, 100%); box-sizing: border-box; padding: 38px 32px; text-align: center; border: 1px solid rgba(218,228,243,.95); border-radius: 28px; background: rgba(255,255,255,.94); box-shadow: 0 28px 70px rgba(20,55,120,.16); }
        .kyntu-status-logo { width: 72px; height: 72px; object-fit: contain; display: block; margin: 0 auto 12px; }
        .kyntu-status-eyebrow { display: block; color: #176bff; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .kyntu-status-spinner { display: block; width: 30px; height: 30px; margin: 22px auto 16px; border: 3px solid #dce7f8; border-top-color: #176bff; border-radius: 50%; animation: spin .8s linear infinite; }
        h1 { margin: 14px 0 8px; color: #061b41; font-size: clamp(23px, 5vw, 30px); line-height: 1.2; }
        p { margin: 0; color: #60708a; font-size: 15px; line-height: 1.65; }
        button { margin-top: 24px; border: 0; border-radius: 14px; padding: 13px 22px; color: #fff; background: linear-gradient(135deg, #176bff, #00afc8); font: inherit; font-weight: 800; cursor: pointer; box-shadow: 0 12px 25px rgba(23,107,255,.22); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
