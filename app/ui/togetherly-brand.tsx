import Image from "next/image";

export function TogetherlyBrand({ tagline = true }: { tagline?: boolean }) {
  return (
    <span className="togetherly-brand">
      <Image
        className="togetherly-mark"
        src="/togetherly-mark.svg"
        width={64}
        height={64}
        alt=""
        unoptimized
      />
      <span className="togetherly-copy">
        <strong className="togetherly-wordmark">
          Together<span>ly</span>
        </strong>
        {tagline && (
          <small className="togetherly-tagline">
            Because relationships deserve remembering.
          </small>
        )}
      </span>
    </span>
  );
}
