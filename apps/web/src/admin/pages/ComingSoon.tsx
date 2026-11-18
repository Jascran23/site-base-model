export function ComingSoon({ title, stage }: { title: string; stage: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-ink-500">Este módulo será implementado na {stage}.</p>
    </div>
  );
}
