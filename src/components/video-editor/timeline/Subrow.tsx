interface SubrowProps {
  children: React.ReactNode;
}

export default function Subrow({ children }: SubrowProps) {
  return (
    <div style={{ height: 50, position: "relative" }}>
      {children}
    </div>
  );
}