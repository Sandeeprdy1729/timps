/**
 * TIMPS Desktop - Image
 * Image and media components.
 */

import { useState, useRef } from 'react';
import './Image.css';

interface ImageProps {
  src: string;
  alt?: string;
  fallback?: string;
  aspectRatio?: string;
}

export function Image({ src, alt, fallback, aspectRatio }: ImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <div className="image-container" style={{ aspectRatio }}>
      {loading && <div className="image-loading">Loading...</div>}
      {error ? (
        fallback ? (
          <img src={fallback} alt={alt} />
        ) : (
          <div className="image-error">Failed to load</div>
        )
      ) : (
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          onLoad={() => setLoading(false)}
          style={{ display: loading ? 'none' : 'block' }}
        />
      )}
    </div>
  );
}

interface GalleryProps {
  images: string[];
  onSelect?: (index: number) => void;
}

export function Gallery({ images, onSelect }: GalleryProps) {
  const [selected, setSelected] = useState(0);

  return (
    <div className="gallery">
      <div className="gallery-main">
        <img src={images[selected]} alt={`Image ${selected + 1}`} />
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails">
          {images.map((img, index) => (
            <button
              key={index}
              className={`gallery-thumb ${index === selected ? 'selected' : ''}`}
              onClick={() => {
                setSelected(index);
                onSelect?.(index);
              }}
            >
              <img src={img} alt={`Thumbnail ${index + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface VideoProps {
  src?: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
}

export function Video({ src, poster, autoplay, controls, loop }: VideoProps) {
  return (
    <video
      src={src}
      poster={poster}
      autoPlay={autoplay}
      controls={controls}
      loop={loop}
    />
  );
}

interface AudioProps {
  src?: string;
  controls?: boolean;
  autoplay?: boolean;
}

export function Audio({ src, controls, autoplay }: AudioProps) {
  return <audio src={src} controls={controls} autoPlay={autoplay} />;
}