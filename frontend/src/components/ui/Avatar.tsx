import { assetUrl } from '../../api/client';
import { initials } from '../../utils/format';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  /** Diametro em pixels. */
  size?: number;
  className?: string;
}

/** Bolinha com a foto da pessoa; sem foto, mostra as iniciais. */
export function Avatar({ name, photoUrl, size = 32, className }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };

  return (
    <span className={`avatar${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      {photoUrl ? <img src={photoUrl.startsWith('blob:') ? photoUrl : assetUrl(photoUrl)} alt="" /> : initials(name)}
    </span>
  );
}
