type Props = {
  userName?: string;
  title: string;
  description?: string;
};

export default function AppHeader({ userName, title, description }: Props) {
  return (
    <div className="mb-6">
      <p className="text-xs text-[#605D62]/60">
        {userName ? `こんにちは、${userName}さん` : "Sakura Stylist"}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[#605D62]">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-[#605D62]/60">{description}</p>
      )}
    </div>
  );
}