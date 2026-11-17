export default function Biography({ text }: { text: string | null }) {
  const paragraphs = text?.split('\n').filter(Boolean) ?? [];
  if (!paragraphs.length) return <p className="bio-pending">A personal introduction is coming soon.</p>;

  return <div className="biography">
    {paragraphs.slice(0, 2).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {paragraphs.length > 2 && <details className="biography-story">
      <summary>
        <span className="story-read">Read My Story</span>
        <span className="story-close">Close My Story</span>
        <span className="story-symbol" aria-hidden="true"/>
      </summary>
      <div className="biography-rest">
        {paragraphs.slice(2).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    </details>}
  </div>;
}
