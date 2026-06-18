import '../styles/MagnetPreview.css';

export default function MagnetPreview({
  imageUrl,
  title,
  shape = 'rectangle',
  size = 'card',
  className = '',
}) {
  const previewClassName = [
    'magnet-preview',
    `magnet-preview-${shape}`,
    `magnet-preview-${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={previewClassName}>
      <div className="magnet-preview-face">
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
        />
      </div>
    </div>
  );
}
