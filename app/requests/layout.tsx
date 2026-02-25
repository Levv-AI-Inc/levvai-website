export default function NewRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-full">
      <div className="mx-auto w-full max-w-5xl p-8">{children}</div>
    </div>
  );
}
