type StatusCardProps = {
  label: string;
  value: string;
  accent?: "gold" | "blue" | "green";
};

export function StatusCard({ label, value, accent = "blue" }: StatusCardProps) {
  return (
    <div className={`status-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
