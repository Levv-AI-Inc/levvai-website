export default function NewRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen flex items-center justify-center">
      <div className="w-full max-w-5xl p-8">{children}</div>
    </div>
  );
}
