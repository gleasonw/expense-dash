export function Label({
  text,
  children,
  className,
}: {
  text: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col ${className}`}>
      <span className="text-sm text-gray-400">{text}</span>
      {children}
    </label>
  );
}
