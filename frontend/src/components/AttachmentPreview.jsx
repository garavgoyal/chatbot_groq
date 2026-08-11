/**
 * Shows the currently staged file (picked but not sent yet).
 * attachment shape: { type: "image"|"doc", file: File, previewUrl?: string }
 */
function AttachmentPreview({ attachment, onRemove }) {
  if (!attachment) return null;

  return (
    <div className="attachment-preview">
      {attachment.type === "image" ? (
        <img src={attachment.previewUrl} alt="attachment preview" className="attachment-thumb" />
      ) : (
        <div className="attachment-thumb doc-thumb">📄</div>
      )}
      <span className="attachment-name">{attachment.file.name}</span>
      <button type="button" className="remove-attachment" onClick={onRemove} title="Remove">
        ✕
      </button>
    </div>
  );
}

export default AttachmentPreview;