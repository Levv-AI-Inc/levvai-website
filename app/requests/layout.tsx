export default function NewRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}
