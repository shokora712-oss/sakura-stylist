type Props = {
  userName?: string;
  title: string;
  description?: string;
};

export default function AppHeader({
  userName,
  title,
  description,
}: Props) {
  return (
    <div className="mb-6">
      {/* 小：ブランド */}
      <p className="text-xs text-gray-400">Sakura Stylist</p>

      {/* 大：タイトル */}
      <h1 className="text-2xl font-bold text-[#0b2341] mt-1">
        {title}
      </h1>

      {/* 小：説明 */}
      {description && (
        <p className="text-sm text-gray-500 mt-1">
          {description}
        </p>
      )}
    </div>
  );
}